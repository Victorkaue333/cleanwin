//! Recycle Bin integration through the Shell API (`SHQueryRecycleBinW`,
//! `SHEmptyRecycleBinW`). The confirmation dialog is CleanWin's own; the
//! shell's dialog, progress UI and sound are suppressed.

use crate::errors::AppResult;
use crate::models::{RecycleBinInfo, RecycleBinResult};

#[cfg(windows)]
pub fn query() -> AppResult<RecycleBinInfo> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};

    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        i64Size: 0,
        i64NumItems: 0,
    };
    // SAFETY: `info` is a properly sized, initialised out-parameter; a null
    // root path means "all drives".
    unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }
        .map_err(|e| crate::errors::AppError::Internal(format!("SHQueryRecycleBin: {e}")))?;
    Ok(RecycleBinInfo {
        item_count: info.i64NumItems.max(0) as u64,
        size_bytes: info.i64Size.max(0) as u64,
    })
}

#[cfg(windows)]
pub fn empty() -> AppResult<RecycleBinResult> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{
        SHEmptyRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI, SHERB_NOSOUND,
    };

    let before = query()?;
    if before.item_count == 0 {
        return Ok(RecycleBinResult {
            emptied: false,
            was_empty: true,
            freed_bytes: 0,
            item_count: 0,
        });
    }
    let flags = SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND;
    // SAFETY: documented shell call; no window handle is required.
    let result = unsafe { SHEmptyRecycleBinW(None, PCWSTR::null(), flags) };
    match result {
        Ok(()) => {}
        Err(err) => {
            // Some builds answer E_UNEXPECTED when the bin became empty meanwhile.
            let after = query().unwrap_or(RecycleBinInfo {
                item_count: 1,
                size_bytes: 0,
            });
            if after.item_count != 0 {
                return Err(crate::errors::AppError::Internal(format!(
                    "SHEmptyRecycleBin: {err}"
                )));
            }
        }
    }
    let after = query().unwrap_or(RecycleBinInfo {
        item_count: 0,
        size_bytes: 0,
    });
    Ok(RecycleBinResult {
        emptied: true,
        was_empty: false,
        freed_bytes: before.size_bytes.saturating_sub(after.size_bytes),
        item_count: before.item_count.saturating_sub(after.item_count),
    })
}

#[cfg(not(windows))]
pub fn query() -> AppResult<RecycleBinInfo> {
    Err(crate::errors::AppError::Unsupported("recycle bin".into()))
}

#[cfg(not(windows))]
pub fn empty() -> AppResult<RecycleBinResult> {
    Err(crate::errors::AppError::Unsupported("recycle bin".into()))
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn query_works_on_windows() {
        // Read-only: never empties the bin in tests.
        let info = super::query().expect("SHQueryRecycleBin must succeed");
        assert!(info.item_count < u64::MAX);
    }
}
