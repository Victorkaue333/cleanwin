//! Process listing helpers and guarded termination.
//!
//! Termination goes through `OpenProcess(PROCESS_TERMINATE)` + `TerminateProcess`
//! so the real Win32 error reaches the user ("access denied" usually means the
//! target runs elevated or belongs to another session). Critical Windows
//! processes are refused before any handle is opened.

use std::collections::HashMap;

use sysinfo::{Pid, Process};

use crate::errors::{AppError, AppResult};
use crate::models::{ProcessGroup, ProcessInfo};

/// Process names that must never be terminated from CleanWin. Killing any of
/// these either crashes Windows immediately or breaks the session.
pub const PROTECTED_NAMES: &[&str] = &[
    "system",
    "registry",
    "memory compression",
    "secure system",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "lsaiso.exe",
    "svchost.exe",
    "dwm.exe",
    "fontdrvhost.exe",
    "sihost.exe",
    "ntoskrnl.exe",
    "msmpeng.exe",
    "wudfhost.exe",
    "audiodg.exe",
];

/// Reason a process is protected, if it is.
pub fn protection_reason(pid: u32, name: &str, own_pid: u32) -> Option<&'static str> {
    if pid == 0 || pid == 4 {
        return Some("kernel");
    }
    if pid == own_pid {
        return Some("self");
    }
    let lowered = name.to_ascii_lowercase();
    if PROTECTED_NAMES.contains(&lowered.as_str()) {
        return Some("critical_windows_process");
    }
    None
}

pub fn to_info(process: &Process, logical_cores: usize, own_pid: u32) -> ProcessInfo {
    let pid = process.pid().as_u32();
    let name = process.name().to_string_lossy().to_string();
    let reason = protection_reason(pid, &name, own_pid);
    let cores = logical_cores.max(1) as f32;
    ProcessInfo {
        pid,
        parent_pid: process.parent().map(|p| p.as_u32()),
        name,
        exe: process.exe().map(|p| p.display().to_string()),
        cpu_percent: (process.cpu_usage() / cores).clamp(0.0, 100.0),
        memory_bytes: process.memory(),
        start_time_secs: process.start_time(),
        protected: reason.is_some(),
        protection_reason: reason.map(str::to_string),
    }
}

/// Aggregate processes by executable name (Task Manager style) and return the
/// `limit` heaviest groups by memory.
pub fn top_groups(processes: &[ProcessInfo], limit: usize) -> Vec<ProcessGroup> {
    let mut groups: HashMap<String, ProcessGroup> = HashMap::new();
    for p in processes {
        let key = p.name.to_ascii_lowercase();
        let g = groups.entry(key).or_insert_with(|| ProcessGroup {
            name: p.name.clone(),
            pids: Vec::new(),
            cpu_percent: 0.0,
            memory_bytes: 0,
            protected: false,
            exe: None,
        });
        g.pids.push(p.pid);
        g.cpu_percent += p.cpu_percent;
        g.memory_bytes += p.memory_bytes;
        g.protected |= p.protected;
        if g.exe.is_none() {
            g.exe = p.exe.clone();
        }
    }
    let mut out: Vec<ProcessGroup> = groups.into_values().collect();
    out.sort_by_key(|g| std::cmp::Reverse(g.memory_bytes));
    out.truncate(limit);
    for g in &mut out {
        g.cpu_percent = g.cpu_percent.clamp(0.0, 100.0);
        g.pids.sort_unstable();
    }
    out
}

/// Terminate a process by pid. `name` is the name observed in the last
/// snapshot (used for the protection check).
pub fn terminate(pid: u32, name: &str, own_pid: u32) -> AppResult<()> {
    if let Some(reason) = protection_reason(pid, name, own_pid) {
        return Err(AppError::Protected(format!("{name} ({reason})")));
    }
    terminate_impl(pid)
}

#[cfg(windows)]
fn terminate_impl(pid: u32) -> AppResult<()> {
    use windows::Win32::Foundation::{CloseHandle, ERROR_ACCESS_DENIED, ERROR_INVALID_PARAMETER};
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    // SAFETY: plain Win32 calls with a valid access mask; the handle is closed below.
    let handle = unsafe { OpenProcess(PROCESS_TERMINATE, false, pid) }.map_err(|err| {
        if err.code() == ERROR_ACCESS_DENIED.to_hresult() {
            AppError::PermissionDenied(format!("pid {pid}: elevated or system process"))
        } else if err.code() == ERROR_INVALID_PARAMETER.to_hresult() {
            AppError::NotFound(format!("pid {pid} no longer exists"))
        } else {
            AppError::Internal(format!("OpenProcess({pid}): {err}"))
        }
    })?;
    let result = unsafe { TerminateProcess(handle, 1) };
    let _ = unsafe { CloseHandle(handle) };
    result.map_err(|err| {
        if err.code() == ERROR_ACCESS_DENIED.to_hresult() {
            AppError::PermissionDenied(format!("pid {pid}: {err}"))
        } else {
            AppError::Internal(format!("TerminateProcess({pid}): {err}"))
        }
    })
}

#[cfg(not(windows))]
fn terminate_impl(_pid: u32) -> AppResult<()> {
    Err(AppError::Unsupported("process termination".into()))
}

/// Re-resolve the name of a pid through sysinfo for the protection check when
/// the pid is not in the cached snapshot.
pub fn lookup_name(pid: u32) -> Option<String> {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
    let mut sys = System::new().ok()?;
    let target = Pid::from_u32(pid);
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[target]),
        true,
        ProcessRefreshKind::nothing(),
    );
    sys.process(target)
        .map(|p| p.name().to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(pid: u32, name: &str, mem: u64, cpu: f32) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid: None,
            name: name.into(),
            exe: None,
            cpu_percent: cpu,
            memory_bytes: mem,
            start_time_secs: 0,
            protected: protection_reason(pid, name, 999).is_some(),
            protection_reason: None,
        }
    }

    #[test]
    fn protection_rules() {
        assert_eq!(
            protection_reason(0, "System Idle Process", 1),
            Some("kernel")
        );
        assert_eq!(protection_reason(4, "System", 1), Some("kernel"));
        assert_eq!(protection_reason(42, "cleanwin.exe", 42), Some("self"));
        assert_eq!(
            protection_reason(500, "CSRSS.EXE", 1),
            Some("critical_windows_process")
        );
        assert_eq!(
            protection_reason(501, "svchost.exe", 1),
            Some("critical_windows_process")
        );
        assert_eq!(protection_reason(600, "notepad.exe", 1), None);
        assert_eq!(protection_reason(601, "explorer.exe", 1), None);
    }

    #[test]
    fn terminate_refuses_protected_without_touching_win32() {
        let err = terminate(4, "System", 1).unwrap_err();
        assert!(matches!(err, AppError::Protected(_)));
        let err = terminate(77, "lsass.exe", 1).unwrap_err();
        assert!(matches!(err, AppError::Protected(_)));
    }

    #[test]
    fn groups_aggregate_by_name_and_sort_by_memory() {
        let list = vec![
            info(1, "chrome.exe", 100, 1.0),
            info(2, "Chrome.exe", 300, 2.0),
            info(3, "code.exe", 250, 0.5),
            info(4, "svchost.exe", 900, 0.1),
        ];
        let groups = top_groups(&list, 2);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].name.to_lowercase(), "svchost.exe");
        assert!(groups[0].protected);
        assert_eq!(groups[1].name.to_lowercase(), "chrome.exe");
        assert_eq!(groups[1].memory_bytes, 400);
        assert_eq!(groups[1].pids, vec![1, 2]);
        assert!((groups[1].cpu_percent - 3.0).abs() < f32::EPSILON);
    }

    /// Spawns a real process and terminates it through the Win32 path.
    /// Run explicitly: `cargo test -- --ignored terminates_a_process_we_spawned`.
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn terminates_a_process_we_spawned() {
        use std::process::{Command, Stdio};
        let mut child = Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn ping");
        let pid = child.id();
        std::thread::sleep(std::time::Duration::from_millis(400));
        let name = lookup_name(pid).expect("spawned process visible to sysinfo");
        assert_eq!(name.to_ascii_lowercase(), "ping.exe");
        terminate(pid, &name, std::process::id()).expect("terminate own child");
        let status = child.wait().expect("wait");
        assert!(!status.success(), "process must have been killed");
    }
}
