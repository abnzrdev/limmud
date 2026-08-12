import { describe, expect, it, vi } from "vitest";
import { createMobileDictionaryService } from "./mobileDictionaryService";

const status = { installed: true, packVersion: "test-1", sourceDate: null, entryCount: 3, databaseSizeBytes: 4096, sources: [] };

describe("mobile offline dictionary service", () => {
  it("selects a pack natively then validates and installs the opaque pending copy in Rust", async () => {
    const call = vi.fn(async (command: string) => command.endsWith("pick_dictionary_pack")
      ? { status: "selected" }
      : status);
    const service = createMobileDictionaryService(call);

    await expect(service.importPack()).resolves.toEqual(status);
    expect(call.mock.calls).toEqual([
      ["plugin:saf-course|pick_dictionary_pack"],
      ["mobile_dictionary_install_pending"],
    ]);
  });

  it("preserves the installed pack when selection is cancelled", async () => {
    const call = vi.fn(async () => ({ status: "cancelled" }));
    const service = createMobileDictionaryService(call);
    await expect(service.importPack()).resolves.toEqual({ status: "cancelled" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("uses narrow offline status, search, and entry commands", async () => {
    const result = { entryId: 7, headword: "study", partOfSpeech: "verb", shortDefinition: "learn", source: "Synthetic" };
    const entry = { id: 7, headword: "study", pronunciations: [], partsOfSpeech: [], etymology: null, forms: [], relatedWords: [], sources: [] };
    const call = vi.fn(async (command: string) => command.endsWith("status") ? status : command.endsWith("search") ? [result] : entry);
    const service = createMobileDictionaryService(call);

    await expect(service.status()).resolves.toEqual(status);
    await expect(service.search("study")).resolves.toEqual([result]);
    await expect(service.getEntry(7)).resolves.toEqual(entry);
  });

  it("maps native details to a fixed privacy-safe error", async () => {
    const service = createMobileDictionaryService(vi.fn(async () => { throw new Error("private query detail"); }));
    await expect(service.search("private input")).rejects.toThrow("Offline dictionary search failed.");
  });

  it("rejects unsafe nested dictionary entry fields", async () => {
    const service = createMobileDictionaryService(vi.fn(async () => ({ id: 7, headword: "safe", pronunciations: [], partsOfSpeech: [], etymology: null, forms: [], relatedWords: [], sources: [{ sourceKey: "safe", sourceName: "Safe", sourceVersion: "1", sourceDate: null, licenseName: "Test", attribution: "Test", homepage: "https://example.invalid", uri: "content://hidden" }] })));
    await expect(service.getEntry(7)).rejects.toThrow("Offline dictionary entry is unavailable.");
  });
});
