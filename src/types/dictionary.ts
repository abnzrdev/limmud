export interface DictionarySourceInfo {
  sourceKey: string; sourceName: string; sourceVersion: string; sourceDate: string | null;
  licenseName: string; attribution: string; homepage: string;
}
export interface DictionaryStatus {
  installed: boolean; packVersion: string | null; sourceDate: string | null;
  entryCount: number; databaseSizeBytes: number; sources: DictionarySourceInfo[];
}
export interface DictionarySearchResult {
  entryId: number; headword: string; partOfSpeech: string; shortDefinition: string;
  matchedForm?: string; source: string;
}
export interface DictionaryEntry {
  id: number; headword: string;
  pronunciations: { ipa: string | null; region: string | null; audioFilename: string | null; audioAvailable: boolean }[];
  partsOfSpeech: { name: string; senses: { order: number; definition: string; tags: string[]; examples: string[]; source?: string }[] }[];
  etymology: string | null; forms: { form: string; tags: string[] }[];
  relatedWords: { relationType: string; targetWord: string; source: string }[];
  sources: DictionarySourceInfo[];
}
export interface SavedVocabularyItem {
  id: string; headword: string; dictionaryEntryId: number; sourceKey: string;
  partOfSpeech?: string; shortDefinition: string; addedAt: string;
  lessonRelativePath?: string; videoPositionSeconds?: number; personalNote: string;
  status: "new" | "learning" | "known"; reviewCount: number; lastReviewedAt?: string;
}
