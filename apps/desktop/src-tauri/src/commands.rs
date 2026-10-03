//! فرمان‌های بومی در دسترس رابط کاربری (پشتیبان، مسیرها، پرونده بازشده).

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, State};

use crate::backup;

/// وضعیت مشترک برنامه.
#[derive(Default)]
pub struct AppState {
    /// مسیر پرونده `.dastmozd` که با دوبار کلیک یا از خط فرمان باز شده است.
    pub pending_open_file: Mutex<Option<String>>,
}

/// مسیرهای مهم برنامه برای نمایش در تنظیمات.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub backup_dir: String,
    pub data_dir: String,
    pub version: String,
    pub identifier: String,
}

/// مسیر پوشه پشتیبان و داده‌ها.
#[tauri::command]
pub fn app_paths(app: tauri::AppHandle) -> Result<AppPaths, String> {
    let backup_dir = backup::backup_dir()?;
    let data_dir = backup::data_dir()?;
    let package = app.package_info();
    Ok(AppPaths {
        backup_dir: backup_dir.to_string_lossy().to_string(),
        data_dir: data_dir.to_string_lossy().to_string(),
        version: package.version.to_string(),
        identifier: app.config().identifier.clone(),
    })
}

/// نوشتن یک نسخه پشتیبان در پوشه پیش‌فرض ویندوز.
#[tauri::command]
pub fn save_backup_file(file_name: String, contents: String) -> Result<backup::SavedBackup, String> {
    backup::save_backup(&file_name, &contents)
}

/// فهرست نسخه‌های پشتیبان موجود.
#[tauri::command]
pub fn list_backup_files() -> Result<Vec<backup::BackupEntry>, String> {
    backup::list_backups()
}

/// خواندن محتوای یک نسخه پشتیبان برای بازگردانی.
#[tauri::command]
pub fn read_backup_file(file_name: String) -> Result<String, String> {
    backup::read_backup(&file_name)
}

/// حذف یک نسخه پشتیبان.
#[tauri::command]
pub fn delete_backup_file(file_name: String) -> Result<bool, String> {
    backup::delete_backup(&file_name)
}

/// اجرای سیاست نگهداری پشتیبان‌ها (۳۰ روزانه، ۱۲ ماهانه، ۵ سالانه).
#[tauri::command]
pub fn prune_backup_files() -> Result<backup::PruneReport, String> {
    backup::prune(30, 12, 5)
}

/// مسیر پرونده‌ای که برنامه با آن باز شده است (یک‌بار مصرف).
#[tauri::command]
pub fn pending_open_file(state: State<'_, AppState>) -> Option<String> {
    state
        .pending_open_file
        .lock()
        .ok()
        .and_then(|mut guard| guard.take())
}

/// بررسی وجود یک مسیر روی دیسک.
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    backup::path_exists(&path)
}

/// ثبت مسیر پرونده در حالت انتظار (از خط فرمان یا نمونه دوم برنامه).
pub fn set_pending_open_file(app: &tauri::AppHandle, path: &str) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut guard) = state.pending_open_file.lock() {
            *guard = Some(path.to_string());
        }
    }
}
