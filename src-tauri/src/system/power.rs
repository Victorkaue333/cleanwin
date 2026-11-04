//! "Keep screen awake" via `SetThreadExecutionState`.
//!
//! The execution state is per-thread, while Tauri commands run on a thread
//! pool. A dedicated OS thread therefore owns the state for the whole app
//! lifetime and receives enable/disable requests through a channel. Dropping
//! the handle (app exit) always clears the request so the system goes back to
//! its normal power behaviour.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender, SyncSender};
use std::sync::Mutex;

use crate::errors::{AppError, AppResult};

type Request = (bool, SyncSender<bool>);

pub struct KeepAwake {
    tx: Mutex<Option<Sender<Request>>>,
    enabled: AtomicBool,
}

impl Default for KeepAwake {
    fn default() -> Self {
        Self::new()
    }
}

impl KeepAwake {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel::<Request>();
        std::thread::Builder::new()
            .name("cleanwin-keep-awake".into())
            .spawn(move || {
                for (enable, reply) in rx {
                    let ok = apply(enable);
                    let _ = reply.send(ok);
                }
                // Channel closed: always restore the default behaviour.
                let _ = apply(false);
            })
            .expect("failed to spawn keep-awake thread");
        Self {
            tx: Mutex::new(Some(tx)),
            enabled: AtomicBool::new(false),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    /// Enable or disable. Returns the resulting state after the OS confirmed it.
    pub fn set(&self, enabled: bool) -> AppResult<bool> {
        if !cfg!(windows) {
            return Err(AppError::Unsupported("keep awake".into()));
        }
        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
        {
            let guard = self.tx.lock().expect("keep-awake mutex poisoned");
            let tx = guard
                .as_ref()
                .ok_or_else(|| AppError::Internal("keep-awake thread stopped".into()))?;
            tx.send((enabled, reply_tx))
                .map_err(|_| AppError::Internal("keep-awake thread stopped".into()))?;
        }
        let ok = reply_rx
            .recv()
            .map_err(|_| AppError::Internal("keep-awake thread did not answer".into()))?;
        if !ok {
            return Err(AppError::Internal(
                "SetThreadExecutionState rejected the request".into(),
            ));
        }
        self.enabled.store(enabled, Ordering::SeqCst);
        Ok(enabled)
    }

    /// Release the request (used on exit). Safe to call multiple times.
    pub fn shutdown(&self) {
        if self.is_enabled() {
            let _ = self.set(false);
        }
        self.tx.lock().expect("keep-awake mutex poisoned").take();
    }
}

impl Drop for KeepAwake {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(windows)]
fn apply(enable: bool) -> bool {
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };
    let flags = if enable {
        ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    // SAFETY: documented Win32 call; returns the previous state, 0 on failure.
    let previous = unsafe { SetThreadExecutionState(flags) };
    previous.0 != 0
}

#[cfg(not(windows))]
fn apply(_enable: bool) -> bool {
    false
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn toggles_and_restores() {
        let k = KeepAwake::new();
        assert!(!k.is_enabled());
        assert!(k.set(true).unwrap());
        assert!(k.is_enabled());
        assert!(!k.set(false).unwrap());
        assert!(!k.is_enabled());
        k.shutdown();
        assert!(k.set(true).is_err(), "after shutdown the thread is gone");
    }
}
