use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
use std::{collections::HashSet, path::Path};

pub const DICTIONARY_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionarySourceInfo {
    pub source_key: String,
    pub source_name: String,
    pub source_version: String,
    pub source_date: Option<String>,
    pub license_name: String,
    pub attribution: String,
    pub homepage: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryStatus {
    pub installed: bool,
    pub pack_version: Option<String>,
    pub source_date: Option<String>,
    pub entry_count: i64,
    pub database_size_bytes: u64,
    pub sources: Vec<DictionarySourceInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionarySearchResult {
    pub entry_id: i64,
    pub headword: String,
    pub part_of_speech: String,
    pub short_definition: String,
    pub matched_form: Option<String>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pronunciation {
    pub ipa: Option<String>,
    pub region: Option<String>,
    pub audio_filename: Option<String>,
    pub audio_available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionarySense {
    pub order: i64,
    pub definition: String,
    pub tags: Vec<String>,
    pub examples: Vec<String>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryPartOfSpeech {
    pub name: String,
    pub senses: Vec<DictionarySense>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryForm {
    pub form: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryRelation {
    pub relation_type: String,
    pub target_word: String,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryEntry {
    pub id: i64,
    pub headword: String,
    pub pronunciations: Vec<Pronunciation>,
    pub parts_of_speech: Vec<DictionaryPartOfSpeech>,
    pub etymology: Option<String>,
    pub forms: Vec<DictionaryForm>,
    pub related_words: Vec<DictionaryRelation>,
    pub sources: Vec<DictionarySourceInfo>,
}

fn open_readonly(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("Dictionary query failed: {error}"))
}

fn source_rows(db: &Connection) -> Result<Vec<DictionarySourceInfo>, String> {
    let mut statement = db
        .prepare("SELECT source_key, source_name, source_version, source_date, license_name, attribution, homepage FROM dictionary_sources ORDER BY id")
        .map_err(|error| error.to_string())?;
    let sources = statement
        .query_map([], |row| {
            Ok(DictionarySourceInfo {
                source_key: row.get(0)?,
                source_name: row.get(1)?,
                source_version: row.get(2)?,
                source_date: row.get(3)?,
                license_name: row.get(4)?,
                attribution: row.get(5)?,
                homepage: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(sources)
}

pub fn validate_pack(path: &Path) -> Result<DictionaryStatus, String> {
    if !path.is_file() {
        return Err("No dictionary pack is installed".into());
    }
    let db = open_readonly(path)?;
    let integrity: String = db
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| "Dictionary database is corrupt".to_string())?;
    if integrity != "ok" {
        return Err("Dictionary database is corrupt".into());
    }
    let schema: i64 = db
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM pack_metadata WHERE key='schema_version'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Invalid dictionary pack".to_string())?;
    if schema != DICTIONARY_SCHEMA_VERSION {
        return Err(format!("Unsupported schema version {schema}"));
    }
    let complete: String = db
        .query_row(
            "SELECT value FROM pack_metadata WHERE key='build_complete'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Invalid dictionary pack".to_string())?;
    if complete != "1" {
        return Err("Invalid dictionary pack: build is incomplete".into());
    }
    let sources = source_rows(&db)?;
    if sources.is_empty()
        || sources.iter().any(|source| {
            source.license_name.trim().is_empty() || source.attribution.trim().is_empty()
        })
    {
        return Err("Invalid dictionary pack: source license metadata is missing".into());
    }
    let source_schema_mismatch: i64 = db
        .query_row(
            "SELECT count(*) FROM dictionary_sources WHERE schema_version<>?1",
            [DICTIONARY_SCHEMA_VERSION],
            |row| row.get(0),
        )
        .map_err(|_| "Invalid dictionary pack".to_string())?;
    let kaikki = sources
        .iter()
        .find(|source| source.source_key == "kaikki-wiktionary")
        .ok_or("Invalid dictionary pack: Kaikki source metadata is missing")?;
    if source_schema_mismatch != 0
        || !kaikki.license_name.contains("CC BY-SA")
        || !kaikki.license_name.contains("GFDL")
    {
        return Err(
            "Invalid dictionary pack: source schema or license metadata is unsupported".into(),
        );
    }
    if let Some(wordnet) = sources
        .iter()
        .find(|source| source.source_key == "open-english-wordnet-2025")
    {
        if wordnet.source_version != "2025" || wordnet.license_name != "CC BY 4.0" {
            return Err(
                "Invalid dictionary pack: Open English WordNet release or license is unsupported"
                    .into(),
            );
        }
    }
    let entry_count = db
        .query_row("SELECT count(*) FROM entries", [], |row| row.get(0))
        .map_err(|_| "Invalid dictionary pack".to_string())?;
    let pack_version = db
        .query_row(
            "SELECT value FROM pack_metadata WHERE key='pack_version'",
            [],
            |row| row.get(0),
        )
        .ok();
    let source_date = sources
        .iter()
        .filter_map(|source| source.source_date.clone())
        .max();
    Ok(DictionaryStatus {
        installed: true,
        pack_version,
        source_date,
        entry_count,
        database_size_bytes: path.metadata().map(|value| value.len()).unwrap_or(0),
        sources,
    })
}

pub fn search(
    path: &Path,
    query: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<DictionarySearchResult>, String> {
    let query = query.trim();
    if query.is_empty()
        || query.chars().count() > 80
        || !(1..=30).contains(&limit)
        || offset > 10_000
    {
        return Err("Invalid dictionary search parameters".into());
    }
    validate_pack(path)?;
    let db = open_readonly(path)?;
    let normalized = query.to_lowercase();
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    let mut add_query = |sql: &str, value: &str| -> Result<(), String> {
        let mut statement = db.prepare(sql).map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![value, limit + offset], |row| {
                Ok(DictionarySearchResult {
                    entry_id: row.get(0)?,
                    headword: row.get(1)?,
                    part_of_speech: row.get(2)?,
                    short_definition: row.get(3)?,
                    matched_form: row.get(4)?,
                    source: row.get(5)?,
                })
            })
            .map_err(|error| error.to_string())?;
        for row in rows {
            let row = row.map_err(|error| error.to_string())?;
            if seen.insert(row.entry_id) {
                results.push(row);
            }
        }
        Ok(())
    };
    let base = "SELECT e.id,e.headword,e.part_of_speech,COALESCE((SELECT definition FROM senses WHERE entry_id=e.id ORDER BY sense_order LIMIT 1),''),NULL,ds.source_name FROM entries e JOIN dictionary_sources ds ON ds.id=e.source_id WHERE e.normalized_headword=?1 ORDER BY e.id LIMIT ?2";
    add_query(base, &normalized)?;
    add_query("SELECT e.id,e.headword,e.part_of_speech,COALESCE((SELECT definition FROM senses WHERE entry_id=e.id ORDER BY sense_order LIMIT 1),''),f.form,ds.source_name FROM forms f JOIN entries e ON e.id=f.entry_id JOIN dictionary_sources ds ON ds.id=e.source_id WHERE f.normalized_form=?1 ORDER BY e.id LIMIT ?2", &normalized)?;
    add_query("SELECT e.id,e.headword,e.part_of_speech,COALESCE((SELECT definition FROM senses WHERE entry_id=e.id ORDER BY sense_order LIMIT 1),''),NULL,ds.source_name FROM entries e JOIN dictionary_sources ds ON ds.id=e.source_id WHERE e.normalized_headword LIKE (?1 || '%') ORDER BY length(e.headword),e.id LIMIT ?2", &normalized)?;
    let fts = normalized
        .split_whitespace()
        .map(|part| format!("\"{}\"", part.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ");
    add_query("SELECT e.id,e.headword,e.part_of_speech,COALESCE((SELECT definition FROM senses WHERE entry_id=e.id ORDER BY sense_order LIMIT 1),''),NULL,ds.source_name FROM dictionary_fts f JOIN entries e ON e.id=f.entry_id JOIN dictionary_sources ds ON ds.id=e.source_id WHERE dictionary_fts MATCH ?1 ORDER BY rank LIMIT ?2", &fts)?;
    Ok(results
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect())
}

pub fn get_entry(path: &Path, entry_id: i64) -> Result<DictionaryEntry, String> {
    if entry_id <= 0 {
        return Err("Invalid dictionary entry".into());
    }
    validate_pack(path)?;
    let db = open_readonly(path)?;
    let (headword, pos, etymology, source_id): (String, String, Option<String>, i64) = db
        .query_row(
            "SELECT headword,part_of_speech,etymology_text,source_id FROM entries WHERE id=?1",
            [entry_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "No offline dictionary entry found".to_string())?;
    let mut senses_stmt = db.prepare("SELECT id,sense_order,definition,tags_json FROM senses WHERE entry_id=?1 ORDER BY sense_order").map_err(|e| e.to_string())?;
    let senses = senses_stmt
        .query_map([entry_id], |row| {
            let sense_id: i64 = row.get(0)?;
            let examples = {
                let mut stmt =
                    db.prepare("SELECT example_text FROM examples WHERE sense_id=?1 ORDER BY id")?;
                let values = stmt
                    .query_map([sense_id], |example| example.get(0))?
                    .collect::<Result<Vec<String>, _>>()?;
                values
            };
            let tags_json: String = row.get(3)?;
            Ok(DictionarySense {
                order: row.get(1)?,
                definition: row.get(2)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                examples,
                source: "Wiktionary / Kaikki".into(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let collect = |sql: &str,
                   mapper: fn(&rusqlite::Row<'_>) -> rusqlite::Result<DictionaryRelation>|
     -> Result<Vec<DictionaryRelation>, String> {
        let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
        let values = stmt
            .query_map([entry_id], mapper)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(values)
    };
    let mut related_words = collect("SELECT relation_type,target_word,'Wiktionary / Kaikki' FROM relations WHERE entry_id=?1 ORDER BY relation_type,id", |row| Ok(DictionaryRelation { relation_type: row.get(0)?, target_word: row.get(1)?, source: row.get(2)? }))?;
    let mut forms_stmt = db
        .prepare("SELECT form,form_tags_json FROM forms WHERE entry_id=?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let forms = forms_stmt
        .query_map([entry_id], |row| {
            let tags: String = row.get(1)?;
            Ok(DictionaryForm {
                form: row.get(0)?,
                tags: serde_json::from_str(&tags).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut pronunciation_stmt = db.prepare("SELECT ipa,region,audio_filename,audio_available FROM pronunciations WHERE entry_id=?1 ORDER BY id").map_err(|e| e.to_string())?;
    let pronunciations = pronunciation_stmt
        .query_map([entry_id], |row| {
            Ok(Pronunciation {
                ipa: row.get(0)?,
                region: row.get(1)?,
                audio_filename: row.get(2)?,
                audio_available: row.get::<_, i64>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let all_sources = source_rows(&db)?;
    let mut sources: Vec<_> = all_sources
        .iter()
        .filter(|source| {
            db.query_row(
                "SELECT source_key FROM dictionary_sources WHERE id=?1",
                [source_id],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .as_deref()
                == Some(source.source_key.as_str())
        })
        .cloned()
        .collect();
    let normalized = headword.to_lowercase();
    let mut wordnet_stmt = db.prepare("SELECT ws.id,ws.part_of_speech,ws.definition FROM wordnet_synsets ws JOIN wordnet_lemmas wl ON wl.synset_id=ws.id WHERE wl.normalized_lemma=?1 ORDER BY ws.id").map_err(|e| e.to_string())?;
    let wordnet = wordnet_stmt
        .query_map([&normalized], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut parts_of_speech = vec![DictionaryPartOfSpeech { name: pos, senses }];
    for (synset_id, wordnet_pos, definition) in wordnet {
        parts_of_speech.push(DictionaryPartOfSpeech {
            name: format!("WordNet · {wordnet_pos}"),
            senses: vec![DictionarySense {
                order: 1,
                definition,
                tags: vec![],
                examples: vec![],
                source: "Open English WordNet".into(),
            }],
        });
        let mut synonym_stmt = db.prepare("SELECT lemma FROM wordnet_lemmas WHERE synset_id=?1 AND normalized_lemma<>?2 ORDER BY lemma").map_err(|e| e.to_string())?;
        let synonyms = synonym_stmt
            .query_map(params![synset_id, normalized], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        related_words.extend(synonyms.into_iter().map(|target_word| DictionaryRelation {
            relation_type: "synonym".into(),
            target_word,
            source: "Open English WordNet".into(),
        }));
        let mut relation_stmt = db.prepare("SELECT wr.relation_type,wl.lemma FROM wordnet_relations wr JOIN wordnet_lemmas wl ON wl.synset_id=wr.target_synset_id WHERE wr.source_synset_id=?1 ORDER BY wr.relation_type,wl.lemma").map_err(|e| e.to_string())?;
        let relations = relation_stmt
            .query_map([synset_id], |row| {
                Ok(DictionaryRelation {
                    relation_type: row.get(0)?,
                    target_word: row.get(1)?,
                    source: "Open English WordNet".into(),
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        related_words.extend(relations);
    }
    if parts_of_speech.len() > 1 {
        if let Some(source) = all_sources
            .into_iter()
            .find(|source| source.source_key == "open-english-wordnet-2025")
        {
            sources.push(source);
        }
    }
    Ok(DictionaryEntry {
        id: entry_id,
        headword,
        pronunciations,
        parts_of_speech,
        etymology,
        forms,
        related_words,
        sources,
    })
}
