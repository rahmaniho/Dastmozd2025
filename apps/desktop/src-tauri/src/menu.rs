//! منوی بومی فارسی و آیکون سینی سیستم.
//!
//! هر فرمان منو به‌صورت رویداد `dastmozd:menu` با شناسه فرمان به رابط کاربری
//! فرستاده می‌شود؛ رابط کاربری مسئول ناوبری و اجرای عملیات است.

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// ساخت و نصب منوی اصلی برنامه.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let new_employee = MenuItemBuilder::with_id("new-employee", "کارمند جدید")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let new_payroll = MenuItemBuilder::with_id("new-payroll", "دوره حقوق جدید")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let quick_backup = MenuItemBuilder::with_id("quick-backup", "پشتیبان‌گیری سریع (Ctrl+B)")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;
    let restore_backup = MenuItemBuilder::with_id("restore-backup", "بازگردانی از پشتیبان…").build(app)?;

    let file_menu = SubmenuBuilder::new(app, "پرونده")
        .item(&new_employee)
        .item(&new_payroll)
        .separator()
        .item(&quick_backup)
        .item(&restore_backup)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("بستن پنجره"))?)
        .item(&PredefinedMenuItem::quit(app, Some("خروج"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "ویرایش")
        .item(&PredefinedMenuItem::undo(app, Some("واگرد"))?)
        .item(&PredefinedMenuItem::redo(app, Some("ازنو"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("برش"))?)
        .item(&PredefinedMenuItem::copy(app, Some("رونوشت"))?)
        .item(&PredefinedMenuItem::paste(app, Some("چسباندن"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("انتخاب همه"))?)
        .build()?;

    let zoom_in = MenuItemBuilder::with_id("zoom-in", "بزرگ‌نمایی").accelerator("CmdOrCtrl+Plus").build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom-out", "کوچک‌نمایی").accelerator("CmdOrCtrl+-").build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "اندازه واقعی").accelerator("CmdOrCtrl+0").build(app)?;
    let reload = MenuItemBuilder::with_id("reload", "بازخوانی").accelerator("CmdOrCtrl+Shift+R").build(app)?;

    let view_menu = SubmenuBuilder::new(app, "نمایش")
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, Some("تمام‌صفحه"))?)
        .item(&reload)
        .build()?;

    let payslips = MenuItemBuilder::with_id("report-payslips", "فیش‌های حقوقی").build(app)?;
    let insurance = MenuItemBuilder::with_id("report-insurance", "دیسکت بیمه تأمین اجتماعی").build(app)?;
    let tax = MenuItemBuilder::with_id("report-tax", "لیست مالیات حقوق").build(app)?;
    let monthly = MenuItemBuilder::with_id("report-monthly", "گزارش ماهانه حقوق").build(app)?;

    let reports_menu = SubmenuBuilder::new(app, "گزارش‌ها")
        .item(&payslips)
        .item(&insurance)
        .item(&tax)
        .separator()
        .item(&monthly)
        .build()?;

    let user_guide = MenuItemBuilder::with_id("user-guide", "راهنمای کاربر")
        .accelerator("F1")
        .build(app)?;
    let check_update = MenuItemBuilder::with_id("check-update", "بررسی به‌روزرسانی…").build(app)?;
    let about = MenuItemBuilder::with_id("about", "درباره دستمزد آرمانی").build(app)?;

    let help_menu = SubmenuBuilder::new(app, "راهنما")
        .item(&user_guide)
        .item(&check_update)
        .separator()
        .item(&about)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &edit_menu, &view_menu, &reports_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;

    let handle = app.clone();
    app.on_menu_event(move |_app, event| {
        let id = event.id().as_ref().to_string();
        if let Err(error) = handle.emit("dastmozd:menu", id) {
            log::warn!("ارسال رویداد منو ناموفق بود: {error}");
        }
    });

    Ok(())
}

/// ساخت آیکون سینی سیستم با منوی فارسی.
pub fn install_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("tray-show", "نمایش پنجره اصلی").build(app)?;
    let quick_backup = MenuItemBuilder::with_id("tray-backup", "پشتیبان‌گیری سریع").build(app)?;
    let quit = MenuItemBuilder::with_id("tray-quit", "خروج از برنامه").build(app)?;

    let tray_menu = Menu::with_items(app, &[&show, &quick_backup, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("دستمزد آرمانی ۱۴۰۵")
        .menu(&tray_menu)
        .show_menu_on_left_click(false);

    // نگاره پیش‌فرض پنجره به‌عنوان نماد سینی استفاده می‌شود.
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.on_menu_event(|app, event| match event.id().as_ref() {
            "tray-show" => focus_main(app),
            "tray-backup" => {
                let _ = app.emit("dastmozd:menu", "quick-backup");
                focus_main(app);
            }
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            }
            | TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// نمایش، بازگرداندن از کوچک‌شدگی و فعال‌سازی پنجره اصلی.
pub fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
