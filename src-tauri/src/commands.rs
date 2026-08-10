use std::path::PathBuf;

use rusqlite::Connection;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::contracts::{
    AppStatePayload, MigrateResult, ProxyConfig, QueryFilter, QueryTaskRow, StatisticsOverview,
    SyncResult, UpdateCheckResult, WeekTreePayload,
};
use crate::credentials;
use crate::db;
use crate::domain;
use crate::queries;
use crate::storage::{self, StorageConfig};
use crate::sync;
use crate::updater;
use crate::webdav;

/// Open the configured database for a command.
fn open_conn(config: &StorageConfig) -> Result<Connection, String> {
    db::open_database(std::path::Path::new(&config.data_dir))
}

fn resolve_storage() -> Result<StorageConfig, String> {
    let config = storage::load_config()?;
    storage::ensure_storage(config)
}

/// Startup payload: storage directory and the ensured current week.
#[tauri::command]
pub async fn initialize_app() -> Result<AppStatePayload, String> {
    let config = resolve_storage()?;
    let mut conn = open_conn(&config)?;
    let (week, _) = domain::ensure_current_week(&mut conn)?;
    Ok(AppStatePayload {
        storage_dir: config.data_dir,
        current_week_id: week.id,
    })
}

/// List recent weeks (newest first) plus the full list for the query view.
#[tauri::command]
pub async fn list_weeks() -> Result<Vec<domain::Week>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::list_weeks(&conn)
}

#[tauri::command]
pub async fn recent_weeks(limit: Option<i64>) -> Result<Vec<domain::Week>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let limit = limit.unwrap_or(4).clamp(1, 12);
    let ids = queries::recent_week_ids(&conn, limit)?;
    let mut weeks = Vec::new();
    for id in ids {
        if let Some(week) = domain::get_week(&conn, &id)? {
            weeks.push(week);
        }
    }
    Ok(weeks)
}

/// Full tree (week + tasks) for one week.
#[tauri::command]
pub async fn get_week_tree(week_id: String) -> Result<WeekTreePayload, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let week = domain::get_week(&conn, &week_id)?.ok_or_else(|| "周不存在".to_string())?;
    let tasks = domain::list_tasks_for_week(&conn, &week_id)?;
    Ok(WeekTreePayload { week, tasks })
}

/// Ensure the current week exists and return its tree.
#[tauri::command]
pub async fn get_current_week_tree() -> Result<WeekTreePayload, String> {
    let config = resolve_storage()?;
    let mut conn = open_conn(&config)?;
    let (week, _) = domain::ensure_current_week(&mut conn)?;
    let tasks = domain::list_tasks_for_week(&conn, &week.id)?;
    Ok(WeekTreePayload { week, tasks })
}

/// Create a week manually for a Monday start date (`YYYYMMDD`).
#[tauri::command]
pub async fn create_week(monday_date: String) -> Result<domain::Week, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let monday = chrono::NaiveDate::parse_from_str(&monday_date, "%Y%m%d")
        .map_err(|_| "日期格式应为 YYYYMMDD".to_string())?;
    domain::create_week_for_monday(&conn, monday)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_task(
    week_id: String,
    title: String,
    description: Option<String>,
    parent_id: Option<i64>,
    priority: Option<i64>,
    execution_mode: Option<String>,
    owner_name: Option<String>,
    assigner_name: Option<String>,
    tag_names: Option<Vec<String>>,
) -> Result<domain::Task, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::create_task(
        &conn,
        &week_id,
        domain::CreateTaskInput {
            title,
            description: description.unwrap_or_default(),
            parent_id,
            priority: priority.unwrap_or(domain::DEFAULT_PRIORITY),
            execution_mode: execution_mode.unwrap_or_else(|| domain::EXECUTION_MODE_SELF.into()),
            owner_name,
            assigner_name,
            tag_names: tag_names.unwrap_or_default(),
        },
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_task(
    week_id: String,
    task_id: i64,
    title: Option<String>,
    description: Option<String>,
    priority: Option<i64>,
    execution_mode: Option<String>,
    owner_name: Option<String>,
    assigner_name: Option<String>,
    tag_names: Option<Vec<String>>,
) -> Result<domain::Task, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::update_task(
        &conn,
        &week_id,
        task_id,
        domain::UpdateTaskInput {
            title,
            description,
            priority,
            execution_mode,
            owner_name,
            assigner_name,
            tag_names,
        },
    )
}

/// All known assigners for dropdown options.
#[tauri::command]
pub async fn list_assigners() -> Result<Vec<domain::Assigner>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::list_assigners(&conn)
}

/// Create a new assigner.
#[tauri::command]
pub async fn create_assigner(name: String) -> Result<domain::Assigner, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let id = domain::ensure_assigner(&conn, &name)?;
    conn.query_row(
        "SELECT id, name FROM assigners WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(domain::Assigner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取新建分派人失败:{error}"))
}

/// Rename an existing assigner.
#[tauri::command]
pub async fn rename_assigner(id: i64, name: String) -> Result<domain::Assigner, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::rename_assigner(&conn, id, &name)
}

/// Delete an assigner. Tasks referencing it get assigner_id cleared.
#[tauri::command]
pub async fn delete_assigner(id: i64) -> Result<(), String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::delete_assigner(&conn, id)
}

/// All known owners for dropdown options.
#[tauri::command]
pub async fn list_owners() -> Result<Vec<domain::Owner>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::list_owners(&conn)
}

/// All known tags for dropdown options.
#[tauri::command]
pub async fn list_tags() -> Result<Vec<domain::Tag>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::list_tags(&conn)
}

/// Create a new owner.
#[tauri::command]
pub async fn create_owner(name: String) -> Result<domain::Owner, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let id = domain::ensure_owner(&conn, &name)?;
    conn.query_row(
        "SELECT id, name FROM owners WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(domain::Owner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取新建负责人失败:{error}"))
}

/// Rename an existing owner.
#[tauri::command]
pub async fn rename_owner(id: i64, name: String) -> Result<domain::Owner, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::rename_owner(&conn, id, &name)
}

/// Delete an owner. Tasks referencing it get owner_id cleared.
#[tauri::command]
pub async fn delete_owner(id: i64) -> Result<(), String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::delete_owner(&conn, id)
}

/// Create a new tag.
#[tauri::command]
pub async fn create_tag(name: String) -> Result<domain::Tag, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    let id = domain::ensure_tag(&conn, &name)?;
    conn.query_row(
        "SELECT id, name FROM tags WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(domain::Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取新建标签失败:{error}"))
}

/// Rename an existing tag.
#[tauri::command]
pub async fn rename_tag(id: i64, name: String) -> Result<domain::Tag, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::rename_tag(&conn, id, &name)
}

/// Delete a tag. Tag-task associations cascade delete.
#[tauri::command]
pub async fn delete_tag(id: i64) -> Result<(), String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::delete_tag(&conn, id)
}

/// All group color mappings (name -> color).
#[tauri::command]
pub async fn list_group_colors() -> Result<Vec<domain::GroupColor>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::list_group_colors(&conn)
}

/// Get a group's color, auto-assigning the first unused palette color when missing.
#[tauri::command]
pub async fn ensure_group_color(name: String) -> Result<domain::GroupColor, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::ensure_group_color(&conn, &name)
}

/// Manually set a group's color.
#[tauri::command]
pub async fn set_group_color(name: String, color: String) -> Result<domain::GroupColor, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::set_group_color(&conn, &name, &color)
}

/// Re-auto-assign a group's color, clearing the manual override flag.
#[tauri::command]
pub async fn reset_group_color(name: String) -> Result<domain::GroupColor, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::reset_group_color(&conn, &name)
}

#[tauri::command]
pub async fn close_task(week_id: String, task_id: i64) -> Result<domain::Task, String> {
    let config = resolve_storage()?;
    let mut conn = open_conn(&config)?;
    domain::close_task(&mut conn, &week_id, task_id)
}

#[tauri::command]
pub async fn reopen_task(week_id: String, task_id: i64) -> Result<domain::Task, String> {
    let config = resolve_storage()?;
    let mut conn = open_conn(&config)?;
    domain::reopen_task(&mut conn, &week_id, task_id)
}

/// Move a task to a new parent (re-indent / re-order).
#[tauri::command]
pub async fn move_task(
    week_id: String,
    task_id: i64,
    new_parent_id: Option<i64>,
    new_index: f64,
) -> Result<(), String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    domain::move_task(&conn, &week_id, task_id, new_parent_id, new_index)
}

/// Delete a task and its whole subtree (children cascade via foreign keys).
#[tauri::command]
pub async fn delete_task(week_id: String, task_id: i64) -> Result<usize, String> {
    let config = resolve_storage()?;
    let mut conn = open_conn(&config)?;
    domain::delete_task(&mut conn, &week_id, task_id)
}

#[tauri::command]
pub async fn query_all_tasks(filter: QueryFilter) -> Result<Vec<QueryTaskRow>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    queries::query_tasks(&conn, &filter)
}

/// 项目（顶层任务）标题列表：不传周返回跨周去重后的全部项目，传周只返回该周项目。
#[tauri::command]
pub async fn query_group_options(week_id: Option<String>) -> Result<Vec<String>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    queries::group_options(&conn, week_id.as_deref())
}

#[tauri::command]
pub async fn week_summaries() -> Result<Vec<(String, i64, i64)>, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    queries::week_summaries(&conn)
}

/// 历史统计 / 复盘视图的一次性聚合数据（可按起止周过滤，缺省为全部历史）。
#[tauri::command]
pub async fn statistics_overview(
    start_week_id: Option<String>,
    end_week_id: Option<String>,
) -> Result<StatisticsOverview, String> {
    let config = resolve_storage()?;
    let conn = open_conn(&config)?;
    queries::statistics_overview(&conn, start_week_id.as_deref(), end_week_id.as_deref())
}

/// Current storage directory.
#[tauri::command]
pub async fn get_storage_dir() -> Result<String, String> {
    let config = resolve_storage()?;
    Ok(config.data_dir)
}

/// Pick a new directory via dialog and migrate storage there.
#[tauri::command]
pub async fn pick_and_migrate_storage(app: AppHandle) -> Result<MigrateResult, String> {
    let folder = app.dialog().file().blocking_pick_folder();
    let Some(folder_path) = folder.and_then(|path| path.into_path().ok()) else {
        return Err("未选择目录".to_string());
    };
    migrate_storage_to(folder_path).await
}

#[tauri::command]
pub async fn migrate_storage_to(new_data_dir: PathBuf) -> Result<MigrateResult, String> {
    let config = resolve_storage()?;
    let migrated = storage::migrate_storage(&config, new_data_dir)?;
    Ok(MigrateResult {
        data_dir: migrated.data_dir,
        message: "数据迁移完成".to_string(),
    })
}

#[tauri::command]
pub async fn check_for_app_update(proxy: Option<ProxyConfig>) -> Result<UpdateCheckResult, String> {
    updater::check_for_app_update(proxy).await
}

#[tauri::command]
pub async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
    proxy: Option<ProxyConfig>,
) -> Result<String, String> {
    updater::download_and_install_update(app, download_url, proxy).await
}

/// Exit the current process so the detached updater helper can start NSIS.
#[tauri::command]
pub async fn exit_app_for_update(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

/// Hide the main window into the system tray without exiting the app.
#[tauri::command]
pub async fn hide_main_window(app: AppHandle) -> Result<(), String> {
    crate::tray::hide_main_window(&app);
    Ok(())
}

/// Exit the app entirely (used when the user chooses "exit" on close).
#[tauri::command]
pub async fn exit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn open_release_page() -> Result<(), String> {
    updater::open_release_page().await
}

/// Open the data directory in the system file manager.
/// On Windows the database file is selected directly, which makes manual
/// backup / copy easy without hunting for the file inside the folder.
#[tauri::command]
pub async fn open_data_dir() -> Result<String, String> {
    let config = resolve_storage()?;
    let data_dir = std::path::Path::new(&config.data_dir);
    if !data_dir.is_dir() {
        return Err(format!("数据目录不存在：{}", data_dir.display()));
    }
    #[cfg(target_os = "windows")]
    {
        let db_file = data_dir.join(db::DB_FILE_NAME);
        if db_file.exists() {
            let _ = std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&db_file)
                .spawn();
            return Ok(config.data_dir);
        }
    }
    open::that(data_dir).map_err(|error| format!("打开数据目录失败：{error}"))?;
    Ok(config.data_dir)
}

/// Validate WebDAV connectivity and create the target directory when missing.
#[tauri::command]
pub async fn webdav_test_connection(
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let base_url = webdav::normalize_dir_url(&url)?;
    let client = webdav::build_client()?;
    // 密码留空时回退到系统凭据中已保存的密码。
    let actual_password = if password.is_empty() {
        credentials::load_password(&username)?
            .ok_or_else(|| "未填写密码，且系统凭据中未保存该账号的密码".to_string())?
    } else {
        password
    };
    webdav::ensure_dir(&client, &base_url, &username, &actual_password).await?;
    Ok(format!("连接成功：{base_url}"))
}

/// Persist the WebDAV password in the OS credential store.
#[tauri::command]
pub async fn webdav_save_credentials(username: String, password: String) -> Result<bool, String> {
    if password.is_empty() {
        return Ok(false);
    }
    credentials::save_password(&username, &password)?;
    Ok(true)
}

/// Whether a password is stored for the given WebDAV username.
#[tauri::command]
pub async fn webdav_has_credentials(username: String) -> Result<bool, String> {
    credentials::has_password(&username)
}

/// Remove the stored password for the given WebDAV username.
#[tauri::command]
pub async fn webdav_clear_credentials(username: String) -> Result<(), String> {
    credentials::delete_password(&username)
}

/// Run one file-level sync against the configured WebDAV directory.
#[tauri::command]
pub async fn webdav_sync_now(url: String, username: String) -> Result<SyncResult, String> {
    let config = resolve_storage()?;
    sync::sync_now(&config.data_dir, &url, &username).await
}

/// Run one scheduler-driven sync with the empty-database overwrite guard enabled.
#[tauri::command]
pub async fn webdav_sync_automatic(url: String, username: String) -> Result<SyncResult, String> {
    let config = resolve_storage()?;
    sync::sync_automatically(&config.data_dir, &url, &username).await
}

/// List the current remote database and its timestamped backups.
#[tauri::command]
pub async fn webdav_list_versions(
    url: String,
    username: String,
) -> Result<Vec<crate::contracts::RemoteDatabaseVersion>, String> {
    let password = credentials::load_password(&username)?
        .ok_or_else(|| "尚未保存该账号的密码，请在同步设置中填写密码后重试".to_string())?;
    let base_url = webdav::normalize_dir_url(&url)?;
    let client = webdav::build_client()?;
    webdav::ensure_dir(&client, &base_url, &username, &password).await?;
    webdav::list_database_versions(&client, &base_url, &username, &password).await
}

/// Restore a server-listed database version after backing up the current local database.
#[tauri::command]
pub async fn webdav_restore_version(
    url: String,
    username: String,
    file_name: String,
) -> Result<crate::contracts::RestoreResult, String> {
    let config = resolve_storage()?;
    sync::restore_database_version(&config.data_dir, &url, &username, &file_name).await
}
