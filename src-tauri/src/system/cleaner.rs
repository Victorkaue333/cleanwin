//! Temporary-file scanner and safe cleaner.
//!
//! Safety model
//! ------------
//! * Only a fixed catalogue of well-known, disposable locations is ever
//!   scanned (`categories()`); the frontend can only refer to categories by id
//!   and to the files of a scan session that the backend itself produced.
//!   No path crosses the IPC boundary in the deletion direction.
//! * Every root is validated by `is_safe_root` (absolute, deep enough, never a
//!   drive, profile, `Windows`, `System32` or `Program Files` folder).
//! * Before deleting, each file is re-checked: it must still be a regular file
//!   (no directories, no reparse points / symlinks), and its canonical path
//!   must be inside the canonical root it was found under (`is_within`).
//! * Scanning never deletes. Cleaning only removes files that were listed by
//!   the scan, then removes directories that became empty, never the root.
//! * Files modified in the last N hours are skipped by default, because fresh
//!   temp files are usually still in use.
//! * Files in use (sharing/lock violations) are reported, not forced.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::errors::{AppError, AppResult};
use crate::models::{
    CleanCategoryInfo, CleanCategoryResult, FileEntry, FileError, ScanCategoryResult,
};

/// Number of largest files kept per category for the preview UI.
pub const PREVIEW_FILES: usize = 40;
/// Number of per-file errors kept per category in the clean report.
pub const MAX_ERRORS: usize = 25;
/// Scan sessions older than this are discarded (results would be stale).
pub const SESSION_TTL: Duration = Duration::from_secs(30 * 60);

// ---------------------------------------------------------------------------
// Category catalogue
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub enum Selector {
    /// Every file below the root, recursively.
    Recursive,
    /// Only files directly inside the root whose name starts with one of
    /// `prefixes` and ends with `extension` (e.g. `thumbcache_*.db`).
    NamePattern {
        prefixes: &'static [&'static str],
        extension: &'static str,
    },
}

#[derive(Debug, Clone)]
pub struct CategoryDef {
    pub id: &'static str,
    pub roots: Vec<PathBuf>,
    pub selector: Selector,
    pub requires_admin: bool,
    /// Hint for the UI: files are usually locked while the related app runs.
    pub closes_apps_hint: bool,
    /// Whether the "skip recent files" rule applies.
    pub skip_recent_applies: bool,
}

impl CategoryDef {
    pub fn info(&self) -> CleanCategoryInfo {
        CleanCategoryInfo {
            id: self.id.to_string(),
            roots: self
                .roots
                .iter()
                .map(|r| {
                    fs::canonicalize(r)
                        .map(|c| display_path(&c))
                        .unwrap_or_else(|_| r.display().to_string())
                })
                .collect(),
            requires_admin: self.requires_admin,
            closes_apps_hint: self.closes_apps_hint,
            available: !self.roots.is_empty(),
        }
    }
}

fn env_path(var: &str) -> Option<PathBuf> {
    std::env::var_os(var)
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
}

fn existing(paths: impl IntoIterator<Item = PathBuf>) -> Vec<PathBuf> {
    paths
        .into_iter()
        .filter(|p| p.is_dir() && is_safe_root(p))
        .collect()
}

/// Chromium-family cache folders under a `User Data` directory.
fn chromium_cache_dirs(user_data: PathBuf) -> Vec<PathBuf> {
    const CACHE_DIRS: &[&str] = &[
        "Cache",
        "Code Cache",
        "GPUCache",
        "DawnCache",
        "DawnGraphiteCache",
        "DawnWebGPUCache",
        "GrShaderCache",
        "ShaderCache",
    ];
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(&user_data) else {
        return out;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_profile =
            name == "Default" || name.starts_with("Profile ") || name == "Guest Profile";
        if !is_profile {
            continue;
        }
        for cache in CACHE_DIRS {
            out.push(entry.path().join(cache));
        }
    }
    // Shader caches shared across profiles.
    out.push(user_data.join("ShaderCache"));
    out.push(user_data.join("GrShaderCache"));
    out.push(user_data.join("GraphiteDawnCache"));
    out
}

fn firefox_cache_dirs(local_app_data: &Path) -> Vec<PathBuf> {
    let profiles = local_app_data
        .join("Mozilla")
        .join("Firefox")
        .join("Profiles");
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&profiles) {
        for entry in entries.flatten() {
            out.push(entry.path().join("cache2"));
            out.push(entry.path().join("startupCache"));
        }
    }
    out
}

/// Build the catalogue of cleanable locations for the current user.
/// Roots that do not exist (e.g. a browser that is not installed) are dropped,
/// so `roots` may be empty, which the UI shows as "nothing to clean here".
pub fn categories() -> Vec<CategoryDef> {
    let local = env_path("LOCALAPPDATA");
    let roaming = env_path("APPDATA");
    let windir = env_path("SystemRoot").or_else(|| env_path("WINDIR"));
    let program_data = env_path("ProgramData");
    let user_temp = env_path("TEMP").or_else(|| env_path("TMP"));

    let mut defs = Vec::new();

    defs.push(CategoryDef {
        id: "user_temp",
        roots: existing(user_temp),
        selector: Selector::Recursive,
        requires_admin: false,
        closes_apps_hint: false,
        skip_recent_applies: true,
    });

    defs.push(CategoryDef {
        id: "windows_temp",
        roots: existing(windir.iter().map(|w| w.join("Temp"))),
        selector: Selector::Recursive,
        requires_admin: true,
        closes_apps_hint: false,
        skip_recent_applies: true,
    });

    let mut browser_roots = Vec::new();
    if let Some(local) = &local {
        for base in [
            local.join("Google").join("Chrome").join("User Data"),
            local.join("Microsoft").join("Edge").join("User Data"),
            local
                .join("BraveSoftware")
                .join("Brave-Browser")
                .join("User Data"),
            local.join("Vivaldi").join("User Data"),
            local.join("Opera Software").join("Opera Stable"),
            local.join("Opera Software").join("Opera GX Stable"),
        ] {
            if base.is_dir() {
                browser_roots.extend(chromium_cache_dirs(base));
            }
        }
        browser_roots.extend(firefox_cache_dirs(local));
    }
    defs.push(CategoryDef {
        id: "browser_cache",
        roots: existing(browser_roots),
        selector: Selector::Recursive,
        requires_admin: false,
        closes_apps_hint: true,
        skip_recent_applies: true,
    });

    let mut crash_roots = Vec::new();
    if let Some(local) = &local {
        crash_roots.push(local.join("CrashDumps"));
        let wer = local.join("Microsoft").join("Windows").join("WER");
        crash_roots.push(wer.join("ReportQueue"));
        crash_roots.push(wer.join("ReportArchive"));
        crash_roots.push(wer.join("Temp"));
    }
    if let Some(pd) = &program_data {
        let wer = pd.join("Microsoft").join("Windows").join("WER");
        crash_roots.push(wer.join("ReportQueue"));
        crash_roots.push(wer.join("ReportArchive"));
        crash_roots.push(wer.join("Temp"));
    }
    defs.push(CategoryDef {
        id: "crash_reports",
        roots: existing(crash_roots),
        selector: Selector::Recursive,
        requires_admin: false,
        closes_apps_hint: false,
        skip_recent_applies: false,
    });

    let mut shader_roots = Vec::new();
    if let Some(local) = &local {
        shader_roots.push(local.join("D3DSCache"));
        shader_roots.push(local.join("NVIDIA").join("DXCache"));
        shader_roots.push(local.join("NVIDIA").join("GLCache"));
        shader_roots.push(local.join("AMD").join("DxCache"));
        shader_roots.push(local.join("AMD").join("GLCache"));
        shader_roots.push(local.join("AMD").join("DxcCache"));
        shader_roots.push(local.join("Intel").join("ShaderCache"));
    }
    defs.push(CategoryDef {
        id: "shader_cache",
        roots: existing(shader_roots),
        selector: Selector::Recursive,
        requires_admin: false,
        closes_apps_hint: true,
        skip_recent_applies: true,
    });

    defs.push(CategoryDef {
        id: "thumbnail_cache",
        roots: existing(
            local
                .iter()
                .map(|l| l.join("Microsoft").join("Windows").join("Explorer")),
        ),
        selector: Selector::NamePattern {
            prefixes: &["thumbcache_", "iconcache_"],
            extension: "db",
        },
        requires_admin: false,
        closes_apps_hint: true,
        skip_recent_applies: false,
    });

    defs.push(CategoryDef {
        id: "inet_cache",
        roots: existing(
            local
                .iter()
                .map(|l| l.join("Microsoft").join("Windows").join("INetCache")),
        ),
        selector: Selector::Recursive,
        requires_admin: false,
        closes_apps_hint: true,
        skip_recent_applies: true,
    });

    let _ = roaming; // reserved for future categories (kept to document the lookup)
    defs
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/// A root is safe when it is absolute, deep enough below the drive, and not
/// one of the folders we must never sweep (drive roots, user profiles, the
/// Windows directory itself, Program Files, personal folders).
pub fn is_safe_root(path: &Path) -> bool {
    use std::path::Component;
    if !path.is_absolute() {
        return false;
    }
    let normals: Vec<String> = path
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().to_lowercase()),
            _ => None,
        })
        .collect();
    if normals.len() < 2 {
        return false;
    }
    const FORBIDDEN_ANY: &[&str] = &[
        "system32",
        "syswow64",
        "program files",
        "program files (x86)",
    ];
    if normals.iter().any(|c| FORBIDDEN_ANY.contains(&c.as_str())) {
        return false;
    }
    const FORBIDDEN_LAST: &[&str] = &[
        "windows",
        "users",
        "programdata",
        "appdata",
        "local",
        "locallow",
        "roaming",
        "desktop",
        "documents",
        "downloads",
        "pictures",
        "videos",
        "music",
        "onedrive",
    ];
    let last = normals.last().map(String::as_str).unwrap_or("");
    if FORBIDDEN_LAST.contains(&last) {
        return false;
    }
    match normals[0].as_str() {
        // `C:\Users\<name>\<folder>` is personal; only deeper AppData paths qualify.
        "users" => normals.len() >= 4,
        // Under the Windows directory only the Temp folder is ever cleanable.
        "windows" => normals.get(1).map(|c| c == "temp").unwrap_or(false),
        "programdata" => normals.len() >= 3,
        _ => true,
    }
}

fn canonical(path: &Path) -> io::Result<PathBuf> {
    fs::canonicalize(path)
}

/// `candidate` must resolve to a location inside `root` (both canonical).
pub fn is_within(root_canonical: &Path, candidate: &Path) -> bool {
    match canonical(candidate) {
        Ok(c) => c.starts_with(root_canonical) && c != root_canonical,
        Err(_) => false,
    }
}

#[cfg(windows)]
fn is_reparse_point(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(meta: &fs::Metadata) -> bool {
    meta.file_type().is_symlink()
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ScannedFile {
    pub path: PathBuf,
    pub size: u64,
    pub modified: Option<SystemTime>,
}

#[derive(Debug, Clone)]
pub struct ScannedCategory {
    pub id: String,
    /// Canonical roots, used as deletion boundaries.
    pub roots: Vec<PathBuf>,
    pub files: Vec<ScannedFile>,
    /// Directories visited (relative deletion candidates once empty).
    pub dirs: Vec<PathBuf>,
    pub skipped_recent_count: u64,
    pub skipped_recent_bytes: u64,
    pub access_denied_count: u64,
}

impl ScannedCategory {
    pub fn total_bytes(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }

    pub fn to_result(&self) -> ScanCategoryResult {
        let mut largest: Vec<&ScannedFile> = self.files.iter().collect();
        largest.sort_by_key(|f| std::cmp::Reverse(f.size));
        ScanCategoryResult {
            id: self.id.clone(),
            roots: self.roots.iter().map(|r| display_path(r)).collect(),
            file_count: self.files.len() as u64,
            total_bytes: self.total_bytes(),
            skipped_recent_count: self.skipped_recent_count,
            skipped_recent_bytes: self.skipped_recent_bytes,
            access_denied_count: self.access_denied_count,
            partial: self.access_denied_count > 0,
            largest: largest
                .into_iter()
                .take(PREVIEW_FILES)
                .map(|f| FileEntry {
                    path: display_path(&f.path),
                    size_bytes: f.size,
                    modified_ms: f.modified.and_then(to_millis),
                })
                .collect(),
        }
    }
}

/// Strip the `\\?\` verbatim prefix that `canonicalize` adds on Windows.
pub fn display_path(p: &Path) -> String {
    let s = p.display().to_string();
    s.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(s)
}

fn to_millis(t: SystemTime) -> Option<u64> {
    t.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

#[derive(Debug, Clone, Copy)]
pub struct ScanOptions {
    pub skip_recent: bool,
    pub recent_window: Duration,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            skip_recent: true,
            recent_window: Duration::from_secs(24 * 3600),
        }
    }
}

struct Walker<'a, F: FnMut(u64, u64)> {
    cancel: &'a AtomicBool,
    opts: ScanOptions,
    skip_recent: bool,
    now: SystemTime,
    out: ScannedCategory,
    on_progress: F,
    last_report: Instant,
}

impl<F: FnMut(u64, u64)> Walker<'_, F> {
    fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    fn report(&mut self, force: bool) {
        if force || self.last_report.elapsed() >= Duration::from_millis(120) {
            let bytes = self.out.total_bytes();
            (self.on_progress)(self.out.files.len() as u64, bytes);
            self.last_report = Instant::now();
        }
    }

    fn consider_file(&mut self, path: PathBuf, meta: &fs::Metadata) {
        let modified = meta.modified().ok();
        let size = meta.len();
        if self.skip_recent && self.opts.skip_recent {
            if let Some(m) = modified {
                if self
                    .now
                    .duration_since(m)
                    .map(|age| age < self.opts.recent_window)
                    .unwrap_or(true)
                {
                    self.out.skipped_recent_count += 1;
                    self.out.skipped_recent_bytes += size;
                    return;
                }
            }
        }
        self.out.files.push(ScannedFile {
            path,
            size,
            modified,
        });
        if self.out.files.len().is_multiple_of(64) {
            self.report(false);
        }
    }

    fn walk_dir(&mut self, dir: &Path, depth: usize) {
        if self.cancelled() || depth > 48 {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(err) => {
                if err.kind() == io::ErrorKind::PermissionDenied {
                    self.out.access_denied_count += 1;
                } else {
                    log::debug!("skip {}: {err}", dir.display());
                }
                return;
            }
        };
        for entry in entries {
            if self.cancelled() {
                return;
            }
            let Ok(entry) = entry else { continue };
            let path = entry.path();
            let meta = match fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(err) => {
                    if err.kind() == io::ErrorKind::PermissionDenied {
                        self.out.access_denied_count += 1;
                    }
                    continue;
                }
            };
            if is_reparse_point(&meta) || meta.file_type().is_symlink() {
                // Never follow junctions / symlinks: they may point anywhere.
                continue;
            }
            if meta.is_dir() {
                self.out.dirs.push(path.clone());
                self.walk_dir(&path, depth + 1);
            } else if meta.is_file() {
                self.consider_file(path, &meta);
            }
        }
    }

    fn walk_pattern(&mut self, dir: &Path, prefixes: &[&str], extension: &str) {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(err) => {
                if err.kind() == io::ErrorKind::PermissionDenied {
                    self.out.access_denied_count += 1;
                }
                return;
            }
        };
        for entry in entries.flatten() {
            if self.cancelled() {
                return;
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_lowercase();
            let ext_ok = path
                .extension()
                .map(|e| e.to_string_lossy().eq_ignore_ascii_case(extension))
                .unwrap_or(false);
            if !ext_ok || !prefixes.iter().any(|p| name.starts_with(p)) {
                continue;
            }
            let Ok(meta) = fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.is_file() && !is_reparse_point(&meta) {
                self.consider_file(path, &meta);
            }
        }
    }
}

/// Scan one category. Never deletes anything.
pub fn scan_category<F: FnMut(u64, u64)>(
    def: &CategoryDef,
    opts: ScanOptions,
    cancel: &AtomicBool,
    on_progress: F,
) -> ScannedCategory {
    let mut walker = Walker {
        cancel,
        opts,
        skip_recent: def.skip_recent_applies,
        now: SystemTime::now(),
        out: ScannedCategory {
            id: def.id.to_string(),
            roots: Vec::new(),
            files: Vec::new(),
            dirs: Vec::new(),
            skipped_recent_count: 0,
            skipped_recent_bytes: 0,
            access_denied_count: 0,
        },
        on_progress,
        last_report: Instant::now(),
    };

    for root in &def.roots {
        if !is_safe_root(root) {
            log::warn!("refusing unsafe root {}", root.display());
            continue;
        }
        let Ok(canonical_root) = canonical(root) else {
            continue;
        };
        walker.out.roots.push(canonical_root.clone());
        match &def.selector {
            Selector::Recursive => walker.walk_dir(&canonical_root, 0),
            Selector::NamePattern {
                prefixes,
                extension,
            } => walker.walk_pattern(&canonical_root, prefixes, extension),
        }
    }
    walker.report(true);
    walker.out
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeleteOutcome {
    Deleted,
    Locked,
    Missing,
    Failed,
}

fn classify_error(err: &io::Error) -> DeleteOutcome {
    match err.raw_os_error() {
        // ERROR_SHARING_VIOLATION / ERROR_LOCK_VIOLATION: file in use.
        Some(32) | Some(33) => DeleteOutcome::Locked,
        _ => match err.kind() {
            io::ErrorKind::NotFound => DeleteOutcome::Missing,
            _ => DeleteOutcome::Failed,
        },
    }
}

/// Delete a single scanned file after re-validating it.
pub fn delete_file(roots: &[PathBuf], file: &Path) -> (DeleteOutcome, Option<String>) {
    let meta = match fs::symlink_metadata(file) {
        Ok(m) => m,
        Err(err) => return (classify_error(&err), Some(err.to_string())),
    };
    if !meta.is_file() || is_reparse_point(&meta) {
        return (
            DeleteOutcome::Failed,
            Some("not a regular file anymore".into()),
        );
    }
    if !roots.iter().any(|r| is_within(r, file)) {
        return (
            DeleteOutcome::Failed,
            Some("outside of the allowed root".into()),
        );
    }
    match fs::remove_file(file) {
        Ok(()) => (DeleteOutcome::Deleted, None),
        Err(err) => {
            // Read-only temp files: clear the attribute once and retry.
            if err.kind() == io::ErrorKind::PermissionDenied && meta.permissions().readonly() {
                let mut perms = meta.permissions();
                #[allow(clippy::permissions_set_readonly_false)]
                perms.set_readonly(false);
                if fs::set_permissions(file, perms).is_ok() {
                    if let Ok(()) = fs::remove_file(file) {
                        return (DeleteOutcome::Deleted, None);
                    }
                }
            }
            (classify_error(&err), Some(err.to_string()))
        }
    }
}

/// Remove directories that became empty, deepest first. Roots are never removed.
fn remove_empty_dirs(cat: &ScannedCategory) -> u64 {
    let mut dirs = cat.dirs.clone();
    dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));
    let mut removed = 0;
    for dir in dirs {
        if cat.roots.iter().any(|r| r == &dir) {
            continue;
        }
        if !cat.roots.iter().any(|r| is_within(r, &dir)) {
            continue;
        }
        if fs::remove_dir(&dir).is_ok() {
            removed += 1;
        }
    }
    removed
}

/// Delete every file of a scanned category. Emits progress through `on_progress`
/// (processed, deleted, freed_bytes, locked, failed).
pub fn clean_category<F: FnMut(u64, u64, u64, u64, u64)>(
    cat: &ScannedCategory,
    cancel: &AtomicBool,
    mut on_progress: F,
) -> CleanCategoryResult {
    let mut result = CleanCategoryResult {
        id: cat.id.clone(),
        ..Default::default()
    };
    let mut last = Instant::now();
    for (i, file) in cat.files.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let (outcome, detail) = delete_file(&cat.roots, &file.path);
        match outcome {
            DeleteOutcome::Deleted => {
                result.deleted_files += 1;
                result.freed_bytes += file.size;
            }
            DeleteOutcome::Locked => result.locked_files += 1,
            DeleteOutcome::Missing => result.missing_files += 1,
            DeleteOutcome::Failed => {
                result.failed_files += 1;
                if result.errors.len() < MAX_ERRORS {
                    result.errors.push(FileError {
                        path: display_path(&file.path),
                        reason: detail.unwrap_or_else(|| "unknown error".into()),
                    });
                }
            }
        }
        if last.elapsed() >= Duration::from_millis(120) || i + 1 == cat.files.len() {
            on_progress(
                (i + 1) as u64,
                result.deleted_files,
                result.freed_bytes,
                result.locked_files,
                result.failed_files,
            );
            last = Instant::now();
        }
    }
    if !cancel.load(Ordering::Relaxed) {
        result.removed_dirs = remove_empty_dirs(cat);
    }
    result
}

// ---------------------------------------------------------------------------
// Session state shared with the commands layer
// ---------------------------------------------------------------------------

pub struct ScanSession {
    pub id: String,
    pub created: Instant,
    pub categories: HashMap<String, ScannedCategory>,
}

#[derive(Default)]
pub struct CleanerState {
    pub cancel: Arc<AtomicBool>,
    pub running: AtomicBool,
    pub session: Mutex<Option<ScanSession>>,
}

impl CleanerState {
    /// Mark the cleaner busy. Returns an error if another scan/clean runs.
    pub fn begin(&self) -> AppResult<()> {
        if self
            .running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err(AppError::Busy("a scan or clean is already running".into()));
        }
        self.cancel.store(false, Ordering::SeqCst);
        Ok(())
    }

    pub fn end(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn request_cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }

    /// Shared cancellation flag for blocking tasks.
    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancel)
    }

    pub fn store_session(&self, session: ScanSession) {
        *self.session.lock().expect("cleaner mutex poisoned") = Some(session);
    }

    pub fn take_session(&self, id: &str) -> AppResult<ScanSession> {
        let mut guard = self.session.lock().expect("cleaner mutex poisoned");
        match guard.as_ref() {
            Some(s) if s.id == id => {
                if s.created.elapsed() > SESSION_TTL {
                    *guard = None;
                    return Err(AppError::InvalidOperation(
                        "scan results expired, run a new scan".into(),
                    ));
                }
                Ok(guard.take().expect("checked above"))
            }
            _ => Err(AppError::NotFound("scan session".into())),
        }
    }
}

pub fn new_session_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("scan-{nanos:x}-{}", std::process::id())
}

// ---------------------------------------------------------------------------
// Tests (isolated temp directories only; never touch real user folders)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    fn touch(path: &Path, bytes: usize) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let mut f = File::create(path).unwrap();
        f.write_all(&vec![b'x'; bytes]).unwrap();
    }

    fn age(path: &Path, secs: u64) {
        let f = fs::OpenOptions::new().write(true).open(path).unwrap();
        f.set_modified(SystemTime::now() - Duration::from_secs(secs))
            .unwrap();
    }

    fn def(root: &Path, selector: Selector, skip_recent_applies: bool) -> CategoryDef {
        CategoryDef {
            id: "test",
            roots: vec![root.to_path_buf()],
            selector,
            requires_admin: false,
            closes_apps_hint: false,
            skip_recent_applies,
        }
    }

    /// Temp dirs are only two levels deep on some machines (`C:\Temp\x`), so tests
    /// create a deeper, clearly-named root.
    fn deep_root(base: &Path) -> PathBuf {
        let r = base.join("cleanwin-tests").join("cache").join("root");
        fs::create_dir_all(&r).unwrap();
        r
    }

    #[test]
    fn safe_root_accepts_known_cleanable_locations() {
        for ok in [
            r"C:\Users\me\AppData\Local\Temp",
            r"C:\Windows\Temp",
            r"C:\Windows\Temp\sub",
            r"C:\Users\me\AppData\Local\Microsoft\Windows\Explorer",
            r"C:\Users\me\AppData\Local\Google\Chrome\User Data\Default\Cache",
            r"C:\ProgramData\Microsoft\Windows\WER\ReportQueue",
            r"C:\Users\me\AppData\Local\CrashDumps",
            r"D:\Temp\cleanwin-tests\root",
        ] {
            assert!(is_safe_root(Path::new(ok)), "{ok} should be safe");
        }
    }

    #[test]
    fn safe_root_rejects_dangerous_locations() {
        for bad in [
            r"C:\",
            r"C:\Windows",
            r"C:\Windows\System32",
            r"C:\Windows\System32\config",
            r"C:\Windows\Prefetch",
            r"C:\Windows\SoftwareDistribution\Download",
            r"C:\Users",
            r"C:\Users\me",
            r"C:\Users\me\AppData",
            r"C:\Users\me\AppData\Local",
            r"C:\Users\me\AppData\Roaming",
            r"C:\Users\me\Documents",
            r"C:\Users\me\Desktop",
            r"C:\Users\me\Downloads",
            r"C:\Users\me\OneDrive",
            r"C:\Program Files",
            r"C:\Program Files\App\cache",
            r"C:\Program Files (x86)\App",
            r"C:\ProgramData",
            r"C:\ProgramData\Microsoft",
            r"relative\path\here",
            r"C:\Temp\Downloads",
        ] {
            assert!(!is_safe_root(Path::new(bad)), "{bad} must be rejected");
        }
    }

    #[test]
    fn scan_finds_files_and_skips_recent() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        touch(&root.join("old.tmp"), 10);
        age(&root.join("old.tmp"), 3 * 24 * 3600);
        touch(&root.join("sub").join("old2.tmp"), 20);
        age(&root.join("sub").join("old2.tmp"), 3 * 24 * 3600);
        touch(&root.join("fresh.tmp"), 5);

        let cancel = AtomicBool::new(false);
        let cat = scan_category(
            &def(&root, Selector::Recursive, true),
            ScanOptions::default(),
            &cancel,
            |_, _| {},
        );
        assert_eq!(cat.files.len(), 2);
        assert_eq!(cat.total_bytes(), 30);
        assert_eq!(cat.skipped_recent_count, 1);
        assert_eq!(cat.skipped_recent_bytes, 5);
        assert_eq!(cat.dirs.len(), 1);
        // scanning never deletes
        assert!(root.join("old.tmp").exists());
        assert!(root.join("fresh.tmp").exists());

        let result = cat.to_result();
        assert_eq!(result.file_count, 2);
        assert_eq!(result.largest[0].size_bytes, 20);
        assert!(!result.partial);
    }

    #[test]
    fn scan_without_skip_rule_takes_everything() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        touch(&root.join("fresh.tmp"), 5);
        let cancel = AtomicBool::new(false);
        let cat = scan_category(
            &def(&root, Selector::Recursive, true),
            ScanOptions {
                skip_recent: false,
                ..Default::default()
            },
            &cancel,
            |_, _| {},
        );
        assert_eq!(cat.files.len(), 1);
    }

    #[test]
    fn name_pattern_selector_only_matches_named_files() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        touch(&root.join("thumbcache_256.db"), 3);
        touch(&root.join("iconcache_32.db"), 3);
        touch(&root.join("important.db"), 3);
        touch(&root.join("thumbcache_notes.txt"), 3);
        touch(&root.join("nested").join("thumbcache_1.db"), 3);
        let cancel = AtomicBool::new(false);
        let cat = scan_category(
            &def(
                &root,
                Selector::NamePattern {
                    prefixes: &["thumbcache_", "iconcache_"],
                    extension: "db",
                },
                false,
            ),
            ScanOptions::default(),
            &cancel,
            |_, _| {},
        );
        let names: Vec<String> = cat
            .files
            .iter()
            .map(|f| f.path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"thumbcache_256.db".to_string()));
        assert!(names.contains(&"iconcache_32.db".to_string()));
    }

    #[test]
    fn clean_deletes_only_inside_root_and_keeps_root() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        let sibling = tmp
            .path()
            .join("cleanwin-tests")
            .join("cache")
            .join("root2");
        touch(&root.join("a.tmp"), 1);
        touch(&root.join("deep").join("er").join("b.tmp"), 1);
        touch(&sibling.join("keep.tmp"), 1);
        let cancel = AtomicBool::new(false);
        let mut cat = scan_category(
            &def(&root, Selector::Recursive, false),
            ScanOptions::default(),
            &cancel,
            |_, _| {},
        );
        // Inject a file outside the root, as if the session had been tampered with.
        cat.files.push(ScannedFile {
            path: sibling.join("keep.tmp"),
            size: 1,
            modified: None,
        });
        let result = clean_category(&cat, &cancel, |_, _, _, _, _| {});
        assert_eq!(result.deleted_files, 2);
        assert_eq!(result.failed_files, 1);
        assert_eq!(result.errors[0].reason, "outside of the allowed root");
        assert!(sibling.join("keep.tmp").exists(), "sibling must survive");
        assert!(root.exists(), "root must survive");
        assert!(!root.join("deep").exists(), "empty dirs removed");
        assert_eq!(result.removed_dirs, 2);
    }

    #[test]
    fn is_within_rejects_prefix_lookalikes() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("root");
        let lookalike = tmp.path().join("root2");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&lookalike).unwrap();
        touch(&lookalike.join("x.tmp"), 1);
        touch(&root.join("y.tmp"), 1);
        let root_c = canonical(&root).unwrap();
        assert!(is_within(&root_c, &root.join("y.tmp")));
        assert!(!is_within(&root_c, &lookalike.join("x.tmp")));
        assert!(!is_within(&root_c, &root), "root itself is not within root");
        assert!(!is_within(&root_c, &root.join("missing.tmp")));
    }

    #[test]
    fn delete_refuses_directories() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        fs::create_dir_all(root.join("dir")).unwrap();
        let roots = vec![canonical(&root).unwrap()];
        let (outcome, _) = delete_file(&roots, &root.join("dir"));
        assert_eq!(outcome, DeleteOutcome::Failed);
        assert!(root.join("dir").exists());
    }

    #[test]
    fn missing_file_is_reported_not_failed() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        let roots = vec![canonical(&root).unwrap()];
        let (outcome, _) = delete_file(&roots, &root.join("gone.tmp"));
        assert_eq!(outcome, DeleteOutcome::Missing);
    }

    #[cfg(windows)]
    #[test]
    fn locked_file_is_reported_as_locked() {
        use std::os::windows::fs::OpenOptionsExt;
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        let locked = root.join("locked.tmp");
        touch(&locked, 4);
        // Exclusive open (share mode 0) makes any delete fail with ERROR_SHARING_VIOLATION.
        let _handle = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&locked)
            .unwrap();
        let roots = vec![canonical(&root).unwrap()];
        let (outcome, _) = delete_file(&roots, &locked);
        assert_eq!(outcome, DeleteOutcome::Locked);
        assert!(locked.exists());
    }

    #[test]
    fn cancel_stops_cleaning() {
        let tmp = tempfile::tempdir().unwrap();
        let root = deep_root(tmp.path());
        for i in 0..10 {
            touch(&root.join(format!("{i}.tmp")), 1);
        }
        let cancel = AtomicBool::new(false);
        let cat = scan_category(
            &def(&root, Selector::Recursive, false),
            ScanOptions::default(),
            &cancel,
            |_, _| {},
        );
        cancel.store(true, Ordering::SeqCst);
        let result = clean_category(&cat, &cancel, |_, _, _, _, _| {});
        assert_eq!(result.deleted_files, 0);
        assert_eq!(fs::read_dir(&root).unwrap().count(), 10);
    }

    #[test]
    fn session_state_guards_concurrency_and_ids() {
        let state = CleanerState::default();
        state.begin().unwrap();
        assert!(matches!(state.begin(), Err(AppError::Busy(_))));
        state.end();
        state.begin().unwrap();
        state.end();

        state.store_session(ScanSession {
            id: "abc".into(),
            created: Instant::now(),
            categories: HashMap::new(),
        });
        assert!(matches!(
            state.take_session("other"),
            Err(AppError::NotFound(_))
        ));
        assert!(state.take_session("abc").is_ok());
        assert!(
            state.take_session("abc").is_err(),
            "sessions are single-use"
        );
    }

    #[test]
    fn catalogue_has_unique_ids_and_safe_roots() {
        let defs = categories();
        let mut ids: Vec<&str> = defs.iter().map(|d| d.id).collect();
        let n = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), n, "duplicate category ids");
        for d in &defs {
            for r in &d.roots {
                assert!(r.is_absolute(), "{}", r.display());
                assert!(is_safe_root(r), "unsafe root {}", r.display());
            }
        }
    }
}
