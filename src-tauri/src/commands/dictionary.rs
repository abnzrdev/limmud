use crate::dictionary::{
    self, DictionaryEntry, DictionaryRelation, DictionarySearchResult, DictionaryStatus,
};
use fs2::available_space;
use rusqlite::{Connection, OpenFlags};
use serde_json::json;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

fn dictionary_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("dictionary"))
        .map_err(|error| format!("Dictionary installation failed: {error}"))
}

fn installed_pack(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(dictionary_dir(app)?.join("dictionary.sqlite"))
}

#[tauri::command]
pub async fn dictionary_status(app: AppHandle) -> Result<DictionaryStatus, String> {
    let path = installed_pack(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if path.is_file() {
            dictionary::validate_pack(&path)
        } else {
            Ok(DictionaryStatus {
                installed: false,
                pack_version: None,
                source_date: None,
                entry_count: 0,
                database_size_bytes: 0,
                sources: vec![],
            })
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn dictionary_import_pack(
    app: AppHandle,
    source_path: String,
) -> Result<DictionaryStatus, String> {
    let directory = dictionary_dir(&app)?;
    let destination = directory.join("dictionary.sqlite");
    tauri::async_runtime::spawn_blocking(move || {
        install_pack(Path::new(&source_path), &directory, &destination)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn install_pack(
    source: &Path,
    directory: &Path,
    destination: &Path,
) -> Result<DictionaryStatus, String> {
    let source = source
        .canonicalize()
        .map_err(|error| format!("Invalid dictionary pack: {error}"))?;
    let source_status = dictionary::validate_pack(&source)?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Dictionary installation failed: {error}"))?;
    if available_space(directory)
        .map_err(|error| format!("Dictionary installation failed: {error}"))?
        < source_status.database_size_bytes.saturating_add(1_048_576)
    {
        return Err("Not enough disk space".into());
    }
    let temporary = directory.join("dictionary.sqlite.tmp");
    let result = (|| {
        fs::copy(&source, &temporary)
            .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        let status = dictionary::validate_pack(&temporary)?;
        fs::rename(&temporary, destination)
            .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        fs::write(
            directory.join("metadata.json"),
            serde_json::to_vec_pretty(&json!({
                "schemaVersion": dictionary::DICTIONARY_SCHEMA_VERSION,
                "entryCount": status.entry_count,
                "sources": status.sources,
            }))
            .unwrap(),
        )
        .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        let licenses = directory.join("licenses");
        fs::create_dir_all(&licenses)
            .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        fs::write(licenses.join("KAIKKI-WIKTIONARY.txt"), "Wiktionary content: CC BY-SA and GFDL. Attribution: Wiktionary contributors; extraction by Wiktextract/Kaikki.org.\n")
            .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        if status
            .sources
            .iter()
            .any(|source| source.source_key == "open-english-wordnet-2025")
        {
            fs::write(licenses.join("OPEN-ENGLISH-WORDNET.txt"), "Open English WordNet 2025 is licensed under CC BY 4.0. Attribution: Open English WordNet Community.\n")
                .map_err(|error| format!("Dictionary installation failed: {error}"))?;
        }
        Ok(status)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[tauri::command]
pub async fn dictionary_remove_pack(app: AppHandle) -> Result<(), String> {
    let directory = dictionary_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if directory.exists() {
            fs::remove_dir_all(directory)
                .map_err(|error| format!("Dictionary removal failed: {error}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn dictionary_search(
    app: AppHandle,
    query: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<DictionarySearchResult>, String> {
    let path = installed_pack(&app)?;
    tauri::async_runtime::spawn_blocking(move || dictionary::search(&path, &query, limit, offset))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn dictionary_lookup(
    app: AppHandle,
    query: String,
) -> Result<Vec<DictionarySearchResult>, String> {
    dictionary_search(app, query, 30, 0).await
}

#[tauri::command]
pub async fn dictionary_get_entry(
    app: AppHandle,
    entry_id: i64,
) -> Result<DictionaryEntry, String> {
    let path = installed_pack(&app)?;
    tauri::async_runtime::spawn_blocking(move || dictionary::get_entry(&path, entry_id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn dictionary_get_related_words(
    app: AppHandle,
    entry_id: i64,
    limit: u32,
    offset: u32,
) -> Result<Vec<DictionaryRelation>, String> {
    if !(1..=100).contains(&limit) || offset > 10_000 {
        return Err("Invalid relation range".into());
    }
    let mut values = dictionary_get_entry(app, entry_id).await?.related_words;
    Ok(values
        .drain(..)
        .skip(offset as usize)
        .take(limit as usize)
        .collect())
}

#[tauri::command]
pub async fn dictionary_get_random_words(
    app: AppHandle,
    limit: u32,
) -> Result<Vec<DictionarySearchResult>, String> {
    if !(1..=30).contains(&limit) {
        return Err("Invalid random word limit".into());
    }
    let path = installed_pack(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        dictionary::validate_pack(&path)?;
        let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
        let mut stmt = db.prepare("SELECT e.id,e.headword,e.part_of_speech,COALESCE((SELECT definition FROM senses WHERE entry_id=e.id ORDER BY sense_order LIMIT 1),''),ds.source_name FROM entries e JOIN dictionary_sources ds ON ds.id=e.source_id ORDER BY random() LIMIT ?1").map_err(|e| e.to_string())?;
        let values = stmt.query_map([limit], |row| Ok(DictionarySearchResult { entry_id: row.get(0)?, headword: row.get(1)?, part_of_speech: row.get(2)?, short_definition: row.get(3)?, matched_form: None, source: row.get(4)? })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        Ok(values)
    }).await.map_err(|error| error.to_string())?
}
