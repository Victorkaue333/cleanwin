//! Real hardware metrics collected with `sysinfo` plus a few Win32 calls.
//!
//! One `MetricsCollector` lives for the whole app and is refreshed in place by
//! the background loop (`services::metrics_loop`). Creating a new `System`
//! per call would always report 0% CPU, because CPU usage is a delta between
//! two refreshes.

use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use sysinfo::{
    Components, Disks, Gpus, Networks, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind,
};

use crate::errors::AppResult;
use crate::models::*;
use crate::system::processes;

const TOP_PROCESSES: usize = 8;
/// WMI thermal queries are slow; refresh them only every N snapshots.
const COMPONENT_REFRESH_EVERY: u32 = 8;

pub struct MetricsCollector {
    sys: System,
    disks: Disks,
    networks: Networks,
    components: Option<Components>,
    gpus: Option<Gpus>,
    nvml: Option<nvml_wrapper::Nvml>,
    last_net: Instant,
    ticks: u32,
    own_pid: u32,
    logical_cores: usize,
    physical_cores: Option<usize>,
    static_info: StaticSystemInfo,
    last_processes: Vec<ProcessInfo>,
    last_temperature: TemperatureMetrics,
}

impl MetricsCollector {
    pub fn new() -> AppResult<Self> {
        let mut sys = System::new()?;
        sys.refresh_memory();
        sys.refresh_cpu_all();
        // CPU usage needs two samples spaced by the minimum interval.
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.max(Duration::from_millis(250)));
        sys.refresh_cpu_all();

        let disks = Disks::new_with_refreshed_list()?;
        let networks = Networks::new_with_refreshed_list()?;
        let components = Components::new_with_refreshed_list().ok();
        let gpus = Gpus::new_with_refreshed_list().ok();
        let nvml = nvml_wrapper::Nvml::init().ok();
        if nvml.is_some() {
            log::info!("NVML available: GPU temperature enabled");
        }

        let logical_cores = sys.cpus().len().max(1);
        let physical_cores = System::physical_core_count().ok();
        let first_cpu = sys.cpus().first();
        let static_info = StaticSystemInfo {
            os_name: System::name().unwrap_or_else(|_| "Windows".into()),
            os_version: System::long_os_version()
                .or_else(|_| System::os_version())
                .unwrap_or_default(),
            kernel_version: System::kernel_version().unwrap_or_default(),
            host_name: System::host_name().unwrap_or_default(),
            cpu_brand: first_cpu
                .map(|c| c.brand().trim().to_string())
                .unwrap_or_default(),
            cpu_vendor: first_cpu
                .map(|c| c.vendor_id().to_string())
                .unwrap_or_default(),
            logical_cores,
            physical_cores,
            arch: System::cpu_arch(),
            total_memory_bytes: sys.total_memory(),
        };

        Ok(Self {
            sys,
            disks,
            networks,
            components,
            gpus,
            nvml,
            last_net: Instant::now(),
            ticks: 0,
            own_pid: std::process::id(),
            logical_cores,
            physical_cores,
            static_info,
            last_processes: Vec::new(),
            last_temperature: TemperatureMetrics::default(),
        })
    }

    pub fn static_info(&self) -> &StaticSystemInfo {
        &self.static_info
    }

    pub fn processes(&self) -> &[ProcessInfo] {
        &self.last_processes
    }

    /// Refresh everything and build a snapshot.
    pub fn refresh(&mut self) -> SystemSnapshot {
        self.ticks = self.ticks.wrapping_add(1);
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();
        self.sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing()
                .with_cpu()
                .with_memory()
                .with_exe(UpdateKind::OnlyIfNotSet),
        );
        self.disks.refresh(true);

        let elapsed = self.last_net.elapsed().as_secs_f64().max(0.001);
        self.networks.refresh(true);
        self.last_net = Instant::now();

        let cpu = self.cpu_metrics();
        let memory = self.memory_metrics();
        let disks = self.disk_metrics();
        let network = self.network_metrics(elapsed);
        let (gpus, gpu_status) = self.gpu_metrics();
        let temperature = self.temperature_metrics();
        let battery = battery_metrics();

        self.last_processes = self
            .sys
            .processes()
            .values()
            .map(|p| processes::to_info(p, self.logical_cores, self.own_pid))
            .collect();
        let top_processes = processes::top_groups(&self.last_processes, TOP_PROCESSES);

        let health = health(&cpu, &memory, &disks, &temperature, gpus.first());

        SystemSnapshot {
            timestamp_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            uptime_secs: System::uptime().unwrap_or(0),
            cpu,
            memory,
            disks,
            gpu: gpus.first().cloned(),
            gpus,
            gpu_status,
            temperature,
            network,
            battery,
            top_processes,
            process_count: self.last_processes.len(),
            health,
        }
    }

    fn cpu_metrics(&self) -> CpuMetrics {
        let cpus = self.sys.cpus();
        CpuMetrics {
            usage_percent: self.sys.global_cpu_usage().clamp(0.0, 100.0),
            per_core: cpus.iter().map(|c| c.usage().clamp(0.0, 100.0)).collect(),
            logical_cores: self.logical_cores,
            physical_cores: self.physical_cores,
            brand: self.static_info.cpu_brand.clone(),
            frequency_mhz: cpus.first().map(|c| c.frequency()).unwrap_or(0),
        }
    }

    fn memory_metrics(&self) -> MemoryMetrics {
        let total = self.sys.total_memory();
        let used = self.sys.used_memory();
        MemoryMetrics {
            total_bytes: total,
            used_bytes: used,
            available_bytes: self.sys.available_memory(),
            usage_percent: percent(used, total),
            swap_total_bytes: self.sys.total_swap(),
            swap_used_bytes: self.sys.used_swap(),
        }
    }

    fn disk_metrics(&self) -> Vec<DiskMetrics> {
        let system_root = std::env::var_os("SystemDrive")
            .map(|s| s.to_string_lossy().to_uppercase())
            .unwrap_or_else(|| "C:".into());
        let mut out: Vec<DiskMetrics> = self
            .disks
            .iter()
            .filter(|d| d.total_space() > 0)
            .map(|d| {
                let total = d.total_space();
                let available = d.available_space();
                let used = total.saturating_sub(available);
                let mount = d.mount_point().display().to_string();
                let mount_upper = mount.trim_end_matches('\\').to_uppercase();
                DiskMetrics {
                    is_system: mount_upper == system_root,
                    mount_point: mount,
                    name: d.name().to_string_lossy().to_string(),
                    file_system: d.file_system().to_string_lossy().to_string(),
                    kind: d.kind().to_string(),
                    total_bytes: total,
                    available_bytes: available,
                    used_bytes: used,
                    usage_percent: percent(used, total),
                    is_removable: d.is_removable(),
                }
            })
            .collect();
        out.sort_by(|a, b| {
            b.is_system
                .cmp(&a.is_system)
                .then(a.mount_point.cmp(&b.mount_point))
        });
        out
    }

    fn network_metrics(&self, elapsed_secs: f64) -> NetworkMetrics {
        let mut m = NetworkMetrics {
            connected: internet_connected(),
            ..Default::default()
        };
        for (name, data) in self.networks.iter() {
            let name = name.to_string_lossy().to_string();
            let lower = name.to_lowercase();
            if lower.contains("loopback") || lower.contains("pseudo-interface") {
                continue;
            }
            let down = (data.received() as f64 / elapsed_secs) as u64;
            let up = (data.transmitted() as f64 / elapsed_secs) as u64;
            m.download_bps += down;
            m.upload_bps += up;
            m.total_received_bytes += data.total_received();
            m.total_transmitted_bytes += data.total_transmitted();
            if down > 0 || up > 0 || data.total_received() > 0 {
                m.interfaces.push(NetworkInterfaceMetrics {
                    name: name.clone(),
                    download_bps: down,
                    upload_bps: up,
                });
            }
        }
        m.interfaces
            .sort_by_key(|i| std::cmp::Reverse(i.download_bps + i.upload_bps));
        m
    }

    fn gpu_metrics(&mut self) -> (Vec<GpuMetrics>, AvailabilityStatus) {
        let Some(gpus) = self.gpus.as_mut() else {
            return (Vec::new(), AvailabilityStatus::NotSupported);
        };
        gpus.refresh(true);
        let nvml_temp = self.nvml.as_ref().and_then(|n| {
            n.device_by_index(0).ok().and_then(|d| {
                d.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
                    .ok()
            })
        });
        let mut list: Vec<GpuMetrics> = gpus
            .iter()
            .filter(|g| {
                !g.model()
                    .map(|m| m.contains("Microsoft Basic Render"))
                    .unwrap_or(false)
            })
            .map(|g| GpuMetrics {
                name: g.model().unwrap_or("GPU").to_string(),
                vendor: g.vendor().map(str::to_string),
                usage_percent: g.usage().map(|u| u.clamp(0.0, 100.0)),
                memory_total_bytes: g.total_memory(),
                memory_used_bytes: g.used_memory(),
                temperature_c: None,
                temperature_source: None,
            })
            .collect();
        // Dedicated GPUs (more VRAM) first.
        list.sort_by_key(|g| std::cmp::Reverse(g.memory_total_bytes));
        if let Some(t) = nvml_temp {
            if let Some(nv) = list.iter_mut().find(|g| {
                g.vendor
                    .as_deref()
                    .map(|v| v.to_lowercase().contains("nvidia"))
                    .unwrap_or(false)
                    || g.name.to_lowercase().contains("nvidia")
                    || g.name.to_lowercase().contains("geforce")
            }) {
                nv.temperature_c = Some(t as f32);
                nv.temperature_source = Some("nvml".into());
            }
        }
        let status = if list.is_empty() {
            AvailabilityStatus::NotAvailable
        } else {
            AvailabilityStatus::Available
        };
        (list, status)
    }

    fn temperature_metrics(&mut self) -> TemperatureMetrics {
        if self.ticks % COMPONENT_REFRESH_EVERY != 1 {
            return self.last_temperature.clone();
        }
        let Some(components) = self.components.as_mut() else {
            self.last_temperature = TemperatureMetrics {
                cpu_c: None,
                status: Some(AvailabilityStatus::NotSupported),
                sensors: Vec::new(),
            };
            return self.last_temperature.clone();
        };
        components.refresh(true);
        let sensors: Vec<SensorReading> = components
            .iter()
            .filter_map(|c| {
                c.temperature().map(|t| SensorReading {
                    label: c.label().to_string(),
                    value_c: t,
                })
            })
            .filter(|s| s.value_c > -50.0 && s.value_c < 150.0)
            .collect();
        let cpu_c = sensors
            .iter()
            .find(|s| {
                let l = s.label.to_lowercase();
                l.contains("cpu") || l.contains("core") || l.contains("package")
            })
            .or_else(|| sensors.first())
            .map(|s| s.value_c);
        self.last_temperature = TemperatureMetrics {
            cpu_c,
            status: Some(if sensors.is_empty() {
                AvailabilityStatus::NotAvailable
            } else {
                AvailabilityStatus::Available
            }),
            sensors,
        };
        self.last_temperature.clone()
    }
}

pub fn percent(part: u64, total: u64) -> f32 {
    if total == 0 {
        0.0
    } else {
        ((part as f64 / total as f64) * 100.0).clamp(0.0, 100.0) as f32
    }
}

fn health(
    cpu: &CpuMetrics,
    memory: &MemoryMetrics,
    disks: &[DiskMetrics],
    temperature: &TemperatureMetrics,
    gpu: Option<&GpuMetrics>,
) -> HealthStatus {
    let mut critical = Vec::new();
    let mut attention = Vec::new();
    if cpu.usage_percent >= 90.0 {
        critical.push("cpu_critical");
    } else if cpu.usage_percent >= 75.0 {
        attention.push("cpu_high");
    }
    if memory.usage_percent >= 92.0 {
        critical.push("memory_critical");
    } else if memory.usage_percent >= 80.0 {
        attention.push("memory_high");
    }
    for d in disks.iter().filter(|d| d.is_system || !d.is_removable) {
        if d.usage_percent >= 95.0 {
            critical.push("disk_critical");
            break;
        } else if d.usage_percent >= 90.0 {
            attention.push("disk_high");
            break;
        }
    }
    let hottest = temperature
        .cpu_c
        .into_iter()
        .chain(gpu.and_then(|g| g.temperature_c))
        .fold(None, |acc: Option<f32>, t| {
            Some(acc.map_or(t, |a| a.max(t)))
        });
    if let Some(t) = hottest {
        if t >= 95.0 {
            critical.push("temperature_critical");
        } else if t >= 85.0 {
            attention.push("temperature_high");
        }
    }
    let (level, reasons) = if !critical.is_empty() {
        (HealthLevel::Critical, critical)
    } else if !attention.is_empty() {
        (HealthLevel::Attention, attention)
    } else {
        (HealthLevel::Healthy, Vec::new())
    };
    HealthStatus {
        level,
        reasons: reasons.into_iter().map(str::to_string).collect(),
    }
}

#[cfg(windows)]
fn battery_metrics() -> Option<BatteryMetrics> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut status = SYSTEM_POWER_STATUS::default();
    // SAFETY: out-parameter of the documented size.
    if unsafe { GetSystemPowerStatus(&mut status) }.is_err() {
        return None;
    }
    const NO_BATTERY: u8 = 128;
    const CHARGING: u8 = 8;
    if status.BatteryFlag == NO_BATTERY || status.BatteryFlag == 255 {
        return None;
    }
    Some(BatteryMetrics {
        percent: (status.BatteryLifePercent != 255).then_some(status.BatteryLifePercent),
        charging: status.BatteryFlag & CHARGING != 0,
        on_ac_power: status.ACLineStatus == 1,
        remaining_secs: (status.BatteryLifeTime != u32::MAX).then_some(status.BatteryLifeTime),
    })
}

#[cfg(not(windows))]
fn battery_metrics() -> Option<BatteryMetrics> {
    None
}

#[cfg(windows)]
fn internet_connected() -> Option<bool> {
    use windows::Win32::Networking::WinInet::{InternetGetConnectedState, INTERNET_CONNECTION};
    let mut flags = INTERNET_CONNECTION(0);
    // SAFETY: documented WinINet call; returns Err when offline.
    Some(unsafe { InternetGetConnectedState(&mut flags, None) }.is_ok())
}

#[cfg(not(windows))]
fn internet_connected() -> Option<bool> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_is_safe_and_clamped() {
        assert_eq!(percent(0, 0), 0.0);
        assert_eq!(percent(50, 100), 50.0);
        assert_eq!(percent(200, 100), 100.0);
        assert!((percent(1, 3) - 33.333).abs() < 0.01);
    }

    fn cpu(p: f32) -> CpuMetrics {
        CpuMetrics {
            usage_percent: p,
            per_core: vec![],
            logical_cores: 1,
            physical_cores: None,
            brand: String::new(),
            frequency_mhz: 0,
        }
    }
    fn mem(p: f32) -> MemoryMetrics {
        MemoryMetrics {
            total_bytes: 100,
            used_bytes: p as u64,
            available_bytes: 0,
            usage_percent: p,
            swap_total_bytes: 0,
            swap_used_bytes: 0,
        }
    }
    fn disk(p: f32) -> DiskMetrics {
        DiskMetrics {
            mount_point: "C:\\".into(),
            name: String::new(),
            file_system: "NTFS".into(),
            kind: "SSD".into(),
            total_bytes: 100,
            available_bytes: 0,
            used_bytes: 0,
            usage_percent: p,
            is_removable: false,
            is_system: true,
        }
    }

    #[test]
    fn health_levels() {
        let t = TemperatureMetrics::default();
        let h = health(&cpu(10.0), &mem(50.0), &[disk(40.0)], &t, None);
        assert_eq!(h.level, HealthLevel::Healthy);
        assert!(h.reasons.is_empty());

        let h = health(&cpu(80.0), &mem(50.0), &[disk(40.0)], &t, None);
        assert_eq!(h.level, HealthLevel::Attention);
        assert_eq!(h.reasons, vec!["cpu_high"]);

        let h = health(&cpu(10.0), &mem(95.0), &[disk(96.0)], &t, None);
        assert_eq!(h.level, HealthLevel::Critical);
        assert!(h.reasons.contains(&"memory_critical".to_string()));
        assert!(h.reasons.contains(&"disk_critical".to_string()));

        let hot = TemperatureMetrics {
            cpu_c: Some(90.0),
            status: None,
            sensors: vec![],
        };
        let h = health(&cpu(10.0), &mem(10.0), &[disk(10.0)], &hot, None);
        assert_eq!(h.level, HealthLevel::Attention);
        assert_eq!(h.reasons, vec!["temperature_high"]);
    }

    #[test]
    #[cfg(windows)]
    fn collector_produces_real_values() {
        let mut c = MetricsCollector::new().expect("collector");
        let snap = c.refresh();
        assert!(snap.cpu.logical_cores >= 1);
        assert_eq!(snap.cpu.per_core.len(), snap.cpu.logical_cores);
        assert!(snap.memory.total_bytes > 0);
        assert!(snap.memory.used_bytes <= snap.memory.total_bytes);
        assert!(!snap.disks.is_empty());
        assert!(snap.disks.iter().any(|d| d.is_system));
        for d in &snap.disks {
            assert_eq!(d.used_bytes + d.available_bytes, d.total_bytes);
        }
        assert!(snap.process_count > 10);
        assert!(!snap.top_processes.is_empty());
        assert!(snap.uptime_secs > 0);
        assert!(!c.static_info().cpu_brand.is_empty());
        assert!(!c.processes().is_empty());
        let own = c
            .processes()
            .iter()
            .find(|p| p.pid == std::process::id())
            .unwrap();
        assert!(own.protected, "own process must be protected");
    }
}
