use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow, WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const CLOSE_REQUESTED_EVENT: &str = "app-close-requested";

/// Show and focus the main window, restoring it from hidden or minimized state.
/// Used by the single-instance callback (relaunching the shortcut) and tray menu.
pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let _ = app.run_on_main_thread(move || {
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        if !window.is_visible().unwrap_or(false) {
            let _ = window.show();
        }
        let _ = window.set_focus();
    });
}

/// Hide the main window into the system tray; the app keeps running in the background.
pub fn hide_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let _ = app.run_on_main_thread(move || {
        let _ = window.hide();
    });
}

/// Toggle the main window between shown and hidden (tray icon left-click).
fn toggle_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        hide_main_window(app);
    } else {
        show_main_window(app);
    }
}

/// Intercept the close button: prevent the window from actually closing and
/// notify the frontend, which decides (ask / minimize to tray / exit) per settings.
pub fn intercept_close_request(app: &AppHandle, window: &WebviewWindow) {
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = app_handle.emit(CLOSE_REQUESTED_EVENT, ());
        }
    });
}

/// Build the system tray icon with a right-click menu and left-click toggle.
pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show-main", "显示主界面", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit-app", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::with_id("main-tray")
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/icon.ico"))?)
        .tooltip("周计划")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show-main" => show_main_window(app),
            "quit-app" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
