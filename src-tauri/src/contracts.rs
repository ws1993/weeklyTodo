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
    /// 顶层任务（分组轨道 / 项目）标题。
    pub root_title: String,
    /// Whether the task has any children (regardless of their status).
    pub has_children: bool,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryFilter {
    pub week_id: Option<String>,
    /// 按顶层任务（项目）标题过滤，跨周同名合并。
    pub group_filter: Option<String>,
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub carried_over_only: Option<bool>,
    pub start_week_id: Option<String>,
    pub end_week_id: Option<String>,
    pub owner_id: Option<i64>,
    pub assigner_id: Option<i64>,
    pub tag_id: Option<i64>,
}

/// 单周趋势：总量 / 完成 / 进行中 / 带入（含带入完成数）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekTrendStat {
    pub week_id: String,
    pub total: i64,
    pub done: i64,
    pub open: i64,
    pub carried: i64,
    pub carried_done: i64,
}

/// 名称 + 计数（标签 / 负责人分布用）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NamedCount {
    pub name: String,
    pub count: i64,
}

/// 某优先级下的任务数与完成数。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityStat {
    pub priority: i64,
    pub count: i64,
    pub done: i64,
}

/// 历史统计 / 复盘视图的一次性聚合结果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsOverview {
    /// 最近 N 周趋势（新 → 旧）。
    pub weeks: Vec<WeekTrendStat>,
    pub total_tasks: i64,
    pub total_done: i64,
    pub total_open: i64,
    pub total_carried: i64,
    /// 范围内进行中且属带入的任务数（拖期未完成）。
    pub carried_open: i64,
    pub by_priority: Vec<PriorityStat>,
    pub by_tag: Vec<NamedCount>,
    pub by_owner: Vec<NamedCount>,
    pub by_assigner: Vec<NamedCount>,
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
