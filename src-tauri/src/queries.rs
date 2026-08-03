use rusqlite::{params, Connection, OptionalExtension};

use crate::contracts::{QueryFilter, QueryTaskRow};
use crate::domain::Task;

/// Search across all stored weeks with filters.
pub fn query_tasks(conn: &Connection, filter: &QueryFilter) -> Result<Vec<QueryTaskRow>, String> {
    let mut sql = String::from(
        "SELECT t.id, t.week_id, t.parent_id, t.title, t.description, t.status, t.priority,
                t.sort_index, t.origin_week_id, t.carried_from_task_id, t.created_at,
                t.updated_at, t.closed_at, t.execution_mode, t.owner_id, o.name,
                w.id AS week_label
         FROM tasks t JOIN weeks w ON w.id = t.week_id
         LEFT JOIN owners o ON o.id = t.owner_id
         WHERE 1 = 1",
    );
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(week_id) = &filter.week_id {
        sql.push_str(" AND t.week_id = ?");
        values.push(Box::new(week_id.clone()));
    }
    if let Some(start_week_id) = &filter.start_week_id {
        sql.push_str(" AND w.start_date >= (SELECT start_date FROM weeks WHERE id = ?)");
        values.push(Box::new(start_week_id.clone()));
    }
    if let Some(end_week_id) = &filter.end_week_id {
        sql.push_str(" AND w.start_date <= (SELECT start_date FROM weeks WHERE id = ?)");
        values.push(Box::new(end_week_id.clone()));
    }
    if let Some(keyword) = &filter.keyword {
        if !keyword.trim().is_empty() {
            sql.push_str(" AND (t.title LIKE ? OR t.description LIKE ?)");
            let pattern = format!("%{}%", keyword.trim());
            values.push(Box::new(pattern.clone()));
            values.push(Box::new(pattern));
        }
    }
    if let Some(status) = &filter.status {
        if !status.is_empty() {
            sql.push_str(" AND t.status = ?");
            values.push(Box::new(status.clone()));
        }
    }
    if filter.carried_over_only.unwrap_or(false) {
        sql.push_str(" AND t.carried_from_task_id IS NOT NULL");
    }
    if let Some(owner_id) = filter.owner_id {
        sql.push_str(" AND t.owner_id = ?");
        values.push(Box::new(owner_id));
    }
    if let Some(tag_id) = filter.tag_id {
        sql.push_str(" AND t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)");
        values.push(Box::new(tag_id));
    }
    sql.push_str(" ORDER BY w.start_date DESC, t.sort_index, t.id LIMIT 1000");

    let params = rusqlite::params_from_iter(values.iter().map(|value| value.as_ref()));
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("准备查询失败：{error}"))?;
    let rows = stmt
        .query_map(params, |row| {
            let task = Task {
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
                tags: Vec::new(),
            };
            Ok(QueryTaskRow {
                week_label: row.get(16)?,
                week_id: task.week_id.clone(),
                task,
                path: String::new(),
            })
        })
        .map_err(|error| format!("查询任务失败：{error}"))?;

    let mut result: Vec<QueryTaskRow> = Vec::new();
    for row in rows {
        let mut item = row.map_err(|error| format!("读取查询结果失败：{error}"))?;
        item.path = build_path(conn, &item.task)?;
        result.push(item);
    }
    // Attach tag names to every returned task.
    let task_ids: Vec<i64> = result.iter().map(|item| item.task.id).collect();
    let tag_map = crate::domain::load_task_tags(conn, &task_ids)?;
    for item in result.iter_mut() {
        item.task.tags = tag_map.get(&item.task.id).cloned().unwrap_or_default();
    }
    Ok(result)
}

/// Build a `父 > 子 > 孙` display path for a task by walking up parents.
fn build_path(conn: &Connection, task: &Task) -> Result<String, String> {
    let mut segments = vec![task.title.clone()];
    let mut current_id = task.parent_id;
    let mut guard = 0;
    while let Some(parent_id) = current_id {
        let parent: Option<(String, Option<i64>)> = conn
            .query_row(
                "SELECT title, parent_id FROM tasks WHERE id = ?1",
                params![parent_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|error| format!("读取任务路径失败：{error}"))?;
        if let Some((title, parent_of_parent)) = parent {
            segments.push(title);
            current_id = parent_of_parent;
        } else {
            break;
        }
        guard += 1;
        if guard > 64 {
            break;
        }
    }
    segments.reverse();
    Ok(segments.join(" > "))
}

/// Count weeks/tasks per week for the query summary strip.
pub fn week_summaries(conn: &Connection) -> Result<Vec<(String, i64, i64)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT w.id,
                    COUNT(t.id) AS total,
                    COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0) AS open
             FROM weeks w LEFT JOIN tasks t ON t.week_id = w.id
             GROUP BY w.id
             ORDER BY w.start_date DESC",
        )
        .map_err(|error| format!("准备周统计失败：{error}"))?;
    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|error| format!("查询周统计失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取周统计失败：{error}"))?;
    Ok(rows)
}

/// The N most recent week ids (newest first) for the left rail.
pub fn recent_week_ids(conn: &Connection, limit: i64) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM weeks ORDER BY start_date DESC LIMIT ?1")
        .map_err(|error| format!("准备周列表失败：{error}"))?;
    let rows = stmt
        .query_map(params![limit], |row| row.get(0))
        .map_err(|error| format!("查询周列表失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取周列表失败：{error}"))?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::domain::{create_task, insert_week_helper, CreateTaskInput};

    #[test]
    fn query_filters_by_keyword_and_status() {
        let mut conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260810-20260816", "20260810", "20260816");

        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "准备周报".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        let done = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "已完成的备份".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        crate::domain::close_task(&mut conn, "20260803-20260809", done.id).unwrap();

        let keyword_result = query_tasks(
            &conn,
            &QueryFilter {
                keyword: Some("周报".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(keyword_result.len(), 1);
        assert_eq!(keyword_result[0].task.title, "准备周报");

        let status_result = query_tasks(
            &conn,
            &QueryFilter {
                status: Some("closed".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(status_result.len(), 1);
        assert_eq!(status_result[0].task.title, "已完成的备份");
    }

    #[test]
    fn query_filters_by_owner_and_tag() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");

        let assigned = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "给小明写周报".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: Some("小明".into()),
                tag_names: vec!["高优".into()],
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "无人认领任务".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        let owner_id = crate::domain::ensure_owner(&conn, "小明").unwrap();
        let tag_id = crate::domain::ensure_tag(&conn, "高优").unwrap();

        let by_owner = query_tasks(
            &conn,
            &QueryFilter {
                owner_id: Some(owner_id),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_owner.len(), 1);
        assert_eq!(by_owner[0].task.id, assigned.id);

        let by_tag = query_tasks(
            &conn,
            &QueryFilter {
                tag_id: Some(tag_id),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_tag.len(), 1);
        assert_eq!(by_tag[0].task.tags, vec!["高优".to_string()]);
    }

    #[test]
    fn recent_week_ids_returns_newest_first() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260727-20260802", "20260727", "20260802");
        let ids = recent_week_ids(&conn, 4).unwrap();
        assert_eq!(ids, vec!["20260803-20260809", "20260727-20260802"]);
    }
}
