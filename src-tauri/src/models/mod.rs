//! Data transfer types shared between the Rust backend and the React frontend.
//! Every struct is serialised with camelCase keys to match the TypeScript types
//! in `src/types/`.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub timestamp_ms: u64,
    pub uptime_secs: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disks: Vec<DiskMetrics>,
    pub gpu: Option<GpuMetrics>,
    pub gpus: Vec<GpuMetrics>,
    pub gpu_status: AvailabilityStatus,
    pub temperature: TemperatureMetrics,
    pub network: NetworkMetrics,
    pub battery: Option<BatteryMetrics>,
    pub top_processes: Vec<ProcessGroup>,
    pub process_count: usize,
    pub health: HealthStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AvailabilityStatus {
    Available,
    NotAvailable,
    NotSupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuMetrics {
    pub usage_percent: f32,
    pub per_core: Vec<f32>,
    pub logical_cores: usize,
    pub physical_cores: Option<usize>,
    pub brand: String,
    pub frequency_mhz: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskMetrics {
    pub mount_point: String,
    pub name: String,
    pub file_system: String,
    pub kind: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub usage_percent: f32,
    pub is_removable: bool,
    pub is_system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuMetrics {
    pub name: String,
    pub vendor: Option<String>,
    pub usage_percent: Option<f32>,
    pub memory_total_bytes: Option<u64>,
    pub memory_used_bytes: Option<u64>,
    pub temperature_c: Option<f32>,
    pub temperature_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemperatureMetrics {
    pub cpu_c: Option<f32>,
    pub status: Option<AvailabilityStatus>,
    pub sensors: Vec<SensorReading>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorReading {
    pub label: String,
    pub value_c: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMetrics {
    pub download_bps: u64,
    pub upload_bps: u64,
    pub total_received_bytes: u64,
    pub total_transmitted_bytes: u64,
    pub connected: Option<bool>,
    pub interfaces: Vec<NetworkInterfaceMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfaceMetrics {
    pub name: String,
    pub download_bps: u64,
    pub upload_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryMetrics {
    pub percent: Option<u8>,
    pub charging: bool,
    pub on_ac_power: bool,
    pub remaining_secs: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub level: HealthLevel,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthLevel {
    Healthy,
    Attention,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub host_name: String,
    pub cpu_brand: String,
    pub cpu_vendor: String,
    pub logical_cores: usize,
    pub physical_cores: Option<usize>,
    pub arch: String,
    pub total_memory_bytes: u64,
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub exe: Option<String>,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub start_time_secs: u64,
    pub protected: bool,
    pub protection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessGroup {
    pub name: String,
    pub pids: Vec<u32>,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub protected: bool,
    pub exe: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KillResult {
    pub pid: u32,
    pub success: bool,
    pub message: String,
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanCategoryInfo {
    pub id: String,
    pub roots: Vec<String>,
    pub requires_admin: bool,
    pub closes_apps_hint: bool,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub size_bytes: u64,
    pub modified_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCategoryResult {
    pub id: String,
    pub roots: Vec<String>,
    pub file_count: u64,
    pub total_bytes: u64,
    pub skipped_recent_count: u64,
    pub skipped_recent_bytes: u64,
    pub access_denied_count: u64,
    pub partial: bool,
    pub largest: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub session_id: String,
    pub duration_ms: u64,
    pub categories: Vec<ScanCategoryResult>,
    pub total_files: u64,
    pub total_bytes: u64,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScanEvent {
    #[serde(rename_all = "camelCase")]
    CategoryStarted { id: String },
    #[serde(rename_all = "camelCase")]
    Progress {
        id: String,
        file_count: u64,
        total_bytes: u64,
    },
    #[serde(rename_all = "camelCase")]
    CategoryFinished { result: ScanCategoryResult },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanRequest {
    pub session_id: String,
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileError {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CleanCategoryResult {
    pub id: String,
    pub deleted_files: u64,
    pub freed_bytes: u64,
    pub locked_files: u64,
    pub failed_files: u64,
    pub missing_files: u64,
    pub removed_dirs: u64,
    pub errors: Vec<FileError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanSummary {
    pub duration_ms: u64,
    pub deleted_files: u64,
    pub freed_bytes: u64,
    pub locked_files: u64,
    pub failed_files: u64,
    pub categories: Vec<CleanCategoryResult>,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CleanEvent {
    #[serde(rename_all = "camelCase")]
    CategoryStarted { id: String, file_count: u64 },
    #[serde(rename_all = "camelCase")]
    Progress {
        id: String,
        processed: u64,
        deleted_files: u64,
        freed_bytes: u64,
        locked_files: u64,
        failed_files: u64,
    },
    #[serde(rename_all = "camelCase")]
    CategoryFinished { result: CleanCategoryResult },
}

// ---------------------------------------------------------------------------
// Recycle bin & utilities
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinInfo {
    pub item_count: u64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinResult {
    pub emptied: bool,
    pub was_empty: bool,
    pub freed_bytes: u64,
    pub item_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UtilitiesState {
    pub keep_awake: bool,
    pub desktop_icons_visible: Option<bool>,
    pub desktop_icons_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub identifier: String,
    pub config_dir: String,
    pub log_dir: String,
    pub repository: String,
    pub elevated: bool,
    pub debug: bool,
}
