// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DictionaryDrawer } from "./DictionaryDrawer";

afterEach(cleanup);

it("shows the offline installation state and imports a local pack", async () => {
  const importPack = vi.fn(async () => ({ installed: true, packVersion: "1", sourceDate: null, entryCount: 4, databaseSizeBytes: 100, sources: [] }));
  render(<DictionaryDrawer open onClose={() => {}} courseRoot={null} statusLoader={async () => ({ installed: false, packVersion: null, sourceDate: null, entryCount: 0, databaseSizeBytes: 0, sources: [] })} importPack={importPack} choosePack={async () => "/tmp/fixture.dict.sqlite"} />);
  expect(await screen.findByText("No dictionary pack is installed.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Import Dictionary Pack" }));
  await waitFor(() => expect(importPack).toHaveBeenCalledWith("/tmp/fixture.dict.sqlite"));
  expect(await screen.findByPlaceholderText("Search offline dictionary")).toBeInTheDocument();
});

it("searches, navigates results, and renders entry provenance", async () => {
  render(<DictionaryDrawer
    open onClose={() => {}} courseRoot={null}
    statusLoader={async () => ({ installed: true, packVersion: "1", sourceDate: null, entryCount: 4, databaseSizeBytes: 100, sources: [{ sourceKey: "kaikki-wiktionary", sourceName: "Wiktionary / Kaikki", sourceVersion: "test", sourceDate: null, licenseName: "CC BY-SA 4.0 and GFDL", attribution: "Wiktionary contributors", homepage: "https://kaikki.org/" }] })}
    searchDictionary={async () => [{ entryId: 1, headword: "run", partOfSpeech: "verb", shortDefinition: "move swiftly", source: "Wiktionary / Kaikki" }]}
    loadEntry={async () => ({ id: 1, headword: "run", pronunciations: [{ ipa: "/ɹʌn/", region: "US", audioFilename: null, audioAvailable: false }], partsOfSpeech: [{ name: "verb", senses: [{ order: 1, definition: "move swiftly", tags: [], examples: ["I run."] }, { order: 2, definition: "manage or operate", tags: [], examples: [] }] }], etymology: null, forms: [{ form: "running", tags: ["participle"] }], relatedWords: [{ relationType: "synonym", targetWord: "sprint", source: "Wiktionary / Kaikki" }], sources: [{ sourceKey: "kaikki-wiktionary", sourceName: "Wiktionary / Kaikki", sourceVersion: "test", sourceDate: null, licenseName: "CC BY-SA 4.0 and GFDL", attribution: "Wiktionary contributors", homepage: "https://kaikki.org/" }] })}
  />);
  const input = await screen.findByPlaceholderText("Search offline dictionary");
  expect(screen.queryByText("Loading offline dictionary...")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "run" } });
  expect(await screen.findByRole("option", { name: /run/ })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("heading", { name: "run" })).toBeInTheDocument();
  expect(screen.getByText("/ɹʌn/")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("move swiftly")).toHaveClass("dictionary-definition");
  expect(screen.getByText("I run.")).toHaveClass("dictionary-example");
  expect(screen.getByText("running")).toBeInTheDocument();
  expect(screen.getByText("sprint")).toBeInTheDocument();
  const sources = screen.getByText("Dictionary sources").closest("details");
  expect(sources).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Dictionary sources"));
  expect(screen.getByText("Wiktionary contributors")).toBeVisible();
});

it("has a sticky header, prominent labelled search, and grouped vocabulary controls", async () => {
  render(<DictionaryDrawer
    open onClose={() => {}} courseRoot="/tmp/course"
    statusLoader={async () => ({ installed: true, packVersion: "1", sourceDate: null, entryCount: 4, databaseSizeBytes: 100, sources: [] })}
    searchDictionary={async () => []}
  />);

  expect(await screen.findByRole("heading", { name: "Dictionary" })).toBeInTheDocument();
  expect(screen.getByText("Installed")).toBeInTheDocument();
  expect(screen.getByLabelText("Search dictionary")).toHaveClass("dictionary-search-input");
  expect(screen.getByRole("button", { name: "Close Dictionary" })).toBeInTheDocument();
});

it("remains mounted but hidden when closed", () => {
  render(<DictionaryDrawer open={false} onClose={() => {}} courseRoot={null} />);
  expect(screen.getByLabelText("Dictionary")).not.toBeVisible();
});
