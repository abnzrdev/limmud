import { BookOpen, Download, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mobileDictionaryService, type MobileDictionaryService } from "../../../lib/mobileDictionaryService";
import type { DictionaryEntry, DictionarySearchResult, DictionaryStatus } from "../../../types/dictionary";

export function MobileDictionaryPanel({
  service = mobileDictionaryService,
  onAddVocabulary,
}: {
  service?: MobileDictionaryService;
  onAddVocabulary: (entry: DictionaryEntry) => void;
}) {
  const [status, setStatus] = useState<DictionaryStatus | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionarySearchResult[]>([]);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [message, setMessage] = useState("Loading offline dictionary…");
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    service.status().then((value) => {
      if (!active) return;
      setStatus(value);
      setMessage(value.installed ? "" : "No offline dictionary pack is installed.");
    }).catch(() => { if (active) setMessage("Offline dictionary is unavailable."); });
    return () => { active = false; };
  }, [service]);

  useEffect(() => {
    if (!status?.installed || !query.trim()) { setResults([]); return; }
    const generation = ++request.current;
    setMessage("Searching…");
    const timeout = window.setTimeout(() => {
      service.search(query.trim()).then((items) => {
        if (request.current !== generation) return;
        setResults(items);
        setMessage(items.length ? "" : "No offline dictionary entry found.");
      }).catch(() => { if (request.current === generation) setMessage("Offline dictionary search failed."); });
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [query, service, status?.installed]);

  const importPack = async () => {
    setMessage("Validating dictionary pack…");
    try {
      const result = await service.importPack();
      if ("installed" in result) {
        setStatus(result);
        setMessage("");
      } else setMessage("Dictionary import cancelled.");
    } catch { setMessage("Dictionary pack could not be installed."); }
  };

  if (!status?.installed) return <div className="m-dictionary"><div><BookOpen /><strong>Offline Dictionary</strong><p>{message}</p><button type="button" className="m-primary" onClick={() => void importPack()}><Download /> Import Dictionary Pack</button></div></div>;

  return <div className="m-dictionary">
    <label><Search /><input type="search" aria-label="Search offline dictionary" placeholder="Search a word" value={query} onChange={(event) => { setQuery(event.target.value); setEntry(null); }} /></label>
    {entry ? <article className="m-dictionary-entry"><span className="m-eyebrow">Offline definition</span><h4>{entry.headword}</h4>{entry.partsOfSpeech.map((part) => <section key={part.name}><strong>{part.name}</strong>{part.senses.map((sense) => <p key={sense.order}>{sense.definition}</p>)}</section>)}<button type="button" className="m-primary" onClick={() => onAddVocabulary(entry)}>Add to Vocabulary</button></article> : <div className="m-dictionary-results">{results.map((item) => <button type="button" key={item.entryId} aria-label={`${item.headword} — ${item.shortDefinition}`} onClick={() => void service.getEntry(item.entryId).then(setEntry).catch(() => setMessage("Offline dictionary entry is unavailable."))}><strong>{item.headword}</strong><span>{item.partOfSpeech} · {item.shortDefinition}</span></button>)}</div>}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
