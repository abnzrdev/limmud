use crate::dictionary::{self, DictionaryEntry, DictionarySearchResult, DictionaryStatus};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(dictionary_directory)
        .map_err(|_| "Offline dictionary storage is unavailable.".to_string())
}

fn dictionary_directory(app_data: PathBuf) -> PathBuf {
    app_data.join("files").join("dictionary")
}

fn installed(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(directory(app)?.join("dictionary.sqlite"))
}

#[tauri::command]
pub async fn mobile_dictionary_status(app: AppHandle) -> Result<DictionaryStatus, String> {
    let path = installed(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if !path.is_file() {
            return Ok(DictionaryStatus {
                installed: false,
                pack_version: None,
                source_date: None,
                entry_count: 0,
                database_size_bytes: 0,
                sources: vec![],
            });
        }
        dictionary::validate_pack(&path)
            .map_err(|_| "The installed dictionary pack is unavailable.".to_string())
    })
    .await
    .map_err(|_| "Offline dictionary status is unavailable.".to_string())?
}

#[tauri::command]
pub async fn mobile_dictionary_install_pending(app: AppHandle) -> Result<DictionaryStatus, String> {
    let directory = directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || install_pending(directory))
        .await
        .map_err(|_| "Dictionary pack could not be installed.".to_string())?
}

fn install_pending(directory: PathBuf) -> Result<DictionaryStatus, String> {
    let pending = directory.join("dictionary.sqlite.pending");
    let installed = directory.join("dictionary.sqlite");
    let backup = directory.join("dictionary.sqlite.previous");
    dictionary::validate_pack(&pending)
        .map_err(|_| "Dictionary pack is invalid or unsupported.".to_string())?;
    if backup.exists() {
        fs::remove_file(&backup)
            .map_err(|_| "Dictionary pack could not be installed.".to_string())?;
    }
    if installed.exists() {
        fs::rename(&installed, &backup)
            .map_err(|_| "Dictionary pack could not be installed.".to_string())?;
    }
    if fs::rename(&pending, &installed).is_err() {
        if backup.exists() {
            let _ = fs::rename(&backup, &installed);
        }
        return Err("Dictionary pack could not be installed.".into());
    }
    match dictionary::validate_pack(&installed) {
        Ok(status) => {
            if backup.exists() {
                let _ = fs::remove_file(&backup);
            }
            Ok(status)
        }
        Err(_) => {
            let _ = fs::remove_file(&installed);
            if backup.exists() {
                let _ = fs::rename(&backup, &installed);
            }
            Err("Dictionary pack verification failed; the previous pack was preserved.".into())
        }
    }
}

#[tauri::command]
pub async fn mobile_dictionary_search(
    app: AppHandle,
    query: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<DictionarySearchResult>, String> {
    let path = installed(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        dictionary::search(&path, &query, limit, offset)
            .map_err(|_| "Offline dictionary search failed.".to_string())
    })
    .await
    .map_err(|_| "Offline dictionary search failed.".to_string())?
}

#[tauri::command]
pub async fn mobile_dictionary_get_entry(
    app: AppHandle,
    entry_id: i64,
) -> Result<DictionaryEntry, String> {
    let path = installed(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        dictionary::get_entry(&path, entry_id)
            .map_err(|_| "Offline dictionary entry is unavailable.".to_string())
    })
    .await
    .map_err(|_| "Offline dictionary entry is unavailable.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::{dictionary_directory, install_pending};
    use std::{fs, path::PathBuf};

    #[test]
    fn missing_pending_pack_does_not_replace_existing_file() {
        let directory =
            std::env::temp_dir().join(format!("limmud-dictionary-test-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let installed = directory.join("dictionary.sqlite");
        fs::write(&installed, b"existing-safe-pack").unwrap();

        assert!(install_pending(PathBuf::from(&directory)).is_err());
        assert_eq!(fs::read(&installed).unwrap(), b"existing-safe-pack");

        let _ = fs::remove_file(&installed);
        let _ = fs::remove_dir(&directory);
    }

    #[test]
    fn android_dictionary_directory_matches_kotlin_files_dir() {
        assert_eq!(
            dictionary_directory(PathBuf::from("/app-data")),
            PathBuf::from("/app-data/files/dictionary")
        );
    }
}
