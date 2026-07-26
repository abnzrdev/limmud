# Offline dictionary data

LearningAppOffline does not author or download dictionary data. A user obtains source files separately, runs the local builder, and imports the resulting pack. The application then performs all lookups offline.

## Supported sources

### Wiktionary through Kaikki/Wiktextract

The primary input is an English Wiktextract `.jsonl` or `.jsonl.gz` dump from [Kaikki](https://kaikki.org/dictionary/rawdata.html). Each line must be a JSON object with `word`, `lang_code`, `pos`, and `senses`; version 1 retains English (`lang_code == "en"`) headwords, parts of speech, glosses, raw gloss fallbacks, sense tags and IDs, examples, IPA and region tags, audio filenames (not URLs or audio files), forms, synonyms, antonyms, derived/related/compound/form-of relations, optional etymology, and optional translations.

Templates, HTML, categories, maintenance data, warnings, debug fields, and online audio URLs are discarded.

Wiktionary-derived content is available under CC BY-SA and GFDL terms. Packs identify the source as `kaikki-wiktionary` and retain attribution to Wiktionary contributors and Wiktextract/Kaikki.

### Open English WordNet 2025

Optional enrichment supports only the official core release named exactly `english-wordnet-2025-json.zip`, available from the [Open English WordNet downloads page](https://en-word.net/downloads). The adapter requires the official 73-file archive structure (`entries-*.json`, adjective/adverb synset files, noun lexicographer files, verb lexicographer files, and `frames.json`) and validates every JSON object and required synset field. Other releases, Plus/Namenet archives, renamed archives, extracted ad-hoc JSON, and malformed structures are rejected.

Open English WordNet 2025 is licensed under CC BY 4.0. Its synsets, lemmas, relations, release date, and source record remain in separate `wordnet_*` tables. Its definitions never replace Kaikki definitions.

## Building

```bash
python3 scripts/dictionary/build_dictionary_pack.py \
  --input /path/to/kaikki.jsonl.gz \
  --output /path/to/english.dict.sqlite \
  --include-etymology
```

Optional WordNet enrichment:

```bash
python3 scripts/dictionary/build_dictionary_pack.py \
  --input /path/to/kaikki.jsonl.gz \
  --output /path/to/english.dict.sqlite \
  --wordnet /path/to/english-wordnet-2025-json.zip
```

Other options are `--language en`, `--include-translations`, `--limit`, `--overwrite`, and `--metadata-output`. The builder uses Python’s standard library, streams Kaikki input, writes a temporary SQLite file, validates integrity/schema/counts, and atomically replaces the destination only after success.

## Storage and licensing separation

The imported global pack is stored below the operating system’s Tauri application-data directory:

```text
dictionary/
  dictionary.sqlite
  metadata.json
  licenses/
    KAIKKI-WIKTIONARY.txt
    OPEN-ENGLISH-WORDNET.txt   # only when present
```

Saved words remain course-specific at `<course>/.learningappoffline/vocabulary.json`. The dictionary database is never copied into courses.

Dictionary-data licenses apply to the corresponding data and derived pack records. They do not change the license of LearningAppOffline’s application source code.
