//! مدیریت پشتیبان‌های بومی روی دیسک.
//!
//! پوشه پیش‌فرض در ویندوز `%APPDATA%\Dastmozd\backups` است تا کاربر بتواند
//! فارغ از شناسه فنی برنامه، نسخه‌های پشتیبان را پیدا کند. سیاست نگهداری
//! پیش‌فرض ۳۰ نسخه روزانه، ۱۲ نسخه ماهانه و ۵ نسخه سالانه است.

use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Local, NaiveDate};
use serde::Serialize;

/// نام پوشه برنامه در پروفایل کاربر.
const APP_FOLDER: &str = "Dastmozd";

/// نتیجه بازگرداندن پروفایل‌های پشتیبان.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PruneReport {
    pub removed: usize,
    pub kept: usize,
}

/// یک پرونده پشتیبان روی دیسک.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    /// نوع پشتیبان: روزانه، ماهانه، سالانه یا دستی.
    pub kind: String,
}

/// پرونده ذخیره‌شده به همراه مسیر کامل آن.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedBackup {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
}

/// مسیر پوشه پشتیبان‌ها؛ در صورت نبود پوشه ساخته می‌شود.
pub fn backup_dir() -> Result<PathBuf, String> {
    let root = data_dir()?;
    let dir = root.join("backups");
    fs::create_dir_all(&dir).map_err(|error| format!("ساخت پوشه پشتیبان ناموفق بود: {error}"))?;
    Ok(dir)
}

/// مسیر داده‌های برنامه (بدون زیرپوشه پشتیبان).
pub fn data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "متغیر محیطی APPDATA یافت نشد.".to_string())?;
        let dir = PathBuf::from(appdata).join(APP_FOLDER);
        fs::create_dir_all(&dir).map_err(|error| format!("ساخت پوشه داده ناموفق بود: {error}"))?;
        return Ok(dir);
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "متغیر محیطی HOME یافت نشد.".to_string())?;
        let dir = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(APP_FOLDER);
        fs::create_dir_all(&dir).map_err(|error| format!("ساخت پوشه داده ناموفق بود: {error}"))?;
        return Ok(dir);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var("HOME").map_err(|_| "متغیر محیطی HOME یافت نشد.".to_string())?;
        let dir = PathBuf::from(home).join(".local").join("share").join(APP_FOLDER);
        fs::create_dir_all(&dir).map_err(|error| format!("ساخت پوشه داده ناموفق بود: {error}"))?;
        Ok(dir)
    }
}

/// جلوگیری از نوشتن خارج از پوشه پشتیبان یا فایل‌های غیرمجاز.
pub fn sanitize_file_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("نام پرونده پشتیبان خالی است.".into());
    }
    let invalid = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if trimmed.contains(invalid) || trimmed.contains("..") {
        return Err("نام پرونده پشتیبان نویسه غیرمجاز دارد.".into());
    }
    if !trimmed.to_ascii_lowercase().ends_with(".dastmozd") {
        return Err("پسوند پرونده پشتیبان باید dastmozd. باشد.".into());
    }
    Ok(trimmed.to_string())
}

/// نوشتن محتوای پشتیبان در پوشه پیش‌فرض.
pub fn save_backup(file_name: &str, contents: &str) -> Result<SavedBackup, String> {
    let name = sanitize_file_name(file_name)?;
    let path = backup_dir()?.join(&name);
    fs::write(&path, contents).map_err(|error| format!("ذخیره پشتیبان ناموفق بود: {error}"))?;
    let size = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
    Ok(SavedBackup {
        name,
        path: path.to_string_lossy().to_string(),
        size_bytes: size,
    })
}

/// خواندن محتوای یک پرونده پشتیبان برای بازگردانی.
pub fn read_backup(file_name: &str) -> Result<String, String> {
    let name = sanitize_file_name(file_name)?;
    let path = backup_dir()?.join(&name);
    fs::read_to_string(&path).map_err(|error| format!("خواندن پشتیبان ناموفق بود: {error}"))
}

/// حذف یک پرونده پشتیبان.
pub fn delete_backup(file_name: &str) -> Result<bool, String> {
    let name = sanitize_file_name(file_name)?;
    let path = backup_dir()?.join(&name);
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(&path).map_err(|error| format!("حذف پشتیبان ناموفق بود: {error}"))?;
    Ok(true)
}

/// فهرست پشتیبان‌های موجود، تازه‌ترین در ابتدا.
pub fn list_backups() -> Result<Vec<BackupEntry>, String> {
    let dir = backup_dir()?;
    let mut entries: Vec<BackupEntry> = Vec::new();
    let reader = fs::read_dir(&dir).map_err(|error| format!("خواندن پوشه پشتیبان ناموفق بود: {error}"))?;
    for item in reader.flatten() {
        let path = item.path();
        if path.extension().and_then(|value| value.to_str()) != Some("dastmozd") {
            continue;
        }
        let name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        let metadata = match item.metadata() {
            Ok(value) => value,
            Err(_) => continue,
        };
        let modified = metadata
            .modified()
            .ok()
            .map(|value| DateTime::<Local>::from(value).to_rfc3339())
            .unwrap_or_default();
        entries.push(BackupEntry {
            kind: kind_of(&name),
            name,
            path: path.to_string_lossy().to_string(),
            size_bytes: metadata.len(),
            modified_at: modified,
        });
    }
    entries.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(entries)
}

/// تشخیص نوع پشتیبان از نام پرونده (قرارداد: `dastmozd-YYYY-MM-DD-HHmm-<kind>.dastmozd`).
pub fn kind_of(file_name: &str) -> String {
    let lower = file_name.to_ascii_lowercase();
    if lower.contains("manual") || lower.contains("dasti") {
        return "manual".into();
    }
    if lower.contains("close") {
        return "on-close".into();
    }
    if lower.contains("daily") {
        return "daily".into();
    }
    "auto".into()
}

/// استخراج تاریخ (میلادی) از نام پرونده پشتیبان.
fn date_of(file_name: &str) -> Option<NaiveDate> {
    let digits: String = file_name
        .chars()
        .skip_while(|value| !value.is_ascii_digit())
        .take(10)
        .collect();
    NaiveDate::parse_from_str(&digits, "%Y-%m-%d").ok()
}

/// اجرای سیاست نگهداری: ۳۰ روزانه، ۱۲ ماهانه و ۵ سالانه.
pub fn prune(daily: usize, monthly: usize, yearly: usize) -> Result<PruneReport, String> {
    let dir = backup_dir()?;
    let mut candidates: Vec<(PathBuf, NaiveDate)> = Vec::new();
    let reader = fs::read_dir(&dir).map_err(|error| format!("خواندن پوشه پشتیبان ناموفق بود: {error}"))?;
    for item in reader.flatten() {
        let path = item.path();
        if path.extension().and_then(|value| value.to_str()) != Some("dastmozd") {
            continue;
        }
        let name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        if let Some(date) = date_of(&name) {
            candidates.push((path, date));
        }
    }
    // تازه‌ترین پرونده هر روز نگه داشته می‌شود و بقیه روزها حذف می‌شوند.
    candidates.sort_by(|left, right| right.1.cmp(&left.1));
    let today = Local::now().date_naive();
    let mut kept_days: Vec<NaiveDate> = Vec::new();
    let mut removed = 0usize;
    let mut kept = 0usize;

    let mut month_keys: Vec<(i32, u32)> = Vec::new();
    let mut year_keys: Vec<i32> = Vec::new();

    for (path, date) in candidates {
        let age_days = (today - date).num_days();
        let month_key = (date.year(), date.month());
        let year_key = date.year();

        let is_daily_kept = age_days < daily as i64 && !kept_days.contains(&date);
        let is_monthly_kept = !month_keys.contains(&month_key) && month_keys.len() < monthly;
        let is_yearly_kept = !year_keys.contains(&year_key) && year_keys.len() < yearly;

        if is_daily_kept || is_monthly_kept || is_yearly_kept {
            if is_daily_kept {
                kept_days.push(date);
            }
            if is_monthly_kept {
                month_keys.push(month_key);
            }
            if is_yearly_kept {
                year_keys.push(year_key);
            }
            kept += 1;
            continue;
        }

        match fs::remove_file(&path) {
            Ok(()) => removed += 1,
            Err(error) => log::warn!("حذف پشتیبان قدیمی ناموفق بود: {error}"),
        }
    }

    Ok(PruneReport { removed, kept })
}

/// استخراج مسیر پرونده‌های `.dastmozd` از آرگومان‌های خط فرمان (انجمن پرونده‌ها).
pub fn file_args(argv: &[String]) -> Vec<String> {
    argv.iter()
        .skip(1)
        .filter(|value| {
            let lower = value.to_ascii_lowercase();
            lower.ends_with(".dastmozd") && !value.starts_with('-')
        })
        .cloned()
        .collect()
}

/// بررسی وجود مسیر (برای بازگردانی پرونده انتخابی کاربر).
pub fn path_exists(path: &str) -> bool {
    Path::new(path).exists()
}
