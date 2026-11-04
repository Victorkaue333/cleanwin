import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Tauri runtime is not available under jsdom: every test talks to these mocks.
vi.mock("@tauri-apps/api/core", () => {
  class Channel<T> {
    onmessage: (data: T) => void = () => undefined;
  }
  return {
    invoke: vi.fn(async () => undefined),
    Channel,
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(async () => undefined),
    toggleMaximize: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    isMaximized: vi.fn(async () => false),
    onResized: vi.fn(async () => () => undefined),
  }),
}));
