import { describe, expect, it } from "vitest";

import type { ScanCategoryResult } from "@/types/ipc";

import {
  applyCleanEvent,
  applyScanEvent,
  cleanableSelection,
  selectedTotals,
  toggleSelection,
} from "./cleaningStore";

function result(id: string, fileCount: number, totalBytes: number): ScanCategoryResult {
  return {
    id,
    roots: [],
    fileCount,
    totalBytes,
    skippedRecentCount: 0,
    skippedRecentBytes: 0,
    accessDeniedCount: 0,
    partial: false,
    largest: [],
  };
}

describe("toggleSelection", () => {
  it("adds and removes ids without mutation", () => {
    const base = ["a"];
    expect(toggleSelection(base, "b")).toEqual(["a", "b"]);
    expect(toggleSelection(base, "a")).toEqual([]);
    expect(base).toEqual(["a"]);
  });
});

describe("applyScanEvent", () => {
  it("tracks progress and results per category", () => {
    let state = applyScanEvent({}, {}, { type: "categoryStarted", id: "user_temp" });
    expect(state.progress.user_temp).toEqual({ id: "user_temp", fileCount: 0, totalBytes: 0, finished: false });

    state = applyScanEvent(state.progress, state.results, {
      type: "progress",
      id: "user_temp",
      fileCount: 10,
      totalBytes: 2048,
    });
    expect(state.progress.user_temp?.fileCount).toBe(10);
    expect(state.results.user_temp).toBeUndefined();

    const r = result("user_temp", 12, 4096);
    state = applyScanEvent(state.progress, state.results, { type: "categoryFinished", result: r });
    expect(state.progress.user_temp?.finished).toBe(true);
    expect(state.progress.user_temp?.fileCount).toBe(12);
    expect(state.results.user_temp).toBe(r);
  });
});

describe("applyCleanEvent", () => {
  it("keeps the file count from categoryStarted across progress events", () => {
    let state = applyCleanEvent({}, {}, { type: "categoryStarted", id: "x", fileCount: 100 });
    state = applyCleanEvent(state.progress, state.results, {
      type: "progress",
      id: "x",
      processed: 40,
      deletedFiles: 38,
      freedBytes: 999,
      lockedFiles: 2,
      failedFiles: 0,
    });
    expect(state.progress.x).toMatchObject({ fileCount: 100, processed: 40, deletedFiles: 38, lockedFiles: 2 });

    state = applyCleanEvent(state.progress, state.results, {
      type: "categoryFinished",
      result: {
        id: "x",
        deletedFiles: 97,
        freedBytes: 5000,
        lockedFiles: 3,
        failedFiles: 0,
        missingFiles: 0,
        removedDirs: 2,
        errors: [],
      },
    });
    expect(state.progress.x).toMatchObject({ finished: true, processed: 100, deletedFiles: 97 });
    expect(state.results.x?.removedDirs).toBe(2);
  });
});

describe("selection helpers", () => {
  const results = {
    a: result("a", 5, 500),
    b: result("b", 0, 0),
    c: result("c", 2, 50),
  };

  it("only cleans selected categories with files", () => {
    expect(cleanableSelection(["a", "b", "c", "unknown"], results)).toEqual(["a", "c"]);
  });

  it("sums totals of the cleanable selection", () => {
    expect(selectedTotals(["a", "b", "c"], results)).toEqual({ files: 7, bytes: 550, categories: 2 });
    expect(selectedTotals([], results)).toEqual({ files: 0, bytes: 0, categories: 0 });
  });
});
