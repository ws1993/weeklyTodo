use serde::{Deserialize, Serialize};

use crate::domain::{Task, Week};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatePayload {
    pub storage_dir: String,
    pub current_week_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekTreePayload {
    pub week: Week,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryTaskRow {
    pub task: Task,
    pub week_id: String,
    pub week_label: String,
    pub path: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryFilter {
    pub week_id: Option<String>,
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub carried_over_only: Option<bool>,
    pub start_week_id: Option<String>,
    pub end_week_id: Option<String>,
    pub owner_id: Option<i64>,
    pub tag_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub body: Option<String>,
    pub download_url: Option<String>,
    pub download_size: Option<u64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub use_system_proxy: Option<bool>,
    pub custom_proxy_url: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateResult {
    pub data_dir: String,
    pub message: String,
}

pub type SyncResult = crate::sync::SyncResult;
pub type RestoreResult = crate::sync::RestoreResult;
pub type RemoteDatabaseVersion = crate::webdav::RemoteDatabaseVersion;
