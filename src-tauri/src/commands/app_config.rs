use std::collections::BTreeMap;

#[tauri::command]
pub fn read_app_config() -> Result<BTreeMap<String, String>, String> {
    crate::persistence::read_json_map(&crate::fs_paths::app_config_file())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_app_config(state: BTreeMap<String, String>) -> Result<(), String> {
    crate::persistence::write_json_map(&crate::fs_paths::app_config_file(), &state)
        .map_err(|error| error.to_string())
}
