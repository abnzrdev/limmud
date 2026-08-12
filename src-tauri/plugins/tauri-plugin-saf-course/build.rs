const COMMANDS: &[&str] = &[
    "pick_course", "restore_courses", "scan_course", "relink_course", "upgrade_course_access",
    "prepare_media", "release_media", "read_subtitle", "load_lesson_note", "save_lesson_note", "save_lesson_draft",
    "load_course_state", "load_course_state_sources", "clear_local_course_state", "save_course_state_file",
    "pick_dictionary_pack",
    "enter_picture_in_picture", "update_android_playback",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
