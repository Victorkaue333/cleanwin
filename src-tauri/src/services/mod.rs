//! Application services: background metrics loop, tray, window and settings.

pub mod metrics_loop;
pub mod settings;
pub mod tray;
pub mod window;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::system::cleaner::CleanerState;
use crate::system::desktop::DesktopIcons;
use crate::system::power::KeepAwake;

/// Everything the commands need, managed once by Tauri.
pub struct AppState {
    pub settings: settings::SettingsStore,
    pub metrics: Arc<metrics_loop::MetricsShared>,
    pub cleaner: CleanerState,
    pub keep_awake: KeepAwake,
    pub desktop: DesktopIcons,
    /// `--minimized` was passed on the command line (autostart).
    pub launched_minimized: AtomicBool,
    /// The frontend already asked to show the window once.
    pub window_revealed: AtomicBool,
    /// Set when the user explicitly chose "Exit" (tray or settings).
    pub exiting: AtomicBool,
}
