use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseRecord {
    pub course_id: String,
    pub display_name: String,
    pub access: String,
    pub entries: Vec<serde_json::Value>,
    pub warning_count: u32,
}

impl CourseRecord {
    pub fn access_required(course_id: impl Into<String>) -> Self {
        Self {
            course_id: course_id.into(),
            display_name: "Saved course".into(),
            access: "accessRequired".into(),
            entries: Vec::new(),
            warning_count: 0,
        }
    }
}

pub fn opaque_entry_id(course_id: &str, provider_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(course_id.as_bytes());
    hasher.update([0]);
    hasher.update(provider_id.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(mobile)]
mod mobile_plugin {
    use serde::{de::DeserializeOwned, Deserialize, Serialize};
    use tauri::{
        plugin::{Builder, PluginApi, PluginHandle, TauriPlugin},
        AppHandle, Manager, Runtime,
    };

    #[derive(Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct EmptyArgs {}

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct CourseArgs {
        course_id: String,
    }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct EntryArgs {
        course_id: String,
        entry_id: String,
        #[serde(default)]
        generation: u32,
    }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct SourceArgs { source_id: String }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct NoteSaveArgs {
        course_id: String,
        entry_id: String,
        contents: String,
        expected_checksum: Option<String>,
    }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct StateSaveArgs {
        course_id: String,
        file: String,
        contents_json: String,
        expected_revision: Option<String>,
    }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct PictureInPictureArgs { width: u32, height: u32 }

    #[derive(Debug, Deserialize, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct PlaybackStateArgs {
        state: String,
        position_seconds: f64,
        duration_seconds: f64,
        can_previous: bool,
        can_next: bool,
    }

    pub struct SafCourse<R: Runtime>(PluginHandle<R>);

    fn init_mobile<R: Runtime, C: DeserializeOwned>(
        _app: &AppHandle<R>,
        api: PluginApi<R, C>,
    ) -> Result<SafCourse<R>, Box<dyn std::error::Error>> {
        #[cfg(target_os = "android")]
        let handle = api.register_android_plugin("com.abnzr.safcourse", "SafCoursePlugin")?;
        #[cfg(not(target_os = "android"))]
        compile_error!("saf-course currently supports Android only");
        Ok(SafCourse(handle))
    }

    fn call<R: Runtime, P: Serialize>(
        app: &AppHandle<R>,
        command: &str,
        payload: P,
    ) -> Result<serde_json::Value, String> {
        app.state::<SafCourse<R>>()
            .0
            .run_mobile_plugin(command, payload)
            .map_err(|_| "Course access is unavailable.".to_string())
    }

    #[tauri::command]
    async fn pick_course<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
        call(&app, "pickCourse", EmptyArgs {})
    }

    #[tauri::command]
    async fn restore_courses<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
        let response = call(&app, "restoreCourses", EmptyArgs {})?;
        response.get("courses").cloned().ok_or_else(|| "Course access is unavailable.".to_string())
    }

    #[tauri::command]
    async fn scan_course<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<serde_json::Value, String> {
        call(&app, "scanCourse", CourseArgs { course_id })
    }

    #[tauri::command]
    async fn relink_course<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<serde_json::Value, String> {
        call(&app, "relinkCourse", CourseArgs { course_id })
    }

    #[tauri::command]
    async fn upgrade_course_access<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<serde_json::Value, String> {
        call(&app, "upgradeCourseAccess", CourseArgs { course_id })
    }

    #[tauri::command]
    async fn prepare_media<R: Runtime>(app: AppHandle<R>, course_id: String, entry_id: String) -> Result<serde_json::Value, String> {
        call(&app, "prepareMedia", EntryArgs { course_id, entry_id, generation: 0 })
    }

    #[tauri::command]
    async fn release_media<R: Runtime>(app: AppHandle<R>, source_id: String) -> Result<serde_json::Value, String> {
        call(&app, "releaseMedia", SourceArgs { source_id })
    }

    #[tauri::command]
    async fn read_subtitle<R: Runtime>(app: AppHandle<R>, course_id: String, entry_id: String, generation: u32) -> Result<serde_json::Value, String> {
        call(&app, "readSubtitle", EntryArgs { course_id, entry_id, generation })
    }

    #[tauri::command]
    async fn load_lesson_note<R: Runtime>(app: AppHandle<R>, course_id: String, entry_id: String) -> Result<serde_json::Value, String> {
        call(&app, "loadLessonNote", EntryArgs { course_id, entry_id, generation: 0 })
    }

    #[tauri::command]
    async fn save_lesson_note<R: Runtime>(app: AppHandle<R>, course_id: String, entry_id: String, contents: String, expected_checksum: Option<String>) -> Result<serde_json::Value, String> {
        call(&app, "saveLessonNote", NoteSaveArgs { course_id, entry_id, contents, expected_checksum })
    }

    #[tauri::command]
    async fn save_lesson_draft<R: Runtime>(app: AppHandle<R>, course_id: String, entry_id: String, contents: String, expected_checksum: Option<String>) -> Result<serde_json::Value, String> {
        call(&app, "saveLessonDraft", NoteSaveArgs { course_id, entry_id, contents, expected_checksum })
    }

    #[tauri::command]
    async fn load_course_state<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<serde_json::Value, String> {
        call(&app, "loadCourseState", CourseArgs { course_id })
    }

    #[tauri::command]
    async fn load_course_state_sources<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<serde_json::Value, String> {
        call(&app, "loadCourseStateSources", CourseArgs { course_id })
    }

    #[tauri::command]
    async fn clear_local_course_state<R: Runtime>(app: AppHandle<R>, course_id: String) -> Result<(), String> {
        call(&app, "clearLocalCourseState", CourseArgs { course_id }).map(|_| ())
    }

    #[tauri::command]
    async fn save_course_state_file<R: Runtime>(
        app: AppHandle<R>,
        course_id: String,
        file: String,
        contents_json: String,
        expected_revision: Option<String>,
    ) -> Result<serde_json::Value, String> {
        call(&app, "saveCourseStateFile", StateSaveArgs { course_id, file, contents_json, expected_revision })
    }

    #[tauri::command]
    async fn pick_dictionary_pack<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
        call(&app, "pickDictionaryPack", EmptyArgs {})
    }

    #[tauri::command]
    async fn enter_picture_in_picture<R: Runtime>(app: AppHandle<R>, width: u32, height: u32) -> Result<serde_json::Value, String> {
        call(&app, "enterPictureInPicture", PictureInPictureArgs { width, height })
    }

    #[tauri::command]
    async fn update_android_playback<R: Runtime>(
        app: AppHandle<R>, state: String, position_seconds: f64, duration_seconds: f64,
        can_previous: bool, can_next: bool,
    ) -> Result<serde_json::Value, String> {
        call(&app, "updateAndroidPlayback", PlaybackStateArgs { state, position_seconds, duration_seconds, can_previous, can_next })
    }

    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("saf-course")
            .invoke_handler(tauri::generate_handler![
                pick_course, restore_courses, scan_course, relink_course, upgrade_course_access,
                prepare_media, release_media, read_subtitle, load_lesson_note, save_lesson_note, save_lesson_draft,
                load_course_state, load_course_state_sources, clear_local_course_state, save_course_state_file, pick_dictionary_pack,
                enter_picture_in_picture, update_android_playback,
            ])
            .setup(|app, api| {
                app.manage(init_mobile(app, api)?);
                Ok(())
            })
            .build()
    }
}

#[cfg(mobile)]
pub use mobile_plugin::init;

#[cfg(test)]
mod tests {
    use super::{opaque_entry_id, CourseRecord};

    #[test]
    fn course_record_uses_camel_case_without_storage_identifiers() {
        let value = serde_json::to_value(CourseRecord::access_required("course-safe")).unwrap();
        assert_eq!(value["courseId"], "course-safe");
        assert_eq!(value["access"], "accessRequired");
        assert!(value.get("treeUri").is_none());
        assert!(value.get("documentId").is_none());
    }

    #[test]
    fn opaque_entry_identity_does_not_reveal_provider_identity() {
        let id = opaque_entry_id("course-safe", "provider-secret-document");
        assert!(!id.contains("provider-secret-document"));
        assert!(!id.contains("course-safe"));
        assert_eq!(id.len(), 64);
    }
}
