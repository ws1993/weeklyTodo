use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::{Connection, OptionalExtension, params};

pub const TASK_STATUS_IN_PROGRESS: &str = "in_progress";
pub const TASK_STATUS_CLOSED: &str = "closed";
pub const DEFAULT_PRIORITY: i64 = 2;

pub const EVENT_TYPE_CREATE: &str = "create";
pub const EVENT_TYPE_UPDATE: &str = "update";
pub const EVENT_TYPE_CLOSE: &str = "close";
pub const EVENT_TYPE_REOPEN: &str = "reopen";
pub const EVENT_TYPE_CARRY_OVER: &str = "carry_over";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Week {
    pub id: String,
    pub start_date: String,
    pub end_date: String,
    pub created_at: String,
    pub carried_from_week_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub week_id: String,
    pub parent_id: Option<i64>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: i64,
    pub sort_index: f64,
    pub origin_week_id: Option<String>,
    pub carried_from_task_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
}

/// Format a date as `YYYYMMDD`.
fn date_key(date: NaiveDate) -> String {
    date.format("%Y%m%d").to_string()
}

fn iso_now() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S%.3f").to_string()
}

/// ISO week range string like `20260803-20260809`.
fn week_range_key(monday: NaiveDate) -> String {
    let sunday = monday + Duration::days(6);
    format!("{}-{}", date_key(monday), date_key(sunday))
}

/// The Monday (week start) containing `date` in the local calendar.
pub fn monday_of(date: NaiveDate) -> NaiveDate {
    let day_index = date.weekday().num_days_from_monday() as i64;
    date - Duration::days(day_index)
}

/// Build a Week record for the week starting at `monday`.
fn week_from_monday(monday: NaiveDate, carried_from: Option<String>) -> Week {
    let start = date_key(monday);
    let end = date_key(monday + Duration::days(6));
    Week {
        id: format!("{start}-{end}"),
        start_date: start,
        end_date: end,
        created_at: iso_now(),
        carried_from_week_id: carried_from,
    }
}

/// The most recent stored week that starts on or before `date`.
fn latest_week_starting_on_or_before(
    conn: &Connection,
    date: NaiveDate,
) -> Result<Option<Week>, String> {
    let target = date_key(date);
    let mut stmt = conn
        .prepare(
            "SELECT id, start_date, end_date, created_at, carried_from_week_id
             FROM weeks WHERE start_date <= ?1 ORDER BY start_date DESC LIMIT 1",
        )
        .map_err(|error| format!("查询周失败：{error}"))?;
    let week = stmt
        .query_row(params![target], week_from_row)
        .optional()
        .map_err(|error| format!("读取周失败：{error}"))?;
    Ok(week)
}

fn week_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Week> {
    Ok(Week {
        id: row.get(0)?,
        start_date: row.get(1)?,
        end_date: row.get(2)?,
        created_at: row.get(3)?,
        carried_from_week_id: row.get(4)?,
    })
}

fn insert_week(conn: &Connection, week: &Week) -> Result<(), String> {
    conn.execute(
        "INSERT INTO weeks (id, start_date, end_date, created_at, carried_from_week_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            week.id,
            week.start_date,
            week.end_date,
            week.created_at,
            week.carried_from_week_id
        ],
    )
    .map_err(|error| format!("写入周失败：{error}"))?;
    Ok(())
}

fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        week_id: row.get(1)?,
        parent_id: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        sort_index: row.get(7)?,
        origin_week_id: row.get(8)?,
        carried_from_task_id: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        closed_at: row.get(12)?,
    })
}

fn get_task(conn: &Connection, week_id: &str, task_id: i64) -> Result<Option<Task>, String> {
    conn.query_row(
        "SELECT id, week_id, parent_id, title, description, status, priority, sort_index,
                origin_week_id, carried_from_task_id, created_at, updated_at, closed_at
         FROM tasks WHERE id = ?1 AND week_id = ?2",
        params![task_id, week_id],
        task_from_row,
    )
    .optional()
    .map_err(|error| format!("读取任务失败：{error}"))
}

fn list_tasks(conn: &Connection, week_id: &str) -> Result<Vec<Task>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, week_id, parent_id, title, description, status, priority, sort_index,
                    origin_week_id, carried_from_task_id, created_at, updated_at, closed_at
             FROM tasks WHERE week_id = ?1 ORDER BY sort_index, id",
        )
        .map_err(|error| format!("查询任务失败：{error}"))?;
    let tasks = stmt
        .query_map(params![week_id], task_from_row)
        .map_err(|error| format!("遍历任务失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取任务失败：{error}"))?;
    Ok(tasks)
}

/// Public variant used by commands and queries.
pub fn list_tasks_for_week(conn: &Connection, week_id: &str) -> Result<Vec<Task>, String> {
    list_tasks(conn, week_id)
}

fn has_week(conn: &Connection, week_id: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM weeks WHERE id = ?1)",
        params![week_id],
        |row| row.get(0),
    )
    .map_err(|error| format!("查询周失败：{error}"))
}

fn record_event(
    conn: &Connection,
    week_id: &str,
    task_id: Option<i64>,
    event_type: &str,
    payload: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO task_events (week_id, task_id, event_type, payload, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![week_id, task_id, event_type, payload, iso_now()],
    )
    .map_err(|error| format!("写入事件失败：{error}"))?;
    Ok(())
}

pub struct CreateTaskInput {
    pub title: String,
    pub description: String,
    pub parent_id: Option<i64>,
    pub priority: i64,
}

/// Create a task in `week_id`. Returns the created task.
pub fn create_task(
    conn: &Connection,
    week_id: &str,
    input: CreateTaskInput,
) -> Result<Task, String> {
    if !has_week(conn, week_id)? {
        return Err(format!("周不存在：{week_id}"));
    }
    let title = input.title.trim();
    if title.is_empty() {
        return Err("任务标题不能为空".to_string());
    }
    if let Some(parent_id) = input.parent_id {
        let parent = get_task(conn, week_id, parent_id)?
            .ok_or_else(|| "父任务不存在".to_string())?;
        if parent.status == TASK_STATUS_CLOSED {
            return Err("不能向已关闭的任务添加子任务".to_string());
        }
    }

    let now = iso_now();
    let priority = input.priority.clamp(0, 3);
    let next_index: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_index), 0) + 1 FROM tasks WHERE week_id = ?1",
            params![week_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("计算排序失败：{error}"))?;

    conn.execute(
        "INSERT INTO tasks (week_id, parent_id, title, description, status, priority, sort_index,
                            origin_week_id, carried_from_task_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?8)",
        params![
            week_id,
            input.parent_id,
            title,
            input.description,
            TASK_STATUS_IN_PROGRESS,
            priority,
            next_index,
            now
        ],
    )
    .map_err(|error| format!("写入任务失败：{error}"))?;

    let task_id = conn.last_insert_rowid();
    record_event(conn, week_id, Some(task_id), EVENT_TYPE_CREATE, None)?;
    get_task(conn, week_id, task_id)?
        .ok_or_else(|| "创建任务后读取失败".to_string())
}

pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i64>,
}

/// Update task fields. Returns the updated task.
pub fn update_task(
    conn: &Connection,
    week_id: &str,
    task_id: i64,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    let current = get_task(conn, week_id, task_id)?
        .ok_or_else(|| "任务不存在".to_string())?;

    let title = input
        .title
        .map(|value| value.trim().to_string())
        .unwrap_or_else(|| current.title.clone());
    if title.is_empty() {
        return Err("任务标题不能为空".to_string());
    }
    let description = input.description.unwrap_or(current.description.clone());
    let priority = input.priority.unwrap_or(current.priority).clamp(0, 3);

    conn.execute(
        "UPDATE tasks SET title = ?1, description = ?2, priority = ?3, updated_at = ?4
         WHERE id = ?5 AND week_id = ?6",
        params![title, description, priority, iso_now(), task_id, week_id],
    )
    .map_err(|error| format!("更新任务失败：{error}"))?;

    record_event(conn, week_id, Some(task_id), EVENT_TYPE_UPDATE, None)?;
    get_task(conn, week_id, task_id)?
        .ok_or_else(|| "更新任务后读取失败".to_string())
}

/// Whether the subtree rooted at `root_id` contains at least one open task.
fn subtree_has_open(conn: &Connection, root_id: i64) -> Result<bool, String> {
    let mut frontier = vec![root_id];
    while let Some(current) = frontier.pop() {
        let status: String = conn
            .query_row(
                "SELECT status FROM tasks WHERE id = ?1",
                params![current],
                |row| row.get(0),
            )
            .map_err(|error| format!("读取任务状态失败：{error}"))?;
        if status == TASK_STATUS_IN_PROGRESS {
            return Ok(true);
        }
        let mut stmt = conn
            .prepare("SELECT id FROM tasks WHERE parent_id = ?1")
            .map_err(|error| format!("查询子任务失败：{error}"))?;
        let mapped = stmt
            .query_map(params![current], |row| row.get(0))
            .map_err(|error| format!("遍历子任务失败：{error}"))?;
        let children: Vec<i64> = mapped
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取子任务失败：{error}"))?;
        for child in children {
            frontier.push(child);
        }
    }
    Ok(false)
}

/// Close a task and, when all siblings are closed, its ancestors (bottom-up).
pub fn close_task(conn: &mut Connection, week_id: &str, task_id: i64) -> Result<Task, String> {
    let mut current = get_task(conn, week_id, task_id)?
        .ok_or_else(|| "任务不存在".to_string())?;
    if current.status == TASK_STATUS_CLOSED {
        return Ok(current);
    }

    let tx = conn
        .transaction()
        .map_err(|error| format!("开启关闭事务失败：{error}"))?;
    let now = iso_now();
    tx.execute(
        "UPDATE tasks SET status = ?1, closed_at = ?2, updated_at = ?2 WHERE id = ?3",
        params![TASK_STATUS_CLOSED, now, task_id],
    )
    .map_err(|error| format!("关闭任务失败：{error}"))?;
    record_event(&tx, week_id, Some(task_id), EVENT_TYPE_CLOSE, None)?;

    // Cascade close ancestors when all children are closed.
    let mut ancestor_id = current.parent_id;
    while let Some(ancestor) = ancestor_id {
        let parent = get_task(&tx, week_id, ancestor)?.unwrap();
        let open_children: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE parent_id = ?1 AND status = ?2",
                params![ancestor, TASK_STATUS_IN_PROGRESS],
                |row| row.get(0),
            )
            .map_err(|error| format!("统计子任务失败：{error}"))?;
        if open_children == 0 {
            tx.execute(
                "UPDATE tasks SET status = ?1, closed_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![TASK_STATUS_CLOSED, now, ancestor],
            )
            .map_err(|error| format!("关闭父任务失败：{error}"))?;
            record_event(&tx, week_id, Some(ancestor), EVENT_TYPE_CLOSE, None)?;
            ancestor_id = parent.parent_id;
        } else {
            break;
        }
    }

    tx.commit()
        .map_err(|error| format!("提交关闭事务失败：{error}"))?;
    current.status = TASK_STATUS_CLOSED.to_string();
    current.closed_at = Some(now);
    Ok(current)
}

/// Reopen a closed task. Ancestors stay closed unless reopened explicitly.
pub fn reopen_task(conn: &mut Connection, week_id: &str, task_id: i64) -> Result<Task, String> {
    let current = get_task(conn, week_id, task_id)?
        .ok_or_else(|| "任务不存在".to_string())?;
    if current.status == TASK_STATUS_IN_PROGRESS {
        return Ok(current);
    }

    let tx = conn
        .transaction()
        .map_err(|error| format!("开启重新打开事务失败：{error}"))?;
    let now = iso_now();
    tx.execute(
        "UPDATE tasks SET status = ?1, closed_at = NULL, updated_at = ?2 WHERE id = ?3",
        params![TASK_STATUS_IN_PROGRESS, now, task_id],
    )
    .map_err(|error| format!("重新打开任务失败：{error}"))?;
    record_event(&tx, week_id, Some(task_id), EVENT_TYPE_REOPEN, None)?;

    // Reopen closed ancestors so the reopened task keeps its context.
    let mut ancestor_id = current.parent_id;
    while let Some(ancestor) = ancestor_id {
        let ancestor_status: String = tx
            .query_row(
                "SELECT status FROM tasks WHERE id = ?1",
                params![ancestor],
                |row| row.get(0),
            )
            .map_err(|error| format!("读取祖先任务状态失败：{error}"))?;
        if ancestor_status == TASK_STATUS_CLOSED {
            tx.execute(
                "UPDATE tasks SET status = ?1, closed_at = NULL, updated_at = ?2 WHERE id = ?3",
                params![TASK_STATUS_IN_PROGRESS, now, ancestor],
            )
            .map_err(|error| format!("重新打开父任务失败：{error}"))?;
            record_event(&tx, week_id, Some(ancestor), EVENT_TYPE_REOPEN, None)?;
        }
        ancestor_id = tx
            .query_row(
                "SELECT parent_id FROM tasks WHERE id = ?1",
                params![ancestor],
                |row| row.get(0),
            )
            .map_err(|error| format!("读取祖先父级失败：{error}"))?;
    }

    tx.commit()
        .map_err(|error| format!("提交重新打开事务失败：{error}"))?;
    get_task(conn, week_id, task_id)?
        .ok_or_else(|| "重新打开任务后读取失败".to_string())
}

/// Re-parent and re-order a task within the same week.
pub fn move_task(
    conn: &Connection,
    week_id: &str,
    task_id: i64,
    new_parent_id: Option<i64>,
    new_index: f64,
) -> Result<(), String> {
    if get_task(conn, week_id, task_id)?.is_none() {
        return Err("任务不存在".to_string());
    }

    if let Some(parent_id) = new_parent_id {
        if parent_id == task_id {
            return Err("不能将任务移动到自身下面".to_string());
        }
        let parent = get_task(conn, week_id, parent_id)?
            .ok_or_else(|| "父任务不存在".to_string())?;
        if parent.status == TASK_STATUS_CLOSED {
            return Err("不能移动到已关闭的任务下".to_string());
        }
        // Prevent cycles: the new parent must not be inside the moved subtree.
        let mut cursor = Some(parent_id);
        let mut guard = 0;
        while let Some(current) = cursor {
            if current == task_id {
                return Err("不能将任务移动到自己的子树内".to_string());
            }
            cursor = get_task(conn, week_id, current)?
                .map(|task| task.parent_id)
                .unwrap_or(None);
            guard += 1;
            if guard > 64 {
                break;
            }
        }
    }

    conn.execute(
        "UPDATE tasks SET parent_id = ?1, sort_index = ?2, updated_at = ?3
         WHERE id = ?4 AND week_id = ?5",
        params![new_parent_id, new_index, iso_now(), task_id, week_id],
    )
    .map_err(|error| format!("移动任务失败：{error}"))?;
    record_event(conn, week_id, Some(task_id), EVENT_TYPE_UPDATE, None)?;
    Ok(())
}

/// Ensure the current week exists, creating it (with carry-over) when missing.
/// Returns the current week and whether it was newly created.
pub fn ensure_current_week(conn: &mut Connection) -> Result<(Week, bool), String> {
    let today = Local::now().date_naive();
    let monday = monday_of(today);
    let week_id = week_range_key(monday);

    if has_week(conn, &week_id)? {
        let week = conn
            .query_row(
                "SELECT id, start_date, end_date, created_at, carried_from_week_id
                 FROM weeks WHERE id = ?1",
                params![week_id],
                week_from_row,
            )
            .map_err(|error| format!("读取当前周失败：{error}"))?;
        return Ok((week, false));
    }

    // Carry from the latest stored week that starts on or before today.
    let carried_from = latest_week_starting_on_or_before(conn, today)?;
    let new_week = week_from_monday(monday, carried_from.as_ref().map(|w| w.id.clone()));

    let tx = conn
        .transaction()
        .map_err(|error| format!("开启建周事务失败：{error}"))?;
    if let Some(source) = &carried_from {
        carry_over_week(&tx, &new_week.id, &source.id)?;
    }
    insert_week(&tx, &new_week)?;
    tx.commit()
        .map_err(|error| format!("提交建周事务失败：{error}"))?;

    Ok((new_week, true))
}

/// Clone unfinished branches of `source_week_id` into `target_week_id`.
/// Open tasks are copied. Within an open branch, closed descendants are copied
/// as read-only context (status preserved). Fully closed branches are omitted.
fn carry_over_week(
    conn: &Connection,
    target_week_id: &str,
    source_week_id: &str,
) -> Result<(), String> {
    let source_tasks = list_tasks(conn, source_week_id)?;
    if source_tasks.is_empty() {
        return Ok(());
    }

    // Map source task id -> target task id for copied tasks.
    let mut id_map: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
    // Roots are tasks without a parent (top-level open tasks and top-level closed tasks
    // that have open descendants).
    let root_ids: Vec<i64> = source_tasks
        .iter()
        .filter(|task| task.parent_id.is_none())
        .map(|task| task.id)
        .collect();

    for root_id in root_ids {
        carry_over_branch(
            conn,
            target_week_id,
            source_week_id,
            &source_tasks,
            root_id,
            None,
            &mut id_map,
        )?;
    }

    if !id_map.is_empty() {
        let payload = serde_json::json!({
            "sourceWeekId": source_week_id,
            "copiedTasks": id_map.len()
        });
        record_event(
            conn,
            target_week_id,
            None,
            EVENT_TYPE_CARRY_OVER,
            Some(&payload.to_string()),
        )?;
    }
    Ok(())
}

/// Recursively carry one branch. `target_parent_id` is the carried parent task in the target week.
#[allow(clippy::too_many_arguments)]
fn carry_over_branch(
    conn: &Connection,
    target_week_id: &str,
    source_week_id: &str,
    source_tasks: &[Task],
    source_id: i64,
    target_parent_id: Option<i64>,
    id_map: &mut std::collections::HashMap<i64, i64>,
) -> Result<(), String> {
    let task = source_tasks
        .iter()
        .find(|task| task.id == source_id)
        .ok_or_else(|| "carry source task missing".to_string())?;

    let children: Vec<&Task> = source_tasks
        .iter()
        .filter(|child| child.parent_id == Some(source_id))
        .collect();
    let has_open_child = children
        .iter()
        .any(|child| {
            child.status == TASK_STATUS_IN_PROGRESS
                || subtree_has_open(conn, child.id).unwrap_or(false)
        });

    // Skip a completely closed top-level branch (no parent carried over) with no open descendants.
    if task.status == TASK_STATUS_CLOSED && target_parent_id.is_none() && !has_open_child {
        return Ok(());
    }

    // Copy this task (open tasks and closed contextual tasks both come over).
    let now = iso_now();
    conn.execute(
        "INSERT INTO tasks (week_id, parent_id, title, description, status, priority, sort_index,
                            origin_week_id, carried_from_task_id, created_at, updated_at, closed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11)",
        params![
            target_week_id,
            target_parent_id,
            task.title,
            task.description,
            task.status,
            task.priority,
            task.sort_index,
            task.origin_week_id.as_deref().unwrap_or(source_week_id),
            source_id,
            now,
            task.closed_at
        ],
    )
    .map_err(|error| format!("复制任务失败：{error}"))?;
    let new_id = conn.last_insert_rowid();
    id_map.insert(source_id, new_id);
    record_event(
        conn,
        target_week_id,
        Some(new_id),
        EVENT_TYPE_CARRY_OVER,
        Some(&serde_json::json!({ "fromTaskId": source_id }).to_string()),
    )?;

    for child in children {
        carry_over_branch(
            conn,
            target_week_id,
            source_week_id,
            source_tasks,
            child.id,
            Some(new_id),
            id_map,
        )?;
    }
    Ok(())
}

/// Create a week manually for a Monday start date. Duplicates are rejected.
pub fn create_week_for_monday(
    conn: &Connection,
    monday: NaiveDate,
) -> Result<Week, String> {
    let week = week_from_monday(monday, None);
    if has_week(conn, &week.id)? {
        return Err(format!("周已存在：{}", week.id));
    }
    insert_week(conn, &week)?;
    record_event(conn, &week.id, None, "create", Some("manual"))?;
    Ok(week)
}

/// All stored weeks sorted newest first.
pub fn list_weeks(conn: &Connection) -> Result<Vec<Week>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, start_date, end_date, created_at, carried_from_week_id
             FROM weeks ORDER BY start_date DESC",
        )
        .map_err(|error| format!("查询周列表失败：{error}"))?;
    let weeks = stmt
        .query_map([], week_from_row)
        .map_err(|error| format!("遍历周列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取周列表失败：{error}"))?;
    Ok(weeks)
}

/// Get a week by id.
pub fn get_week(conn: &Connection, week_id: &str) -> Result<Option<Week>, String> {
    conn.query_row(
        "SELECT id, start_date, end_date, created_at, carried_from_week_id
         FROM weeks WHERE id = ?1",
        params![week_id],
        week_from_row,
    )
    .optional()
    .map_err(|error| format!("读取周失败：{error}"))
}

pub fn current_week_id() -> String {
    week_range_key(monday_of(Local::now().date_naive()))
}

#[cfg(test)]
pub fn insert_week_helper(conn: &Connection, id: &str, start_date: &str, end_date: &str) {
    conn.execute(
        "INSERT INTO weeks (id, start_date, end_date, created_at, carried_from_week_id)
         VALUES (?1, ?2, ?3, ?4, NULL)",
        params![id, start_date, end_date, iso_now()],
    )
    .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn seed_week(conn: &Connection, week_id: &str) {
        insert_week(
            conn,
            &Week {
                id: week_id.to_string(),
                start_date: week_id[..8].to_string(),
                end_date: week_id[9..].to_string(),
                created_at: iso_now(),
                carried_from_week_id: None,
            },
        )
        .unwrap();
    }

    #[test]
    fn monday_of_known_date() {
        // 2026-08-03 is a Monday.
        assert_eq!(
            monday_of(NaiveDate::from_ymd_opt(2026, 8, 3).unwrap()),
            NaiveDate::from_ymd_opt(2026, 8, 3).unwrap()
        );
        // 2026-08-07 (Friday) belongs to the same week.
        assert_eq!(
            monday_of(NaiveDate::from_ymd_opt(2026, 8, 7).unwrap()),
            NaiveDate::from_ymd_opt(2026, 8, 3).unwrap()
        );
        // 2026-08-09 (Sunday) belongs to the same week.
        assert_eq!(
            monday_of(NaiveDate::from_ymd_opt(2026, 8, 9).unwrap()),
            NaiveDate::from_ymd_opt(2026, 8, 3).unwrap()
        );
        // 2026-08-10 (Monday) starts a new week.
        assert_eq!(
            monday_of(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
            NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()
        );
    }

    #[test]
    fn carry_over_copies_open_branches_only() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        // Open root with open child.
        let root = create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "项目A".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        let child = create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "子任务1".into(),
                description: String::new(),
                parent_id: Some(root.id),
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        // Completed root with no open descendants.
        let done_root = create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "已完成项目".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        close_task(&mut conn, "20260727-20260802", done_root.id).unwrap();

        let target = "20260803-20260809";
        carry_over_week(&conn, target, "20260727-20260802").unwrap();

        let target_tasks = list_tasks(&conn, target).unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["项目A", "子任务1"]);
        assert!(target_tasks.iter().all(|t| t.carried_from_task_id.is_some()));
        let copied_child = target_tasks
            .iter()
            .find(|t| t.title == "子任务1")
            .unwrap();
        let copied_root = target_tasks
            .iter()
            .find(|t| t.title == "项目A")
            .unwrap();
        assert_eq!(copied_child.parent_id, Some(copied_root.id));
        assert_eq!(copied_root.origin_week_id.as_deref(), Some("20260727-20260802"));
        assert_eq!(child.origin_week_id, None);
        assert_eq!(copied_child.status, TASK_STATUS_IN_PROGRESS);
    }

    #[test]
    fn closed_context_stays_inside_open_branch() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        let root = create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "项目B".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        let done_child = create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "已完成步骤".into(),
                description: String::new(),
                parent_id: Some(root.id),
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "进行中的步骤".into(),
                description: String::new(),
                parent_id: Some(root.id),
                priority: DEFAULT_PRIORITY,
            },
        )
        .unwrap();
        close_task(&mut conn, "20260727-20260802", done_child.id).unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let target_tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["项目B", "已完成步骤", "进行中的步骤"]);
        let copied_done = target_tasks
            .iter()
            .find(|t| t.title == "已完成步骤")
            .unwrap();
        assert_eq!(copied_done.status, TASK_STATUS_CLOSED);
        assert!(copied_done.closed_at.is_some());
    }

    #[test]
    fn ensure_current_week_is_idempotent() {
        let mut conn = db::open_in_memory();
        let (week, created) = ensure_current_week(&mut conn).unwrap();
        assert!(created);
        assert_eq!(week.id, current_week_id());
        let (week_again, created_again) = ensure_current_week(&mut conn).unwrap();
        assert!(!created_again);
        assert_eq!(week_again.id, week.id);
    }

    #[test]
    fn manual_duplicate_week_rejected() {
        let conn = db::open_in_memory();
        let monday = NaiveDate::from_ymd_opt(2026, 8, 17).unwrap();
        create_week_for_monday(&conn, monday).unwrap();
        assert!(create_week_for_monday(&conn, monday).is_err());
    }
}
