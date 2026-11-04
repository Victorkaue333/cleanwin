//! Main window helpers: show/hide, view-mode sizing and exit flow.

use std::sync::atomic::Ordering;

use tauri::{AppHandle, LogicalSize, Manager};

use crate::services::settings::ViewMode;
use crate::services::AppState;

pub const MAIN_WINDOW: &str = "main";

/// Logical sizes for the two presentations (width, height, min width, min height).
pub fn size_for(mode: ViewMode) -> (f64, f64, f64, f64) {
    match mode {
        ViewMode::Compact => (560.0, 680.0, 520.0, 600.0),
        ViewMode::Full => (1120.0, 720.0, 940.0, 620.0),
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    if let Some(state) = app.try_state::<AppState>() {
        state.metrics.request_refresh();
    }
}

pub fn hide_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.hide();
    }
}

pub fn toggle_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let visible = w.is_visible().unwrap_or(false);
        let minimized = w.is_minimized().unwrap_or(false);
        let focused = w.is_focused().unwrap_or(false);
        if visible && !minimized && focused {
            hide_main(app);
        } else {
            show_main(app);
        }
    }
}

pub fn apply_view_mode(app: &AppHandle, mode: ViewMode) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let (width, height, min_w, min_h) = size_for(mode);
        let _ = w.set_min_size(Some(LogicalSize::new(min_w, min_h)));
        if !w.is_maximized().unwrap_or(false) {
            let _ = w.set_size(LogicalSize::new(width, height));
        }
    }
}

/// Mark that the user wants to quit and start the exit flow. Cleanup happens in
/// the `RunEvent::ExitRequested` handler in `lib.rs`.
pub fn request_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        state.exiting.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

/// Release OS resources we hold before the process ends.
pub fn cleanup(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        state.keep_awake.shutdown();
        state.desktop.restore_if_needed();
    }
}
