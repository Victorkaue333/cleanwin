//! System tray icon and menu.

use std::sync::Mutex;

use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::models::SystemSnapshot;
use crate::services::{window, AppState};

pub const TRAY_ID: &str = "cleanwin-tray";
const MENU_OPEN: &str = "tray-open";
const MENU_HIDE: &str = "tray-hide";
const MENU_STATUS: &str = "tray-status";
const MENU_SCAN: &str = "tray-scan";
const MENU_QUIT: &str = "tray-quit";

pub struct TrayHandles {
    status_item: MenuItem<Wry>,
    labels: Mutex<TrayLabels>,
}

#[derive(Clone)]
pub struct TrayLabels {
    pub status_prefix: String,
}

pub fn labels_for(language: &str) -> (TrayLabels, [&'static str; 4]) {
    if language == "en-US" {
        (
            TrayLabels {
                status_prefix: "CPU".into(),
            },
            ["Open CleanWin", "Hide window", "Scan junk files", "Exit"],
        )
    } else {
        (
            TrayLabels {
                status_prefix: "CPU".into(),
            },
            ["Abrir CleanWin", "Ocultar janela", "Escanear lixo", "Sair"],
        )
    }
}

pub fn build(app: &AppHandle, language: &str) -> tauri::Result<()> {
    let (labels, [open, hide, scan, quit]) = labels_for(language);

    let status_item = MenuItemBuilder::with_id(MENU_STATUS, "CleanWin")
        .enabled(false)
        .build(app)?;
    let open_item = MenuItemBuilder::with_id(MENU_OPEN, open).build(app)?;
    let hide_item = MenuItemBuilder::with_id(MENU_HIDE, hide).build(app)?;
    let scan_item = MenuItemBuilder::with_id(MENU_SCAN, scan).build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT, quit).build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&open_item)
        .item(&hide_item)
        .item(&scan_item)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&quit_item)
        .build()?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("bundle icon is configured in tauri.conf.json");

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("CleanWin")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_OPEN => window::show_main(app),
            MENU_HIDE => window::hide_main(app),
            MENU_SCAN => {
                window::show_main(app);
                let _ = tauri::Emitter::emit(app, "navigate", "cleaning");
            }
            MENU_QUIT => window::request_exit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle_main(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(TrayHandles {
        status_item,
        labels: Mutex::new(labels),
    });
    Ok(())
}

/// Refresh the status line and tooltip with the latest numbers.
pub fn update_status(app: &AppHandle, snapshot: &SystemSnapshot) {
    let Some(handles) = app.try_state::<TrayHandles>() else {
        return;
    };
    let show_metrics = app
        .try_state::<AppState>()
        .map(|s| s.settings.get().show_tray_metrics)
        .unwrap_or(true);
    let labels = handles.labels.lock().expect("tray mutex poisoned").clone();
    let text = if show_metrics {
        format!(
            "{} {:.0}%  ·  RAM {:.0}%",
            labels.status_prefix, snapshot.cpu.usage_percent, snapshot.memory.usage_percent
        )
    } else {
        "CleanWin".to_string()
    };
    let _ = handles.status_item.set_text(&text);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if show_metrics {
            format!("CleanWin — {text}")
        } else {
            "CleanWin".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}
