import { BookOpen, HelpCircle, Search, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  chooseDictionaryPack, dictionaryGetEntry, dictionaryImportPack, dictionarySearch,
  dictionaryStatus, vocabularyList, vocabularyRemove, vocabularySave, vocabularyUpdate,
} from "../../lib/tauri";
import type {
  DictionaryEntry, DictionarySearchResult, DictionaryStatus, SavedVocabularyItem,
} from "../../types/dictionary";

interface Props {
  open: boolean;
  onClose: () => void;
  courseRoot: string | null;
  initialQuery?: string;
  statusLoader?: () => Promise<DictionaryStatus>;
  choosePack?: () => Promise<string | null>;
  importPack?: (path: string) => Promise<DictionaryStatus>;
  searchDictionary?: (query: string) => Promise<DictionarySearchResult[]>;
  loadEntry?: (id: number) => Promise<DictionaryEntry>;
}

export function DictionaryDrawer({
  open, onClose, courseRoot, initialQuery = "", statusLoader = dictionaryStatus,
  choosePack = chooseDictionaryPack, importPack = dictionaryImportPack,
  searchDictionary = dictionarySearch, loadEntry = dictionaryGetEntry,
}: Props) {
  const [status, setStatus] = useState<DictionaryStatus | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DictionarySearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [message, setMessage] = useState("Loading offline dictionary...");
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    void statusLoader().then((value) => {
      setStatus(value);
      setMessage("");
    }).catch((error) => setMessage(String(error)));
  }, [open, statusLoader]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open || !status?.installed || !query.trim()) {
      setResults([]);
      return;
    }
    const request = ++requestRef.current;
    setMessage("Searching…");
    const timer = window.setTimeout(() => {
      void searchDictionary(query.trim()).then((values) => {
        if (request !== requestRef.current) return;
        setResults(values);
        setSelected(0);
        setMessage(values.length ? "" : "No offline dictionary entry found");
      }).catch((error) => setMessage(`Dictionary query failed: ${String(error)}`));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, query, searchDictionary, status?.installed]);

  useEffect(() => {
    if (!open) return;
    const focusSearch = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [open]);

  const openSelected = async () => {
    const result = results[selected];
    if (!result) return;
    try {
      setEntry(await loadEntry(result.entryId));
    } catch (error) {
      setMessage(`Dictionary query failed: ${String(error)}`);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      void openSelected();
    } else if (event.key === "Escape") {
      entry ? setEntry(null) : onClose();
    }
  };

  const install = async () => {
    const path = await choosePack();
    if (!path) return;
    try {
      setMessage("Validating and installing dictionary pack…");
      setStatus(await importPack(path));
      setMessage("");
    } catch (error) {
      setMessage(`Dictionary installation failed: ${String(error)}`);
    }
  };

  return (
    <aside className="dictionary-drawer" aria-label="Dictionary" hidden={!open}>
      <header className="dictionary-header">
        <h2><BookOpen aria-hidden="true" /> Dictionary</h2>
        <span className="dictionary-installed"><i aria-hidden="true" />{status?.installed ? "Installed" : "Offline"}</span>
        <button type="button" className="icon-button" aria-label="Close Dictionary" onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <div className="dictionary-scroll">
        {!status?.installed ? (
          <div className="dictionary-empty">
            <h3>Offline Dictionary</h3>
            <p>No dictionary pack is installed.</p>
            <p>Build or choose a compatible LearningAppOffline dictionary pack to enable offline definitions.</p>
            <button type="button" className="button-primary" onClick={() => void install()}>Import Dictionary Pack</button>
            <details><summary>View Setup Instructions</summary><p>Build a local pack with <code>python3 scripts/dictionary/build_dictionary_pack.py --input … --output english.dict.sqlite</code>, then import it here.</p></details>
          </div>
        ) : (
          <>
            <label className="dictionary-search">
              <Search aria-hidden="true" />
              <input className="dictionary-search-input" aria-label="Search dictionary" ref={inputRef} value={query} placeholder="Search offline dictionary" onChange={(event) => { setQuery(event.target.value); setEntry(null); }} onKeyDown={onKeyDown} />
              <button type="button" aria-label="Clear dictionary search" onClick={() => { setQuery(""); setEntry(null); }}><X aria-hidden="true" /></button>
            </label>
            {entry ? (
              <><EntryView entry={entry} /><VocabularyPanel courseRoot={courseRoot} entry={entry} /></>
            ) : (
              <div className="dictionary-results" role="listbox" aria-label="Dictionary results">
                {results.map((result, index) => <button key={result.entryId} type="button" role="option" aria-selected={index === selected} className="dictionary-result" onMouseEnter={() => setSelected(index)} onClick={() => { setSelected(index); void loadEntry(result.entryId).then(setEntry); }}><strong>{result.headword}</strong><span>{result.partOfSpeech} · {result.shortDefinition}</span><small>{result.matchedForm ? `Matched ${result.matchedForm} · ` : ""}{result.source}</small></button>)}
              </div>
            )}
            <details className="dictionary-sources">
              <summary>Dictionary sources</summary>
              {status.sources.map((source) => <div key={source.sourceKey}><strong>{source.sourceName} {source.sourceVersion}</strong><p>{source.attribution}</p><small>{source.licenseName}{source.sourceDate ? ` · ${source.sourceDate}` : ""}</small></div>)}
            </details>
          </>
        )}
        {message ? <p className="dictionary-message" role="status">{message}</p> : null}
      </div>
    </aside>
  );
}

function VocabularyPanel({ courseRoot, entry }: { courseRoot: string | null; entry: DictionaryEntry }) {
  const [items, setItems] = useState<SavedVocabularyItem[]>([]);
  const [filter, setFilter] = useState<SavedVocabularyItem["status"] | "all">("all");
  const [savedSearch, setSavedSearch] = useState("");
  useEffect(() => {
    if (courseRoot) void vocabularyList(courseRoot).then(setItems).catch(() => setItems([]));
  }, [courseRoot]);
  if (!courseRoot) return <p className="dictionary-message">Open a course to save vocabulary.</p>;
  const saved = items.find((item) => item.dictionaryEntryId === entry.id);
  const save = async () => {
    const first = entry.partsOfSpeech[0];
    const source = entry.sources[0];
    if (!source || !first?.senses[0]) return;
    setItems(await vocabularySave(courseRoot, {
      id: crypto.randomUUID(), headword: entry.headword, dictionaryEntryId: entry.id,
      sourceKey: source.sourceKey, partOfSpeech: first.name, shortDefinition: first.senses[0].definition,
      addedAt: new Date().toISOString(), personalNote: "", status: "new", reviewCount: 0,
    }));
  };
  const visible = items.filter((item) => (filter === "all" || item.status === filter) && item.headword.toLocaleLowerCase().includes(savedSearch.toLocaleLowerCase()));
  return (
    <section className="dictionary-vocabulary dictionary-card" aria-labelledby="course-vocabulary-title">
      <div className="dictionary-section-heading"><h3 id="course-vocabulary-title">Course vocabulary</h3><HelpCircle aria-label="Words saved for this course" /></div>
      <div className="dictionary-vocabulary-actions">
        {!saved ? <button type="button" className="button-primary" onClick={() => void save()}>+ Save word</button> : <button type="button" className="button-secondary" onClick={() => void vocabularyRemove(courseRoot, saved.id).then(setItems)}>Saved · Remove</button>}
        <div className="dictionary-status-options" aria-label="Vocabulary status">
          {(["new", "learning", "known"] as const).map((value) => <button type="button" aria-pressed={saved?.status === value} disabled={!saved} key={value} onClick={() => saved && void vocabularyUpdate(courseRoot, { ...saved, status: value }).then(setItems)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
      </div>
      <textarea aria-label="Personal vocabulary note" placeholder="Add a personal note..." disabled={!saved} value={saved?.personalNote ?? ""} onChange={(event) => saved && setItems((values) => values.map((item) => item.id === saved.id ? { ...item, personalNote: event.target.value } : item))} onBlur={() => saved && void vocabularyUpdate(courseRoot, saved).then(setItems)} />
      {items.length > 8 ? <><label>Search saved words <input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} /></label><div>{(["all", "new", "learning", "known"] as const).map((value) => <button type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}</button>)}</div></> : null}
      <h4>Saved words</h4>
      <div className="dictionary-saved-words">{visible.slice(0, 8).map((item) => <span key={item.id}>{item.headword}</span>)}{visible.length > 8 ? <small>See all ({visible.length})</small> : null}</div>
    </section>
  );
}

function EntryView({ entry }: { entry: DictionaryEntry }) {
  return (
    <article className="dictionary-entry">
      <header className="dictionary-entry-header">
        <div><h2>{entry.headword}</h2>{entry.pronunciations.map((value, index) => <p key={index} className="dictionary-ipa">{value.ipa}<span>{value.region}</span></p>)}</div>
        {entry.pronunciations.some((value) => value.audioAvailable) ? <button type="button" className="icon-button" aria-label={`Pronounce ${entry.headword}`}><Volume2 aria-hidden="true" /></button> : null}
      </header>
      {entry.partsOfSpeech.map((part) => <section className="dictionary-meanings" key={part.name}><h3>{part.name}</h3><ol>{part.senses.map((sense) => <li className="dictionary-definition-card" key={sense.order}><p className="dictionary-definition">{sense.definition}</p>{sense.examples.map((example) => <p className="dictionary-example" key={example}>{example}</p>)}<small>{sense.source ?? entry.sources[0]?.sourceName}</small></li>)}</ol></section>)}
      {entry.forms.length ? <section className="dictionary-card"><h3>Forms</h3><div className="dictionary-chips">{entry.forms.map((form) => <span key={form.form}>{form.form}</span>)}</div></section> : null}
      {entry.relatedWords.length ? <section className="dictionary-card"><h3>Related words</h3><div className="dictionary-relations">{entry.relatedWords.map((relation, index) => <div key={`${relation.relationType}-${relation.targetWord}-${index}`}><small>{relation.relationType}</small><span>{relation.targetWord}</span></div>)}</div></section> : null}
      {entry.etymology ? <details className="dictionary-card"><summary>Etymology</summary><p>{entry.etymology}</p></details> : null}
    </article>
  );
}
