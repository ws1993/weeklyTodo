use std::path::Path;

use rusqlite::Connection;

pub const DB_FILE_NAME: &str = "weeklytodo.db";
pub const SCHEMA_VERSION: i32 = 5;

/// Open (or create) the SQLite database inside `data_dir` and run migrations.
pub fn open_database(data_dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(data_dir).map_err(|error| format!("创建数据目录失败：{error}"))?;
    let db_path = data_dir.join(DB_FILE_NAME);
    let mut conn =
        Connection::open(&db_path).map_err(|error| format!("打开数据库失败：{error}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("启用外键失败：{error}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("启用 WAL 失败：{error}"))?;
    // Wait for the write lock when a concurrent connection holds it, instead
    // of failing immediately with SQLITE_BUSY. Needed for IMMEDIATE
    // transactions (see `ensure_current_week`).
    conn.busy_timeout(std::time::Duration::from_secs(10))
        .map_err(|error| format!("设置忙等待超时失败：{error}"))?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Run incremental schema migrations tracked by `PRAGMA user_version`.
pub fn migrate(conn: &mut Connection) -> Result<(), String> {
    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| format!("读取数据库版本失败：{error}"))?;

    if version < 1 {
        let tx = conn
            .transaction()
            .map_err(|error| format!("开启迁移事务失败：{error}"))?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS weeks (
                id TEXT PRIMARY KEY,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                carried_from_week_id TEXT
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
                parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'in_progress',
                priority INTEGER NOT NULL DEFAULT 2,
                sort_index REAL NOT NULL DEFAULT 0,
                origin_week_id TEXT,
                carried_from_task_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                closed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_week_parent ON tasks(week_id, parent_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_carried_from ON tasks(carried_from_task_id);
            CREATE TABLE IF NOT EXISTS task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id TEXT NOT NULL,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                payload TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);",
        )
        .map_err(|error| format!("创建表结构失败：{error}"))?;
        tx.pragma_update(None, "user_version", 1)
            .map_err(|error| format!("写入数据库版本失败：{error}"))?;
        tx.commit()
            .map_err(|error| format!("提交迁移失败：{error}"))?;
    }

    if version < 2 {
        let tx = conn
            .transaction()
            .map_err(|error| format!("开启迁移事务失败：{error}"))?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS owners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            ALTER TABLE tasks ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'self';
            ALTER TABLE tasks ADD COLUMN owner_id INTEGER REFERENCES owners(id);
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, tag_id)
            );
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);",
        )
        .map_err(|error| format!("升级表结构失败：{error}"))?;
        tx.pragma_update(None, "user_version", 2)
            .map_err(|error| format!("写入数据库版本失败：{error}"))?;
        tx.commit()
            .map_err(|error| format!("提交迁移失败：{error}"))?;
    }

    if version < 3 {
        let tx = conn
            .transaction()
            .map_err(|error| format!("开启迁移事务失败：{error}"))?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS group_colors (
                name TEXT PRIMARY KEY,
                color TEXT NOT NULL,
                is_manual INTEGER NOT NULL DEFAULT 0
            );",
        )
        .map_err(|error| format!("创建分组颜色表失败：{error}"))?;
        tx.pragma_update(None, "user_version", 3)
            .map_err(|error| format!("写入数据库版本失败：{error}"))?;
        tx.commit()
            .map_err(|error| format!("提交迁移失败：{error}"))?;
    }

    if version < 4 {
        let tx = conn
            .transaction()
            .map_err(|error| format!("开启迁移事务失败：{error}"))?;
        // One-time backfill: derive every parent's priority from its open
        // children so existing data already reflects the linked-priority rule.
        crate::domain::backfill_derived_priorities(&tx)
            .map_err(|error| format!("回填派生优先级失败：{error}"))?;
        tx.pragma_update(None, "user_version", 4)
            .map_err(|error| format!("写入数据库版本失败：{error}"))?;
        tx.commit()
            .map_err(|error| format!("提交迁移失败：{error}"))?;
    }

    if version < 5 {
        let tx = conn
            .transaction()
            .map_err(|error| format!("开启迁移事务失败：{error}"))?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS assigners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            ALTER TABLE tasks ADD COLUMN assigner_id INTEGER REFERENCES assigners(id);",
        )
        .map_err(|error| format!("升级表结构失败：{error}"))?;
        tx.pragma_update(None, "user_version", 5)
            .map_err(|error| format!("写入数据库版本失败：{error}"))?;
        tx.commit()
            .map_err(|error| format!("提交迁移失败：{error}"))?;
    }

    Ok(())
}

#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let mut conn = Connection::open_in_memory().expect("open in-memory database");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("enable foreign keys");
    conn.busy_timeout(std::time::Duration::from_secs(10))
        .expect("set busy timeout");
    migrate(&mut conn).expect("run migrations");
    conn
}
