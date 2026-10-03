// جلوگیری از باز شدن پنجره کنسول در ویندوز برای ساخت‌های رسمی.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dastmozd_lib::run()
}
