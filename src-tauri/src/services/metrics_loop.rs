//! Background metrics loop.
//!
//! A single OS thread owns the `MetricsCollector`, refreshes it on the
//! configured interval and pushes every snapshot to the webview through the
//! `metrics:update` event. When the window is hidden or minimized the loop
//! slows down to `HIDDEN_INTERVAL_MS` (the tray tooltip still needs numbers)
//! instead of stopping, so the UI is fresh the moment it is shown again.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};

use crate::models::{ProcessInfo, StaticSystemInfo, SystemSnapshot};
use crate::services::tray;
use crate::system::metrics::MetricsCollector;

pub const METRICS_EVENT: &str = "metrics:update";
pub const HIDDEN_INTERVAL_MS: u64 = 5_000;

#[derive(Default)]
pub struct MetricsShared {
    pub latest: Mutex<Option<SystemSnapshot>>,
    pub processes: Mutex<Vec<ProcessInfo>>,
    pub static_info: Mutex<Option<StaticSystemInfo>>,
    pub interval_ms: AtomicU64,
    pub ready: AtomicBool,
    pub init_error: Mutex<Option<String>>,
    /// Bumped by the frontend to request an immediate refresh.
    pub refresh_requested: AtomicBool,
}

impl MetricsShared {
    pub fn new(interval_ms: u64) -> Self {
        Self {
            interval_ms: AtomicU64::new(interval_ms),
            ..Default::default()
        }
    }

    pub fn set_interval(&self, ms: u64) {
        self.interval_ms.store(ms, Ordering::Relaxed);
    }

    pub fn latest(&self) -> Option<SystemSnapshot> {
        self.latest.lock().expect("metrics mutex poisoned").clone()
    }

    pub fn processes(&self) -> Vec<ProcessInfo> {
        self.processes
            .lock()
            .expect("metrics mutex poisoned")
            .clone()
    }

    pub fn static_info(&self) -> Option<StaticSystemInfo> {
        self.static_info
            .lock()
            .expect("metrics mutex poisoned")
            .clone()
    }

    pub fn request_refresh(&self) {
        self.refresh_requested.store(true, Ordering::Relaxed);
    }
}

fn window_is_hidden(app: &AppHandle) -> bool {
    match app.get_webview_window("main") {
        Some(w) => {
            let visible = w.is_visible().unwrap_or(true);
            let minimized = w.is_minimized().unwrap_or(false);
            !visible || minimized
        }
        None => true,
    }
}

pub fn spawn(app: AppHandle, shared: Arc<MetricsShared>) {
    std::thread::Builder::new()
        .name("cleanwin-metrics".into())
        .spawn(move || {
            let mut collector = match MetricsCollector::new() {
                Ok(c) => c,
                Err(err) => {
                    log::error!("metrics collector failed to start: {err}");
                    *shared.init_error.lock().expect("metrics mutex poisoned") =
                        Some(err.to_string());
                    let _ = app.emit("metrics:error", err.to_string());
                    return;
                }
            };
            *shared.static_info.lock().expect("metrics mutex poisoned") =
                Some(collector.static_info().clone());
            shared.ready.store(true, Ordering::SeqCst);

            loop {
                let started = Instant::now();
                let snapshot = collector.refresh();
                *shared.processes.lock().expect("metrics mutex poisoned") =
                    collector.processes().to_vec();
                tray::update_status(&app, &snapshot);
                if let Err(err) = app.emit(METRICS_EVENT, &snapshot) {
                    log::debug!("emit metrics failed: {err}");
                }
                *shared.latest.lock().expect("metrics mutex poisoned") = Some(snapshot);

                let base = shared.interval_ms.load(Ordering::Relaxed).max(500);
                let interval = if window_is_hidden(&app) {
                    base.max(HIDDEN_INTERVAL_MS)
                } else {
                    base
                };
                let work = started.elapsed().as_millis() as u64;
                let mut remaining = interval.saturating_sub(work).max(200);
                // Sleep in small steps so a refresh request or interval change
                // takes effect quickly.
                while remaining > 0 {
                    let step = remaining.min(100);
                    std::thread::sleep(Duration::from_millis(step));
                    remaining -= step;
                    if shared.refresh_requested.swap(false, Ordering::Relaxed) {
                        break;
                    }
                }
            }
        })
        .expect("failed to spawn metrics thread");
}
