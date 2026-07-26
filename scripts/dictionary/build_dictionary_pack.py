#!/usr/bin/env python3
"""Build a compact LearningAppOffline dictionary pack from local source files."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SCHEMA_VERSION = 1
KAIKKI_LICENSE = "CC BY-SA 4.0 and GFDL"
KAIKKI_ATTRIBUTION = "Wiktionary contributors; extracted by Wiktextract/Kaikki.org"
OEWN_2025_MEMBERS = frozenset(
    ["adj.all.json", "adj.pert.json", "adj.ppl.json", "adv.all.json", "frames.json"]
    + [f"entries-{character}.json" for character in "0abcdefghijklmnopqrstuvwxyz"]
    + [f"noun.{name}.json" for name in (
        "Tops", "act", "animal", "artifact", "attribute", "body", "cognition", "communication",
        "event", "feeling", "food", "group", "location", "motive", "object", "person",
        "phenomenon", "plant", "possession", "process", "quantity", "relation", "shape",
        "state", "substance", "time",
    )]
    + [f"verb.{name}.json" for name in (
        "body", "change", "cognition", "communication", "competition", "consumption", "contact",
        "creation", "emotion", "motion", "perception", "possession", "social", "stative", "weather",
    )]
)


@dataclass(frozen=True)
class BuildOptions:
    input: Path
    output: Path
    language: str = "en"
    include_etymology: bool = False
    include_translations: bool = False
    wordnet: Path | None = None
    limit: int | None = None
    overwrite: bool = False
    metadata_output: Path | None = None


def normalize(value: str) -> str:
    return value.strip().casefold()


def source_records(path: Path) -> Iterator[tuple[int, dict[str, Any]]]:
    if path.name.endswith(".jsonl.gz"):
        opener = lambda: gzip.open(path, "rt", encoding="utf-8")
    elif path.name.endswith(".jsonl"):
        opener = lambda: path.open("rt", encoding="utf-8")
    else:
        raise ValueError("unsupported input; expected .jsonl or .jsonl.gz")
    try:
        with opener() as stream:
            for line_number, line in enumerate(stream, 1):
                if not line.strip():
                    continue
                try:
                    value = json.loads(line)
                except json.JSONDecodeError as error:
                    raise ValueError(f"malformed JSONL at line {line_number}: {error.msg}") from error
                if not isinstance(value, dict):
                    raise ValueError(f"incompatible source data at line {line_number}: expected an object")
                yield line_number, value
    except (gzip.BadGzipFile, EOFError) as error:
        raise ValueError(f"corrupt gzip input: {error}") from error


def create_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        PRAGMA foreign_keys=ON;
        CREATE TABLE pack_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE dictionary_sources (
          id INTEGER PRIMARY KEY, source_key TEXT UNIQUE NOT NULL, source_name TEXT NOT NULL,
          source_version TEXT NOT NULL, source_date TEXT, license_name TEXT NOT NULL,
          attribution TEXT NOT NULL, homepage TEXT NOT NULL, schema_version INTEGER NOT NULL
        );
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES dictionary_sources(id),
          headword TEXT NOT NULL, normalized_headword TEXT NOT NULL, language_code TEXT NOT NULL,
          part_of_speech TEXT NOT NULL, etymology_text TEXT, raw_source_id TEXT
        );
        CREATE TABLE senses (
          id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
          sense_order INTEGER NOT NULL, definition TEXT NOT NULL, learner_definition TEXT,
          tags_json TEXT NOT NULL, raw_source_id TEXT
        );
        CREATE TABLE examples (
          id INTEGER PRIMARY KEY, sense_id INTEGER NOT NULL REFERENCES senses(id),
          example_text TEXT NOT NULL, translation_text TEXT
        );
        CREATE TABLE pronunciations (
          id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
          ipa TEXT, region TEXT, audio_filename TEXT, audio_available INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE forms (
          id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
          form TEXT NOT NULL, normalized_form TEXT NOT NULL, form_tags_json TEXT NOT NULL
        );
        CREATE TABLE relations (
          id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
          sense_id INTEGER REFERENCES senses(id), relation_type TEXT NOT NULL,
          target_word TEXT NOT NULL, target_source_id TEXT
        );
        CREATE TABLE translations (
          id INTEGER PRIMARY KEY, sense_id INTEGER REFERENCES senses(id),
          language_code TEXT, target_word TEXT NOT NULL, sense_text TEXT
        );
        CREATE TABLE wordnet_synsets (
          id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES dictionary_sources(id),
          synset_key TEXT UNIQUE NOT NULL, part_of_speech TEXT NOT NULL, definition TEXT NOT NULL
        );
        CREATE TABLE wordnet_lemmas (
          synset_id INTEGER NOT NULL REFERENCES wordnet_synsets(id), lemma TEXT NOT NULL,
          normalized_lemma TEXT NOT NULL, PRIMARY KEY (synset_id, lemma)
        );
        CREATE TABLE wordnet_relations (
          source_synset_id INTEGER NOT NULL REFERENCES wordnet_synsets(id),
          relation_type TEXT NOT NULL, target_synset_id INTEGER NOT NULL REFERENCES wordnet_synsets(id)
        );
        CREATE INDEX entries_normalized_idx ON entries(normalized_headword);
        CREATE INDEX entries_headword_idx ON entries(headword);
        CREATE INDEX forms_normalized_idx ON forms(normalized_form);
        CREATE INDEX relations_target_idx ON relations(target_word, relation_type);
        CREATE INDEX wordnet_lemma_idx ON wordnet_lemmas(normalized_lemma);
        CREATE VIRTUAL TABLE dictionary_fts USING fts5(
          entry_id UNINDEXED, headword, normalized_headword, forms, definitions, synonyms,
          tokenize='unicode61 remove_diacritics 0'
        );
        """
    )


def text_list(value: Any) -> list[str]:
    return [item for item in value if isinstance(item, str) and item.strip()] if isinstance(value, list) else []


def relation_words(value: Any) -> list[tuple[str, str | None]]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("word"), str) and item["word"].strip():
            result.append((item["word"], item.get("sense") if isinstance(item.get("sense"), str) else None))
    return result


def import_kaikki(db: sqlite3.Connection, options: BuildOptions) -> tuple[int, int]:
    source_id = db.execute(
        """INSERT INTO dictionary_sources
           (source_key, source_name, source_version, source_date, license_name, attribution, homepage, schema_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
        ("kaikki-wiktionary", "Wiktionary / Kaikki", "wiktextract-jsonl", None,
         KAIKKI_LICENSE, KAIKKI_ATTRIBUTION, "https://kaikki.org/", SCHEMA_VERSION),
    ).fetchone()[0]
    imported = scanned = 0
    for line_number, record in source_records(options.input):
        scanned += 1
        if record.get("lang_code") != options.language:
            continue
        word, pos, senses = record.get("word"), record.get("pos"), record.get("senses")
        if not isinstance(word, str) or not word.strip() or not isinstance(pos, str) or not isinstance(senses, list):
            raise ValueError(f"incompatible source data at line {line_number}: word, pos, and senses are required")
        entry_id = db.execute(
            """INSERT INTO entries
               (source_id, headword, normalized_headword, language_code, part_of_speech, etymology_text, raw_source_id)
               VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""",
            (source_id, word, normalize(word), options.language, pos,
             record.get("etymology_text") if options.include_etymology and isinstance(record.get("etymology_text"), str) else None,
             str(record.get("id")) if record.get("id") is not None else None),
        ).fetchone()[0]
        definitions: list[str] = []
        synonyms: list[str] = []
        forms: list[str] = []
        for order, sense in enumerate(senses, 1):
            if not isinstance(sense, dict):
                continue
            glosses = text_list(sense.get("glosses")) or text_list(sense.get("raw_glosses"))
            definition = glosses[0] if glosses else ""
            if not definition:
                continue
            definitions.extend(glosses)
            sense_ids = text_list(sense.get("senseid"))
            sense_id = db.execute(
                """INSERT INTO senses
                   (entry_id, sense_order, definition, learner_definition, tags_json, raw_source_id)
                   VALUES (?, ?, ?, NULL, ?, ?) RETURNING id""",
                (entry_id, order, definition, json.dumps(text_list(sense.get("tags")), ensure_ascii=False),
                 sense_ids[0] if sense_ids else None),
            ).fetchone()[0]
            for example in sense.get("examples", []) if isinstance(sense.get("examples"), list) else []:
                if isinstance(example, dict) and isinstance(example.get("text"), str):
                    db.execute("INSERT INTO examples (sense_id, example_text, translation_text) VALUES (?, ?, ?)",
                               (sense_id, example["text"], example.get("english")))
            for source_key, relation_type in (
                ("synonyms", "synonym"), ("antonyms", "antonym"), ("derived", "derived"),
                ("related", "related"), ("compounds", "compound"), ("form_of", "form_of"),
            ):
                for target, target_sense in relation_words(sense.get(source_key)):
                    db.execute(
                        "INSERT INTO relations (entry_id, sense_id, relation_type, target_word, target_source_id) VALUES (?, ?, ?, ?, ?)",
                        (entry_id, sense_id, relation_type, target, target_sense),
                    )
                    if relation_type == "synonym":
                        synonyms.append(target)
            if options.include_translations:
                for translation in sense.get("translations", []) if isinstance(sense.get("translations"), list) else []:
                    if isinstance(translation, dict) and isinstance(translation.get("word"), str):
                        db.execute("INSERT INTO translations (sense_id, language_code, target_word, sense_text) VALUES (?, ?, ?, ?)",
                                   (sense_id, translation.get("code"), translation["word"], translation.get("sense")))
        for sound in record.get("sounds", []) if isinstance(record.get("sounds"), list) else []:
            if not isinstance(sound, dict) or not any(isinstance(sound.get(key), str) for key in ("ipa", "audio")):
                continue
            tags = text_list(sound.get("tags"))
            db.execute(
                "INSERT INTO pronunciations (entry_id, ipa, region, audio_filename, audio_available) VALUES (?, ?, ?, ?, 0)",
                (entry_id, sound.get("ipa"), ", ".join(tags) or None, sound.get("audio")),
            )
        for form in record.get("forms", []) if isinstance(record.get("forms"), list) else []:
            if not isinstance(form, dict) or not isinstance(form.get("form"), str) or form["form"] == "-":
                continue
            forms.append(form["form"])
            db.execute("INSERT INTO forms (entry_id, form, normalized_form, form_tags_json) VALUES (?, ?, ?, ?)",
                       (entry_id, form["form"], normalize(form["form"]), json.dumps(text_list(form.get("tags")), ensure_ascii=False)))
        db.execute(
            "INSERT INTO dictionary_fts (entry_id, headword, normalized_headword, forms, definitions, synonyms) VALUES (?, ?, ?, ?, ?, ?)",
            (entry_id, word, normalize(word), " ".join(forms), " ".join(definitions), " ".join(synonyms)),
        )
        imported += 1
        if imported % 10_000 == 0:
            print(f"Imported {imported:,} English entries ({scanned:,} records scanned)", file=sys.stderr)
        if options.limit is not None and imported >= options.limit:
            break
    if imported == 0:
        raise ValueError(f"no entries matched language {options.language!r}")
    return imported, scanned


def validate_pack(db: sqlite3.Connection) -> dict[str, int]:
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("dictionary database is corrupt")
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dictionary_fts'").fetchone():
        raise ValueError("SQLite FTS5 is unavailable")
    counts = {
        "entry_count": db.execute("SELECT count(*) FROM entries").fetchone()[0],
        "sense_count": db.execute("SELECT count(*) FROM senses").fetchone()[0],
        "wordnet_synset_count": db.execute("SELECT count(*) FROM wordnet_synsets").fetchone()[0],
    }
    if counts["entry_count"] <= 0:
        raise ValueError("dictionary pack contains no entries")
    return counts


def build_pack(options: BuildOptions) -> dict[str, Any]:
    started = time.monotonic()
    source = Path(options.input)
    output = Path(options.output)
    if not source.is_file():
        raise FileNotFoundError(f"input does not exist: {source}")
    if options.limit is not None and options.limit <= 0:
        raise ValueError("--limit must be greater than zero")
    if output.exists() and not options.overwrite:
        raise FileExistsError(f"output already exists: {output}; use --overwrite")
    output.parent.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(output.parent).free
    if free < max(source.stat().st_size * 2, 10 * 1024 * 1024):
        raise OSError("insufficient disk space for dictionary build")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with sqlite3.connect(temporary) as db:
            create_schema(db)
            db.execute("INSERT INTO pack_metadata VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),))
            db.execute("INSERT INTO pack_metadata VALUES ('build_complete', '0')")
            db.execute("INSERT INTO pack_metadata VALUES ('pack_version', '1')")
            db.execute("INSERT INTO pack_metadata VALUES ('build_date', ?)",
                       (datetime.now(timezone.utc).replace(microsecond=0).isoformat(),))
            imported, scanned = import_kaikki(db, options)
            if options.wordnet is not None:
                import_oewn_2025(db, Path(options.wordnet))
            counts = validate_pack(db)
            db.execute("UPDATE pack_metadata SET value='1' WHERE key='build_complete'")
            db.commit()
        os.replace(temporary, output)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    sources = ["kaikki-wiktionary"] + (["open-english-wordnet-2025"] if options.wordnet else [])
    recap: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        **counts,
        "records_scanned": scanned,
        "sources": sources,
        "pack_size_bytes": output.stat().st_size,
        "build_duration_seconds": round(time.monotonic() - started, 3),
        "validation": "ok",
    }
    if options.metadata_output:
        Path(options.metadata_output).write_text(json.dumps(recap, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return recap


def import_oewn_2025(db: sqlite3.Connection, path: Path) -> None:
    if path.name != "english-wordnet-2025-json.zip":
        raise ValueError("WordNet input must be the official english-wordnet-2025-json.zip")
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as error:
        raise ValueError(f"unsupported Open English WordNet 2025 archive: {error}") from error
    with archive:
        names = set(archive.namelist())
        if names != OEWN_2025_MEMBERS:
            raise ValueError("unsupported Open English WordNet 2025 archive: member list does not match the official release")
        source_id = db.execute(
            """INSERT INTO dictionary_sources
               (source_key, source_name, source_version, source_date, license_name, attribution, homepage, schema_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
            ("open-english-wordnet-2025", "Open English WordNet", "2025", "2025-12-31",
             "CC BY 4.0", "Open English WordNet Community", "https://en-word.net/", SCHEMA_VERSION),
        ).fetchone()[0]
        synset_ids: dict[str, int] = {}
        pending_relations: list[tuple[str, str, str]] = []
        excluded = {"definition", "members", "partOfSpeech", "ili", "example", "source", "wikidata"}
        for name in sorted(names):
            try:
                value = json.loads(archive.read(name))
            except (KeyError, UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ValueError(f"unsupported Open English WordNet 2025 archive: malformed {name}") from error
            if not isinstance(value, dict):
                raise ValueError(f"unsupported Open English WordNet 2025 archive: {name} must contain an object")
            if name.startswith("entries-") or name == "frames.json":
                continue
            for synset_key, synset in value.items():
                if (
                    not isinstance(synset_key, str)
                    or not isinstance(synset, dict)
                    or not isinstance(synset.get("partOfSpeech"), str)
                    or not text_list(synset.get("definition"))
                    or not text_list(synset.get("members"))
                ):
                    raise ValueError(f"unsupported Open English WordNet 2025 archive: invalid synset in {name}")
                synset_id = db.execute(
                    "INSERT INTO wordnet_synsets (source_id, synset_key, part_of_speech, definition) VALUES (?, ?, ?, ?) RETURNING id",
                    (source_id, synset_key, synset["partOfSpeech"], text_list(synset["definition"])[0]),
                ).fetchone()[0]
                synset_ids[synset_key] = synset_id
                for lemma in text_list(synset["members"]):
                    db.execute(
                        "INSERT INTO wordnet_lemmas (synset_id, lemma, normalized_lemma) VALUES (?, ?, ?)",
                        (synset_id, lemma, normalize(lemma)),
                    )
                for relation_type, targets in synset.items():
                    if relation_type in excluded:
                        continue
                    for target in text_list(targets):
                        pending_relations.append((synset_key, relation_type, target))
        for source_key, relation_type, target_key in pending_relations:
            source_synset_id = synset_ids.get(source_key)
            target_synset_id = synset_ids.get(target_key)
            if source_synset_id is not None and target_synset_id is not None:
                db.execute(
                    "INSERT INTO wordnet_relations (source_synset_id, relation_type, target_synset_id) VALUES (?, ?, ?)",
                    (source_synset_id, relation_type, target_synset_id),
                )


def parse_args(argv: list[str] | None = None) -> BuildOptions:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--language", default="en")
    parser.add_argument("--include-etymology", action="store_true")
    parser.add_argument("--include-translations", action="store_true")
    parser.add_argument("--wordnet", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--metadata-output", type=Path)
    args = parser.parse_args(argv)
    return BuildOptions(**vars(args))


def main(argv: list[str] | None = None) -> int:
    try:
        recap = build_pack(parse_args(argv))
    except (OSError, ValueError, sqlite3.Error) as error:
        print(f"Dictionary build failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(recap, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
