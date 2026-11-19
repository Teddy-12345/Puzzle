//! GNU builds use an embedded Microsoft loader instead of an adjacent DLL.
//! MSVC builds retain webview2-com's normal static loader implementation.
use std::{ffi::c_void, os::windows::ffi::OsStrExt, sync::OnceLock};

const PAYLOAD: &[u8] = include_bytes!("../resources/WebView2Loader.x64.dll");
const E_FAIL: i32 = 0x80004005u32 as i32;
static LIBRARY: OnceLock<Result<usize, i32>> = OnceLock::new();

#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryExW(name: *const u16, file: *mut c_void, flags: u32) -> *mut c_void;
    fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
}

fn load_library() -> Result<usize, i32> {
    let directory = std::path::PathBuf::from(std::env::var_os("LOCALAPPDATA").ok_or(E_FAIL)?)
        .join("com.puzzle.desktop").join("runtime").join("loader-0.39.1-x64");
    std::fs::create_dir_all(&directory).map_err(|_| E_FAIL)?;
    let path = directory.join("WebView2Loader.dll");
    if std::fs::read(&path).ok().as_deref() != Some(PAYLOAD) {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| E_FAIL)?.as_nanos();
        let temporary = directory.join(format!("loader-{}-{nonce}.tmp", std::process::id()));
        std::fs::write(&temporary, PAYLOAD).map_err(|_| E_FAIL)?;
        let result = std::fs::rename(&temporary, &path);
        if result.is_err() {
            let _ = std::fs::remove_file(&temporary);
        }
        // Also accepts a concurrent process publishing the exact same payload.
        if std::fs::read(&path).ok().as_deref() != Some(PAYLOAD) {
            return Err(E_FAIL);
        }
    }
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    // Absolute private path, with dependency search restricted to safe locations.
    let module = unsafe { LoadLibraryExW(wide.as_ptr(), std::ptr::null_mut(), 0x1100) };
    if module.is_null() { Err(E_FAIL) } else { Ok(module as usize) }
}

fn symbol(name: &'static [u8]) -> Result<*mut c_void, i32> {
    let module = LIBRARY.get_or_init(load_library).as_ref().map_err(|e| *e)?;
    let address = unsafe { GetProcAddress(*module as *mut c_void, name.as_ptr()) };
    if address.is_null() { Err(E_FAIL) } else { Ok(address) }
}

type CreateEnvironment = unsafe extern "system" fn(*const u16, *const u16, *mut c_void, *mut c_void) -> i32;
type BrowserVersion = unsafe extern "system" fn(*const u16, *mut *mut u16) -> i32;

#[export_name = "CreateCoreWebView2EnvironmentWithOptions"]
unsafe extern "system" fn create_environment(browser: *const u16, data: *const u16, options: *mut c_void, handler: *mut c_void) -> i32 {
    match symbol(b"CreateCoreWebView2EnvironmentWithOptions\0") {
        Ok(address) => {
            let function: CreateEnvironment = std::mem::transmute(address);
            function(browser, data, options, handler)
        }
        Err(error) => error,
    }
}

#[export_name = "GetAvailableCoreWebView2BrowserVersionString"]
unsafe extern "system" fn browser_version(browser: *const u16, version: *mut *mut u16) -> i32 {
    match symbol(b"GetAvailableCoreWebView2BrowserVersionString\0") {
        Ok(address) => {
            let function: BrowserVersion = std::mem::transmute(address);
            function(browser, version)
        }
        Err(error) => error,
    }
}

// The two exported GNU ABI functions resolve references before the import library.
// Export validation rejects any sidecar dependency added by a future API upgrade.

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn embedded_loader_can_query_the_installed_runtime() {
        let mut version = std::ptr::null_mut();
        let result = unsafe { browser_version(std::ptr::null(), &mut version) };
        assert!(result >= 0, "WebView2 query failed: {result:#x}");
        assert!(!version.is_null());
        #[link(name = "ole32")]
        extern "system" { fn CoTaskMemFree(memory: *mut c_void); }
        unsafe { CoTaskMemFree(version as *mut c_void); }
    }
}
