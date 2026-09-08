//! One-off maintenance tool: repairs an empty current week that was created
//! by an older build predating manual-week carry-over. It runs the same
//! `ensure_current_week` path the app uses on startup, which backfills the
//! unfinished tasks from the newest earlier week when the current week is
//! still empty and has no carry source.
//!
//! Usage:
//!   cargo run --manifest-path src-tauri/Cargo.toml --example repair_current_week -- "<data-dir>"
//! where <data-dir> is the folder that contains `weeklytodo.db`.

use std::path::Path;

use weekly_todo_lib::{db, domain};

fn main() {
    let Some(raw) = std::env::args().nth(1) else {
        eprintln!("用法: repair_current_week \"<data-dir>\"");
        std::process::exit(2);
    };
    match run(Path::new(&raw)) {
        Ok(summary) => println!("{summary}"),
        Err(error) => {
            eprintln!("修复失败：{error}");
            std::process::exit(1);
        }
    }
}

fn run(data_dir: &Path) -> Result<String, String> {
    let mut conn = db::open_database(data_dir)?;
    let (week, _) = domain::ensure_current_week(&mut conn)?;
    let tasks = domain::list_tasks_for_week(&conn, &week.id)?;
    let open = tasks
        .iter()
        .filter(|task| task.status == domain::TASK_STATUS_IN_PROGRESS)
        .count();
    Ok(format!(
        "本周 {}：现有任务 {} 个（未完成 {}），带入来源 {:?}",
        week.id,
        tasks.len(),
        open,
        week.carried_from_week_id
    ))
}
