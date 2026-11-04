//! Per-user "always show the tray icon" preference.
//!
//! Windows 10/11 keep one registry key per notification-area icon under
//! `HKCU\Control Panel\NotifyIconSettings\<id>`. Explorer creates it the first
//! time an icon is shown; its `IsPromoted` DWORD (1 = always visible, absent =
//! hidden in the overflow "^" menu) is the same switch the Settings app toggles.
//!
//! This is the only registry write CleanWin performs besides the opt-in
//! autostart entry: it is per-user, reversible (deleting the value restores the
//! default) and only touches the entry whose `ExecutablePath` is this exe.

use std::path::Path;

use crate::errors::{AppError, AppResult};
#[cfg(any(windows, test))]
use crate::system::cleaner::display_path;

/// Case-insensitive comparison of a registry `ExecutablePath` with `b`, after
/// canonicalising both sides (falling back to the raw text when a path does not
/// exist) and stripping the `\\?\` verbatim prefix.
#[cfg(any(windows, test))]
fn same_executable(a: &str, b: &Path) -> bool {
    let normalise = |p: &Path| {
        let resolved = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
        display_path(&resolved).replace('/', "\\").to_lowercase()
    };
    !a.trim().is_empty() && normalise(Path::new(a.trim())) == normalise(b)
}

/// `None` when the tray entry is not registered yet; otherwise whether
/// `IsPromoted` is a non-zero DWORD.
pub fn is_promoted() -> AppResult<Option<bool>> {
    imp::is_promoted()
}

/// Pin (`true`) or unpin (`false`) the icon. Returns the real state afterwards.
/// `NotFound` while Explorer has not registered the icon yet.
pub fn set_promoted(enabled: bool) -> AppResult<bool> {
    imp::set_promoted(enabled)
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::{w, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{
        ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_NO_MORE_ITEMS, WIN32_ERROR,
    };
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, RegSetValueExW,
        HKEY, HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, REG_DWORD, RRF_RT_REG_DWORD,
        RRF_RT_REG_SZ,
    };

    const ROOT: &str = r"Control Panel\NotifyIconSettings";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn registry_error(op: &str, code: WIN32_ERROR) -> AppError {
        if code == ERROR_ACCESS_DENIED {
            AppError::PermissionDenied(format!("registry {op}: access denied"))
        } else {
            AppError::Internal(format!("registry {op} failed (error {})", code.0))
        }
    }

    /// Closes the wrapped key on drop so every exit path releases the handle.
    struct KeyGuard(HKEY);

    impl Drop for KeyGuard {
        fn drop(&mut self) {
            // SAFETY: the handle was opened by RegOpenKeyExW and is closed exactly once.
            unsafe {
                let _ = RegCloseKey(self.0);
            }
        }
    }

    fn open(
        path: &str,
        access: windows::Win32::System::Registry::REG_SAM_FLAGS,
    ) -> Result<Option<KeyGuard>, WIN32_ERROR> {
        let path = wide(path);
        let mut key = HKEY::default();
        // SAFETY: `path` is NUL-terminated and outlives the call; `key` receives the handle.
        let status = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(path.as_ptr()),
                None,
                access,
                &mut key,
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            Ok(None)
        } else if status.0 != 0 {
            Err(status)
        } else {
            Ok(Some(KeyGuard(key)))
        }
    }

    /// Read a REG_SZ value of `HKCU\<ROOT>\<sub>`; `None` when absent.
    fn read_string(sub: &str, name: PCWSTR) -> AppResult<Option<String>> {
        let path = wide(&format!(r"{ROOT}\{sub}"));
        let mut bytes = 0u32;
        // SAFETY: size query only (null data pointer); all pointers are valid for the call.
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                PCWSTR(path.as_ptr()),
                name,
                RRF_RT_REG_SZ,
                None,
                None,
                Some(&mut bytes),
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if status.0 != 0 {
            return Err(registry_error("read", status));
        }
        let mut buf = vec![0u16; (bytes as usize).div_ceil(2) + 1];
        let mut capacity = (buf.len() * 2) as u32;
        // SAFETY: `buf` holds `capacity` bytes; RRF_RT_REG_SZ guarantees NUL termination.
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                PCWSTR(path.as_ptr()),
                name,
                RRF_RT_REG_SZ,
                None,
                Some(buf.as_mut_ptr().cast()),
                Some(&mut capacity),
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if status.0 != 0 {
            return Err(registry_error("read", status));
        }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Ok(Some(String::from_utf16_lossy(&buf[..end])))
    }

    /// Name of the NotifyIconSettings subkey whose `ExecutablePath` is this exe.
    fn find_entry() -> AppResult<Option<String>> {
        let exe = std::env::current_exe()?;
        let Some(root) = open(ROOT, KEY_READ).map_err(|c| registry_error("open", c))? else {
            return Ok(None);
        };
        let mut index = 0u32;
        loop {
            let mut name = [0u16; 256];
            let mut len = name.len() as u32;
            // SAFETY: `name` has `len` UTF-16 units; the optional out-pointers are unused (None).
            let status = unsafe {
                RegEnumKeyExW(
                    root.0,
                    index,
                    Some(PWSTR(name.as_mut_ptr())),
                    &mut len,
                    None,
                    None,
                    None,
                    None,
                )
            };
            if status == ERROR_NO_MORE_ITEMS {
                return Ok(None);
            }
            if status.0 != 0 {
                return Err(registry_error("enumerate", status));
            }
            index += 1;
            let sub = String::from_utf16_lossy(&name[..len as usize]);
            if let Ok(Some(path)) = read_string(&sub, w!("ExecutablePath")) {
                if same_executable(&path, &exe) {
                    return Ok(Some(sub));
                }
            }
        }
    }

    fn read_promoted(sub: &str) -> AppResult<bool> {
        let path = wide(&format!(r"{ROOT}\{sub}"));
        let mut value = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        // SAFETY: `value` is a 4-byte buffer matching `size`; path is NUL-terminated.
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                PCWSTR(path.as_ptr()),
                w!("IsPromoted"),
                RRF_RT_REG_DWORD,
                None,
                Some((&mut value as *mut u32).cast()),
                Some(&mut size),
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            Ok(false)
        } else if status.0 != 0 {
            Err(registry_error("read", status))
        } else {
            Ok(value != 0)
        }
    }

    pub fn is_promoted() -> AppResult<Option<bool>> {
        match find_entry()? {
            Some(sub) => read_promoted(&sub).map(Some),
            None => Ok(None),
        }
    }

    pub fn set_promoted(enabled: bool) -> AppResult<bool> {
        let sub = find_entry()?
            .ok_or_else(|| AppError::NotFound("tray icon entry not registered yet".into()))?;
        let key = open(&format!(r"{ROOT}\{sub}"), KEY_SET_VALUE)
            .map_err(|c| registry_error("open", c))?
            .ok_or_else(|| AppError::NotFound("tray icon entry not registered yet".into()))?;
        if enabled {
            let data = 1u32.to_le_bytes();
            // SAFETY: valid key opened with KEY_SET_VALUE; `data` is a 4-byte REG_DWORD payload.
            let status =
                unsafe { RegSetValueExW(key.0, w!("IsPromoted"), None, REG_DWORD, Some(&data)) };
            if status.0 != 0 {
                return Err(registry_error("write", status));
            }
        } else {
            // SAFETY: valid key opened with KEY_SET_VALUE; the value name is a NUL-terminated literal.
            let status = unsafe { RegDeleteValueW(key.0, w!("IsPromoted")) };
            if status.0 != 0 && status != ERROR_FILE_NOT_FOUND {
                return Err(registry_error("delete", status));
            }
        }
        drop(key);
        read_promoted(&sub)
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;

    pub fn is_promoted() -> AppResult<Option<bool>> {
        Err(AppError::Unsupported(
            "tray icon preference requires Windows".into(),
        ))
    }

    pub fn set_promoted(_enabled: bool) -> AppResult<bool> {
        Err(AppError::Unsupported(
            "tray icon preference requires Windows".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_executable_ignores_case_and_spelling() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("CleanWin.exe");
        std::fs::write(&exe, b"x").unwrap();
        let other = dir.path().join("Other.exe");
        std::fs::write(&other, b"x").unwrap();

        let plain = exe.display().to_string();
        assert!(same_executable(&plain, &exe));
        assert!(same_executable(&plain.to_uppercase(), &exe));
        assert!(same_executable(&plain.to_lowercase(), &exe));

        let canonical = std::fs::canonicalize(&exe).unwrap();
        assert!(same_executable(&canonical.display().to_string(), &exe));

        let roundabout = dir
            .path()
            .join("sub")
            .join("..")
            .join("CleanWin.exe")
            .display()
            .to_string();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        assert!(same_executable(&roundabout, &exe));

        assert!(!same_executable(&other.display().to_string(), &exe));
        assert!(!same_executable("", &exe));
    }

    /// Read-only probe against the real registry: `cargo test -- --ignored`.
    #[test]
    #[ignore = "reads the live HKCU registry"]
    fn live_is_promoted_does_not_fail() {
        let state = is_promoted();
        println!("is_promoted = {state:?}");
        assert!(state.is_ok());
    }
}
