use std::path::Path;

use tauri::{AppHandle, Emitter};

use crate::contracts::{ProxyConfig, UpdateCheckResult};

const GITHUB_LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/ws1993/weeklytodo/releases/latest";
const GITHUB_RELEASES_PAGE: &str = "https://github.com/ws1993/weeklytodo/releases/latest";

/// Compare two dot-separated numeric version strings.
/// Returns `Ordering::Greater` when `a > b`. Missing segments count as zero.
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let to_segments = |version: &str| -> Vec<u64> {
        version
            .trim_start_matches('v')
            .split('.')
            .map(|segment| segment.trim().parse::<u64>().unwrap_or(0))
            .collect()
    };
    let left = to_segments(a);
    let right = to_segments(b);
    let length = left.len().max(right.len());
    for index in 0..length {
        let left_part = left.get(index).copied().unwrap_or(0);
        let right_part = right.get(index).copied().unwrap_or(0);
        if left_part != right_part {
            return left_part.cmp(&right_part);
        }
    }
    std::cmp::Ordering::Equal
}

fn build_client(proxy: Option<&ProxyConfig>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().user_agent("weeklytodo-updater");
    if let Some(config) = proxy {
        let use_system = config.use_system_proxy.unwrap_or(true);
        if !use_system {
            if let Some(custom_url) = &config.custom_proxy_url {
                let mut proxy = reqwest::Proxy::all(custom_url)
                    .map_err(|error| format!("创建自定义代理失败：{error}"))?;
                match (&config.username, &config.password) {
                    (Some(user), Some(password)) => {
                        proxy = proxy.basic_auth(user.as_str(), password.as_str());
                    }
                    _ => {}
                }
                builder = builder.proxy(proxy);
            } else {
                builder = builder.no_proxy();
            }
        }
    }
    builder.build().map_err(|error| format!("创建 HTTP 客户端失败：{error}"))
}

/// Query GitHub for the latest release and compare against the running version.
pub async fn check_for_update(proxy: Option<ProxyConfig>) -> Result<UpdateCheckResult, String> {
    let client = build_client(proxy.as_ref())?;
    let response = client
        .get(GITHUB_LATEST_RELEASE_URL)
        .send()
        .await
        .map_err(|error| format!("请求 GitHub Release 失败：{error}"))?;

    if response.status().as_u16() == 404 {
        return Ok(UpdateCheckResult {
            available: false,
            version: None,
            body: Some("尚未发布 GitHub Release".to_string()),
            download_url: None,
            download_size: None,
        });
    }
    if !response.status().is_success() {
        return Err(format!("GitHub Release 返回状态 {}", response.status()));
    }

    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析 Release JSON 失败：{error}"))?;
    let remote_tag = payload
        .get("tag_name")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let available = !remote_tag.is_empty()
        && compare_versions(&remote_tag, &current_version) == std::cmp::Ordering::Greater;

    let mut download_url: Option<String> = None;
    let mut download_size: Option<u64> = None;
    if let Some(assets) = payload.get("assets").and_then(|value| value.as_array()) {
        for asset in assets {
            if let Some(name) = asset.get("name").and_then(|value| value.as_str()) {
                if name.ends_with("-setup.exe") || name.ends_with("_x64-setup.exe") {
                    download_url = asset
                        .get("browser_download_url")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string());
                    download_size = asset.get("size").and_then(|value| value.as_u64());
                    break;
                }
            }
        }
    }

    Ok(UpdateCheckResult {
        available,
        version: if remote_tag.is_empty() {
            None
        } else {
            Some(remote_tag)
        },
        body: payload
            .get("body")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        download_url,
        download_size,
    })
}

/// Launch the downloaded NSIS installer so it survives app exit.
fn launch_nsis_installer(installer_path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        if !installer_path.is_file() {
            return Err(format!("安装包不存在：{}", installer_path.display()));
        }
        let file_size = std::fs::metadata(installer_path)
            .map_err(|error| format!("读取安装包失败：{error}"))?
            .len();
        if file_size < 1024 {
            return Err("安装包文件过小，下载可能不完整".to_string());
        }

        let absolute_installer = installer_path
            .canonicalize()
            .unwrap_or_else(|_| installer_path.to_path_buf());
        let installer = absolute_installer
            .to_string_lossy()
            .trim_start_matches(r"\\?\")
            .replace('\'', "''")
            .replace('"', "")
            .to_string();

        let helper_dir = std::env::temp_dir().join("weeklytodo_update");
        std::fs::create_dir_all(&helper_dir)
            .map_err(|error| format!("创建更新目录失败：{error}"))?;

        let app_process_id = std::process::id();
        let helper_script_path = helper_dir.join("launch_installer.ps1");
        let log_path = helper_dir
            .join("install.log")
            .to_string_lossy()
            .replace('\'', "''")
            .to_string();
        let script_content = format!(
            "$ErrorActionPreference = 'Continue'\r\n\
             $log = '{log_path}'\r\n\
             function Write-UpdateLog([string]$message) {{\r\n\
               $line = (Get-Date -Format o) + ' ' + $message\r\n\
               Add-Content -LiteralPath $log -Value $line -Encoding UTF8\r\n\
             }}\r\n\
             Write-UpdateLog 'helper started; waiting for pid {app_process_id}'\r\n\
             $deadline = (Get-Date).AddSeconds(90)\r\n\
             while ((Get-Date) -lt $deadline) {{\r\n\
               if (-not (Get-Process -Id {app_process_id} -ErrorAction SilentlyContinue)) {{ break }}\r\n\
               Start-Sleep -Milliseconds 250\r\n\
             }}\r\n\
             if (Get-Process -Id {app_process_id} -ErrorAction SilentlyContinue) {{\r\n\
               Write-UpdateLog 'timeout waiting for app exit; launching installer anyway'\r\n\
             }} else {{\r\n\
               Write-UpdateLog 'app exited'\r\n\
             }}\r\n\
             Start-Sleep -Milliseconds 800\r\n\
             $installer = '{installer}'\r\n\
             if (-not (Test-Path -LiteralPath $installer)) {{\r\n\
               Write-UpdateLog \"installer missing: $installer\"\r\n\
               exit 2\r\n\
             }}\r\n\
             Write-UpdateLog \"starting installer: $installer\"\r\n\
             try {{\r\n\
               $process = Start-Process -FilePath $installer -PassThru\r\n\
               Write-UpdateLog (\"installer pid=\" + $process.Id)\r\n\
             }} catch {{\r\n\
               Write-UpdateLog (\"Start-Process failed: \" + $_.Exception.Message)\r\n\
               exit 3\r\n\
             }}\r\n"
        );
        std::fs::write(&helper_script_path, script_content)
            .map_err(|error| format!("写入安装启动脚本失败：{error}"))?;

        let script_path = helper_script_path
            .to_string_lossy()
            .trim_start_matches(r"\\?\")
            .replace('"', "")
            .to_string();
        shell_execute_open(
            "powershell.exe",
            &format!(
                "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{script_path}\""
            ),
        )?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = installer_path;
        Err("当前平台不支持应用内安装".to_string())
    }
}

/// Start a process through the Windows shell so it is not tied to Tauri's process tree.
#[cfg(windows)]
fn shell_execute_open(file: &str, parameters: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    fn to_wide(value: &str) -> Vec<u16> {
        OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let operation = to_wide("open");
    let file_wide = to_wide(file);
    let parameters_wide = to_wide(parameters);
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(operation.as_ptr()),
            PCWSTR(file_wide.as_ptr()),
            PCWSTR(parameters_wide.as_ptr()),
            PCWSTR::null(),
            SW_HIDE,
        )
    };
    if result.0 as usize <= 32 {
        return Err(format!(
            "启动安装助手失败，ShellExecute 返回码 {}",
            result.0 as usize
        ));
    }
    Ok(())
}

/// Download the update installer and launch it after the app exits.
/// Emits progress/completion/error events like PrintAssist.
pub async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
    proxy: Option<ProxyConfig>,
) -> Result<String, String> {
    use std::fs::File;
    use std::io::Write;

    let client = build_client(proxy.as_ref())?;
    let mut response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|error| format!("下载更新失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("下载更新返回状态 {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let installer_name = download_url
        .rsplit('/')
        .next()
        .unwrap_or("weeklytodo-setup.exe")
        .to_string();
    let download_dir = std::env::temp_dir().join("weeklytodo_update");
    std::fs::create_dir_all(&download_dir)
        .map_err(|error| format!("创建更新目录失败：{error}"))?;
    let installer_path = download_dir.join(&installer_name);

    let mut file = File::create(&installer_path)
        .map_err(|error| format!("创建安装包失败：{error}"))?;
    let mut downloaded: u64 = 0;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("读取下载流失败：{error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("写入安装包失败：{error}"))?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let percent = (downloaded as f64 / total as f64 * 100.0).round() as u32;
            let _ = app.emit(
                "update-download-progress",
                serde_json::json!({
                    "percent": percent,
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
        }
    }
    file.sync_all().ok();

    let _ = app.emit(
        "update-download-complete",
        serde_json::json!({ "path": installer_path.to_string_lossy() }),
    );
    launch_nsis_installer(&installer_path)?;
    Ok(installer_path.to_string_lossy().to_string())
}

pub async fn check_for_app_update(proxy: Option<ProxyConfig>) -> Result<UpdateCheckResult, String> {
    check_for_update(proxy).await
}

pub async fn open_release_page() -> Result<(), String> {
    open::that(GITHUB_RELEASES_PAGE).map_err(|error| format!("打开更新页面失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semantic_version_comparison() {
        assert_eq!(compare_versions("1.0.0", "1.0.0"), std::cmp::Ordering::Equal);
        assert_eq!(compare_versions("1.0.1", "1.0.0"), std::cmp::Ordering::Greater);
        assert_eq!(compare_versions("1.0.0", "1.0.1"), std::cmp::Ordering::Less);
        assert_eq!(compare_versions("2.0.0", "1.9.9"), std::cmp::Ordering::Greater);
        // Missing segments count as zero.
        assert_eq!(compare_versions("1.1", "1.0.9"), std::cmp::Ordering::Greater);
        assert_eq!(compare_versions("1.1", "1.1.0"), std::cmp::Ordering::Equal);
        // Leading v and non-numeric fallback.
        assert_eq!(compare_versions("v1.2.3", "1.2.3"), std::cmp::Ordering::Equal);
        assert_eq!(compare_versions("1.2.3", "beta"), std::cmp::Ordering::Greater);
    }
}
