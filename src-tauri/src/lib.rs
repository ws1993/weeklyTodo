pub mod commands;
pub mod contracts;
pub mod credentials;
pub mod db;
pub mod domain;
pub mod queries;
pub mod storage;
pub mod sync;
pub mod tray;
pub mod updater;
pub mod webdav;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 再次启动（如双击桌面快捷方式）时唤醒后台运行的主窗口。
            tray::show_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let window = app.get_webview_window("main").expect("main window");
                window.set_icon(
                    tauri::image::Image::from_bytes(include_bytes!("../icons/icon.ico"))
                        .expect("Failed to load icon"),
                )?;
                tray::create_tray(app.handle())?;
                tray::intercept_close_request(app.handle(), &window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::initialize_app,
            commands::list_weeks,
            commands::recent_weeks,
            commands::get_week_tree,
            commands::get_current_week_tree,
            commands::create_week,
            commands::create_task,
            commands::update_task,
            commands::list_assigners,
            commands::create_assigner,
            commands::rename_assigner,
            commands::delete_assigner,
            commands::list_owners,
            commands::list_tags,
            commands::create_owner,
            commands::rename_owner,
            commands::delete_owner,
            commands::create_tag,
            commands::rename_tag,
            commands::delete_tag,
            commands::list_group_colors,
            commands::ensure_group_color,
            commands::set_group_color,
            commands::reset_group_color,
            commands::close_task,
            commands::reopen_task,
            commands::move_task,
            commands::delete_task,
            commands::query_all_tasks,
            commands::query_group_options,
            commands::week_summaries,
            commands::statistics_overview,
            commands::get_storage_dir,
            commands::pick_and_migrate_storage,
            commands::migrate_storage_to,
            commands::check_for_app_update,
            commands::download_and_install_update,
            commands::exit_app_for_update,
            commands::hide_main_window,
            commands::exit_app,
            commands::open_release_page,
            commands::open_data_dir,
            commands::webdav_test_connection,
            commands::webdav_save_credentials,
            commands::webdav_has_credentials,
            commands::webdav_clear_credentials,
            commands::webdav_sync_now,
            commands::webdav_sync_automatic,
            commands::webdav_list_versions,
            commands::webdav_restore_version,
            commands::save_share_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running weeklytodo");
}
