//! Local, persistent user preferences.
//!
//! Settings live in a single JSON file inside the app config directory
//! (`%APPDATA%\com.cleanwin.desktop\settings.json`). Writes are atomic:
//! the new content goes to a temporary sibling file that is then renamed
//! over the previous one, so a crash mid-write never leaves a corrupt file.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::errors::{AppError, AppResult};

pub const SETTINGS_FILE_NAME: &str = "settings.json";
pub const MIN_REFRESH_INTERVAL_MS: u32 = 500;
pub const MAX_REFRESH_INTERVAL_MS: u32 = 10_000;
pub const DEFAULT_REFRESH_INTERVAL_MS: u32 = 1_500;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CloseBehavior {
    #[default]
    MinimizeToTray,
    Exit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    #[default]
    Compact,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CleaningSettings {
    /// Skip files modified in the last `recent_hours` hours. Temporary files
    /// that are brand new are frequently still in use by the app that created them.
    pub skip_recent_files: bool,
    pub recent_hours: u32,
    /// Category ids pre-selected in the cleaning view.
    pub default_categories: Vec<String>,
}

impl Default for CleaningSettings {
    fn default() -> Self {
        Self {
            skip_recent_files: true,
            recent_hours: 24,
            default_categories: vec![
                "user_temp".into(),
                "windows_temp".into(),
                "crash_reports".into(),
                "shader_cache".into(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub launch_at_startup: bool,
    pub start_minimized: bool,
    pub refresh_interval_ms: u32,
    pub close_behavior: CloseBehavior,
    pub view_mode: ViewMode,
    pub language: String,
    pub show_tray_metrics: bool,
    pub reduce_motion: bool,
    pub cleaning: CleaningSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            launch_at_startup: false,
            start_minimized: false,
            refresh_interval_ms: DEFAULT_REFRESH_INTERVAL_MS,
            close_behavior: CloseBehavior::MinimizeToTray,
            view_mode: ViewMode::Compact,
            language: "pt-BR".into(),
            show_tray_metrics: true,
            reduce_motion: false,
            cleaning: CleaningSettings::default(),
        }
    }
}

impl Settings {
    /// Clamp every value to a safe range. Called on load and on every update
    /// so a hand-edited file can never put the app into a bad state.
    pub fn sanitized(mut self) -> Self {
        self.refresh_interval_ms = self
            .refresh_interval_ms
            .clamp(MIN_REFRESH_INTERVAL_MS, MAX_REFRESH_INTERVAL_MS);
        self.cleaning.recent_hours = self.cleaning.recent_hours.clamp(1, 24 * 30);
        if self.language != "pt-BR" && self.language != "en-US" {
            self.language = "pt-BR".into();
        }
        self.cleaning
            .default_categories
            .retain(|c| !c.trim().is_empty());
        self.cleaning.default_categories.dedup();
        self
    }
}

/// Thread-safe in-memory copy of the settings backed by the JSON file.
pub struct SettingsStore {
    path: PathBuf,
    current: Mutex<Settings>,
}

impl SettingsStore {
    /// Load from `dir/settings.json`. Missing or invalid files fall back to
    /// defaults; the broken file is kept as `settings.json.invalid` for inspection.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(SETTINGS_FILE_NAME);
        let settings = match fs::read(&path) {
            // Tolerate a UTF-8 BOM (Notepad and PowerShell add one when editing).
            Ok(bytes) => match serde_json::from_slice::<Settings>(strip_bom(&bytes)) {
                Ok(s) => s.sanitized(),
                Err(err) => {
                    log::warn!("settings file is invalid ({err}); using defaults");
                    let _ = fs::rename(&path, path.with_extension("json.invalid"));
                    Settings::default()
                }
            },
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Settings::default(),
            Err(err) => {
                log::warn!("could not read settings ({err}); using defaults");
                Settings::default()
            }
        };
        Self {
            path,
            current: Mutex::new(settings),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn get(&self) -> Settings {
        self.current
            .lock()
            .expect("settings mutex poisoned")
            .clone()
    }

    /// Replace the settings, persist them and return the sanitized value.
    pub fn replace(&self, settings: Settings) -> AppResult<Settings> {
        let settings = settings.sanitized();
        write_atomic(&self.path, &serde_json::to_vec_pretty(&settings)?)?;
        *self.current.lock().expect("settings mutex poisoned") = settings.clone();
        Ok(settings)
    }

    /// Apply a mutation and persist.
    pub fn update<F: FnOnce(&mut Settings)>(&self, f: F) -> AppResult<Settings> {
        let mut s = self.get();
        f(&mut s);
        self.replace(s)
    }
}

fn strip_bom(bytes: &[u8]) -> &[u8] {
    bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes)
}

/// Write `bytes` to `path` atomically (temp file + rename).
pub fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let dir = path
        .parent()
        .ok_or_else(|| AppError::Internal("settings path has no parent".into()))?;
    fs::create_dir_all(dir)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes)?;
    // On Windows `rename` replaces an existing destination (MoveFileEx + REPLACE_EXISTING).
    fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_when_file_missing() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::load(dir.path());
        assert_eq!(store.get(), Settings::default());
        assert!(!store.path().exists(), "load must not create the file");
    }

    #[test]
    fn roundtrip_persists_and_reloads() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::load(dir.path());
        let saved = store
            .update(|s| {
                s.refresh_interval_ms = 3000;
                s.close_behavior = CloseBehavior::Exit;
                s.language = "en-US".into();
                s.cleaning.skip_recent_files = false;
            })
            .unwrap();
        assert_eq!(saved.refresh_interval_ms, 3000);
        assert!(store.path().exists());
        assert!(!store.path().with_extension("json.tmp").exists());

        let reloaded = SettingsStore::load(dir.path()).get();
        assert_eq!(reloaded, saved);
        assert_eq!(reloaded.close_behavior, CloseBehavior::Exit);
        assert!(!reloaded.cleaning.skip_recent_files);
    }

    #[test]
    fn invalid_json_falls_back_to_defaults_and_keeps_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE_NAME);
        fs::write(&path, b"{ not json").unwrap();
        let store = SettingsStore::load(dir.path());
        assert_eq!(store.get(), Settings::default());
        assert!(path.with_extension("json.invalid").exists());
    }

    #[test]
    fn unknown_fields_are_ignored_and_missing_fields_defaulted() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE_NAME);
        fs::write(
            &path,
            br#"{"refreshIntervalMs": 2000, "futureOption": true}"#,
        )
        .unwrap();
        let s = SettingsStore::load(dir.path()).get();
        assert_eq!(s.refresh_interval_ms, 2000);
        assert_eq!(s.close_behavior, CloseBehavior::MinimizeToTray);
        assert_eq!(s.cleaning, CleaningSettings::default());
    }

    #[test]
    fn utf8_bom_is_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE_NAME);
        fs::write(&path, b"\xEF\xBB\xBF{\"closeBehavior\": \"exit\"}").unwrap();
        let s = SettingsStore::load(dir.path()).get();
        assert_eq!(s.close_behavior, CloseBehavior::Exit);
        assert!(!path.with_extension("json.invalid").exists());
    }

    #[test]
    fn values_are_clamped() {
        let s = Settings {
            refresh_interval_ms: 10,
            language: "xx-YY".into(),
            cleaning: CleaningSettings {
                recent_hours: 0,
                ..Default::default()
            },
            ..Default::default()
        }
        .sanitized();
        assert_eq!(s.refresh_interval_ms, MIN_REFRESH_INTERVAL_MS);
        assert_eq!(s.language, "pt-BR");
        assert_eq!(s.cleaning.recent_hours, 1);

        let s = Settings {
            refresh_interval_ms: 99_999,
            ..Default::default()
        }
        .sanitized();
        assert_eq!(s.refresh_interval_ms, MAX_REFRESH_INTERVAL_MS);
    }

    #[test]
    fn json_uses_camel_case_keys() {
        let json = serde_json::to_string(&Settings::default()).unwrap();
        assert!(json.contains("\"launchAtStartup\""));
        assert!(json.contains("\"closeBehavior\":\"minimize_to_tray\""));
        assert!(json.contains("\"viewMode\":\"compact\""));
    }
}
