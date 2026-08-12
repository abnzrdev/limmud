import { invoke } from "@tauri-apps/api/core";
import type { DictionaryEntry, DictionarySearchResult, DictionaryStatus } from "../types/dictionary";

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
export type DictionaryImportOutcome = DictionaryStatus | { status: "cancelled" };

export interface MobileDictionaryService {
  status(): Promise<DictionaryStatus>;
  importPack(): Promise<DictionaryImportOutcome>;
  search(query: string): Promise<DictionarySearchResult[]>;
  getEntry(entryId: number): Promise<DictionaryEntry>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("unsafe");
  const result = value as Record<string, unknown>;
  for (const key of ["uri", "documentUri", "documentId", "absolutePath", "sourcePath"]) if (key in result) throw new Error("unsafe");
  return result;
}

function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }

function parseSource(value: unknown) {
  const item = record(value);
  if (typeof item.sourceKey !== "string" || typeof item.sourceName !== "string" || typeof item.sourceVersion !== "string"
    || !(item.sourceDate === null || typeof item.sourceDate === "string") || typeof item.licenseName !== "string"
    || typeof item.attribution !== "string" || typeof item.homepage !== "string") throw new Error("unsafe");
  return item as unknown as DictionaryEntry["sources"][number];
}

function parseStatus(value: unknown): DictionaryStatus {
  const item = record(value);
  if (typeof item.installed !== "boolean"
    || !(typeof item.packVersion === "string" || item.packVersion === null)
    || !(typeof item.sourceDate === "string" || item.sourceDate === null)
    || !Number.isSafeInteger(item.entryCount) || !Number.isSafeInteger(item.databaseSizeBytes)
    || !Array.isArray(item.sources)) throw new Error("unsafe");
  return { ...item, sources: item.sources.map(parseSource) } as unknown as DictionaryStatus;
}

function parseEntry(value: unknown): DictionaryEntry {
  const item = record(value);
  if (!Number.isSafeInteger(item.id) || typeof item.headword !== "string"
    || !(item.etymology === null || typeof item.etymology === "string")
    || !Array.isArray(item.pronunciations) || !Array.isArray(item.partsOfSpeech)
    || !Array.isArray(item.forms) || !Array.isArray(item.relatedWords) || !Array.isArray(item.sources)) throw new Error("unsafe");
  const pronunciations = item.pronunciations.map((raw) => {
    const value = record(raw);
    if (!(value.ipa === null || typeof value.ipa === "string") || !(value.region === null || typeof value.region === "string")
      || !(value.audioFilename === null || typeof value.audioFilename === "string") || typeof value.audioAvailable !== "boolean") throw new Error("unsafe");
    return value as unknown as DictionaryEntry["pronunciations"][number];
  });
  const partsOfSpeech = item.partsOfSpeech.map((raw) => {
    const value = record(raw);
    if (typeof value.name !== "string" || !Array.isArray(value.senses)) throw new Error("unsafe");
    const senses = value.senses.map((rawSense) => {
      const sense = record(rawSense);
      if (!Number.isSafeInteger(sense.order) || typeof sense.definition !== "string" || !strings(sense.tags) || !strings(sense.examples)
        || !(sense.source === undefined || typeof sense.source === "string")) throw new Error("unsafe");
      return sense as unknown as DictionaryEntry["partsOfSpeech"][number]["senses"][number];
    });
    return { name: value.name as string, senses };
  });
  const forms = item.forms.map((raw) => { const value = record(raw); if (typeof value.form !== "string" || !strings(value.tags)) throw new Error("unsafe"); return value as unknown as DictionaryEntry["forms"][number]; });
  const relatedWords = item.relatedWords.map((raw) => { const value = record(raw); if (typeof value.relationType !== "string" || typeof value.targetWord !== "string" || typeof value.source !== "string") throw new Error("unsafe"); return value as unknown as DictionaryEntry["relatedWords"][number]; });
  return { id: item.id as number, headword: item.headword, etymology: item.etymology as string | null, pronunciations, partsOfSpeech, forms, relatedWords, sources: item.sources.map(parseSource) } as DictionaryEntry;
}

function parseResults(value: unknown): DictionarySearchResult[] {
  if (!Array.isArray(value)) throw new Error("unsafe");
  return value.map((raw) => {
    const item = record(raw);
    if (!Number.isSafeInteger(item.entryId) || typeof item.headword !== "string"
      || typeof item.partOfSpeech !== "string" || typeof item.shortDefinition !== "string"
      || typeof item.source !== "string") throw new Error("unsafe");
    return item as unknown as DictionarySearchResult;
  });
}

function safeFailure(message: string): never { throw new Error(message); }

export function createMobileDictionaryService(call: InvokeFn = invoke): MobileDictionaryService {
  return {
    async status() {
      try { return parseStatus(await call("mobile_dictionary_status")); }
      catch { return safeFailure("Offline dictionary status is unavailable."); }
    },
    async importPack() {
      try {
        const picked = record(await call("plugin:saf-course|pick_dictionary_pack"));
        if (picked.status === "cancelled") return { status: "cancelled" };
        if (picked.status !== "selected") throw new Error("unsafe");
        return parseStatus(await call("mobile_dictionary_install_pending"));
      } catch { return safeFailure("Dictionary pack could not be installed."); }
    },
    async search(query) {
      try { return parseResults(await call("mobile_dictionary_search", { query, limit: 30, offset: 0 })); }
      catch { return safeFailure("Offline dictionary search failed."); }
    },
    async getEntry(entryId) {
      try { return parseEntry(await call("mobile_dictionary_get_entry", { entryId })); }
      catch { return safeFailure("Offline dictionary entry is unavailable."); }
    },
  };
}

export const mobileDictionaryService = createMobileDictionaryService();
