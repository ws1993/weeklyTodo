use rusqlite::{params, Connection, OptionalExtension};

use crate::contracts::{
    NamedCount, PriorityStat, QueryFilter, QueryTaskRow, StatisticsOverview, WeekTrendStat,
};
use crate::domain::Task;

/// Search across all stored weeks with filters.
pub fn query_tasks(conn: &Connection, filter: &QueryFilter) -> Result<Vec<QueryTaskRow>, String> {
    let mut sql = String::from(
        "SELECT t.id, t.week_id, t.parent_id, t.title, t.description, t.status, t.priority,
                t.sort_index, t.origin_week_id, t.carried_from_task_id, t.created_at,
                t.updated_at, t.closed_at, t.execution_mode, t.owner_id, o.name,
                t.assigner_id, a.name, w.id AS week_label,
                EXISTS(SELECT 1 FROM tasks child WHERE child.parent_id = t.id) AS has_children
         FROM tasks t JOIN weeks w ON w.id = t.week_id
         LEFT JOIN owners o ON o.id = t.owner_id
         LEFT JOIN assigners a ON a.id = t.assigner_id
         WHERE 1 = 1",
    );
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(week_id) = &filter.week_id {
        sql.push_str(" AND t.week_id = ?");
        values.push(Box::new(week_id.clone()));
    }
    if let Some(group) = &filter.group_filter {
        if !group.trim().is_empty() {
            // 项目 = 顶层任务（parent_id 为空）。用递归 CTE 把每个任务映射到其根任务，
            // 再按根任务标题过滤；跨周同名根任务视为同一项目。
            sql.push_str(
                " AND t.id IN (
                    WITH RECURSIVE root_of(id, root_id) AS (
                        SELECT id, id FROM tasks WHERE parent_id IS NULL
                        UNION ALL
                        SELECT child.id, root_of.root_id
                        FROM tasks child JOIN root_of ON child.parent_id = root_of.id
                    )
                    SELECT root_of.id FROM root_of
                    JOIN tasks root_task ON root_task.id = root_of.root_id
                    WHERE root_task.title = ?
                )",
            );
            values.push(Box::new(group.trim().to_string()));
        }
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
    if let Some(assigner_id) = filter.assigner_id {
        sql.push_str(" AND t.assigner_id = ?");
        values.push(Box::new(assigner_id));
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
                assigner_id: row.get(16)?,
                assigner_name: row.get(17)?,
                tags: Vec::new(),
            };
            Ok(QueryTaskRow {
                week_label: row.get(18)?,
                week_id: task.week_id.clone(),
                task,
                path: String::new(),
                root_title: String::new(),
                has_children: row.get(19)?,
            })
        })
        .map_err(|error| format!("查询任务失败：{error}"))?;

    let mut result: Vec<QueryTaskRow> = Vec::new();
    for row in rows {
        let mut item = row.map_err(|error| format!("读取查询结果失败：{error}"))?;
        item.path = build_path(conn, &item.task)?;
        item.root_title = build_root_title(conn, &item.task)?;
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

/// 项目（顶层任务）标题列表，供查询页「项目」筛选下拉使用。
/// 传入某周时只返回该周的项目；不传则返回跨周全部项目（同名去重合并）。
pub fn group_options(conn: &Connection, week_id: Option<&str>) -> Result<Vec<String>, String> {
    let mut sql =
        String::from("SELECT DISTINCT title FROM tasks WHERE parent_id IS NULL AND title != ''");
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(week_id) = week_id {
        sql.push_str(" AND week_id = ?");
        values.push(Box::new(week_id.to_string()));
    }
    sql.push_str(" ORDER BY title");

    let params = rusqlite::params_from_iter(values.iter().map(|value| value.as_ref()));
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("准备项目选项查询失败：{error}"))?;
    let rows = stmt
        .query_map(params, |row| row.get::<_, String>(0))
        .map_err(|error| format!("查询项目选项失败：{error}"))?;
    let mut titles = Vec::new();
    for row in rows {
        titles.push(row.map_err(|error| format!("读取项目选项失败：{error}"))?);
    }
    Ok(titles)
}

/// 向上追溯任务的顶层祖先标题（项目名）；无父节点时返回自身标题。
fn build_root_title(conn: &Connection, task: &Task) -> Result<String, String> {
    let mut title = task.title.clone();
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
            .map_err(|error| format!("读取任务根节点失败：{error}"))?;
        if let Some((parent_title, parent_of_parent)) = parent {
            title = parent_title;
            current_id = parent_of_parent;
        } else {
            break;
        }
        guard += 1;
        if guard > 64 {
            break;
        }
    }
    Ok(title)
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

/// 把起止周 id 解析为对应周 `start_date` 边界；周 id 不存在时视为无该边界。
fn resolve_week_bound(conn: &Connection, week_id: Option<&str>) -> Result<Option<String>, String> {
    let Some(week_id) = week_id else {
        return Ok(None);
    };
    conn.query_row(
        "SELECT start_date FROM weeks WHERE id = ?1",
        params![week_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|error| format!("解析统计范围周失败：{error}"))
}

/// 生成「任务周 id 落在起止周范围内」的 SQL 条件片段与对应参数。
/// 片段形如 `week_id IN (SELECT id FROM weeks WHERE 1=1 [AND start_date >= ?] [AND start_date <= ?])`，
/// 需按使用处补上前缀（如 `t.`）。
fn week_id_in_range_condition(
    start_bound: Option<&str>,
    end_bound: Option<&str>,
) -> (String, Vec<Box<dyn rusqlite::types::ToSql>>) {
    let mut sql = String::from("week_id IN (SELECT id FROM weeks WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(bound) = start_bound {
        sql.push_str(" AND start_date >= ?");
        params.push(Box::new(bound.to_string()));
    }
    if let Some(bound) = end_bound {
        sql.push_str(" AND start_date <= ?");
        params.push(Box::new(bound.to_string()));
    }
    sql.push(')');
    (sql, params)
}

/// 一次性聚合「统计 / 复盘」视图需要的全部数据（可限定起止周范围，缺省为全部历史）。
pub fn statistics_overview(
    conn: &Connection,
    start_week_id: Option<&str>,
    end_week_id: Option<&str>,
) -> Result<StatisticsOverview, String> {
    let start_bound = resolve_week_bound(conn, start_week_id)?;
    let end_bound = resolve_week_bound(conn, end_week_id)?;

    // 周趋势：范围内各周总量 / 完成 / 进行中 / 带入 / 带入完成。
    let mut week_sql = String::from(
        "SELECT w.id,
                COUNT(t.id) AS total,
                COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) AS done,
                COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0) AS open,
                COALESCE(SUM(CASE WHEN t.carried_from_task_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS carried,
                COALESCE(SUM(CASE WHEN t.status = 'closed' AND t.carried_from_task_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS carried_done
         FROM weeks w LEFT JOIN tasks t ON t.week_id = w.id",
    );
    let mut week_conditions = Vec::new();
    let mut week_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(bound) = start_bound.as_deref() {
        week_conditions.push("w.start_date >= ?");
        week_params.push(Box::new(bound.to_string()));
    }
    if let Some(bound) = end_bound.as_deref() {
        week_conditions.push("w.start_date <= ?");
        week_params.push(Box::new(bound.to_string()));
    }
    if !week_conditions.is_empty() {
        week_sql.push_str(" WHERE ");
        week_sql.push_str(&week_conditions.join(" AND "));
    }
    // 上限 104 周（约两年），仅作防御性保护，正常不会触达。
    week_sql.push_str(" GROUP BY w.id ORDER BY w.start_date DESC LIMIT 104");
    let weeks = {
        let mut stmt = conn
            .prepare(&week_sql)
            .map_err(|error| format!("准备周趋势统计失败：{error}"))?;
        let rows = stmt
            .query_map(
                rusqlite::params_from_iter(week_params.iter().map(|value| value.as_ref())),
                |row| {
                    Ok(WeekTrendStat {
                        week_id: row.get(0)?,
                        total: row.get(1)?,
                        done: row.get(2)?,
                        open: row.get(3)?,
                        carried: row.get(4)?,
                        carried_done: row.get(5)?,
                    })
                },
            )
            .map_err(|error| format!("查询周趋势统计失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取周趋势统计失败：{error}"))?;
        rows
    };

    // 范围内任务过滤条件（各分布与总量查询共用）。
    let (task_condition, task_params) =
        week_id_in_range_condition(start_bound.as_deref(), end_bound.as_deref());

    // 范围内总量：任务 / 完成 / 进行中 / 带入 / 拖期未完成。
    let (total_tasks, total_done, total_open, total_carried, carried_open) = conn
        .query_row(
            &format!(
                "SELECT COUNT(*),
                        COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN carried_from_task_id IS NOT NULL THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN status = 'in_progress' AND carried_from_task_id IS NOT NULL THEN 1 ELSE 0 END), 0)
                 FROM tasks t
                 WHERE t.{task_condition}",
            ),
            rusqlite::params_from_iter(task_params.iter().map(|value| value.as_ref())),
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .map_err(|error| format!("统计任务总量失败：{error}"))?;

    // 按优先级分布。
    let by_priority = {
        let sql = format!(
            "SELECT priority, COUNT(*),
                    COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0)
             FROM tasks t
             WHERE t.{task_condition}
             GROUP BY priority ORDER BY priority",
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|error| format!("准备优先级统计失败：{error}"))?;
        let rows = stmt
            .query_map(
                rusqlite::params_from_iter(task_params.iter().map(|value| value.as_ref())),
                |row| {
                    Ok(PriorityStat {
                        priority: row.get(0)?,
                        count: row.get(1)?,
                        done: row.get(2)?,
                    })
                },
            )
            .map_err(|error| format!("查询优先级统计失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取优先级统计失败：{error}"))?;
        rows
    };

    // 按标签分布（按数量降序）。
    let by_tag = {
        let sql = format!(
            "SELECT tags.name, COUNT(*)
             FROM task_tags JOIN tags ON tags.id = task_tags.tag_id
             WHERE task_tags.task_id IN (
                 SELECT t.id FROM tasks t WHERE t.{task_condition}
             )
             GROUP BY tags.name
             ORDER BY COUNT(*) DESC, tags.name",
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|error| format!("准备标签统计失败：{error}"))?;
        let rows = stmt
            .query_map(
                rusqlite::params_from_iter(task_params.iter().map(|value| value.as_ref())),
                |row| {
                    Ok(NamedCount {
                        name: row.get(0)?,
                        count: row.get(1)?,
                    })
                },
            )
            .map_err(|error| format!("查询标签统计失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取标签统计失败：{error}"))?;
        rows
    };

    // 按负责人分布（未指定负责人最后；其余按数量降序）。
    let by_owner = {
        let sql = format!(
            "SELECT COALESCE(owners.name, ''), COUNT(*)
             FROM tasks t LEFT JOIN owners ON owners.id = t.owner_id
             WHERE t.{task_condition}
             GROUP BY owners.name
             ORDER BY (owners.name IS NULL) ASC, COUNT(*) DESC, owners.name",
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|error| format!("准备负责人统计失败：{error}"))?;
        let rows = stmt
            .query_map(
                rusqlite::params_from_iter(task_params.iter().map(|value| value.as_ref())),
                |row| {
                    Ok(NamedCount {
                        name: row.get(0)?,
                        count: row.get(1)?,
                    })
                },
            )
            .map_err(|error| format!("查询负责人统计失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取负责人统计失败：{error}"))?;
        rows
    };

    // 按分派人分布（未指定分派人最后；其余按数量降序）。
    let by_assigner = {
        let sql = format!(
            "SELECT COALESCE(assigners.name, ''), COUNT(*)
             FROM tasks t LEFT JOIN assigners ON assigners.id = t.assigner_id
             WHERE t.{task_condition}
             GROUP BY assigners.name
             ORDER BY (assigners.name IS NULL) ASC, COUNT(*) DESC, assigners.name",
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|error| format!("准备分派人统计失败：{error}"))?;
        let rows = stmt
            .query_map(
                rusqlite::params_from_iter(task_params.iter().map(|value| value.as_ref())),
                |row| {
                    Ok(NamedCount {
                        name: row.get(0)?,
                        count: row.get(1)?,
                    })
                },
            )
            .map_err(|error| format!("查询分派人统计失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取分派人统计失败：{error}"))?;
        rows
    };

    Ok(StatisticsOverview {
        weeks,
        total_tasks,
        total_done,
        total_open,
        total_carried,
        carried_open,
        by_priority,
        by_tag,
        by_owner,
        by_assigner,
    })
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
                assigner_name: None,
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
                assigner_name: None,
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
                assigner_name: None,
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
                assigner_name: None,
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
    fn query_filters_by_assigner() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");

        let assigned = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "分派给张三的任务".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: Some("张三".into()),
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "未分派任务".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        let assigner_id = crate::domain::ensure_assigner(&conn, "张三").unwrap();
        let by_assigner = query_tasks(
            &conn,
            &QueryFilter {
                assigner_id: Some(assigner_id),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_assigner.len(), 1);
        assert_eq!(by_assigner[0].task.id, assigned.id);
        assert_eq!(by_assigner[0].task.assigner_name.as_deref(), Some("张三"));
    }

    #[test]
    fn query_reports_has_children_for_parents_only() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");

        let root = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "项目".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "子任务".into(),
                description: String::new(),
                parent_id: Some(root.id),
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        let rows = query_tasks(
            &conn,
            &QueryFilter {
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(rows.len(), 2);
        let parent = rows.iter().find(|row| row.task.title == "项目").unwrap();
        let child = rows.iter().find(|row| row.task.title == "子任务").unwrap();
        assert!(parent.has_children);
        assert!(!child.has_children);
    }

    #[test]
    fn query_filters_by_group_and_reports_root_title() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260810-20260816", "20260810", "20260816");

        // 第 1 周：项目 A（含子任务）+ 项目 B。
        let week1_project_a = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "项目A".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "A的子任务".into(),
                description: String::new(),
                parent_id: Some(week1_project_a.id),
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "项目B".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        // 第 2 周：同名项目 A。
        let week2_project_a = create_task(
            &conn,
            "20260810-20260816",
            CreateTaskInput {
                title: "项目A".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260810-20260816",
            CreateTaskInput {
                title: "A的另一个子任务".into(),
                description: String::new(),
                parent_id: Some(week2_project_a.id),
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        // 按项目「项目A」过滤：跨周命中，且每个结果都带正确 root_title。
        let by_group = query_tasks(
            &conn,
            &QueryFilter {
                group_filter: Some("项目A".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_group.len(), 4);
        assert!(by_group.iter().all(|row| row.root_title == "项目A"));
        assert!(
            !by_group.iter().any(|row| row.task.title == "项目B"),
            "项目B 不应出现在项目A 的筛选结果中"
        );

        // 项目 + 周组合过滤：只命中第 2 周的项目A 及其子任务。
        let by_group_and_week = query_tasks(
            &conn,
            &QueryFilter {
                week_id: Some("20260810-20260816".into()),
                group_filter: Some("项目A".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_group_and_week.len(), 2);
        assert!(by_group_and_week
            .iter()
            .all(|row| row.week_id == "20260810-20260816"));
    }

    #[test]
    fn group_options_scopes_to_week_and_merges_across_weeks() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260810-20260816", "20260810", "20260816");

        for (week_id, titles) in [
            ("20260803-20260809", vec!["项目A", "项目B"]),
            ("20260810-20260816", vec!["项目A"]),
        ] {
            for title in titles {
                create_task(
                    &conn,
                    week_id,
                    CreateTaskInput {
                        title: title.into(),
                        description: String::new(),
                        parent_id: None,
                        priority: 2,
                        execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                        owner_name: None,
                        assigner_name: None,
                        tag_names: Vec::new(),
                    },
                )
                .unwrap();
            }
        }

        // 跨周同名去重合并。
        assert_eq!(
            group_options(&conn, None).unwrap(),
            vec!["项目A".to_string(), "项目B".to_string()]
        );
        assert_eq!(
            group_options(&conn, Some("20260803-20260809")).unwrap(),
            vec!["项目A".to_string(), "项目B".to_string()]
        );
        assert_eq!(
            group_options(&conn, Some("20260810-20260816")).unwrap(),
            vec!["项目A".to_string()]
        );
    }

    #[test]
    fn recent_week_ids_returns_newest_first() {
        let conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260727-20260802", "20260727", "20260802");
        let ids = recent_week_ids(&conn, 4).unwrap();
        assert_eq!(ids, vec!["20260803-20260809", "20260727-20260802"]);
    }

    #[test]
    fn statistics_overview_aggregates_trend_and_distributions() {
        let mut conn = db::open_in_memory();
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260810-20260816", "20260810", "20260816");

        // 第 1 周：带入且完成 / 本周新完成 / 进行中。
        let carried_done = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "带入且完成".into(),
                description: String::new(),
                parent_id: None,
                priority: 0,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: Some("小明".into()),
                assigner_name: Some("李四".into()),
                tag_names: vec!["工作".into()],
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "本周新完成".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "进行中".into(),
                description: String::new(),
                parent_id: None,
                priority: 1,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();
        // 第 2 周：一个未完成的普通任务。
        create_task(
            &conn,
            "20260810-20260816",
            CreateTaskInput {
                title: "新周进行中".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        // 模拟带入：把第 1 周的任务标记为从更早周带入，再关闭两个任务。
        conn.execute(
            "UPDATE tasks SET carried_from_task_id = 999 WHERE id = ?1",
            params![carried_done.id],
        )
        .unwrap();
        crate::domain::close_task(&mut conn, "20260803-20260809", carried_done.id).unwrap();
        let done_id = conn
            .query_row(
                "SELECT id FROM tasks WHERE week_id = '20260803-20260809' AND title = '本周新完成'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap();
        crate::domain::close_task(&mut conn, "20260803-20260809", done_id).unwrap();

        let stats = statistics_overview(&conn, None, None).unwrap();

        // 周趋势：新 → 旧。
        assert_eq!(stats.weeks.len(), 2);
        assert_eq!(stats.weeks[0].week_id, "20260810-20260816");
        assert_eq!(
            (
                stats.weeks[0].total,
                stats.weeks[0].done,
                stats.weeks[0].open
            ),
            (1, 0, 1)
        );
        assert_eq!(stats.weeks[1].week_id, "20260803-20260809");
        assert_eq!(
            (
                stats.weeks[1].total,
                stats.weeks[1].done,
                stats.weeks[1].open,
                stats.weeks[1].carried,
                stats.weeks[1].carried_done,
            ),
            (3, 2, 1, 1, 1)
        );

        // 全历史总量。
        assert_eq!(stats.total_tasks, 4);
        assert_eq!(stats.total_done, 2);
        assert_eq!(stats.total_open, 2);
        assert_eq!(stats.total_carried, 1);
        // 拖期未完成：第 1 周唯一的带入任务已关闭，不应计入积压。
        assert_eq!(stats.carried_open, 0);

        // 优先级分布（含完成数）。
        assert_eq!(
            stats
                .by_priority
                .iter()
                .map(|item| (item.priority, item.count, item.done))
                .collect::<Vec<_>>(),
            vec![(0, 1, 1), (1, 1, 0), (2, 2, 1)]
        );

        // 标签分布。
        assert_eq!(
            stats
                .by_tag
                .iter()
                .map(|item| (item.name.as_str(), item.count))
                .collect::<Vec<_>>(),
            vec![("工作", 1)]
        );

        // 负责人分布：有名字的在前，未指定排最后。
        assert_eq!(
            stats
                .by_owner
                .iter()
                .map(|item| (item.name.as_str(), item.count))
                .collect::<Vec<_>>(),
            vec![("小明", 1), ("", 3)]
        );

        // 分派人分布：有名字的在前，未指定排最后。
        assert_eq!(
            stats
                .by_assigner
                .iter()
                .map(|item| (item.name.as_str(), item.count))
                .collect::<Vec<_>>(),
            vec![("李四", 1), ("", 3)]
        );
    }

    #[test]
    fn statistics_overview_empty_database() {
        let conn = db::open_in_memory();
        let stats = statistics_overview(&conn, None, None).unwrap();
        assert!(stats.weeks.is_empty());
        assert_eq!(stats.total_tasks, 0);
        assert_eq!(stats.total_done, 0);
        assert!(stats.by_priority.is_empty());
        assert!(stats.by_tag.is_empty());
        assert!(stats.by_owner.is_empty());
    }

    #[test]
    fn statistics_overview_filters_by_week_range() {
        let mut conn = db::open_in_memory();
        insert_week_helper(&conn, "20260727-20260802", "20260727", "20260802");
        insert_week_helper(&conn, "20260803-20260809", "20260803", "20260809");
        insert_week_helper(&conn, "20260810-20260816", "20260810", "20260816");

        // 第 1 周：进行中的带入任务（拖期）。
        create_task(
            &conn,
            "20260727-20260802",
            CreateTaskInput {
                title: "旧周带入未完成".into(),
                description: String::new(),
                parent_id: None,
                priority: 0,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: vec!["旧标签".into()],
            },
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET carried_from_task_id = 888 WHERE week_id = '20260727-20260802'",
            [],
        )
        .unwrap();
        // 第 2 周：已完成的普通任务。
        let week2_done = create_task(
            &conn,
            "20260803-20260809",
            CreateTaskInput {
                title: "周内已完成".into(),
                description: String::new(),
                parent_id: None,
                priority: 2,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: Some("小明".into()),
                assigner_name: None,
                tag_names: vec!["工作".into()],
            },
        )
        .unwrap();
        crate::domain::close_task(&mut conn, "20260803-20260809", week2_done.id).unwrap();
        // 第 3 周：进行中的普通任务。
        create_task(
            &conn,
            "20260810-20260816",
            CreateTaskInput {
                title: "新周进行中".into(),
                description: String::new(),
                parent_id: None,
                priority: 1,
                execution_mode: crate::domain::EXECUTION_MODE_SELF.into(),
                owner_name: None,
                assigner_name: None,
                tag_names: Vec::new(),
            },
        )
        .unwrap();

        // 只统计第 2、3 周：排除旧周带入任务。
        let stats =
            statistics_overview(&conn, Some("20260803-20260809"), Some("20260810-20260816"))
                .unwrap();
        assert_eq!(
            stats
                .weeks
                .iter()
                .map(|week| week.week_id.as_str())
                .collect::<Vec<_>>(),
            vec!["20260810-20260816", "20260803-20260809"]
        );
        assert_eq!(stats.total_tasks, 2);
        assert_eq!(stats.total_done, 1);
        assert_eq!(stats.total_open, 1);
        assert_eq!(stats.total_carried, 0);
        assert_eq!(stats.carried_open, 0);
        assert!(stats.by_tag.iter().all(|item| item.name != "旧标签"));
        assert!(stats.by_owner.iter().any(|item| item.name == "小明"));

        // 只统计第 1 周：仅旧周带入任务，标记为拖期未完成。
        let single =
            statistics_overview(&conn, Some("20260727-20260802"), Some("20260727-20260802"))
                .unwrap();
        assert_eq!(single.total_tasks, 1);
        assert_eq!(single.total_open, 1);
        assert_eq!(single.total_carried, 1);
        assert_eq!(single.carried_open, 1);

        // 不存在的周 id 视为无边界：等同全量。
        let defensive = statistics_overview(&conn, Some("29990101-29990107"), None).unwrap();
        assert_eq!(defensive.total_tasks, 3);
    }
}
