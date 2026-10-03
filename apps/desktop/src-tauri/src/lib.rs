//! هسته برنامه دسکتاپ دستمزد آرمانی ۱۴۰۵.
//!
//! برنامه همان خروجی ایستای بستر وب را در WebView2 (ویندوز) یا WKWebView (مک)
//! بارگذاری می‌کند و امکانات بومی را در اختیار آن می‌گذارد: منوی فارسی، سینی
//! سیستم، پشتیبان‌گیری روی `%APPDATA%\Dastmozd\backups`، انجمن پرونده `.dastmozd`،
//! اجرا در هنگام روشن‌شدن ویندوز و چاپ بومی.

mod backup;
mod commands;
mod menu;

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

use commands::AppState;

/// اجرای برنامه دسکتاپ.
pub fn run() {
    // پرونده‌ای که برنامه با آن فراخوانی شده است، پیش از آماده‌شدن پنجره نگه داشته می‌شود.
    let startup_file = backup::file_args(&std::env::args().collect::<Vec<String>>())
        .into_iter()
        .next();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = backup::file_args(&argv).into_iter().next() {
                commands::set_pending_open_file(app, &path);
                let _ = app.emit("dastmozd:open-file", path);
            }
            menu::focus_main(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(AppState {
            pending_open_file: std::sync::Mutex::new(startup_file),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            menu::install(&handle)?;
            menu::install_tray(&handle)?;

            // پوشه پشتیبان در نخستین اجرا ساخته می‌شود و سیاست نگهداری اعمال می‌گردد.
            if let Err(error) = backup::backup_dir() {
                log::error!("آماده‌سازی پوشه پشتیبان ناموفق بود: {error}");
            }
            match backup::prune(30, 12, 5) {
                Ok(report) => log::info!(
                    "سیاست نگهداری پشتیبان اجرا شد: {} حذف‌شده، {} نگه‌داشته‌شده",
                    report.removed,
                    report.kept
                ),
                Err(error) => log::warn!("اجرای سیاست نگهداری پشتیبان ناموفق بود: {error}"),
            }

            if let Some(window) = app.get_webview_window("main") {
                let window_for_close = window.clone();
                // بستن پنجره به سینی سیستم می‌فرستد تا پشتیبان‌گیری خودکار انجام شود.
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_for_close.emit("dastmozd:before-close", ());
                        let inner = window_for_close.clone();
                        // یک ثانیه فرصت برای پشتیبان‌گیری خودکار رابط کاربری.
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(1200));
                            if let Some(window) = inner.app_handle().get_webview_window("main") {
                                let _ = window.hide();
                            }
                        });
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_paths,
            commands::save_backup_file,
            commands::list_backup_files,
            commands::read_backup_file,
            commands::delete_backup_file,
            commands::prune_backup_files,
            commands::pending_open_file,
            commands::path_exists,
        ]);

    // افزونه به‌روزرسانی خودکار فقط در ساخت‌های امضاشده فعال است.
    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("اجرای برنامه دسکتاپ دستمزد آرمانی با خطا متوقف شد");
}
