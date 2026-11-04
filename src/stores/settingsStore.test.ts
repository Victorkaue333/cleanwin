import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { DEFAULT_SETTINGS, mergeSettings, useSettingsStore } from "./settingsStore";

const invokeMock = invoke as unknown as Mock;

describe("mergeSettings", () => {
  it("merges top-level and nested cleaning fields", () => {
    const next = mergeSettings(DEFAULT_SETTINGS, {
      language: "en-US",
      cleaning: { recentHours: 48 },
    });
    expect(next.language).toBe("en-US");
    expect(next.cleaning.recentHours).toBe(48);
    expect(next.cleaning.skipRecentFiles).toBe(true);
    expect(next.cleaning.defaultCategories).toEqual(DEFAULT_SETTINGS.cleaning.defaultCategories);
    expect(DEFAULT_SETTINGS.language).toBe("pt-BR");
  });
});

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: false, saving: false, error: null });
    invokeMock.mockReset();
  });

  it("loads settings from the backend", async () => {
    invokeMock.mockResolvedValueOnce({ ...DEFAULT_SETTINGS, refreshIntervalMs: 3000 });
    await useSettingsStore.getState().load();
    expect(invokeMock).toHaveBeenCalledWith("get_settings", undefined);
    expect(useSettingsStore.getState().settings.refreshIntervalMs).toBe(3000);
    expect(useSettingsStore.getState().loaded).toBe(true);
  });

  it("persists an update optimistically and keeps the sanitized value", async () => {
    invokeMock.mockImplementationOnce(async (_cmd: string, args: { settings: typeof DEFAULT_SETTINGS }) => ({
      ...args.settings,
      refreshIntervalMs: 500, // backend clamps
    }));
    const saved = await useSettingsStore.getState().update({ refreshIntervalMs: 10 });
    expect(invokeMock).toHaveBeenCalledWith("update_settings", {
      settings: { ...DEFAULT_SETTINGS, refreshIntervalMs: 10 },
    });
    expect(saved.refreshIntervalMs).toBe(500);
    expect(useSettingsStore.getState().settings.refreshIntervalMs).toBe(500);
  });

  it("rolls back when the backend rejects", async () => {
    invokeMock.mockRejectedValueOnce({ code: "internal", message: "autostart: denied" });
    await expect(useSettingsStore.getState().update({ launchAtStartup: true })).rejects.toMatchObject({
      code: "internal",
    });
    expect(useSettingsStore.getState().settings.launchAtStartup).toBe(false);
    expect(useSettingsStore.getState().error?.message).toContain("autostart");
  });

  it("exposes load errors", async () => {
    invokeMock.mockRejectedValueOnce("ipc unavailable");
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().error?.code).toBe("internal");
    vi.restoreAllMocks();
  });
});
