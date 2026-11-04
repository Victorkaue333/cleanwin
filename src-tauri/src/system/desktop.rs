//! Desktop "clean screen" helper: temporarily hide/show desktop icons.
//!
//! This sends the same `WM_COMMAND` (id `0x7402`) that Explorer's own
//! "View > Show desktop icons" menu item sends to the desktop list view host
//! (`SHELLDLL_DefView`). Nothing is deleted or moved; the state is read back
//! after toggling to confirm the change. If CleanWin hid the icons it restores
//! them on exit.

use std::sync::atomic::{AtomicBool, Ordering};

use crate::errors::{AppError, AppResult};

#[derive(Default)]
pub struct DesktopIcons {
    hidden_by_us: AtomicBool,
}

impl DesktopIcons {
    pub fn supported(&self) -> bool {
        cfg!(windows) && win::find_def_view().is_some()
    }

    /// `Some(visible)` when the desktop list view could be located.
    pub fn visible(&self) -> Option<bool> {
        win::icons_visible()
    }

    pub fn set_visible(&self, visible: bool) -> AppResult<bool> {
        let current = win::icons_visible()
            .ok_or_else(|| AppError::Unsupported("desktop list view not found".into()))?;
        if current == visible {
            return Ok(current);
        }
        win::toggle()?;
        // Explorer applies the change asynchronously; give it a moment.
        let mut after = win::icons_visible();
        for _ in 0..10 {
            if after == Some(visible) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(40));
            after = win::icons_visible();
        }
        let after = after
            .ok_or_else(|| AppError::Internal("desktop state unreadable after toggle".into()))?;
        if after != visible {
            return Err(AppError::Internal(
                "Explorer did not apply the desktop icons change".into(),
            ));
        }
        self.hidden_by_us.store(!visible, Ordering::SeqCst);
        Ok(after)
    }

    /// Restore icons if CleanWin was the one hiding them.
    pub fn restore_if_needed(&self) {
        if self.hidden_by_us.swap(false, Ordering::SeqCst) {
            let _ = self.set_visible(true);
        }
    }
}

#[cfg(windows)]
mod win {
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, IsWindowVisible, SendMessageW, WM_COMMAND,
    };

    use crate::errors::{AppError, AppResult};

    const TOGGLE_DESKTOP_ICONS: usize = 0x7402;

    pub fn find_def_view() -> Option<HWND> {
        // SAFETY: FindWindow* only read window handles; null results are handled.
        unsafe {
            if let Ok(progman) = FindWindowW(w!("Progman"), None) {
                if let Ok(def_view) =
                    FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), None)
                {
                    if !def_view.0.is_null() {
                        return Some(def_view);
                    }
                }
            }
            // When wallpaper slideshows / "spotlight" are active the desktop
            // view lives under one of the WorkerW windows instead.
            let mut worker: Option<HWND> = None;
            loop {
                let Ok(next) = FindWindowExW(None, worker, w!("WorkerW"), None) else {
                    break;
                };
                if next.0.is_null() {
                    break;
                }
                if let Ok(def_view) = FindWindowExW(Some(next), None, w!("SHELLDLL_DefView"), None)
                {
                    if !def_view.0.is_null() {
                        return Some(def_view);
                    }
                }
                worker = Some(next);
            }
        }
        None
    }

    fn list_view(def_view: HWND) -> Option<HWND> {
        unsafe {
            FindWindowExW(Some(def_view), None, w!("SysListView32"), None)
                .ok()
                .filter(|h| !h.0.is_null())
        }
    }

    pub fn icons_visible() -> Option<bool> {
        let def_view = find_def_view()?;
        let list = list_view(def_view)?;
        Some(unsafe { IsWindowVisible(list) }.as_bool())
    }

    pub fn toggle() -> AppResult<()> {
        let def_view = find_def_view()
            .ok_or_else(|| AppError::Unsupported("desktop list view not found".into()))?;
        unsafe {
            SendMessageW(
                def_view,
                WM_COMMAND,
                Some(WPARAM(TOGGLE_DESKTOP_ICONS)),
                Some(LPARAM(0)),
            );
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod win {
    use crate::errors::{AppError, AppResult};
    pub fn find_def_view() -> Option<()> {
        None
    }
    pub fn icons_visible() -> Option<bool> {
        None
    }
    pub fn toggle() -> AppResult<()> {
        Err(AppError::Unsupported("desktop icons".into()))
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Touches the real desktop (icons blink once). Run explicitly:
    /// `cargo test -- --ignored hide_and_restore_desktop_icons`.
    #[test]
    #[ignore]
    fn hide_and_restore_desktop_icons() {
        let d = DesktopIcons::default();
        assert!(d.supported(), "SHELLDLL_DefView not found");
        let initial = d.visible().expect("desktop state readable");
        assert!(!d.set_visible(false).unwrap());
        assert_eq!(d.visible(), Some(false));
        assert!(d.set_visible(true).unwrap());
        assert_eq!(d.visible(), Some(true));
        let _ = d.set_visible(initial);
        d.restore_if_needed();
        assert_eq!(d.visible(), Some(true));
    }
}
