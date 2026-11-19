//! Windows签名更新入口：服务端地址和公钥只取构建配置，不接受前端安装地址。
use serde::Serialize;
use tauri::{ipc::Channel, AppHandle};

#[tauri::command]
pub fn open_update_website() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", "http://teddy-personal.cloud:22830/projects/puzzle"])
            .creation_flags(0x08000000)
            .spawn().map(|_| ()).map_err(|_| "无法打开浏览器".into())
    }
    #[cfg(not(windows))]
    { Err("请使用系统浏览器打开网站".into()) }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    version: String,
    notes: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    phase: &'static str,
    downloaded: u64,
    total: Option<u64>,
}

#[cfg(windows)]
#[derive(Default)]
pub struct WindowsUpdates {
    // 检测和安装共用操作锁；连续点击不会重复下载或覆盖待安装版本。
    operation: tokio::sync::Mutex<()>,
    pending: tokio::sync::Mutex<Option<tauri_plugin_updater::Update>>,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<Release>, String> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        use tauri_plugin_updater::UpdaterExt;
        let state = app.state::<WindowsUpdates>();
        let _operation = state.operation.try_lock().map_err(|_| "正在处理更新，请稍候")?;
        // 失败不能继续安装上次的陈旧结果，也不能伪装成“最新版”。
        *state.pending.lock().await = None;
        let config = app.config().plugins.0.get("updater").ok_or("更新服务尚未配置")?;
        let key = config["pubkey"].as_str().unwrap_or("");
        let endpoints = config["endpoints"].as_array();
        if key.trim().is_empty() || endpoints.is_none_or(|items| items.is_empty()) {
            return Err("更新服务尚未配置".into());
        }
        // 当前 NAT 服务器仅提供 HTTP；仅允许构建配置主动启用，包签名与版本绑定仍为强制。
        let allow_http = config["dangerousInsecureTransportProtocol"].as_bool().unwrap_or(false);
        let allowed_http_origins: Vec<_> = endpoints.into_iter().flatten()
            .filter_map(|value| value.as_str().and_then(|text| url::Url::parse(text).ok()))
            .filter(|endpoint| endpoint.scheme() == "http")
            .map(|endpoint| endpoint.origin()).collect();
        let updater = app.updater_builder()
            .timeout(std::time::Duration::from_secs(12))
            .configure_client(move |client| client.https_only(!allow_http))
            .build().map_err(|error| { tracing::warn!(%error, "updater configuration failed"); "更新服务配置有误" })?;
        let mut update = updater.check().await.map_err(|error| {
            tracing::warn!(%error, "update check failed");
            "暂时无法检查更新，请稍后重试"
        })?;
        if let Some(release) = &mut update {
            let same_http_origin = allow_http && release.download_url.scheme() == "http"
                && allowed_http_origins.contains(&release.download_url.origin());
            if release.download_url.scheme() != "https" && !same_http_origin {
                return Err("更新文件地址不属于已配置的更新服务器".into());
            }
            // 检测短超时，安装下载单独允许慢网络；签名由官方组件强制验证。
            release.timeout = Some(std::time::Duration::from_secs(20 * 60));
        }
        let public = update.as_ref().map(|release| Release {
            version: release.version.clone(),
            notes: release.body.clone().unwrap_or_default().chars().take(12_000).collect(),
        });
        *state.pending.lock().await = update;
        Ok(public)
    }
    #[cfg(not(windows))]
    { let _ = app; Err("此平台暂不支持应用内更新".into()) }
}

#[tauri::command]
pub async fn install_update(app: AppHandle, on_progress: Channel<UpdateProgress>) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let state = app.state::<WindowsUpdates>();
        let _operation = state.operation.try_lock().map_err(|_| "正在处理更新，请稍候")?;
        let update = state.pending.lock().await.clone().ok_or("请先检查更新")?;
        let mut downloaded = 0u64;
        let mut last = std::time::Instant::now();
        let _ = on_progress.send(UpdateProgress { phase: "downloading", downloaded: 0, total: None });
        let bytes = update.download(|chunk, total| {
            downloaded = downloaded.saturating_add(chunk as u64);
            if last.elapsed().as_millis() >= 100 || total == Some(downloaded) {
                let _ = on_progress.send(UpdateProgress { phase: "downloading", downloaded, total });
                last = std::time::Instant::now();
            }
        }, || {}).await.map_err(|error| {
            tracing::warn!(%error, "update download or signature verification failed");
            "更新下载或校验失败，当前版本未更改，请重试"
        })?;
        // download已校验签名，install再次校验；只有通过后才交给NSIS覆盖并重启。
        let _ = on_progress.send(UpdateProgress { phase: "installing", downloaded, total: Some(downloaded) });
        tauri::async_runtime::spawn_blocking(move || update.install(bytes)).await
            .map_err(|_| "更新安装任务失败，请重试")?
            .map_err(|error| { tracing::warn!(%error, "update install failed"); "无法启动更新安装，请重试" })?;
        Ok(())
    }
    #[cfg(not(windows))]
    { let _ = (app, on_progress); Err("此平台暂不支持应用内更新".into()) }
}
