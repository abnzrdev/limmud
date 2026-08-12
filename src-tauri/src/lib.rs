#[cfg(not(mobile))]
pub mod commands;
#[cfg(not(mobile))]
pub mod course_covers;
pub mod dictionary;
#[cfg(not(mobile))]
pub mod errors;
#[cfg(not(mobile))]
pub mod fs_paths;
#[cfg(not(mobile))]
pub mod media_server;
#[cfg(mobile)]
pub mod mobile_dictionary;
#[cfg(not(mobile))]
pub mod models;
#[cfg(not(mobile))]
pub mod persistence;
#[cfg(not(mobile))]
pub mod scanner;
#[cfg(not(mobile))]
pub mod terminal;

#[cfg(all(debug_assertions, not(mobile)))]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(mobile)]
    tauri::Builder::default()
        .plugin(tauri_plugin_saf_course::init())
        .invoke_handler(tauri::generate_handler![
            mobile_dictionary::mobile_dictionary_status,
            mobile_dictionary::mobile_dictionary_install_pending,
            mobile_dictionary::mobile_dictionary_search,
            mobile_dictionary::mobile_dictionary_get_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Limmud mobile");

    #[cfg(not(mobile))]
    run_desktop();
}

#[cfg(not(mobile))]
fn run_desktop() {
    let terminal_state = terminal::TerminalState::default();
    let cleanup_state = terminal_state.clone();
    tauri::Builder::default()
        // Limmud debug DevTools
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            #[cfg(not(debug_assertions))]
            let _ = app;

            Ok(())
        })
        .manage(terminal_state)
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::attachments::import_attachment,
            commands::attachments::import_lesson_resources,
            commands::attachments::open_resource,
            commands::attachments::read_lesson_resources,
            commands::app_config::read_app_config,
            commands::app_config::write_app_config,
            commands::app_config::install_course_cover,
            commands::app_config::remove_course_cover,
            commands::course::scan_course,
            commands::course::read_course_state,
            commands::course::write_course_state,
            commands::dictionary::dictionary_status,
            commands::dictionary::dictionary_import_pack,
            commands::dictionary::dictionary_remove_pack,
            commands::dictionary::dictionary_search,
            commands::dictionary::dictionary_lookup,
            commands::dictionary::dictionary_get_entry,
            commands::dictionary::dictionary_get_related_words,
            commands::dictionary::dictionary_get_random_words,
            commands::notes::read_note,
            commands::notes::read_editable_text_file,
            commands::notes::write_editable_text_file,
            commands::notes::write_note,
            commands::notes::read_recovery_drafts,
            commands::notes::write_recovery_draft,
            commands::notes::remove_recovery_draft,
            commands::open_external::open_lesson_external,
            commands::open_external::open_lesson_folder,
            commands::vocabulary::vocabulary_list,
            commands::vocabulary::vocabulary_save,
            commands::vocabulary::vocabulary_update,
            commands::vocabulary::vocabulary_remove,
            media_server::course_media_url,
            terminal::terminal_start,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::terminal_restart
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                cleanup_state.close_all();
            }
        });
}
