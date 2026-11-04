//! CleanWin — native backend entry point.
//!
//! Wires plugins, managed state, the tray icon, window lifecycle and the
//! background metrics loop, then registers every IPC command.

mod commands;
mod errors;
mod models;
mod services;
mod system;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

use services::metrics_loop::MetricsShared;
use services::settings::{CloseBehavior, SettingsStore};
use services::{metrics_loop, tray, window, AppState};
use system::cleaner::CleanerState;
use system::desktop::DesktopIcons;
use system::power::KeepAwake;

/// Command-line flag passed by the autostart entry.
pub const MINIMIZED_FLAG: &str = "--minimized";

/// Explorer registers the tray icon a moment after it appears, so retry for a
/// while. Keeps the "always visible" choice across updates and reinstalls.
fn reapply_tray_promotion() {
    let spawned = std::thread::Builder::new()
        .name("tray-promote".into())
        .spawn(|| {
            for attempt in 1..=30u32 {
                match system::tray_icon_settings::set_promoted(true) {
                    Ok(_) => {
                        log::info!("tray icon promoted (attempt {attempt})");
                        return;
                    }
                    Err(err) => log::debug!("tray icon promotion attempt {attempt}: {err}"),
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
            log::info!("tray icon promotion gave up after 15 s");
        });
    if let Err(err) = spawned {
        log::warn!("could not start tray promotion thread: {err}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launched_minimized = std::env::args().any(|a| a == MINIMIZED_FLAG);

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    tauri::Builder::default()
        // Must be registered first so a second launch focuses the running instance.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            log::info!("second instance blocked: {argv:?}");
            window::show_main(app);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log_level)
                .level_for("tao", log::LevelFilter::Warn)
                .level_for("wry", log::LevelFilter::Warn)
                .max_file_size(2 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_FLAG]),
        ))
        .setup(move |app| {
            let config_dir = app.path().app_config_dir()?;
            let settings = SettingsStore::load(&config_dir);
            let current = settings.get();
            log::info!(
                "CleanWin {} starting (config: {})",
                app.package_info().version,
                settings.path().display()
            );

            let metrics = Arc::new(MetricsShared::new(u64::from(current.refresh_interval_ms)));
            app.manage(AppState {
                settings,
                metrics: Arc::clone(&metrics),
                cleaner: CleanerState::default(),
                keep_awake: KeepAwake::new(),
                desktop: DesktopIcons::default(),
                launched_minimized: AtomicBool::new(launched_minimized),
                window_revealed: AtomicBool::new(false),
                exiting: AtomicBool::new(false),
            });

            tray::build(app.handle(), &current.language)?;
            if current.tray_icon_promoted == Some(true) {
                reapply_tray_promotion();
            }
            metrics_loop::spawn(app.handle().clone(), metrics);
            Ok(())
        })
        .on_window_event(|win, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = win.app_handle();
                let state = app.state::<AppState>();
                if state.exiting.load(Ordering::SeqCst) {
                    return;
                }
                match state.settings.get().close_behavior {
                    CloseBehavior::MinimizeToTray => {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                    CloseBehavior::Exit => {
                        api.prevent_close();
                        window::request_exit(app);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::frontend_ready,
            commands::get_app_info,
            commands::set_view_mode,
            commands::hide_to_tray,
            commands::exit_app,
            commands::open_external,
            commands::reveal_path,
            commands::get_system_snapshot,
            commands::get_system_info,
            commands::request_metrics_refresh,
            commands::list_processes,
            commands::kill_process,
            commands::list_clean_categories,
            commands::scan_cleanup,
            commands::clean_files,
            commands::cancel_cleanup,
            commands::get_recycle_bin_info,
            commands::empty_recycle_bin,
            commands::get_utilities_state,
            commands::set_keep_awake,
            commands::set_desktop_icons_visible,
            commands::get_settings,
            commands::update_settings,
            commands::get_autostart_enabled,
            commands::get_tray_icon_promoted,
            commands::set_tray_icon_promoted,
        ])
        .build(tauri::generate_context!())
        .expect("error while building CleanWin")
        .run(|app, event| match event {
            RunEvent::ExitRequested { .. } => {
                // Reached when the last window closes with "exit" behaviour or
                // when `request_exit` is called: release OS resources first.
                window::cleanup(app);
            }
            RunEvent::Exit => {
                window::cleanup(app);
            }
            _ => {}
        });
}
