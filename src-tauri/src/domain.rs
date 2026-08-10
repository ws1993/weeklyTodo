use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

pub const TASK_STATUS_IN_PROGRESS: &str = "in_progress";
pub const TASK_STATUS_CLOSED: &str = "closed";
pub const DEFAULT_PRIORITY: i64 = 2;
pub const EXECUTION_MODE_SELF: &str = "self";
pub const EXECUTION_MODE_FOLLOW_UP: &str = "follow_up";

pub const EVENT_TYPE_CREATE: &str = "create";
pub const EVENT_TYPE_UPDATE: &str = "update";
pub const EVENT_TYPE_CLOSE: &str = "close";
pub const EVENT_TYPE_REOPEN: &str = "reopen";
pub const EVENT_TYPE_CARRY_OVER: &str = "carry_over";
pub const EVENT_TYPE_DELETE: &str = "delete";

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
    pub execution_mode: String,
    pub owner_id: Option<i64>,
    pub owner_name: Option<String>,
    pub assigner_id: Option<i64>,
    pub assigner_name: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Owner {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Assigner {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
}

/// A color mapping for one root task (group). Auto-assigned from the palette
/// on first appearance, overridable by the user (is_manual).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupColor {
    pub name: String,
    pub color: String,
    pub is_manual: bool,
}

/// High-distinction palette used for group color auto-assignment.
/// Must stay in sync with `GROUP_PALETTE` in `src/utils/groupColors.ts`.
pub const GROUP_COLOR_PALETTE: [&str; 12] = [
    "#E05A3E", "#E0A03D", "#A9B84A", "#4F9E5A", "#2E9E7C", "#2AA5A0", "#3B8FBF", "#4A6FD1",
    "#5A5FC0", "#7A5FC0", "#C05FA0", "#C0557A",
];

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
        execution_mode: row.get(13)?,
        owner_id: row.get(14)?,
        owner_name: row.get(15)?,
        assigner_id: row.get(16)?,
        assigner_name: row.get(17)?,
        tags: Vec::new(),
    })
}

fn get_task(conn: &Connection, week_id: &str, task_id: i64) -> Result<Option<Task>, String> {
    let mut task = conn
        .query_row(
            "SELECT t.id, t.week_id, t.parent_id, t.title, t.description, t.status, t.priority,
                    t.sort_index, t.origin_week_id, t.carried_from_task_id, t.created_at,
                    t.updated_at, t.closed_at, t.execution_mode, t.owner_id, o.name,
                    t.assigner_id, a.name
             FROM tasks t LEFT JOIN owners o ON o.id = t.owner_id
             LEFT JOIN assigners a ON a.id = t.assigner_id
             WHERE t.id = ?1 AND t.week_id = ?2",
            params![task_id, week_id],
            task_from_row,
        )
        .optional()
        .map_err(|error| format!("读取任务失败：{error}"))?;
    if let Some(task) = task.as_mut() {
        attach_tags(conn, std::slice::from_mut(task))?;
    }
    Ok(task)
}

/// Load tag names for the given task ids as `task_id -> tag names` map.
pub fn load_task_tags(
    conn: &Connection,
    task_ids: &[i64],
) -> Result<std::collections::HashMap<i64, Vec<String>>, String> {
    let mut result = std::collections::HashMap::new();
    if task_ids.is_empty() {
        return Ok(result);
    }
    let placeholders = task_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT tt.task_id, t.name
         FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
         WHERE tt.task_id IN ({placeholders}) ORDER BY t.name"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("准备标签查询失败：{error}"))?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(task_ids), |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("查询标签失败：{error}"))?;
    for row in rows {
        let (task_id, name) = row.map_err(|error| format!("读取标签失败：{error}"))?;
        result.entry(task_id).or_insert_with(Vec::new).push(name);
    }
    Ok(result)
}

fn attach_tags(conn: &Connection, tasks: &mut [Task]) -> Result<(), String> {
    let ids: Vec<i64> = tasks.iter().map(|task| task.id).collect();
    let tag_map = load_task_tags(conn, &ids)?;
    for task in tasks.iter_mut() {
        task.tags = tag_map.get(&task.id).cloned().unwrap_or_default();
    }
    Ok(())
}

fn list_tasks(conn: &Connection, week_id: &str) -> Result<Vec<Task>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.week_id, t.parent_id, t.title, t.description, t.status, t.priority,
                    t.sort_index, t.origin_week_id, t.carried_from_task_id, t.created_at,
                    t.updated_at, t.closed_at, t.execution_mode, t.owner_id, o.name,
                    t.assigner_id, a.name
             FROM tasks t LEFT JOIN owners o ON o.id = t.owner_id
             LEFT JOIN assigners a ON a.id = t.assigner_id
             WHERE t.week_id = ?1 ORDER BY t.sort_index, t.id",
        )
        .map_err(|error| format!("查询任务失败：{error}"))?;
    let mut tasks = stmt
        .query_map(params![week_id], task_from_row)
        .map_err(|error| format!("遍历任务失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取任务失败：{error}"))?;
    attach_tags(conn, &mut tasks)?;
    Ok(tasks)
}

/// Public variant used by commands and queries.
pub fn list_tasks_for_week(conn: &Connection, week_id: &str) -> Result<Vec<Task>, String> {
    list_tasks(conn, week_id)
}

/// Ensure an owner exists by name; create it when missing. Returns the owner id.
pub fn ensure_owner(conn: &Connection, name: &str) -> Result<i64, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("负责人不能为空".to_string());
    }
    conn.execute(
        "INSERT OR IGNORE INTO owners (name) VALUES (?1)",
        params![trimmed],
    )
    .map_err(|error| format!("写入负责人失败：{error}"))?;
    conn.query_row(
        "SELECT id FROM owners WHERE name = ?1",
        params![trimmed],
        |row| row.get(0),
    )
    .map_err(|error| format!("读取负责人失败：{error}"))
}

/// Ensure a tag exists by name; create it when missing. Returns the tag id.
pub fn ensure_tag(conn: &Connection, name: &str) -> Result<i64, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("标签不能为空".to_string());
    }
    conn.execute(
        "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
        params![trimmed],
    )
    .map_err(|error| format!("写入标签失败：{error}"))?;
    conn.query_row(
        "SELECT id FROM tags WHERE name = ?1",
        params![trimmed],
        |row| row.get(0),
    )
    .map_err(|error| format!("读取标签失败：{error}"))
}

/// All owners ordered by name, for dropdown options.
pub fn list_owners(conn: &Connection) -> Result<Vec<Owner>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM owners ORDER BY name COLLATE NOCASE, id")
        .map_err(|error| format!("查询负责人列表失败：{error}"))?;
    let owners = stmt
        .query_map([], |row| {
            Ok(Owner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|error| format!("遍历负责人列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取负责人列表失败：{error}"))?;
    Ok(owners)
}

/// All tags ordered by name, for dropdown options.
pub fn list_tags(conn: &Connection) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE, id")
        .map_err(|error| format!("查询标签列表失败：{error}"))?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|error| format!("遍历标签列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取标签列表失败：{error}"))?;
    Ok(tags)
}

/// Rename an owner. Returns the updated owner.
pub fn rename_owner(conn: &Connection, id: i64, new_name: &str) -> Result<Owner, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("负责人名称不能为空".to_string());
    }
    let affected = conn
        .execute(
            "UPDATE owners SET name = ?1 WHERE id = ?2",
            params![trimmed, id],
        )
        .map_err(|error| format!("重命名负责人失败:{error}"))?;
    if affected == 0 {
        return Err("负责人不存在".to_string());
    }
    conn.query_row(
        "SELECT id, name FROM owners WHERE id = ?1",
        params![id],
        |row| {
            Ok(Owner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取重命名后的负责人失败:{error}"))
}

/// Rename a tag. Returns the updated tag.
pub fn rename_tag(conn: &Connection, id: i64, new_name: &str) -> Result<Tag, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("标签名称不能为空".to_string());
    }
    let affected = conn
        .execute(
            "UPDATE tags SET name = ?1 WHERE id = ?2",
            params![trimmed, id],
        )
        .map_err(|error| format!("重命名标签失败:{error}"))?;
    if affected == 0 {
        return Err("标签不存在".to_string());
    }
    conn.query_row(
        "SELECT id, name FROM tags WHERE id = ?1",
        params![id],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取重命名后的标签失败:{error}"))
}

/// Delete an owner by id. Sets owner_id to NULL on all referencing tasks.
pub fn delete_owner(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE tasks SET owner_id = NULL WHERE owner_id = ?1",
        params![id],
    )
    .map_err(|error| format!("清除任务负责人引用失败:{error}"))?;
    let affected = conn
        .execute("DELETE FROM owners WHERE id = ?1", params![id])
        .map_err(|error| format!("删除负责人失败:{error}"))?;
    if affected == 0 {
        return Err("负责人不存在".to_string());
    }
    Ok(())
}

/// Delete a tag by id. Tag-task associations cascade delete.
pub fn delete_tag(conn: &Connection, id: i64) -> Result<(), String> {
    let affected = conn
        .execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|error| format!("删除标签失败:{error}"))?;
    if affected == 0 {
        return Err("标签不存在".to_string());
    }
    Ok(())
}

/// Ensure an assigner exists by name; create it when missing. Returns the assigner id.
pub fn ensure_assigner(conn: &Connection, name: &str) -> Result<i64, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("分派人不能为空".to_string());
    }
    conn.execute(
        "INSERT OR IGNORE INTO assigners (name) VALUES (?1)",
        params![trimmed],
    )
    .map_err(|error| format!("写入分派人失败：{error}"))?;
    conn.query_row(
        "SELECT id FROM assigners WHERE name = ?1",
        params![trimmed],
        |row| row.get(0),
    )
    .map_err(|error| format!("读取分派人失败：{error}"))
}

/// All assigners ordered by name, for dropdown options.
pub fn list_assigners(conn: &Connection) -> Result<Vec<Assigner>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM assigners ORDER BY name COLLATE NOCASE, id")
        .map_err(|error| format!("查询分派人列表失败：{error}"))?;
    let assigners = stmt
        .query_map([], |row| {
            Ok(Assigner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|error| format!("遍历分派人列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取分派人列表失败：{error}"))?;
    Ok(assigners)
}

/// Rename an assigner. Returns the updated assigner.
pub fn rename_assigner(conn: &Connection, id: i64, new_name: &str) -> Result<Assigner, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("分派人名称不能为空".to_string());
    }
    let affected = conn
        .execute(
            "UPDATE assigners SET name = ?1 WHERE id = ?2",
            params![trimmed, id],
        )
        .map_err(|error| format!("重命名分派人失败:{error}"))?;
    if affected == 0 {
        return Err("分派人不存在".to_string());
    }
    conn.query_row(
        "SELECT id, name FROM assigners WHERE id = ?1",
        params![id],
        |row| {
            Ok(Assigner {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    )
    .map_err(|error| format!("读取重命名后的分派人失败:{error}"))
}

/// Delete an assigner by id. Sets assigner_id to NULL on all referencing tasks.
pub fn delete_assigner(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE tasks SET assigner_id = NULL WHERE assigner_id = ?1",
        params![id],
    )
    .map_err(|error| format!("清除任务分派人引用失败:{error}"))?;
    let affected = conn
        .execute("DELETE FROM assigners WHERE id = ?1", params![id])
        .map_err(|error| format!("删除分派人失败:{error}"))?;
    if affected == 0 {
        return Err("分派人不存在".to_string());
    }
    Ok(())
}

fn group_color_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GroupColor> {
    Ok(GroupColor {
        name: row.get(0)?,
        color: row.get(1)?,
        is_manual: row.get::<_, i64>(2)? != 0,
    })
}

fn read_group_color(conn: &Connection, name: &str) -> Result<Option<GroupColor>, String> {
    conn.query_row(
        "SELECT name, color, is_manual FROM group_colors WHERE name = ?1",
        params![name],
        group_color_from_row,
    )
    .optional()
    .map_err(|error| format!("读取分组颜色失败：{error}"))
}

/// First palette color not yet used by any stored mapping.
fn first_unused_palette_color(conn: &Connection) -> Result<&'static str, String> {
    let mut stmt = conn
        .prepare("SELECT color FROM group_colors")
        .map_err(|error| format!("查询分组颜色失败：{error}"))?;
    let used = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("遍历分组颜色失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取分组颜色失败：{error}"))?;
    GROUP_COLOR_PALETTE
        .iter()
        .copied()
        .find(|color| !used.iter().any(|used_color| used_color.as_str() == *color))
        .ok_or_else(|| "分组颜色已用尽，请手动选择".to_string())
}

/// All group color mappings (name -> color), ordered by name.
pub fn list_group_colors(conn: &Connection) -> Result<Vec<GroupColor>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT name, color, is_manual FROM group_colors
             ORDER BY name COLLATE NOCASE, rowid",
        )
        .map_err(|error| format!("查询分组颜色列表失败：{error}"))?;
    let colors = stmt
        .query_map([], group_color_from_row)
        .map_err(|error| format!("遍历分组颜色列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取分组颜色列表失败：{error}"))?;
    Ok(colors)
}

/// Get the color for a group, auto-assigning the first unused palette color
/// when the mapping does not exist yet.
pub fn ensure_group_color(conn: &Connection, name: &str) -> Result<GroupColor, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("分组名称不能为空".to_string());
    }
    if let Some(existing) = read_group_color(conn, trimmed)? {
        return Ok(existing);
    }
    let color = first_unused_palette_color(conn)?;
    conn.execute(
        "INSERT INTO group_colors (name, color, is_manual) VALUES (?1, ?2, 0)",
        params![trimmed, color],
    )
    .map_err(|error| format!("写入分组颜色失败：{error}"))?;
    read_group_color(conn, trimmed)?.ok_or_else(|| "读取新建分组颜色失败".to_string())
}

/// Manually set a group's color.
pub fn set_group_color(conn: &Connection, name: &str, color: &str) -> Result<GroupColor, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("分组名称不能为空".to_string());
    }
    conn.execute(
        "INSERT INTO group_colors (name, color, is_manual) VALUES (?1, ?2, 1)
         ON CONFLICT(name) DO UPDATE SET color = excluded.color, is_manual = 1",
        params![trimmed, color],
    )
    .map_err(|error| format!("设置分组颜色失败：{error}"))?;
    read_group_color(conn, trimmed)?.ok_or_else(|| "读取分组颜色失败".to_string())
}

/// Re-auto-assign a group's color (first unused palette color), clearing the
/// manual override flag.
pub fn reset_group_color(conn: &Connection, name: &str) -> Result<GroupColor, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("分组名称不能为空".to_string());
    }
    let current = read_group_color(conn, trimmed)?.ok_or_else(|| "分组颜色不存在".to_string())?;
    let color = first_unused_palette_color_excluding(conn, &current.color)?;
    conn.execute(
        "UPDATE group_colors SET color = ?1, is_manual = 0 WHERE name = ?2",
        params![color, trimmed],
    )
    .map_err(|error| format!("重置分组颜色失败：{error}"))?;
    read_group_color(conn, trimmed)?.ok_or_else(|| "读取分组颜色失败".to_string())
}

/// First palette color not used by any *other* mapping, so the group keeps its
/// current color when it is already the only user of it.
fn first_unused_palette_color_excluding(
    conn: &Connection,
    current_color: &str,
) -> Result<&'static str, String> {
    let mut stmt = conn
        .prepare("SELECT color FROM group_colors")
        .map_err(|error| format!("查询分组颜色失败：{error}"))?;
    let used = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("遍历分组颜色失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取分组颜色失败：{error}"))?;
    GROUP_COLOR_PALETTE
        .iter()
        .copied()
        .find(|color| {
            *color == current_color || !used.iter().any(|used_color| used_color.as_str() == *color)
        })
        .ok_or_else(|| "分组颜色已用尽，请手动选择".to_string())
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

/// Whether `task_id` has any children, regardless of their status.
pub fn has_children(conn: &Connection, task_id: i64) -> Result<bool, String> {
    let child_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE parent_id = ?1",
            params![task_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("统计子任务失败：{error}"))?;
    Ok(child_count > 0)
}

/// Derive `task_id`'s priority from its open direct children when it has any
/// children: the highest priority (smallest number) wins, and a node whose
/// children are all closed degrades back to `DEFAULT_PRIORITY`. Tasks without
/// children keep their manually set priority. Returns the new priority when
/// the stored value was updated, `None` otherwise.
fn derive_priority_from_children(conn: &Connection, task_id: i64) -> Result<Option<i64>, String> {
    if !has_children(conn, task_id)? {
        return Ok(None);
    }
    let highest_open_priority: Option<i64> = conn
        .query_row(
            "SELECT MIN(priority) FROM tasks WHERE parent_id = ?1 AND status = ?2",
            params![task_id, TASK_STATUS_IN_PROGRESS],
            |row| row.get(0),
        )
        .map_err(|error| format!("统计子任务优先级失败：{error}"))?;
    let new_priority = highest_open_priority.unwrap_or(DEFAULT_PRIORITY);
    let current_priority: i64 = conn
        .query_row(
            "SELECT priority FROM tasks WHERE id = ?1",
            params![task_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("读取任务优先级失败：{error}"))?;
    if current_priority == new_priority {
        return Ok(None);
    }
    conn.execute(
        "UPDATE tasks SET priority = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_priority, iso_now(), task_id],
    )
    .map_err(|error| format!("联动更新父任务优先级失败：{error}"))?;
    Ok(Some(new_priority))
}

/// Recompute the priority of `task_id` and all its ancestors from their open
/// direct children, walking bottom-up so changes propagate through the whole
/// ancestor chain. Called after any operation that alters the set of open
/// children in a subtree: priority edits, close/reopen, move, delete and
/// creating a subtask. Each changed ancestor is audited as an update event
/// carrying `autoPriority: true`.
pub fn recompute_ancestor_priorities(
    conn: &Connection,
    week_id: &str,
    task_id: i64,
) -> Result<(), String> {
    let mut current = Some(task_id);
    let mut guard = 0;
    while let Some(id) = current {
        if let Some(new_priority) = derive_priority_from_children(conn, id)? {
            let payload = serde_json::json!({ "autoPriority": true, "priority": new_priority });
            record_event(
                conn,
                week_id,
                Some(id),
                EVENT_TYPE_UPDATE,
                Some(&payload.to_string()),
            )?;
        }
        current = conn
            .query_row(
                "SELECT parent_id FROM tasks WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|error| format!("读取任务父级失败：{error}"))?;
        guard += 1;
        if guard > 64 {
            break;
        }
    }
    Ok(())
}

/// One-time data backfill used by the schema v4 migration: derive every
/// parent's priority from its open children, deepest nodes first, so existing
/// data already reflects the linked-priority rule.
pub fn backfill_derived_priorities(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id, parent_id FROM tasks")
        .map_err(|error| format!("查询任务失败：{error}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?))
        })
        .map_err(|error| format!("遍历任务失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取任务失败：{error}"))?;

    let parent_of: std::collections::HashMap<i64, Option<i64>> =
        rows.iter().map(|(id, parent)| (*id, *parent)).collect();
    let mut depth: std::collections::HashMap<i64, usize> = std::collections::HashMap::new();
    let mut task_ids: Vec<i64> = rows.iter().map(|(id, _)| *id).collect();
    task_ids.sort();
    for id in &task_ids {
        let mut level = 0;
        let mut cursor = parent_of.get(id).copied().flatten();
        while let Some(parent) = cursor {
            level += 1;
            cursor = parent_of.get(&parent).copied().flatten();
            if level > 64 {
                break;
            }
        }
        depth.insert(*id, level);
    }
    // Deepest nodes first, so a parent always derives from already-finalized children.
    task_ids.sort_by_key(|id| std::cmp::Reverse(depth.get(id).copied().unwrap_or(0)));
    for id in task_ids {
        derive_priority_from_children(conn, id)?;
    }
    Ok(())
}

pub struct CreateTaskInput {
    pub title: String,
    pub description: String,
    pub parent_id: Option<i64>,
    pub priority: i64,
    pub execution_mode: String,
    pub owner_name: Option<String>,
    pub assigner_name: Option<String>,
    pub tag_names: Vec<String>,
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
        let parent =
            get_task(conn, week_id, parent_id)?.ok_or_else(|| "父任务不存在".to_string())?;
        if parent.status == TASK_STATUS_CLOSED {
            // 挂到已关闭节点 = 该节点重新激活：自动重开自身与祖先链，
            // 保持「已关闭节点下没有开放子任务」的不变量不被破坏。
            reopen_closed_chain(conn, week_id, parent_id)?;
        }
    }

    let execution_mode = if input.execution_mode == EXECUTION_MODE_FOLLOW_UP {
        EXECUTION_MODE_FOLLOW_UP
    } else {
        EXECUTION_MODE_SELF
    };
    let owner_id = match &input.owner_name {
        Some(name) if !name.trim().is_empty() => Some(ensure_owner(conn, name)?),
        _ => None,
    };
    if execution_mode == EXECUTION_MODE_FOLLOW_UP && owner_id.is_none() {
        return Err("跟进任务需要指定负责人".to_string());
    }
    let assigner_id = match &input.assigner_name {
        Some(name) if !name.trim().is_empty() => Some(ensure_assigner(conn, name)?),
        _ => None,
    };

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
                            origin_week_id, carried_from_task_id, created_at, updated_at,
                            execution_mode, owner_id, assigner_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?8, ?9, ?10, ?11)",
        params![
            week_id,
            input.parent_id,
            title,
            input.description,
            TASK_STATUS_IN_PROGRESS,
            priority,
            next_index,
            now,
            execution_mode,
            owner_id,
            assigner_id
        ],
    )
    .map_err(|error| format!("写入任务失败：{error}"))?;

    let task_id = conn.last_insert_rowid();
    set_task_tags(conn, task_id, &input.tag_names)?;
    record_event(conn, week_id, Some(task_id), EVENT_TYPE_CREATE, None)?;
    if input.parent_id.is_some() {
        recompute_ancestor_priorities(conn, week_id, task_id)?;
    }
    get_task(conn, week_id, task_id)?.ok_or_else(|| "创建任务后读取失败".to_string())
}

pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i64>,
    pub execution_mode: Option<String>,
    /// `Some("")` clears the owner; `None` keeps the current owner.
    pub owner_name: Option<String>,
    /// `Some("")` clears the assigner; `None` keeps the current assigner.
    pub assigner_name: Option<String>,
    /// `Some(names)` replaces all tags; `None` leaves tags unchanged.
    pub tag_names: Option<Vec<String>>,
}

/// Update task fields. Returns the updated task.
pub fn update_task(
    conn: &Connection,
    week_id: &str,
    task_id: i64,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    let current = get_task(conn, week_id, task_id)?.ok_or_else(|| "任务不存在".to_string())?;

    let title = input
        .title
        .map(|value| value.trim().to_string())
        .unwrap_or_else(|| current.title.clone());
    if title.is_empty() {
        return Err("任务标题不能为空".to_string());
    }
    let description = input.description.unwrap_or(current.description.clone());
    let priority = input.priority.unwrap_or(current.priority).clamp(0, 3);

    // 非叶子任务不展示也不允许编辑执行方式 / 负责人：忽略传入值，保留原有数据，
    // 任务变回叶子后恢复可编辑。
    let is_leaf = !has_children(conn, task_id)?;
    let execution_mode = if is_leaf {
        match input.execution_mode.as_deref() {
            Some(EXECUTION_MODE_FOLLOW_UP) => EXECUTION_MODE_FOLLOW_UP.to_string(),
            Some(_) => EXECUTION_MODE_SELF.to_string(),
            None => current.execution_mode.clone(),
        }
    } else {
        current.execution_mode.clone()
    };
    let owner_id = if is_leaf {
        match &input.owner_name {
            Some(name) if name.trim().is_empty() => None,
            Some(name) => Some(ensure_owner(conn, name)?),
            None => current.owner_id,
        }
    } else {
        current.owner_id
    };
    if execution_mode == EXECUTION_MODE_FOLLOW_UP && owner_id.is_none() {
        return Err("跟进任务需要指定负责人".to_string());
    }
    // 分派人是独立可选字段：不参与执行方式校验，仅叶子任务可编辑。
    let assigner_id = if is_leaf {
        match &input.assigner_name {
            Some(name) if name.trim().is_empty() => None,
            Some(name) => Some(ensure_assigner(conn, name)?),
            None => current.assigner_id,
        }
    } else {
        current.assigner_id
    };

    conn.execute(
        "UPDATE tasks SET title = ?1, description = ?2, priority = ?3, updated_at = ?4,
                          execution_mode = ?5, owner_id = ?6, assigner_id = ?7
         WHERE id = ?8 AND week_id = ?9",
        params![
            title,
            description,
            priority,
            iso_now(),
            execution_mode,
            owner_id,
            assigner_id,
            task_id,
            week_id
        ],
    )
    .map_err(|error| format!("更新任务失败：{error}"))?;

    if let Some(tag_names) = &input.tag_names {
        set_task_tags(conn, task_id, tag_names)?;
    }
    record_event(conn, week_id, Some(task_id), EVENT_TYPE_UPDATE, None)?;
    recompute_ancestor_priorities(conn, week_id, task_id)?;
    get_task(conn, week_id, task_id)?.ok_or_else(|| "更新任务后读取失败".to_string())
}

/// Replace a task's tags with the given names, auto-creating missing tags.
fn set_task_tags(conn: &Connection, task_id: i64, tag_names: &[String]) -> Result<(), String> {
    conn.execute("DELETE FROM task_tags WHERE task_id = ?1", params![task_id])
        .map_err(|error| format!("清理任务标签失败：{error}"))?;
    for raw_name in tag_names {
        let name = raw_name.trim();
        if name.is_empty() {
            continue;
        }
        let tag_id = ensure_tag(conn, name)?;
        conn.execute(
            "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
            params![task_id, tag_id],
        )
        .map_err(|error| format!("写入任务标签失败：{error}"))?;
    }
    Ok(())
}

/// Copy a task's tag associations from `source_id` to `target_id`.
fn copy_task_tags(conn: &Connection, source_id: i64, target_id: i64) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT tag_id FROM task_tags WHERE task_id = ?1")
        .map_err(|error| format!("查询源任务标签失败：{error}"))?;
    let tag_ids = stmt
        .query_map(params![source_id], |row| row.get::<_, i64>(0))
        .map_err(|error| format!("遍历源任务标签失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取源任务标签失败：{error}"))?;
    for tag_id in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
            params![target_id, tag_id],
        )
        .map_err(|error| format!("写入结转任务标签失败：{error}"))?;
    }
    Ok(())
}

/// Close a task and, when all siblings are closed, its ancestors (bottom-up).
pub fn close_task(conn: &mut Connection, week_id: &str, task_id: i64) -> Result<Task, String> {
    let mut current = get_task(conn, week_id, task_id)?.ok_or_else(|| "任务不存在".to_string())?;
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

    // Re-derive ancestor priorities now that the open-child set changed.
    recompute_ancestor_priorities(&tx, week_id, task_id)?;

    tx.commit()
        .map_err(|error| format!("提交关闭事务失败：{error}"))?;
    current.status = TASK_STATUS_CLOSED.to_string();
    current.closed_at = Some(now);
    Ok(current)
}

/// Reopen `task_id` and any closed ancestors up the chain, recording a reopen
/// event for each. Used when a task is attached beneath a closed node: once a
/// completed node gains a new open child it must become active again so the
/// tree stays consistent (a closed node never holds open descendants).
fn reopen_closed_chain(conn: &Connection, week_id: &str, task_id: i64) -> Result<(), String> {
    let now = iso_now();
    let mut cursor = Some(task_id);
    let mut guard = 0;
    while let Some(current) = cursor {
        let status: String = conn
            .query_row(
                "SELECT status FROM tasks WHERE id = ?1 AND week_id = ?2",
                params![current, week_id],
                |row| row.get(0),
            )
            .map_err(|error| format!("读取任务状态失败：{error}"))?;
        if status == TASK_STATUS_CLOSED {
            conn.execute(
                "UPDATE tasks SET status = ?1, closed_at = NULL, updated_at = ?2 WHERE id = ?3",
                params![TASK_STATUS_IN_PROGRESS, now, current],
            )
            .map_err(|error| format!("重新打开任务失败：{error}"))?;
            record_event(conn, week_id, Some(current), EVENT_TYPE_REOPEN, None)?;
        }
        cursor = conn
            .query_row(
                "SELECT parent_id FROM tasks WHERE id = ?1 AND week_id = ?2",
                params![current, week_id],
                |row| row.get(0),
            )
            .map_err(|error| format!("读取祖先父级失败：{error}"))?;
        guard += 1;
        if guard > 64 {
            break;
        }
    }
    Ok(())
}

/// Reopen a closed task and cascade to its closed ancestors.
pub fn reopen_task(conn: &mut Connection, week_id: &str, task_id: i64) -> Result<Task, String> {
    let current = get_task(conn, week_id, task_id)?.ok_or_else(|| "任务不存在".to_string())?;
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

    // Reopen closed ancestors so the reopened task keeps its context. The task
    // itself is already open, so the chain walk starts from its own id.
    reopen_closed_chain(&tx, week_id, task_id)?;

    // Re-derive ancestor priorities now that the reopened task is active again.
    recompute_ancestor_priorities(&tx, week_id, task_id)?;

    tx.commit()
        .map_err(|error| format!("提交重新打开事务失败：{error}"))?;
    get_task(conn, week_id, task_id)?.ok_or_else(|| "重新打开任务后读取失败".to_string())
}

/// Re-parent and re-order a task within the same week.
pub fn move_task(
    conn: &Connection,
    week_id: &str,
    task_id: i64,
    new_parent_id: Option<i64>,
    new_index: f64,
) -> Result<(), String> {
    let old_parent_id = get_task(conn, week_id, task_id)?
        .ok_or_else(|| "任务不存在".to_string())?
        .parent_id;

    if let Some(parent_id) = new_parent_id {
        if parent_id == task_id {
            return Err("不能将任务移动到自身下面".to_string());
        }
        let parent =
            get_task(conn, week_id, parent_id)?.ok_or_else(|| "父任务不存在".to_string())?;
        if parent.status == TASK_STATUS_CLOSED {
            // 挂到已关闭节点 = 该节点重新激活：自动重开自身与祖先链，
            // 保持「已关闭节点下没有开放子任务」的不变量不被破坏。
            reopen_closed_chain(conn, week_id, parent_id)?;
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
    // Both the old and the new ancestor chains may need their priority re-derived.
    if let Some(old_parent) = old_parent_id {
        recompute_ancestor_priorities(conn, week_id, old_parent)?;
    }
    if new_parent_id.is_some() {
        recompute_ancestor_priorities(conn, week_id, task_id)?;
    }
    Ok(())
}

/// Delete a task and its whole subtree. Children, tags and events cascade
/// through the `ON DELETE CASCADE` foreign keys.
pub fn delete_task(conn: &mut Connection, week_id: &str, task_id: i64) -> Result<usize, String> {
    let task = get_task(conn, week_id, task_id)?.ok_or_else(|| "任务不存在".to_string())?;
    let parent_id = task.parent_id;

    let tx = conn
        .transaction()
        .map_err(|error| format!("开启删除事务失败：{error}"))?;
    // The task row is removed right away, so record the event with a NULL
    // task_id and keep the deleted task info in the payload.
    let payload = serde_json::json!({ "taskId": task_id, "title": task.title });
    record_event(
        &tx,
        week_id,
        None,
        EVENT_TYPE_DELETE,
        Some(&payload.to_string()),
    )?;
    let affected = tx
        .execute(
            "DELETE FROM tasks WHERE id = ?1 AND week_id = ?2",
            params![task_id, week_id],
        )
        .map_err(|error| format!("删除任务失败：{error}"))?;
    tx.commit()
        .map_err(|error| format!("提交删除事务失败：{error}"))?;
    if let Some(parent) = parent_id {
        recompute_ancestor_priorities(conn, week_id, parent)?;
    }
    Ok(affected)
}

/// Ensure the current week exists, creating it (with carry-over) when missing.
/// Returns the current week and whether it was newly created.
pub fn ensure_current_week(conn: &mut Connection) -> Result<(Week, bool), String> {
    let today = Local::now().date_naive();
    let monday = monday_of(today);
    let week_id = week_range_key(monday);

    // Fast path: the current week already exists.
    if let Some(week) = get_week(conn, &week_id)? {
        return Ok((week, false));
    }

    // Carry from the latest stored week that starts on or before today.
    let carried_from = latest_week_starting_on_or_before(conn, today)?;
    let new_week = week_from_monday(monday, carried_from.as_ref().map(|w| w.id.clone()));

    // Use an IMMEDIATE transaction so concurrent callers (e.g. React
    // StrictMode double effects or a sync-triggered re-initialize) serialize
    // on the write lock instead of both passing the existence check and
    // racing on the INSERT.
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|error| format!("开启建周事务失败：{error}"))?;
    // Re-check inside the transaction: a concurrent connection may have
    // created this week while we waited for the write lock.
    if let Some(week) = get_week(&tx, &week_id)? {
        return Ok((week, false));
    }
    // Insert the target week first: carried tasks reference `week_id`, so the
    // week row must exist before copying tasks over (foreign key constraint).
    insert_week(&tx, &new_week)?;
    if let Some(source) = &carried_from {
        carry_over_week(&tx, &new_week.id, &source.id)?;
    }
    tx.commit()
        .map_err(|error| format!("提交建周事务失败：{error}"))?;

    Ok((new_week, true))
}

/// Clone unfinished tasks of `source_week_id` into `target_week_id`.
/// Only open tasks are copied; closed tasks always stay in their source week.
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
    // Roots are top-level tasks.
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
/// Closed tasks are never copied; their open descendants are promoted to the
/// target parent's level so no unfinished work is silently dropped.
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

    // Closed tasks do not carry over. Recurse into their children so any open
    // descendants still come over, promoted to the target parent's level.
    if task.status == TASK_STATUS_CLOSED {
        for child in children {
            carry_over_branch(
                conn,
                target_week_id,
                source_week_id,
                source_tasks,
                child.id,
                target_parent_id,
                id_map,
            )?;
        }
        return Ok(());
    }

    // Copy this open task.
    let now = iso_now();
    conn.execute(
        "INSERT INTO tasks (week_id, parent_id, title, description, status, priority, sort_index,
                            origin_week_id, carried_from_task_id, created_at, updated_at, closed_at,
                            execution_mode, owner_id, assigner_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, ?12, ?13, ?14)",
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
            task.closed_at,
            task.execution_mode,
            task.owner_id,
            task.assigner_id
        ],
    )
    .map_err(|error| format!("复制任务失败：{error}"))?;
    let new_id = conn.last_insert_rowid();
    copy_task_tags(conn, source_id, new_id)?;
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
    // The whole subtree is copied now: re-derive this node's priority from its
    // copied open children (ancestors re-derive when their own recursion ends).
    derive_priority_from_children(conn, new_id)?;
    Ok(())
}

/// Create a week manually for a Monday start date. Duplicates are rejected.
pub fn create_week_for_monday(conn: &Connection, monday: NaiveDate) -> Result<Week, String> {
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

    fn create_plain_task(
        conn: &Connection,
        week_id: &str,
        title: &str,
        parent_id: Option<i64>,
    ) -> Task {
        create_task(
            conn,
            week_id,
            CreateTaskInput {
                title: title.into(),
                description: String::new(),
                parent_id,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap()
    }

    fn create_task_with_priority(
        conn: &Connection,
        week_id: &str,
        title: &str,
        parent_id: Option<i64>,
        priority: i64,
    ) -> Task {
        create_task(
            conn,
            week_id,
            CreateTaskInput {
                title: title.into(),
                description: String::new(),
                parent_id,
                priority,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap()
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
        let root = create_plain_task(&conn, "20260727-20260802", "项目A", None);
        let child = create_plain_task(&conn, "20260727-20260802", "子任务1", Some(root.id));
        // Completed root with no open descendants.
        let done_root = create_plain_task(&conn, "20260727-20260802", "已完成项目", None);
        close_task(&mut conn, "20260727-20260802", done_root.id).unwrap();

        let target = "20260803-20260809";
        carry_over_week(&conn, target, "20260727-20260802").unwrap();

        let target_tasks = list_tasks(&conn, target).unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["项目A", "子任务1"]);
        assert!(target_tasks
            .iter()
            .all(|t| t.carried_from_task_id.is_some()));
        let copied_child = target_tasks.iter().find(|t| t.title == "子任务1").unwrap();
        let copied_root = target_tasks.iter().find(|t| t.title == "项目A").unwrap();
        assert_eq!(copied_child.parent_id, Some(copied_root.id));
        assert_eq!(
            copied_root.origin_week_id.as_deref(),
            Some("20260727-20260802")
        );
        assert_eq!(child.origin_week_id, None);
        assert_eq!(copied_child.status, TASK_STATUS_IN_PROGRESS);
    }

    #[test]
    fn closed_nodes_are_not_carried_over() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260727-20260802", "项目B", None);
        let done_child = create_plain_task(&conn, "20260727-20260802", "已完成步骤", Some(root.id));
        create_plain_task(&conn, "20260727-20260802", "进行中的步骤", Some(root.id));
        close_task(&mut conn, "20260727-20260802", done_child.id).unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let target_tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        // Closed tasks inside an open branch stay in the source week.
        assert_eq!(titles, vec!["项目B", "进行中的步骤"]);
        assert!(target_tasks
            .iter()
            .all(|t| t.status == TASK_STATUS_IN_PROGRESS));
    }

    #[test]
    fn closed_subtree_is_not_carried_over() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        // An open root with a sibling branch that is fully closed.
        let open_root = create_plain_task(&conn, "20260727-20260802", "开放项目", None);
        create_plain_task(&conn, "20260727-20260802", "开放子任务", Some(open_root.id));
        let closed_root = create_plain_task(&conn, "20260727-20260802", "已结束项目", None);
        let closed_child = create_plain_task(
            &conn,
            "20260727-20260802",
            "已结束子任务",
            Some(closed_root.id),
        );
        close_task(&mut conn, "20260727-20260802", closed_child.id).unwrap();
        close_task(&mut conn, "20260727-20260802", closed_root.id).unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let target_tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["开放项目", "开放子任务"]);
    }

    #[test]
    fn open_descendant_of_closed_task_is_promoted() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        // Guard against invariant violations: an open task nested under a closed
        // task must still be carried over (promoted to the target parent level).
        let closed_root = create_plain_task(&conn, "20260727-20260802", "关闭根", None);
        let closed_mid = create_plain_task(
            &conn,
            "20260727-20260802",
            "关闭中间层",
            Some(closed_root.id),
        );
        create_plain_task(&conn, "20260727-20260802", "开放叶", Some(closed_mid.id));
        close_task(&mut conn, "20260727-20260802", closed_mid.id).unwrap();
        close_task(&mut conn, "20260727-20260802", closed_root.id).unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let target_tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["开放叶"]);
        assert_eq!(target_tasks[0].parent_id, None);
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
    fn ensure_current_week_carries_over_from_previous_week() {
        let mut conn = db::open_in_memory();
        // A previous week with unfinished tasks (ends before the current week).
        seed_week(&conn, "20260803-20260809");
        create_plain_task(&conn, "20260803-20260809", "项目A", None);

        let (week, created) = ensure_current_week(&mut conn).unwrap();
        assert!(created);
        assert_eq!(week.id, current_week_id());
        assert_ne!(week.id, "20260803-20260809");

        // Open tasks from the previous week must have been carried over.
        let target_tasks = list_tasks(&conn, &week.id).unwrap();
        let titles: Vec<&str> = target_tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["项目A"]);
    }

    #[test]
    fn ensure_current_week_is_safe_under_concurrent_calls() {
        use std::sync::{Arc, Barrier};

        let dir = std::env::temp_dir().join(format!(
            "weeklytodo-concurrency-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        // Seed a previous week with an unfinished task so carry-over actually runs.
        {
            let conn = db::open_database(&dir).unwrap();
            conn.execute(
                "INSERT INTO weeks (id, start_date, end_date, created_at, carried_from_week_id)
                 VALUES ('20260803-20260809', '20260803', '20260809', '2026-08-03T08:00:00.000', NULL)",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO tasks (week_id, title, status, priority, sort_index, created_at, updated_at)
                 VALUES ('20260803-20260809', '并发任务', 'in_progress', 2, 0,
                         '2026-08-03T08:00:00.000', '2026-08-03T08:00:00.000')",
                [],
            )
            .unwrap();
        }

        // Two connections racing to create the current week, like React
        // StrictMode double effects in dev mode.
        let barrier = Arc::new(Barrier::new(2));
        let dir_a = dir.clone();
        let barrier_a = barrier.clone();
        let handle_a = std::thread::spawn(move || {
            barrier_a.wait();
            let mut conn = db::open_database(&dir_a).unwrap();
            ensure_current_week(&mut conn).unwrap()
        });
        let dir_b = dir.clone();
        let barrier_b = barrier.clone();
        let handle_b = std::thread::spawn(move || {
            barrier_b.wait();
            let mut conn = db::open_database(&dir_b).unwrap();
            ensure_current_week(&mut conn).unwrap()
        });

        let result_a = handle_a.join().unwrap();
        let result_b = handle_b.join().unwrap();
        assert_eq!(result_a.0.id, result_b.0.id);
        assert_eq!(result_a.0.id, current_week_id());
        // Exactly one call created the week; the other reused it.
        assert_ne!(result_a.1, result_b.1);

        // Carry-over ran exactly once.
        let conn = db::open_database(&dir).unwrap();
        let tasks = list_tasks(&conn, &result_a.0.id).unwrap();
        let titles: Vec<&str> = tasks.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, vec!["并发任务"]);
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn manual_duplicate_week_rejected() {
        let conn = db::open_in_memory();
        let monday = NaiveDate::from_ymd_opt(2026, 8, 17).unwrap();
        create_week_for_monday(&conn, monday).unwrap();
        assert!(create_week_for_monday(&conn, monday).is_err());
    }

    #[test]
    fn follow_up_task_requires_owner() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let missing_owner = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "跟进任务".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_FOLLOW_UP.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        );
        assert!(missing_owner.is_err());

        let with_owner = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "跟进任务".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_FOLLOW_UP.into(),
                owner_name: Some("小王".into()),
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        assert_eq!(with_owner.execution_mode, EXECUTION_MODE_FOLLOW_UP);
        assert_eq!(with_owner.owner_name.as_deref(), Some("小王"));
    }

    #[test]
    fn owner_and_tags_are_saved_and_auto_created() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let task = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "写周报".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: Some("小明".into()),
                assigner_name: None,
                tag_names: vec!["总结".into(), "高优".into()],
            },
        )
        .unwrap();

        assert_eq!(task.owner_name.as_deref(), Some("小明"));
        assert_eq!(task.tags, vec!["总结".to_string(), "高优".to_string()]);

        // Reusing the same owner/tag names must not duplicate rows.
        ensure_owner(&conn, "小明").unwrap();
        ensure_tag(&conn, "总结").unwrap();
        let owners = list_owners(&conn).unwrap();
        let tags = list_tags(&conn).unwrap();
        assert_eq!(owners.len(), 1);
        assert_eq!(tags.len(), 2);
    }

    #[test]
    fn update_task_replaces_tags_and_clears_owner() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        let task = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "写周报".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: Some("小明".into()),
                assigner_name: None,
                tag_names: vec!["总结".into()],
            },
        )
        .unwrap();

        let updated = update_task(
            &conn,
            "20260803-20260809",
            task.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: Some(EXECUTION_MODE_FOLLOW_UP.into()),
                owner_name: Some("小红".into()),
                assigner_name: None,
                tag_names: Some(vec!["总结".into(), "汇报".into()]),
            },
        )
        .unwrap();
        assert_eq!(updated.execution_mode, EXECUTION_MODE_FOLLOW_UP);
        assert_eq!(updated.owner_name.as_deref(), Some("小红"));
        let mut updated_tags = updated.tags.clone();
        let mut expected_tags = vec!["汇报".to_string(), "总结".to_string()];
        updated_tags.sort();
        expected_tags.sort();
        assert_eq!(updated_tags, expected_tags);

        // Clearing the owner is only allowed for self-executed tasks.
        let cleared = update_task(
            &conn,
            "20260803-20260809",
            task.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: Some(EXECUTION_MODE_SELF.into()),
                owner_name: Some(String::new()),
                assigner_name: None,
                tag_names: Some(Vec::new()),
            },
        )
        .unwrap();
        assert_eq!(cleared.owner_name, None);
        assert!(cleared.tags.is_empty());
    }

    #[test]
    fn group_colors_auto_assign_first_unused_palette_color() {
        let conn = db::open_in_memory();

        let first = ensure_group_color(&conn, "产品发布冲刺").unwrap();
        assert_eq!(first.color, GROUP_COLOR_PALETTE[0]);
        assert!(!first.is_manual);

        let second = ensure_group_color(&conn, "团队管理").unwrap();
        assert_eq!(second.color, GROUP_COLOR_PALETTE[1]);

        // 已存在的分组保持原色不变。
        let again = ensure_group_color(&conn, "产品发布冲刺").unwrap();
        assert_eq!(again.color, first.color);

        // 空名称拒绝。
        assert!(ensure_group_color(&conn, "   ").is_err());
    }

    #[test]
    fn group_colors_manual_override_and_reset() {
        let conn = db::open_in_memory();
        ensure_group_color(&conn, "产品发布冲刺").unwrap();
        ensure_group_color(&conn, "团队管理").unwrap();

        // 手动换色后标记为 manual。
        let manual = set_group_color(&conn, "产品发布冲刺", "#C0557A").unwrap();
        assert_eq!(manual.color, "#C0557A");
        assert!(manual.is_manual);

        // 恢复自动：取色板中第一个未被其他分组使用的颜色。
        let reset = reset_group_color(&conn, "产品发布冲刺").unwrap();
        assert_eq!(reset.color, GROUP_COLOR_PALETTE[0]);
        assert!(!reset.is_manual);

        // 列表包含全部映射。
        let list = list_group_colors(&conn).unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn carry_over_copies_owner_and_tags() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "项目A".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_FOLLOW_UP.into(),
                owner_name: Some("小王".into()),
                assigner_name: Some("李四".into()),
                tag_names: vec!["开发".into()],
            },
        )
        .unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let target_tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        assert_eq!(target_tasks.len(), 1);
        assert_eq!(target_tasks[0].execution_mode, EXECUTION_MODE_FOLLOW_UP);
        assert_eq!(target_tasks[0].owner_name.as_deref(), Some("小王"));
        assert_eq!(target_tasks[0].assigner_name.as_deref(), Some("李四"));
        assert_eq!(target_tasks[0].tags, vec!["开发".to_string()]);
    }

    #[test]
    fn assigner_is_optional_and_auto_created() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        // 分派人不填也允许创建，且不依赖执行方式。
        let no_assigner = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "自己执行任务".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        assert_eq!(no_assigner.assigner_id, None);
        assert_eq!(no_assigner.assigner_name, None);

        let assigned = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "分派给张三".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: Some("张三".into()),
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        assert_eq!(assigned.assigner_name.as_deref(), Some("张三"));

        // 重复使用同一分派人不会产生重复行。
        let assigners = list_assigners(&conn).unwrap();
        assert_eq!(assigners.len(), 1);
        assert_eq!(assigners[0].name, "张三");
    }

    #[test]
    fn update_task_sets_and_clears_assigner() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        let task = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "写周报".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: Some("张三".into()),
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        assert_eq!(task.assigner_name.as_deref(), Some("张三"));

        // 换人。
        let switched = update_task(
            &conn,
            "20260803-20260809",
            task.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: None,
                owner_name: None,
                assigner_name: Some("李四".into()),
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(switched.assigner_name.as_deref(), Some("李四"));

        // 清空（Some("") 置空）。
        let cleared = update_task(
            &conn,
            "20260803-20260809",
            task.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: None,
                owner_name: None,
                assigner_name: Some(String::new()),
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(cleared.assigner_name, None);
        assert_eq!(cleared.assigner_id, None);
    }

    #[test]
    fn assigner_is_ignored_for_non_leaf_tasks() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        let parent = create_plain_task(&conn, "20260803-20260809", "项目A", None);
        create_plain_task(&conn, "20260803-20260809", "子任务", Some(parent.id));

        // 非叶子任务更新分派人会被静默忽略，保留原值。
        let updated = update_task(
            &conn,
            "20260803-20260809",
            parent.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: None,
                owner_name: None,
                assigner_name: Some("张三".into()),
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(updated.assigner_id, None);
        assert_eq!(updated.assigner_name, None);
    }

    #[test]
    fn delete_assigner_clears_task_references() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "分派任务".into(),
                description: String::new(),
                parent_id: None,
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: Some("张三".into()),
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        let assigners = list_assigners(&conn).unwrap();
        assert_eq!(assigners.len(), 1);
        delete_assigner(&conn, assigners[0].id).unwrap();

        let tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        assert_eq!(tasks[0].assigner_id, None);
        assert_eq!(tasks[0].assigner_name, None);
        assert!(list_assigners(&conn).unwrap().is_empty());
    }

    #[test]
    fn delete_task_removes_whole_subtree() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目A", None);
        let child = create_plain_task(&conn, "20260803-20260809", "子任务1", Some(root.id));
        let _grandchild = create_plain_task(&conn, "20260803-20260809", "孙任务", Some(child.id));
        let sibling = create_plain_task(&conn, "20260803-20260809", "任务B", None);
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "带标签的子任务".into(),
                description: String::new(),
                parent_id: Some(root.id),
                priority: DEFAULT_PRIORITY,
                execution_mode: EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: vec!["开发".into()],
            },
        )
        .unwrap();

        let affected = delete_task(&mut conn, "20260803-20260809", root.id).unwrap();
        assert_eq!(affected, 1);

        let remaining = list_tasks(&conn, "20260803-20260809").unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, sibling.id);
    }

    #[test]
    fn delete_task_rejects_missing_task() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        assert!(delete_task(&mut conn, "20260803-20260809", 999).is_err());
    }

    #[test]
    fn move_task_reparents_and_reorders() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let first = create_plain_task(&conn, "20260803-20260809", "第一个", None);
        let second = create_plain_task(&conn, "20260803-20260809", "第二个", None);
        let third = create_plain_task(&conn, "20260803-20260809", "第三个", None);

        // Move "第三个" before "第一个".
        move_task(&conn, "20260803-20260809", third.id, None, -1.0).unwrap();
        // Make "第二个" a child of "第一个".
        move_task(&conn, "20260803-20260809", second.id, Some(first.id), 0.0).unwrap();

        let tasks = list_tasks(&conn, "20260803-20260809").unwrap();
        let third_now = tasks.iter().find(|task| task.id == third.id).unwrap();
        let second_now = tasks.iter().find(|task| task.id == second.id).unwrap();
        assert_eq!(third_now.parent_id, None);
        assert_eq!(second_now.parent_id, Some(first.id));
    }

    #[test]
    fn move_task_rejects_cycle() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "根任务", None);
        let child = create_plain_task(&conn, "20260803-20260809", "子任务", Some(root.id));

        // Moving a task under itself is rejected.
        assert!(move_task(&conn, "20260803-20260809", root.id, Some(root.id), 0.0).is_err());
        // Moving a parent under its own child would create a cycle.
        assert!(move_task(&conn, "20260803-20260809", root.id, Some(child.id), 0.0).is_err());
    }

    #[test]
    fn create_child_under_closed_parent_reopens_chain() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let done_root = create_plain_task(&conn, "20260803-20260809", "已完成项目", None);
        close_task(&mut conn, "20260803-20260809", done_root.id).unwrap();
        let closed = get_task(&conn, "20260803-20260809", done_root.id)
            .unwrap()
            .unwrap();
        assert_eq!(closed.status, TASK_STATUS_CLOSED);

        // Attaching a new open child reopens the closed parent automatically.
        let child = create_plain_task(&conn, "20260803-20260809", "新挂的事项", Some(done_root.id));
        assert_eq!(child.status, TASK_STATUS_IN_PROGRESS);
        let reopened = get_task(&conn, "20260803-20260809", done_root.id)
            .unwrap()
            .unwrap();
        assert_eq!(reopened.status, TASK_STATUS_IN_PROGRESS);
        assert!(reopened.closed_at.is_none());
    }

    #[test]
    fn create_child_under_closed_parent_reopens_all_ancestors() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "根项目", None);
        let middle = create_plain_task(&conn, "20260803-20260809", "中间分组", Some(root.id));
        let leaf = create_plain_task(&conn, "20260803-20260809", "已完成的叶子", Some(middle.id));

        // Closing the leaf cascades: root and middle have no open children left.
        close_task(&mut conn, "20260803-20260809", leaf.id).unwrap();
        for task_id in [root.id, middle.id, leaf.id] {
            let task = get_task(&conn, "20260803-20260809", task_id)
                .unwrap()
                .unwrap();
            assert_eq!(task.status, TASK_STATUS_CLOSED);
        }

        // Attaching under the closed middle group reopens middle and root,
        // while the old leaf stays closed.
        let new_child =
            create_plain_task(&conn, "20260803-20260809", "新挂的事项", Some(middle.id));
        assert_eq!(new_child.status, TASK_STATUS_IN_PROGRESS);
        for task_id in [root.id, middle.id] {
            let task = get_task(&conn, "20260803-20260809", task_id)
                .unwrap()
                .unwrap();
            assert_eq!(task.status, TASK_STATUS_IN_PROGRESS);
            assert!(task.closed_at.is_none());
        }
        let leaf_now = get_task(&conn, "20260803-20260809", leaf.id)
            .unwrap()
            .unwrap();
        assert_eq!(leaf_now.status, TASK_STATUS_CLOSED);
    }

    #[test]
    fn move_task_into_closed_parent_reopens_chain() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let completed = create_plain_task(&conn, "20260803-20260809", "已完成分组", None);
        close_task(&mut conn, "20260803-20260809", completed.id).unwrap();

        let loose = create_plain_task(&conn, "20260803-20260809", "游离任务", None);
        move_task(
            &conn,
            "20260803-20260809",
            loose.id,
            Some(completed.id),
            0.0,
        )
        .unwrap();

        let completed_now = get_task(&conn, "20260803-20260809", completed.id)
            .unwrap()
            .unwrap();
        let loose_now = get_task(&conn, "20260803-20260809", loose.id)
            .unwrap()
            .unwrap();
        assert_eq!(completed_now.status, TASK_STATUS_IN_PROGRESS);
        assert!(completed_now.closed_at.is_none());
        assert_eq!(loose_now.parent_id, Some(completed.id));
    }

    #[test]
    fn moving_a_closed_task_under_a_closed_parent_reopens_the_parent() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let target = create_plain_task(&conn, "20260803-20260809", "已完成目标", None);
        close_task(&mut conn, "20260803-20260809", target.id).unwrap();
        let done_item = create_plain_task(&conn, "20260803-20260809", "已完成的项", None);
        close_task(&mut conn, "20260803-20260809", done_item.id).unwrap();

        // 挂载即激活：即使被挂的任务本身已关闭，父节点也自动重开。
        move_task(
            &conn,
            "20260803-20260809",
            done_item.id,
            Some(target.id),
            0.0,
        )
        .unwrap();
        let target_now = get_task(&conn, "20260803-20260809", target.id)
            .unwrap()
            .unwrap();
        assert_eq!(target_now.status, TASK_STATUS_IN_PROGRESS);
        assert!(target_now.closed_at.is_none());
    }

    #[test]
    fn subtask_priority_propagates_to_all_ancestors() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let mid = create_plain_task(&conn, "20260803-20260809", "子项目", Some(root.id));
        create_task_with_priority(&conn, "20260803-20260809", "P0任务", Some(mid.id), 0);
        create_task_with_priority(&conn, "20260803-20260809", "P1任务", Some(mid.id), 1);
        create_task_with_priority(&conn, "20260803-20260809", "P2任务", Some(mid.id), 2);

        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        // 最高优先级（最小数值）层层向上传递。
        assert_eq!(mid_now.priority, 0);
        assert_eq!(root_now.priority, 0);
    }

    #[test]
    fn leaf_priority_is_never_overwritten() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let leaf =
            create_task_with_priority(&conn, "20260803-20260809", "P0叶子", Some(root.id), 0);
        create_task_with_priority(&conn, "20260803-20260809", "P1兄弟", Some(root.id), 1);

        // 兄弟节点变化不影响叶子自身的手动优先级。
        let leaf_now = get_task(&conn, "20260803-20260809", leaf.id)
            .unwrap()
            .unwrap();
        assert_eq!(leaf_now.priority, 0);
    }

    #[test]
    fn closing_highest_child_degrades_ancestors() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let mid = create_plain_task(&conn, "20260803-20260809", "子项目", Some(root.id));
        let p0 = create_task_with_priority(&conn, "20260803-20260809", "P0", Some(mid.id), 0);
        let p1 = create_task_with_priority(&conn, "20260803-20260809", "P1", Some(mid.id), 1);
        let p2 = create_task_with_priority(&conn, "20260803-20260809", "P2", Some(mid.id), 2);

        close_task(&mut conn, "20260803-20260809", p0.id).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.priority, 1);
        assert_eq!(root_now.priority, 1);

        close_task(&mut conn, "20260803-20260809", p1.id).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.priority, 2);

        // 全部子任务关闭后，父任务级联关闭并回落到默认优先级。
        close_task(&mut conn, "20260803-20260809", p2.id).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.status, TASK_STATUS_CLOSED);
        assert_eq!(root_now.status, TASK_STATUS_CLOSED);
        assert_eq!(mid_now.priority, DEFAULT_PRIORITY);
        assert_eq!(root_now.priority, DEFAULT_PRIORITY);
    }

    #[test]
    fn reopening_restores_derived_priority() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let mid = create_plain_task(&conn, "20260803-20260809", "子项目", Some(root.id));
        let p0 = create_task_with_priority(&conn, "20260803-20260809", "P0", Some(mid.id), 0);
        let p1 = create_task_with_priority(&conn, "20260803-20260809", "P1", Some(mid.id), 1);
        let p2 = create_task_with_priority(&conn, "20260803-20260809", "P2", Some(mid.id), 2);
        close_task(&mut conn, "20260803-20260809", p0.id).unwrap();
        close_task(&mut conn, "20260803-20260809", p1.id).unwrap();
        close_task(&mut conn, "20260803-20260809", p2.id).unwrap();

        reopen_task(&mut conn, "20260803-20260809", p0.id).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.status, TASK_STATUS_IN_PROGRESS);
        assert_eq!(root_now.status, TASK_STATUS_IN_PROGRESS);
        assert_eq!(mid_now.priority, 0);
        assert_eq!(root_now.priority, 0);
    }

    #[test]
    fn updating_leaf_priority_updates_ancestors() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let mid = create_plain_task(&conn, "20260803-20260809", "子项目", Some(root.id));
        let leaf = create_plain_task(&conn, "20260803-20260809", "叶子", Some(mid.id));

        update_task(
            &conn,
            "20260803-20260809",
            leaf.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: Some(0),
                execution_mode: None,
                owner_name: None,
                assigner_name: None,
                tag_names: None,
            },
        )
        .unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.priority, 0);
        assert_eq!(root_now.priority, 0);
    }

    #[test]
    fn update_task_ignores_execution_and_owner_for_non_leaf() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let child = create_plain_task(&conn, "20260803-20260809", "子任务", Some(root.id));

        // 非叶子任务尝试改成 follow_up + 负责人，应被静默忽略（保留 self / 无负责人）。
        let updated = update_task(
            &conn,
            "20260803-20260809",
            root.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: Some(EXECUTION_MODE_FOLLOW_UP.into()),
                owner_name: Some("小明".into()),
                assigner_name: None,
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(updated.execution_mode, EXECUTION_MODE_SELF);
        assert_eq!(updated.owner_name, None);

        // 叶子任务仍可正常设置执行方式与负责人。
        let child_updated = update_task(
            &conn,
            "20260803-20260809",
            child.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: Some(EXECUTION_MODE_FOLLOW_UP.into()),
                owner_name: Some("小明".into()),
                assigner_name: None,
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(child_updated.execution_mode, EXECUTION_MODE_FOLLOW_UP);
        assert_eq!(child_updated.owner_name.as_deref(), Some("小明"));

        // 把子任务移走后，原非叶子任务恢复可编辑。
        move_task(&conn, "20260803-20260809", child.id, None, 10.0).unwrap();
        let root_restored = update_task(
            &conn,
            "20260803-20260809",
            root.id,
            UpdateTaskInput {
                title: None,
                description: None,
                priority: None,
                execution_mode: Some(EXECUTION_MODE_FOLLOW_UP.into()),
                owner_name: Some("小红".into()),
                assigner_name: None,
                tag_names: None,
            },
        )
        .unwrap();
        assert_eq!(root_restored.execution_mode, EXECUTION_MODE_FOLLOW_UP);
        assert_eq!(root_restored.owner_name.as_deref(), Some("小红"));
    }

    #[test]
    fn move_task_recomputes_old_and_new_ancestors() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root_a = create_plain_task(&conn, "20260803-20260809", "项目A", None);
        let root_b = create_plain_task(&conn, "20260803-20260809", "项目B", None);
        let child_a =
            create_task_with_priority(&conn, "20260803-20260809", "A-P0", Some(root_a.id), 0);
        let child_b =
            create_task_with_priority(&conn, "20260803-20260809", "B-P2", Some(root_b.id), 2);

        // 把 B 的 P2 子任务移入 A：A 仍为 P0，B 无子任务后不再派生。
        move_task(
            &conn,
            "20260803-20260809",
            child_b.id,
            Some(root_a.id),
            10.0,
        )
        .unwrap();
        let root_a_now = get_task(&conn, "20260803-20260809", root_a.id)
            .unwrap()
            .unwrap();
        let root_b_now = get_task(&conn, "20260803-20260809", root_b.id)
            .unwrap()
            .unwrap();
        assert_eq!(root_a_now.priority, 0);
        assert_eq!(root_b_now.priority, DEFAULT_PRIORITY);

        // 把 A 的 P0 子任务移出到顶层：A 只剩 P2 子任务，降为 P2。
        move_task(&conn, "20260803-20260809", child_a.id, None, 20.0).unwrap();
        let root_a_now = get_task(&conn, "20260803-20260809", root_a.id)
            .unwrap()
            .unwrap();
        assert_eq!(root_a_now.priority, 2);
    }

    #[test]
    fn delete_subtask_recomputes_ancestors() {
        let mut conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260803-20260809", "项目", None);
        let mid = create_plain_task(&conn, "20260803-20260809", "子项目", Some(root.id));
        let p0 = create_task_with_priority(&conn, "20260803-20260809", "P0", Some(mid.id), 0);
        create_task_with_priority(&conn, "20260803-20260809", "P2", Some(mid.id), 2);

        delete_task(&mut conn, "20260803-20260809", p0.id).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid.id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root.id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.priority, 2);
        assert_eq!(root_now.priority, 2);
    }

    #[test]
    fn carry_over_derives_parent_priority_in_target_week() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260727-20260802");
        seed_week(&conn, "20260803-20260809");

        let root = create_plain_task(&conn, "20260727-20260802", "项目", None);
        let mid = create_plain_task(&conn, "20260727-20260802", "子项目", Some(root.id));
        create_task_with_priority(&conn, "20260727-20260802", "P0", Some(mid.id), 0);
        // 人为把源周父任务优先级改成错误值，验证带入时重新派生。
        conn.execute(
            "UPDATE tasks SET priority = 3 WHERE id IN (?1, ?2)",
            params![root.id, mid.id],
        )
        .unwrap();

        carry_over_week(&conn, "20260803-20260809", "20260727-20260802").unwrap();
        let copied = list_tasks(&conn, "20260803-20260809").unwrap();
        let copied_mid = copied.iter().find(|task| task.title == "子项目").unwrap();
        let copied_root = copied.iter().find(|task| task.title == "项目").unwrap();
        assert_eq!(copied_mid.priority, 0);
        assert_eq!(copied_root.priority, 0);
    }

    #[test]
    fn backfill_derives_priorities_for_existing_data() {
        let conn = db::open_in_memory();
        seed_week(&conn, "20260803-20260809");
        // 直接插入带陈旧优先级的父子任务，绕过 create_task 的联动。
        conn.execute(
            "INSERT INTO tasks (week_id, parent_id, title, description, status, priority,
                                sort_index, created_at, updated_at, execution_mode)
             VALUES (?1, NULL, '项目', '', 'in_progress', 3, 0, '2026-08-03', '2026-08-03', 'self')",
            params!["20260803-20260809"],
        )
        .unwrap();
        let root_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (week_id, parent_id, title, description, status, priority,
                                sort_index, created_at, updated_at, execution_mode)
             VALUES (?1, ?2, '子项目', '', 'in_progress', 3, 0, '2026-08-03', '2026-08-03', 'self')",
            params!["20260803-20260809", root_id],
        )
        .unwrap();
        let mid_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (week_id, parent_id, title, description, status, priority,
                                sort_index, created_at, updated_at, execution_mode)
             VALUES (?1, ?2, 'P0', '', 'in_progress', 0, 0, '2026-08-03', '2026-08-03', 'self')",
            params!["20260803-20260809", mid_id],
        )
        .unwrap();

        backfill_derived_priorities(&conn).unwrap();
        let mid_now = get_task(&conn, "20260803-20260809", mid_id)
            .unwrap()
            .unwrap();
        let root_now = get_task(&conn, "20260803-20260809", root_id)
            .unwrap()
            .unwrap();
        assert_eq!(mid_now.priority, 0);
        assert_eq!(root_now.priority, 0);
    }
}
