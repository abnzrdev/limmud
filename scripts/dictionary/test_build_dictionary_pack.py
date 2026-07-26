import gzip
import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts.dictionary.build_dictionary_pack import BuildOptions, build_pack


FIXTURE = Path(__file__).parent / "fixtures" / "kaikki-small.jsonl"


class DictionaryPackBuilderTests(unittest.TestCase):
    def test_streams_filters_and_extracts_learner_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "fixture.dict.sqlite"
            recap = build_pack(BuildOptions(input=FIXTURE, output=output, include_etymology=True))
            self.assertEqual(recap["entry_count"], 4)
            self.assertEqual(recap["sources"], ["kaikki-wiktionary"])
            with sqlite3.connect(output) as db:
                self.assertEqual(db.execute("select count(*) from entries where headword='run'").fetchone()[0], 2)
                self.assertEqual(db.execute("select definition from senses order by id limit 1").fetchone()[0], "To move swiftly on foot.")
                self.assertEqual(db.execute("select ipa, region, audio_filename from pronunciations").fetchone(), ("/ɹʌn/", "US", "en-us-run.ogg"))
                self.assertEqual(db.execute("select form from forms where normalized_form='running'").fetchone()[0], "running")
                self.assertEqual(set(row[0] for row in db.execute("select relation_type from relations")), {"synonym", "antonym"})
                self.assertEqual(db.execute("select etymology_text from entries where headword='run' and part_of_speech='verb'").fetchone()[0], "From Middle English runnen.")
                self.assertEqual(db.execute("select value from pack_metadata where key='build_complete'").fetchone()[0], "1")
                self.assertEqual(db.execute("pragma integrity_check").fetchone()[0], "ok")

    def test_gzip_and_limit_are_streamed(self):
        with tempfile.TemporaryDirectory() as directory:
            compressed = Path(directory) / "fixture.jsonl.gz"
            with FIXTURE.open("rb") as source, gzip.open(compressed, "wb") as target:
                target.write(source.read())
            recap = build_pack(BuildOptions(input=compressed, output=Path(directory) / "limited.dict.sqlite", limit=1))
            self.assertEqual(recap["entry_count"], 1)

    def test_malformed_json_does_not_leave_pack_or_temp_file(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.jsonl"
            source.write_text('{"word":"good","lang_code":"en","pos":"noun","senses":[]}\nnot-json\n', encoding="utf-8")
            output = Path(directory) / "bad.dict.sqlite"
            with self.assertRaisesRegex(ValueError, "line 2"):
                build_pack(BuildOptions(input=source, output=output))
            self.assertFalse(output.exists())
            self.assertEqual(list(Path(directory).glob("*.tmp")), [])

    def test_rejects_existing_output_without_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing.dict.sqlite"
            output.write_bytes(b"keep")
            with self.assertRaises(FileExistsError):
                build_pack(BuildOptions(input=FIXTURE, output=output))
            self.assertEqual(output.read_bytes(), b"keep")

    def test_schema_and_content_are_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.dict.sqlite"
            second = Path(directory) / "second.dict.sqlite"
            build_pack(BuildOptions(input=FIXTURE, output=first))
            build_pack(BuildOptions(input=FIXTURE, output=second))
            with sqlite3.connect(first) as a, sqlite3.connect(second) as b:
                stable = lambda db: [line for line in db.iterdump() if "'build_date'" not in line]
                self.assertEqual(stable(a), stable(b))

    def test_imports_only_the_strict_official_oewn_2025_archive_shape(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "english-wordnet-2025-json.zip"
            write_oewn_fixture(archive)
            output = Path(directory) / "with-wordnet.dict.sqlite"
            recap = build_pack(BuildOptions(input=FIXTURE, output=output, wordnet=archive))
            self.assertEqual(recap["wordnet_synset_count"], 2)
            self.assertEqual(recap["sources"], ["kaikki-wiktionary", "open-english-wordnet-2025"])
            with sqlite3.connect(output) as db:
                self.assertEqual(set(row[0] for row in db.execute("select lemma from wordnet_lemmas")), {"run", "running", "move"})
                self.assertEqual(db.execute("select relation_type from wordnet_relations").fetchone()[0], "hypernym")
                self.assertEqual(db.execute("select license_name from dictionary_sources where source_key='open-english-wordnet-2025'").fetchone()[0], "CC BY 4.0")

    def test_rejects_wrong_wordnet_filename_and_archive_shape(self):
        with tempfile.TemporaryDirectory() as directory:
            wrong_name = Path(directory) / "wordnet.zip"
            write_oewn_fixture(wrong_name)
            with self.assertRaisesRegex(ValueError, "english-wordnet-2025-json.zip"):
                build_pack(BuildOptions(input=FIXTURE, output=Path(directory) / "bad-name.dict.sqlite", wordnet=wrong_name))
            malformed = Path(directory) / "english-wordnet-2025-json.zip"
            with zipfile.ZipFile(malformed, "w") as archive:
                archive.writestr("entries-a.json", "{}")
            with self.assertRaisesRegex(ValueError, "unsupported Open English WordNet 2025 archive"):
                build_pack(BuildOptions(input=FIXTURE, output=Path(directory) / "bad-shape.dict.sqlite", wordnet=malformed))


def write_oewn_fixture(path: Path) -> None:
    from scripts.dictionary.build_dictionary_pack import OEWN_2025_MEMBERS
    synsets = {
        "00000001-v": {
            "definition": ["move swiftly on foot"],
            "members": ["run", "running"],
            "partOfSpeech": "v",
            "hypernym": ["00000002-v"],
        },
        "00000002-v": {
            "definition": ["move"],
            "members": ["move"],
            "partOfSpeech": "v",
        },
    }
    entries = {"run": {"v": {"sense": [{"id": "run%2:38:00::", "synset": "00000001-v"}]}}}
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in OEWN_2025_MEMBERS:
            value = entries if name == "entries-r.json" else synsets if name == "verb.motion.json" else {}
            archive.writestr(name, json.dumps(value))


if __name__ == "__main__":
    unittest.main()
