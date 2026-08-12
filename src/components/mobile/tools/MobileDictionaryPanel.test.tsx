// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MobileDictionaryService } from "../../../lib/mobileDictionaryService";
import { MobileDictionaryPanel } from "./MobileDictionaryPanel";

const status = { installed: true, packVersion: "test", sourceDate: null, entryCount: 1, databaseSizeBytes: 1024, sources: [] };
const result = { entryId: 3, headword: "study", partOfSpeech: "verb", shortDefinition: "To learn deliberately.", source: "Synthetic" };
const entry = {
  id: 3, headword: "study", pronunciations: [], etymology: null, forms: [], relatedWords: [], sources: [{ sourceKey: "synthetic", sourceName: "Synthetic", sourceVersion: "1", sourceDate: null, licenseName: "Test", attribution: "Synthetic", homepage: "" }],
  partsOfSpeech: [{ name: "verb", senses: [{ order: 1, definition: "To learn deliberately.", tags: [], examples: [], source: "Synthetic" }] }],
};

afterEach(cleanup);

function service(overrides: Partial<MobileDictionaryService> = {}): MobileDictionaryService {
  return {
    status: async () => status,
    importPack: async () => status,
    search: async () => [result],
    getEntry: async () => entry,
    ...overrides,
  };
}

describe("mobile offline dictionary", () => {
  it("searches the installed local pack and opens a definition", async () => {
    render(<MobileDictionaryPanel service={service()} onAddVocabulary={() => undefined} />);
    const input = await screen.findByRole("searchbox", { name: "Search offline dictionary" });
    fireEvent.change(input, { target: { value: "study" } });
    fireEvent.click(await screen.findByRole("button", { name: /study.*learn deliberately/i }));

    expect(await screen.findByText("To learn deliberately.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Vocabulary" })).toBeEnabled();
  });

  it("imports a user-selected pack without showing a filesystem path", async () => {
    const importPack = vi.fn(async () => status);
    render(<MobileDictionaryPanel service={service({
      status: async () => ({ ...status, installed: false, entryCount: 0 }), importPack,
    })} onAddVocabulary={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Import Dictionary Pack" }));
    await waitFor(() => expect(importPack).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/content:\/\//i)).not.toBeInTheDocument();
  });

  it("adds the selected definition to the course vocabulary", async () => {
    const add = vi.fn();
    render(<MobileDictionaryPanel service={service()} onAddVocabulary={add} />);
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search offline dictionary" }), { target: { value: "study" } });
    fireEvent.click(await screen.findByRole("button", { name: /study.*learn deliberately/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Add to Vocabulary" }));

    expect(add).toHaveBeenCalledWith(entry);
  });
});
