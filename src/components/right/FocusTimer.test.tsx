// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FocusTimer } from "./FocusTimer";

const notifyFocusSessionComplete = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("../../lib/notifications", () => ({
  notifyFocusSessionComplete,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("renders the provided timer presets", () => {
  render(
    <FocusTimer
      timerMode="focus"
      timerPreset={30}
      timerPresets={[15, 30, 60]}
      onPickPreset={() => {}}
      onToggleMode={() => {}}
    />,
  );

  expect(screen.getByText("15m")).toBeInTheDocument();
  expect(screen.getByText("30m")).toBeInTheDocument();
  expect(screen.getByText("60m")).toBeInTheDocument();
});

it("shows completion state and sends a local notification when focus time ends", () => {
  vi.useFakeTimers();

  render(
    <FocusTimer
      timerMode="focus"
      timerPreset={1}
      timerPresets={[1]}
      onPickPreset={() => {}}
      onToggleMode={() => {}}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  act(() => vi.advanceTimersByTime(60_000));

  expect(screen.getByText("00:00")).toBeInTheDocument();
  expect(screen.getByText("Focus session complete")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Complete" })).toBeDisabled();
  expect(notifyFocusSessionComplete).toHaveBeenCalledTimes(1);
});

it("validates custom minutes safely", () => {
  const onPickPreset = vi.fn();

  render(
    <FocusTimer
      timerMode="focus"
      timerPreset={25}
      timerPresets={[25, 50, 90]}
      onPickPreset={onPickPreset}
      onToggleMode={() => {}}
    />,
  );

  fireEvent.change(screen.getByPlaceholderText("Custom minutes"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));

  expect(screen.getByText("Enter minutes above 0.")).toBeInTheDocument();
  expect(onPickPreset).not.toHaveBeenCalled();
});
