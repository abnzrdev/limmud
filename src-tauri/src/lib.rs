pub mod commands;
pub mod dictionary;
pub mod errors;
pub mod fs_paths;
pub mod media_server;
pub mod models;
pub mod persistence;
pub mod scanner;
pub mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let terminal_state = terminal::TerminalState::default();
    let cleanup_state = terminal_state.clone();
    tauri::Builder::default()
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
