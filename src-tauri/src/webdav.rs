//! 基于 reqwest 的轻量 WebDAV 客户端，覆盖目录创建、文件探测、上传与下载。

use std::path::Path;
use std::time::Duration;

use chrono::{DateTime, Utc};
use reqwest::Method;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use crate::db;

/// Remote file metadata returned by a PROPFIND probe.
#[derive(Debug, Clone)]
pub struct RemoteFileInfo {
    pub last_modified_utc: i64,
    pub size: u64,
}

/// A restorable database version discovered in the configured WebDAV directory.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDatabaseVersion {
    pub file_name: String,
    pub last_modified_utc: i64,
    pub size: u64,
    pub is_current: bool,
}

fn propfind_method() -> Method {
    Method::from_bytes(b"PROPFIND").expect("PROPFIND is a valid HTTP method")
}

fn mkcol_method() -> Method {
    Method::from_bytes(b"MKCOL").expect("MKCOL is a valid HTTP method")
}

pub fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("weeklytodo-webdav")
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| format!("创建 HTTP 客户端失败：{error}"))
}

/// Normalize the user-configured URL to a directory base URL ending with `/`.
pub fn normalize_dir_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("WebDAV 地址不能为空".to_string());
    }
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("WebDAV 地址必须以 http:// 或 https:// 开头".to_string());
    }
    Ok(format!("{}/", trimmed.trim_end_matches('/')))
}

/// Ensure the configured directory exists on the server, creating it when missing.
pub async fn ensure_dir(
    client: &reqwest::Client,
    dir_url: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let probe = client
        .request(propfind_method(), dir_url)
        .basic_auth(username, Some(password))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|error| format!("探测 WebDAV 目录失败：{error}"))?;

    if probe.status().as_u16() == 404 {
        let create = client
            .request(mkcol_method(), dir_url)
            .basic_auth(username, Some(password))
            .send()
            .await
            .map_err(|error| format!("创建 WebDAV 目录失败：{error}"))?;
        match create.status().as_u16() {
            // 201 创建成功；405 表示目录已存在但服务器不允许 MKCOL，视为可用。
            200 | 201 | 204 | 405 => Ok(()),
            status => Err(format!("创建 WebDAV 目录失败：HTTP {status}")),
        }
    } else if probe.status().is_success() {
        Ok(())
    } else {
        Err(format!("访问 WebDAV 目录失败：HTTP {}", probe.status()))
    }
}

/// Extract the text content of the first `<prefix:tag>` element in the XML body.
fn extract_prop<'body>(body: &'body str, tag: &str) -> Option<&'body str> {
    let needle = format!("{tag}>");
    let start = body.find(&needle)? + needle.len();
    let end = body[start..].find('<')?;
    Some(body[start..start + end].trim())
}

/// Parse an HTTP-date value (e.g. `Mon, 03 Aug 2026 10:00:00 GMT`) to UTC seconds.
pub fn parse_http_date_to_utc_seconds(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc2822(value.trim())
        .ok()
        .map(|datetime| datetime.with_timezone(&Utc).timestamp())
}

/// Accept only the stable database filename and its timestamped backup format.
pub fn is_database_version_filename(file_name: &str) -> bool {
    if file_name == db::DB_FILE_NAME {
        return true;
    }

    let Some(timestamp) = file_name
        .strip_prefix(&format!("{}.", db::DB_FILE_NAME))
        .and_then(|suffix| suffix.strip_suffix(".bak"))
    else {
        return false;
    };

    timestamp.len() == 15
        && timestamp.as_bytes().get(8) == Some(&b'-')
        && chrono::NaiveDateTime::parse_from_str(timestamp, "%Y%m%d-%H%M%S").is_ok()
}

/// Read all XML element contents for one local-name, regardless of namespace prefix.
fn extract_element_blocks<'body>(body: &'body str, local_name: &str) -> Vec<&'body str> {
    let mut blocks = Vec::new();
    let mut remaining = body;

    while let Some(opening_start) = find_xml_tag(remaining, local_name, false) {
        let opening_end = match remaining[opening_start..].find('>') {
            Some(offset) => opening_start + offset + 1,
            None => break,
        };
        let after_opening = &remaining[opening_end..];
        let Some(closing_relative_start) = find_xml_tag(after_opening, local_name, true) else {
            break;
        };
        let closing_start = opening_end + closing_relative_start;
        blocks.push(&remaining[opening_end..closing_start]);

        let closing_end = match remaining[closing_start..].find('>') {
            Some(offset) => closing_start + offset + 1,
            None => break,
        };
        remaining = &remaining[closing_end..];
    }

    blocks
}

/// Locate an opening or closing XML tag by local name without assuming a prefix.
fn find_xml_tag(body: &str, local_name: &str, closing: bool) -> Option<usize> {
    let marker = if closing { "</" } else { "<" };
    let mut search_start = 0;

    while let Some(relative_start) = body[search_start..].find(marker) {
        let tag_start = search_start + relative_start;
        let name_start = tag_start + marker.len();
        let remainder = &body[name_start..];
        let tag_end = remainder.find('>')?;
        let token = remainder[..tag_end]
            .trim_start()
            .split(|character: char| character.is_whitespace() || character == '/' || character == '>')
            .next()
            .unwrap_or_default();
        if token.rsplit(':').next() == Some(local_name) {
            return Some(tag_start);
        }
        search_start = name_start;
    }

    None
}

/// Parse a WebDAV `Depth: 1` Multi-Status response into valid database versions.
fn parse_database_versions(xml: &str) -> Vec<RemoteDatabaseVersion> {
    let mut versions = extract_element_blocks(xml, "response")
        .into_iter()
        .filter_map(|response| {
            let href = extract_prop(response, "href")?;
            let file_name = href.rsplit('/').next()?.trim();
            if file_name.is_empty() || file_name.contains('%') || !is_database_version_filename(file_name) {
                return None;
            }
            let last_modified_utc = extract_prop(response, "getlastmodified")
                .and_then(parse_http_date_to_utc_seconds)?;
            let size = extract_prop(response, "getcontentlength")
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(0);
            Some(RemoteDatabaseVersion {
                file_name: file_name.to_string(),
                last_modified_utc,
                size,
                is_current: file_name == db::DB_FILE_NAME,
            })
        })
        .collect::<Vec<_>>();

    versions.sort_by(|left, right| {
        right
            .is_current
            .cmp(&left.is_current)
            .then_with(|| right.last_modified_utc.cmp(&left.last_modified_utc))
    });
    versions
}

/// List the current database and timestamped backups in the configured directory.
pub async fn list_database_versions(
    client: &reqwest::Client,
    dir_url: &str,
    username: &str,
    password: &str,
) -> Result<Vec<RemoteDatabaseVersion>, String> {
    let response = client
        .request(propfind_method(), dir_url)
        .basic_auth(username, Some(password))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| format!("列出 WebDAV 备份失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("列出 WebDAV 备份失败：HTTP {}", response.status()));
    }
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 WebDAV 备份列表失败：{error}"))?;
    Ok(parse_database_versions(&body))
}

/// Probe a remote file. Returns `None` when the file does not exist.
pub async fn probe_file(
    client: &reqwest::Client,
    file_url: &str,
    username: &str,
    password: &str,
) -> Result<Option<RemoteFileInfo>, String> {
    let response = client
        .request(propfind_method(), file_url)
        .basic_auth(username, Some(password))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|error| format!("探测远端文件失败：{error}"))?;

    if response.status().as_u16() == 404 {
        return Ok(None);
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 WebDAV 响应失败：{error}"))?;

    // 部分服务器在 207 Multi-Status 内部报告 404。
    if body.contains("404 Not Found") || body.contains(">404") {
        return Ok(None);
    }

    let last_modified =
        extract_prop(&body, "getlastmodified").and_then(parse_http_date_to_utc_seconds);
    let size =
        extract_prop(&body, "getcontentlength").and_then(|value| value.trim().parse::<u64>().ok());

    match last_modified {
        Some(last_modified_utc) => Ok(Some(RemoteFileInfo {
            last_modified_utc,
            size: size.unwrap_or(0),
        })),
        None => Err("无法解析服务器返回的文件信息（未找到修改时间）".to_string()),
    }
}

/// Upload a local file to the server with PUT.
pub async fn upload_file(
    client: &reqwest::Client,
    url: &str,
    local_path: &Path,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let content =
        std::fs::read(local_path).map_err(|error| format!("读取待上传文件失败：{error}"))?;
    let response = client
        .put(url)
        .basic_auth(username, Some(password))
        .header("Content-Type", "application/octet-stream")
        .body(content)
        .send()
        .await
        .map_err(|error| format!("上传文件失败：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("上传文件失败：HTTP {}", response.status()))
    }
}

/// Upload in-memory bytes to the server with PUT (used for remote backups).
pub async fn upload_bytes(
    client: &reqwest::Client,
    url: &str,
    content: &[u8],
    username: &str,
    password: &str,
) -> Result<(), String> {
    let response = client
        .put(url)
        .basic_auth(username, Some(password))
        .header("Content-Type", "application/octet-stream")
        .body(content.to_vec())
        .send()
        .await
        .map_err(|error| format!("上传备份文件失败：{error}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("上传备份文件失败：HTTP {}", response.status()))
    }
}

/// Download a remote file to `dest_path` atomically (temp file + rename).
/// Validates the payload looks like a SQLite database before replacing the local file.
pub async fn download_file(
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    username: &str,
    password: &str,
) -> Result<(), String> {
    use std::io::Write;

    let response = client
        .get(url)
        .basic_auth(username, Some(password))
        .send()
        .await
        .map_err(|error| format!("下载文件失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("下载文件失败：HTTP {}", response.status()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取下载内容失败：{error}"))?;

    // 防呆校验：WebDAV 服务器异常时可能返回 HTML 错误页。
    if bytes.len() < 16 || &bytes[..16] != b"SQLite format 3\0" {
        return Err("下载的文件不是有效的 SQLite 数据库，已放弃覆盖".to_string());
    }

    let file_name = dest_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法确定数据库文件名".to_string())?;
    let temp_path = dest_path.with_file_name(format!("{file_name}.synctmp"));

    let mut temp_file =
        std::fs::File::create(&temp_path).map_err(|error| format!("创建临时文件失败：{error}"))?;
    temp_file
        .write_all(&bytes)
        .map_err(|error| format!("写入临时文件失败：{error}"))?;
    temp_file
        .sync_all()
        .map_err(|error| format!("同步临时文件失败：{error}"))?;
    drop(temp_file);

    validate_sqlite_database(&temp_path)?;

    std::fs::rename(&temp_path, dest_path)
        .map_err(|error| format!("替换本地数据库失败：{error}"))?;

    // 移除可能与新文件不匹配的旧 WAL 日志，避免下次打开时被重放。
    for suffix in ["-wal", "-shm"] {
        let stale = dest_path.with_file_name(format!("{file_name}{suffix}"));
        let _ = std::fs::remove_file(stale);
    }
    Ok(())
}

/// Verify that a downloaded file is a readable SQLite database before replacing local data.
fn validate_sqlite_database(database_path: &Path) -> Result<(), String> {
    let connection = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("下载的 SQLite 数据库无法打开，已放弃覆盖：{error}"))?;
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| format!("校验下载的 SQLite 数据库失败，已放弃覆盖：{error}"))?;
    if integrity != "ok" {
        return Err(format!("下载的 SQLite 数据库完整性校验失败：{integrity}"));
    }
    Ok(())
}

/// Download a remote file into memory (used to back up the remote version).
pub async fn fetch_remote_bytes(
    client: &reqwest::Client,
    url: &str,
    username: &str,
    password: &str,
) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .basic_auth(username, Some(password))
        .send()
        .await
        .map_err(|error| format!("读取远端备份文件失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("读取远端备份文件失败：HTTP {}", response.status()));
    }
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("读取远端备份内容失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_dir_url_adds_trailing_slash() {
        assert_eq!(
            normalize_dir_url("https://dav.example.com/weeklytodo").unwrap(),
            "https://dav.example.com/weeklytodo/"
        );
        assert_eq!(
            normalize_dir_url("https://dav.example.com/weeklytodo/").unwrap(),
            "https://dav.example.com/weeklytodo/"
        );
        assert!(normalize_dir_url("ftp://dav.example.com").is_err());
        assert!(normalize_dir_url("").is_err());
    }

    #[test]
    fn parse_http_date_handles_rfc1123() {
        let seconds = parse_http_date_to_utc_seconds("Mon, 03 Aug 2026 10:00:00 GMT").unwrap();
        let expected = DateTime::parse_from_rfc3339("2026-08-03T10:00:00Z")
            .unwrap()
            .timestamp();
        assert_eq!(seconds, expected);
    }

    #[test]
    fn extract_prop_reads_element_content() {
        let body = r#"<d:multistatus xmlns:d="DAV:">
            <d:response><d:propstat><d:prop>
              <d:getlastmodified>Mon, 03 Aug 2026 10:00:00 GMT</d:getlastmodified>
              <d:getcontentlength>12345</d:getcontentlength>
            </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
        </d:multistatus>"#;
        assert_eq!(extract_prop(body, "getcontentlength"), Some("12345"));
    }

    #[test]
    fn accepts_only_current_database_and_timestamped_backup_filenames() {
        assert!(is_database_version_filename("weeklytodo.db"));
        assert!(is_database_version_filename("weeklytodo.db.20260804-133200.bak"));

        assert!(!is_database_version_filename("weeklytodo.db-wal"));
        assert!(!is_database_version_filename("weeklytodo.db.20260804-1332.bak"));
        assert!(!is_database_version_filename("weeklytodo.db.20261304-133200.bak"));
        assert!(!is_database_version_filename("../weeklytodo.db"));
        assert!(!is_database_version_filename("weeklytodo.db?version=old"));
    }

    #[test]
    fn parses_current_database_and_valid_backups_from_directory_listing() {
        let xml = r#"<D:multistatus xmlns:D="DAV:">
          <D:response><D:href>/weeklytodo/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
          <D:response><D:href>/weeklytodo/weeklytodo.db.20260804-133200.bak</D:href><D:propstat><D:prop><D:getlastmodified>Tue, 04 Aug 2026 13:32:00 GMT</D:getlastmodified><D:getcontentlength>65536</D:getcontentlength></D:prop></D:propstat></D:response>
          <D:response><D:href>/weeklytodo/unrelated.txt</D:href><D:propstat><D:prop><D:getlastmodified>Tue, 04 Aug 2026 13:33:00 GMT</D:getlastmodified></D:prop></D:propstat></D:response>
          <D:response><D:href>/weeklytodo/weeklytodo.db</D:href><D:propstat><D:prop><D:getlastmodified>Tue, 04 Aug 2026 13:34:00 GMT</D:getlastmodified><D:getcontentlength>73728</D:getcontentlength></D:prop></D:propstat></D:response>
        </D:multistatus>"#;

        let versions = parse_database_versions(xml);

        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].file_name, "weeklytodo.db");
        assert!(versions[0].is_current);
        assert_eq!(versions[1].file_name, "weeklytodo.db.20260804-133200.bak");
        assert_eq!(versions[1].size, 65_536);
    }
}

/// 供集成测试使用的内存式本地 WebDAV 服务器（基于 tiny_http）。
#[cfg(test)]
pub mod test_server {
    use std::net::TcpListener;
    use std::path::{Path, PathBuf};
    use std::thread;

    use chrono::{DateTime, Utc};

    pub struct TestServer {
        port: u16,
        root: PathBuf,
    }

    impl TestServer {
        pub fn base_url(&self, dir: &str) -> String {
            format!("http://127.0.0.1:{}/{dir}", self.port)
        }

        pub fn file_exists(&self, relative: &str) -> bool {
            self.root.join(relative).is_file()
        }

        pub fn read_file(&self, relative: &str) -> Vec<u8> {
            std::fs::read(self.root.join(relative)).unwrap()
        }

        /// 模拟另一台设备直接向服务器写入文件（会更新远端 mtime）。
        pub fn put_file(&self, relative: &str, bytes: Vec<u8>) {
            let path = self.root.join(relative);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, bytes).unwrap();
        }
    }

    pub fn spawn() -> TestServer {
        let root = std::env::temp_dir().join(format!(
            "weeklytodo-webdav-server-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tiny_http::Server::from_listener(listener, None).unwrap();
        let server_root = root.clone();

        thread::spawn(move || {
            for mut request in server.incoming_requests() {
                let method = request.method().as_str().to_string();
                let url = request.url().to_string();
                let depth = request
                    .headers()
                    .iter()
                    .find(|header| header.field.equiv("Depth"))
                    .map(|header| header.value.as_str().to_string());
                let path = url
                    .split('?')
                    .next()
                    .unwrap_or("")
                    .trim_start_matches('/')
                    .to_string();
                let mut body = Vec::new();
                let _ = request.as_reader().read_to_end(&mut body);
                let response = handle_request(&server_root, &method, &path, &body, depth.as_deref());
                let _ = request.respond(response);
            }
        });

        TestServer { port, root }
    }

    fn not_found() -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
        tiny_http::Response::from_data(Vec::new()).with_status_code(404)
    }

    fn handle_request(
        root: &Path,
        method: &str,
        path: &str,
        body: &[u8],
        depth: Option<&str>,
    ) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
        let fs_path = root.join(path);
        match method {
            "PROPFIND" => {
                if fs_path.is_dir() {
                    if depth == Some("1") {
                        return directory_multistatus_response(root, path);
                    }
                    return multistatus_response(path, None);
                }
                match std::fs::metadata(&fs_path) {
                    Ok(metadata) if metadata.is_file() => multistatus_response(
                        path,
                        Some((metadata.modified().unwrap(), metadata.len())),
                    ),
                    _ => not_found(),
                }
            }
            "MKCOL" => {
                if fs_path.exists() {
                    tiny_http::Response::from_data(Vec::new()).with_status_code(405)
                } else {
                    std::fs::create_dir_all(&fs_path).ok();
                    tiny_http::Response::from_data(Vec::new()).with_status_code(201)
                }
            }
            "PUT" => {
                if let Some(parent) = fs_path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                std::fs::write(&fs_path, body).ok();
                tiny_http::Response::from_data(Vec::new()).with_status_code(201)
            }
            "GET" => {
                if fs_path.is_file() {
                    let data = std::fs::read(&fs_path).unwrap_or_default();
                    tiny_http::Response::from_data(data).with_status_code(200)
                } else {
                    not_found()
                }
            }
            _ => tiny_http::Response::from_data(Vec::new()).with_status_code(501),
        }
    }

    fn multistatus_response(
        path: &str,
        file: Option<(std::time::SystemTime, u64)>,
    ) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
        let xml = match file {
            Some((mtime, size)) => {
                let datetime: DateTime<Utc> = mtime.into();
                let last_modified = datetime.format("%a, %d %b %Y %H:%M:%S GMT");
                format!(
                    r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/{path}</D:href>
    <D:propstat>
      <D:prop>
        <D:getlastmodified>{last_modified}</D:getlastmodified>
        <D:getcontentlength>{size}</D:getcontentlength>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>"#
                )
            }
            None => r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/</D:href>
    <D:propstat>
      <D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>"#
                .to_string(),
        };
        tiny_http::Response::from_data(xml.into_bytes())
            .with_status_code(207)
            .with_header(
                "Content-Type: application/xml"
                    .parse::<tiny_http::Header>()
                    .unwrap(),
            )
    }

    fn directory_multistatus_response(
        root: &Path,
        path: &str,
    ) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
        let mut entries = vec![directory_response_entry(path)];
        let directory_path = root.join(path);
        if let Ok(read_dir) = std::fs::read_dir(directory_path) {
            for entry in read_dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let child_path = format!("{}/{}", path.trim_end_matches('/'), name);
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        entries.push(file_response_entry(
                            &child_path,
                            metadata.modified().unwrap(),
                            metadata.len(),
                        ));
                    } else if metadata.is_dir() {
                        entries.push(directory_response_entry(&child_path));
                    }
                }
            }
        }
        let xml = format!(
            r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">{}</D:multistatus>"#,
            entries.join("\n")
        );
        tiny_http::Response::from_data(xml.into_bytes())
            .with_status_code(207)
            .with_header(
                "Content-Type: application/xml"
                    .parse::<tiny_http::Header>()
                    .unwrap(),
            )
    }

    fn directory_response_entry(path: &str) -> String {
        format!(
            r#"<D:response><D:href>/{path}</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"#
        )
    }

    fn file_response_entry(path: &str, mtime: std::time::SystemTime, size: u64) -> String {
        let datetime: DateTime<Utc> = mtime.into();
        let last_modified = datetime.format("%a, %d %b %Y %H:%M:%S GMT");
        format!(
            r#"<D:response><D:href>/{path}</D:href><D:propstat><D:prop><D:getlastmodified>{last_modified}</D:getlastmodified><D:getcontentlength>{size}</D:getcontentlength></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>"#
        )
    }
}
