// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

it("shows a fallback when a child render crashes", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );

  expect(screen.getByText("Something went wrong. Restart the app or reopen the course folder.")).toBeInTheDocument();
});
