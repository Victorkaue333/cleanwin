//! Tauri commands exposed to the frontend. Documented in `docs/api/tauri-commands.md`.
//!
//! Every command validates its input here and delegates to `system::*` /
//! `services::*`. Long-running work (scan, clean) runs on a blocking thread and
//! streams progress through an IPC `Channel`.

use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

use crate::errors::{AppError, AppResult};
use crate::models::*;
use crate::services::settings::{Settings, ViewMode};
use crate::services::{window, AppState};
use crate::system::cleaner::{self, ScanOptions, ScanSession};
use crate::system::{processes, recycle_bin};

pub const REPOSITORY_URL: &str = "https://github.com/Victorkaue333/cleanwin";

// ---------------------------------------------------------------------------
// App / window
// ---------------------------------------------------------------------------

/// Called once by the frontend when React has mounted. Shows the window unless
/// the app was started minimized (autostart `--minimized` or the setting).
#[tauri::command]
pub fn frontend_ready(app: AppHandle, state: State<'_, AppState>) -> AppResult<bool> {
    let settings = state.settings.get();
    let launched_minimized = state.launched_minimized.load(Ordering::SeqCst);
    let keep_hidden = (launched_minimized || settings.start_minimized)
        && !state.window_revealed.load(Ordering::SeqCst);
    window::apply_view_mode(&app, settings.view_mode);
    if keep_hidden {
        log::info!("starting minimized to tray");
        state.window_revealed.store(true, Ordering::SeqCst);
        return Ok(false);
    }
    state.window_revealed.store(true, Ordering::SeqCst);
    window::show_main(&app);
    Ok(true)
}

#[tauri::command]
pub fn get_app_info(app: AppHandle, state: State<'_, AppState>) -> AppResult<AppInfo> {
    let config = app.config();
    Ok(AppInfo {
        name: config
            .product_name
            .clone()
            .unwrap_or_else(|| "CleanWin".into()),
        version: config.version.clone().unwrap_or_else(|| "0.0.0".into()),
        identifier: config.identifier.clone(),
        config_dir: state
            .settings
            .path()
            .parent()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        log_dir: app
            .path()
            .app_log_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        repository: REPOSITORY_URL.into(),
        elevated: is_elevated(),
        debug: cfg!(debug_assertions),
    })
}

#[tauri::command]
pub fn set_view_mode(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: ViewMode,
) -> AppResult<Settings> {
    let saved = state.settings.update(|s| s.view_mode = mode)?;
    window::apply_view_mode(&app, mode);
    Ok(saved)
}

#[tauri::command]
pub fn hide_to_tray(app: AppHandle) {
    window::hide_main(&app);
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    window::request_exit(&app);
}

#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> AppResult<()> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(AppError::InvalidOperation(
            "only http(s) URLs can be opened".into(),
        ));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// Reveal a folder CleanWin itself reported (config/log dir or a scan root).
#[tauri::command]
pub fn reveal_path(app: AppHandle, state: State<'_, AppState>, path: String) -> AppResult<()> {
    // Compare canonical forms: %TEMP% may be an 8.3 short path while scan
    // results report the long canonical path.
    let candidate =
        std::fs::canonicalize(&path).map_err(|_| AppError::NotFound(format!("path {path}")))?;
    let mut allowed_roots: Vec<std::path::PathBuf> = Vec::new();
    allowed_roots.extend(state.settings.path().parent().map(|p| p.to_path_buf()));
    allowed_roots.extend(app.path().app_log_dir().ok());
    for category in cleaner::categories() {
        allowed_roots.extend(category.roots.iter().cloned());
    }
    let allowed = allowed_roots
        .iter()
        .filter_map(|p| std::fs::canonicalize(p).ok())
        .any(|p| p == candidate);
    if !allowed {
        return Err(AppError::InvalidOperation(
            "path is not one CleanWin reported".into(),
        ));
    }
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| AppError::Internal(e.to_string()))
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_system_snapshot(state: State<'_, AppState>) -> AppResult<Option<SystemSnapshot>> {
    if let Some(err) = state.metrics.init_error.lock().expect("mutex").clone() {
        return Err(AppError::Internal(err));
    }
    Ok(state.metrics.latest())
}

#[tauri::command]
pub fn get_system_info(state: State<'_, AppState>) -> AppResult<Option<StaticSystemInfo>> {
    Ok(state.metrics.static_info())
}

#[tauri::command]
pub fn request_metrics_refresh(state: State<'_, AppState>) {
    state.metrics.request_refresh();
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_processes(state: State<'_, AppState>) -> AppResult<Vec<ProcessInfo>> {
    Ok(state.metrics.processes())
}

#[tauri::command]
pub async fn kill_process(state: State<'_, AppState>, pid: u32) -> AppResult<KillResult> {
    let own_pid = std::process::id();
    let cached = state
        .metrics
        .processes()
        .into_iter()
        .find(|p| p.pid == pid)
        .map(|p| p.name);
    let name = match cached {
        Some(n) => n,
        None => tauri::async_runtime::spawn_blocking(move || processes::lookup_name(pid))
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("pid {pid} no longer exists")))?,
    };
    let message_name = name.clone();
    tauri::async_runtime::spawn_blocking(move || processes::terminate(pid, &name, own_pid))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;
    state.metrics.request_refresh();
    Ok(KillResult {
        pid,
        success: true,
        message: format!("{message_name} terminated"),
    })
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_clean_categories() -> Vec<CleanCategoryInfo> {
    cleaner::categories().iter().map(|c| c.info()).collect()
}

#[tauri::command]
pub async fn scan_cleanup(
    state: State<'_, AppState>,
    categories: Vec<String>,
    on_event: Channel<ScanEvent>,
) -> AppResult<ScanSummary> {
    if categories.is_empty() {
        return Err(AppError::InvalidOperation(
            "select at least one category".into(),
        ));
    }
    let defs: Vec<_> = cleaner::categories()
        .into_iter()
        .filter(|d| categories.iter().any(|c| c == d.id))
        .collect();
    if defs.is_empty() {
        return Err(AppError::NotFound("no known category selected".into()));
    }
    let settings = state.settings.get();
    let opts = ScanOptions {
        skip_recent: settings.cleaning.skip_recent_files,
        recent_window: Duration::from_secs(u64::from(settings.cleaning.recent_hours) * 3600),
    };
    state.cleaner.begin()?;
    log::info!("scan started: {:?}", categories);
    let metrics = state.metrics.clone();
    let cancel_flag = state.cleaner.cancel_flag();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let cancel = cancel_flag.as_ref();
        let started = Instant::now();
        let mut session = ScanSession {
            id: cleaner::new_session_id(),
            created: Instant::now(),
            categories: HashMap::new(),
        };
        let mut results = Vec::new();
        for def in &defs {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            let _ = on_event.send(ScanEvent::CategoryStarted { id: def.id.into() });
            let id = def.id.to_string();
            let ch = on_event.clone();
            let scanned = cleaner::scan_category(def, opts, cancel, |files, bytes| {
                let _ = ch.send(ScanEvent::Progress {
                    id: id.clone(),
                    file_count: files,
                    total_bytes: bytes,
                });
            });
            let result = scanned.to_result();
            let _ = on_event.send(ScanEvent::CategoryFinished {
                result: result.clone(),
            });
            results.push(result);
            session.categories.insert(def.id.to_string(), scanned);
        }
        let cancelled = cancel.load(Ordering::Relaxed);
        let summary = ScanSummary {
            session_id: session.id.clone(),
            duration_ms: started.elapsed().as_millis() as u64,
            total_files: results.iter().map(|r| r.file_count).sum(),
            total_bytes: results.iter().map(|r| r.total_bytes).sum(),
            categories: results,
            cancelled,
        };
        (session, summary)
    })
    .await;
    state.cleaner.end();
    let (session, summary) = result.map_err(|e| AppError::Internal(e.to_string()))?;
    log::info!(
        "scan finished: {} files, {} bytes, {} categories, cancelled={}",
        summary.total_files,
        summary.total_bytes,
        summary.categories.len(),
        summary.cancelled
    );
    state.cleaner.store_session(session);
    metrics.request_refresh();
    Ok(summary)
}

#[tauri::command]
pub async fn clean_files(
    state: State<'_, AppState>,
    request: CleanRequest,
    on_event: Channel<CleanEvent>,
) -> AppResult<CleanSummary> {
    if request.categories.is_empty() {
        return Err(AppError::InvalidOperation(
            "select at least one category".into(),
        ));
    }
    state.cleaner.begin()?;
    let session = match state.cleaner.take_session(&request.session_id) {
        Ok(s) => s,
        Err(err) => {
            state.cleaner.end();
            return Err(err);
        }
    };
    log::info!("clean started: {:?}", request.categories);
    let cancel_flag = state.cleaner.cancel_flag();
    let selected = request.categories.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let cancel = cancel_flag.as_ref();
        let started = Instant::now();
        let mut results = Vec::new();
        for id in &selected {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            let Some(cat) = session.categories.get(id) else {
                log::warn!("category {id} not part of the scan session; skipped");
                continue;
            };
            let _ = on_event.send(CleanEvent::CategoryStarted {
                id: id.clone(),
                file_count: cat.files.len() as u64,
            });
            let ch = on_event.clone();
            let cid = id.clone();
            let res = cleaner::clean_category(
                cat,
                cancel,
                |processed, deleted, freed, locked, failed| {
                    let _ = ch.send(CleanEvent::Progress {
                        id: cid.clone(),
                        processed,
                        deleted_files: deleted,
                        freed_bytes: freed,
                        locked_files: locked,
                        failed_files: failed,
                    });
                },
            );
            let _ = on_event.send(CleanEvent::CategoryFinished {
                result: res.clone(),
            });
            results.push(res);
        }
        CleanSummary {
            duration_ms: started.elapsed().as_millis() as u64,
            deleted_files: results.iter().map(|r| r.deleted_files).sum(),
            freed_bytes: results.iter().map(|r| r.freed_bytes).sum(),
            locked_files: results.iter().map(|r| r.locked_files).sum(),
            failed_files: results.iter().map(|r| r.failed_files).sum(),
            categories: results,
            cancelled: cancel.load(Ordering::Relaxed),
        }
    })
    .await;
    state.cleaner.end();
    state.metrics.request_refresh();
    let summary = result.map_err(|e| AppError::Internal(e.to_string()))?;
    log::info!(
        "clean finished: {} deleted, {} bytes freed, {} locked, {} failed, cancelled={}",
        summary.deleted_files,
        summary.freed_bytes,
        summary.locked_files,
        summary.failed_files,
        summary.cancelled
    );
    Ok(summary)
}

#[tauri::command]
pub fn cancel_cleanup(state: State<'_, AppState>) {
    state.cleaner.request_cancel();
}

// ---------------------------------------------------------------------------
// Recycle bin & utilities
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_recycle_bin_info() -> AppResult<RecycleBinInfo> {
    tauri::async_runtime::spawn_blocking(recycle_bin::query)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn empty_recycle_bin(state: State<'_, AppState>) -> AppResult<RecycleBinResult> {
    let result = tauri::async_runtime::spawn_blocking(recycle_bin::empty)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    state.metrics.request_refresh();
    result
}

#[tauri::command]
pub fn get_utilities_state(state: State<'_, AppState>) -> UtilitiesState {
    UtilitiesState {
        keep_awake: state.keep_awake.is_enabled(),
        desktop_icons_visible: state.desktop.visible(),
        desktop_icons_supported: state.desktop.supported(),
    }
}

#[tauri::command]
pub fn set_keep_awake(state: State<'_, AppState>, enabled: bool) -> AppResult<UtilitiesState> {
    state.keep_awake.set(enabled)?;
    Ok(get_utilities_state(state))
}

#[tauri::command]
pub fn set_desktop_icons_visible(
    state: State<'_, AppState>,
    visible: bool,
) -> AppResult<UtilitiesState> {
    state.desktop.set_visible(visible)?;
    Ok(get_utilities_state(state))
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.get()
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> AppResult<Settings> {
    let previous = state.settings.get();
    let saved = state.settings.replace(settings)?;

    state
        .metrics
        .set_interval(u64::from(saved.refresh_interval_ms));

    if saved.launch_at_startup != previous.launch_at_startup {
        let manager = app.autolaunch();
        let result = if saved.launch_at_startup {
            manager.enable()
        } else {
            manager.disable()
        };
        if let Err(err) = result {
            // Roll back the flag so the UI never shows a state that is not real.
            let _ = state
                .settings
                .update(|s| s.launch_at_startup = previous.launch_at_startup);
            return Err(AppError::Internal(format!("autostart: {err}")));
        }
    }
    if saved.view_mode != previous.view_mode {
        window::apply_view_mode(&app, saved.view_mode);
    }
    Ok(saved)
}

/// Reconcile the stored flag with the real autostart entry (the user may have
/// removed it from Task Manager > Startup).
#[tauri::command]
pub fn get_autostart_enabled(app: AppHandle) -> AppResult<bool> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| AppError::Internal(format!("autostart: {e}")))
}

// ---------------------------------------------------------------------------

#[cfg(windows)]
fn is_elevated() -> bool {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let mut token = HANDLE::default();
    // SAFETY: documented token query on our own process; handle closed below.
    unsafe {
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut std::ffi::c_void),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        )
        .is_ok();
        let _ = CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
fn is_elevated() -> bool {
    false
}
