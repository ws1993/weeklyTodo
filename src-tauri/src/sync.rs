//! 文件级 WebDAV 同步引擎：比较本地/远端数据库修改时间，后写覆盖，
//! 被覆盖方先以带时间戳的 `.bak` 备份到远端。

use std::path::Path;
use std::time::SystemTime;

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::credentials;
use crate::db;
use crate::webdav;

/// Result of one sync run, reported back to the UI.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    /// `upload` | `download` | `noop`
    pub direction: String,
    /// Backup file names created on the remote during this run.
    pub backup_files: Vec<String>,
    /// ISO 8601 UTC time when the sync finished.
    pub synced_at: String,
    /// Human-readable summary.
    pub message: String,
}

/// Merge the WAL into the main database file before syncing it.
fn checkpoint_db(data_dir: &Path) -> Result<(), String> {
    let conn = db::open_database(data_dir)?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|error| format!("同步前合并数据库日志失败：{error}"))
}

fn system_time_to_utc_seconds(time: SystemTime) -> i64 {
    let datetime: DateTime<Utc> = time.into();
    datetime.timestamp()
}

/// Build a `weeklytodo.db.YYYYMMDD-HHMMSS.bak` backup file name from a UTC timestamp.
pub fn backup_filename(utc_seconds: i64) -> String {
    let stamp = DateTime::<Utc>::from_timestamp(utc_seconds, 0)
        .map(|datetime| datetime.format("%Y%m%d-%H%M%S").to_string())
        .unwrap_or_else(|| "19700101-000000".to_string());
    format!("{}.{stamp}.bak", db::DB_FILE_NAME)
}

/// Decide the sync direction from local/remote modified times.
/// Returns `Some(true)` when the remote should be uploaded over (local newer),
/// `Some(false)` when the remote should be downloaded (remote newer),
/// `None` when both are equal (noop).
pub fn decide_direction(local_modified_utc: i64, remote_modified_utc: i64) -> Option<bool> {
    // 两个时间都按秒比较：HTTP-date 只有秒级精度，统一粒度避免每次误同步。
    if local_modified_utc == remote_modified_utc {
        return None;
    }
    Some(local_modified_utc > remote_modified_utc)
}

/// Run one sync against the configured WebDAV directory.
pub async fn sync_now(data_dir: &str, url: &str, username: &str) -> Result<SyncResult, String> {
    let password = credentials::load_password(username)?.ok_or_else(|| {
        "尚未保存该账号的密码，请在同步设置中填写密码后重试".to_string()
    })?;
    sync_now_with_password(data_dir, url, username, &password).await
}

/// Core sync engine; the password is supplied by the caller (testable).
pub async fn sync_now_with_password(
    data_dir: &str,
    url: &str,
    username: &str,
    password: &str,
) -> Result<SyncResult, String> {
    checkpoint_db(Path::new(data_dir))?;
    let base_url = webdav::normalize_dir_url(url)?;
    let client = webdav::build_client()?;
    webdav::ensure_dir(&client, &base_url, username, password).await?;

    let local_path = Path::new(data_dir).join(db::DB_FILE_NAME);
    let file_url = format!("{base_url}{}", db::DB_FILE_NAME);
    let local_modified = std::fs::metadata(&local_path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .map(system_time_to_utc_seconds);
    let remote = webdav::probe_file(&client, &file_url, username, password).await?;

    let mut backup_files: Vec<String> = Vec::new();
    let (direction, message) = match (local_modified, remote) {
        (None, None) => {
            return Err("本地和远端都没有数据库文件".to_string());
        }
        (None, Some(_)) => {
            webdav::download_file(&client, &file_url, &local_path, username, password).await?;
            // 校准本地 mtime，避免下次比较时因毫秒/秒级偏差被误判。
            sync_local_mtime_to_remote(&client, &file_url, &local_path, username, password).await;
            ("download", "已从远端下载数据库".to_string())
        }
        (Some(_), None) => {
            webdav::upload_file(&client, &file_url, &local_path, username, password).await?;
            sync_local_mtime_to_remote(&client, &file_url, &local_path, username, password).await;
            ("upload", "已将本地数据库上传到远端".to_string())
        }
        (Some(local_modified_utc), Some(remote_info)) => {
            match decide_direction(local_modified_utc, remote_info.last_modified_utc) {
                None => ("noop", "两端数据库一致，无需同步".to_string()),
                Some(true) => {
                    // 本地更新：先把远端旧版备份，再上传本地版本。
                    let backup_name = backup_filename(remote_info.last_modified_utc);
                    let backup_url = format!("{base_url}{backup_name}");
                    let remote_bytes =
                        webdav::fetch_remote_bytes(&client, &file_url, username, password).await?;
                    webdav::upload_bytes(
                        &client,
                        &backup_url,
                        &remote_bytes,
                        username,
                        password,
                    )
                    .await?;
                    backup_files.push(backup_name);
                    webdav::upload_file(&client, &file_url, &local_path, username, password)
                        .await?;
                    sync_local_mtime_to_remote(&client, &file_url, &local_path, username, password)
                        .await;
                    ("upload", "本地版本更新，已将远端旧版本备份后上传".to_string())
                }
                Some(false) => {
                    // 远端更新：先把本地旧版备份到远端，再下载覆盖本地。
                    let backup_name = backup_filename(local_modified_utc);
                    let backup_url = format!("{base_url}{backup_name}");
                    webdav::upload_file(&client, &backup_url, &local_path, username, password)
                        .await?;
                    backup_files.push(backup_name);
                    webdav::download_file(&client, &file_url, &local_path, username, password)
                        .await?;
                    sync_local_mtime_to_remote(&client, &file_url, &local_path, username, password)
                        .await;
                    ("download", "远端版本更新，本地旧版已备份并下载新版本".to_string())
                }
            }
        }
    };

    Ok(SyncResult {
        direction: direction.to_string(),
        backup_files,
        synced_at: Utc::now().to_rfc3339(),
        message,
    })
}

/// 上传/下载后校准本地 mtime 与远端一致，防止下次同步因时间偏差反复翻转。
async fn sync_local_mtime_to_remote(
    client: &reqwest::Client,
    file_url: &str,
    local_path: &Path,
    username: &str,
    password: &str,
) {
    // 校准失败只影响下一次比较，上传/下载本身已成功，因此尽力而为。
    let Ok(Some(remote)) = webdav::probe_file(client, file_url, username, password).await else {
        return;
    };
    let datetime = DateTime::<Utc>::from_timestamp(remote.last_modified_utc, 0);
    let Some(datetime) = datetime else {
        return;
    };
    let system_time: SystemTime = datetime.into();
    let _ = filetime::set_file_mtime(
        local_path,
        filetime::FileTime::from_system_time(system_time),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_filename_formats_utc_timestamp() {
        let timestamp = DateTime::parse_from_rfc3339("2026-08-03T10:00:00Z")
            .unwrap()
            .timestamp();
        assert_eq!(
            backup_filename(timestamp),
            "weeklytodo.db.20260803-100000.bak"
        );
    }

    #[test]
    fn decide_direction_compares_whole_seconds() {
        assert_eq!(decide_direction(1000, 1000), None);
        assert_eq!(decide_direction(1001, 1000), Some(true));
        assert_eq!(decide_direction(1000, 1001), Some(false));
    }

    #[tokio::test]
    async fn sync_uploads_then_keeps_idle_and_backs_up_conflicts() {
        use crate::webdav::test_server;

        let server = test_server::spawn();
        let data_dir = temp_dir();
        create_sample_week(&data_dir);

        // 1) 首次同步：空远端 -> 上传。
        let url = server.base_url("weeklytodo");
        let first = sync_now_with_password(
            data_dir.to_str().unwrap(),
            &url,
            "alice",
            "secret",
        )
        .await
        .unwrap();
        assert_eq!(first.direction, "upload");
        assert!(server.file_exists("weeklytodo/weeklytodo.db"));
        let uploaded = server.read_file("weeklytodo/weeklytodo.db");
        assert_eq!(&uploaded[..16], b"SQLite format 3\0");

        // 2) 立即再次同步：无任何改动 -> noop（验证不会反复翻转）。
        let idle = sync_now_with_password(
            data_dir.to_str().unwrap(),
            &url,
            "alice",
            "secret",
        )
        .await
        .unwrap();
        assert_eq!(idle.direction, "noop");

        // 3) 本地新增数据并稍等，再同步：本地较新 -> 上传并备份远端旧版。
        std::thread::sleep(std::time::Duration::from_millis(1100));
        add_sample_task(&data_dir);
        let local = sync_now_with_password(
            data_dir.to_str().unwrap(),
            &url,
            "alice",
            "secret",
        )
        .await
        .unwrap();
        assert_eq!(local.direction, "upload");
        assert_eq!(local.backup_files.len(), 1);
        let backup_name = &local.backup_files[0];
        assert!(server.file_exists(&format!("weeklytodo/{backup_name}")));
        // 备份内容应等于上一次上传的远端版本。
        assert_eq!(server.read_file(&format!("weeklytodo/{backup_name}")), uploaded);

        // 4) 模拟另一台设备更新远端，再同步：远端较新 -> 下载并备份本地旧版。
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let local_before = std::fs::read(data_dir.join(db::DB_FILE_NAME)).unwrap();
        let remote_edit: Vec<u8> = b"SQLite format 3\0".to_vec(); // 仅校验下载方向，不校验内容有效性
        server.put_file("weeklytodo/weeklytodo.db", remote_edit.clone());
        let remote = sync_now_with_password(
            data_dir.to_str().unwrap(),
            &url,
            "alice",
            "secret",
        )
        .await
        .unwrap();
        assert_eq!(remote.direction, "download");
        assert_eq!(remote.backup_files.len(), 1);
        let backup_name = &remote.backup_files[0];
        assert!(server.file_exists(&format!("weeklytodo/{backup_name}")));
        // 本地旧版被备份到远端。
        assert_eq!(server.read_file(&format!("weeklytodo/{backup_name}")), local_before);

        let _ = std::fs::remove_dir_all(&data_dir);
    }

    fn temp_dir() -> std::path::PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        std::env::temp_dir().join(format!(
            "weeklytodo-sync-test-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ))
    }

    fn create_sample_week(data_dir: &std::path::Path) {
        let conn = crate::db::open_database(data_dir).unwrap();
        let mut conn = conn;
        crate::domain::ensure_current_week(&mut conn).unwrap();
    }

    fn add_sample_task(data_dir: &std::path::Path) {
        let conn = crate::db::open_database(data_dir).unwrap();
        let mut conn = conn;
        let (week, _) = crate::domain::ensure_current_week(&mut conn).unwrap();
        crate::domain::create_task(
            &conn,
            &week.id,
            crate::domain::CreateTaskInput {
                title: "同步测试任务".into(),
                description: String::new(),
                parent_id: None,
                priority: crate::domain::DEFAULT_PRIORITY,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                tag_names: vec![],
            },
        )
        .unwrap();
    }
}
