import { describe, expect, it } from "vitest";

import type { ProcessInfo } from "@/types/ipc";

import { DEFAULT_PROCESS_SORT, filterProcesses, sortProcesses, toggleSort } from "./processes";

function p(pid: number, name: string, cpu: number, mem: number, exe: string | null = null): ProcessInfo {
  return {
    pid,
    parentPid: null,
    name,
    exe,
    cpuPercent: cpu,
    memoryBytes: mem,
    startTimeSecs: 0,
    protected: false,
    protectionReason: null,
  };
}

const LIST = [
  p(10, "firefox.exe", 3.2, 500, "C:\\Program Files\\Mozilla Firefox\\firefox.exe"),
  p(20, "Code.exe", 1.1, 270),
  p(30, "Discord.exe", 0.4, 125),
  p(40, "svchost.exe", 0.0, 125),
];

describe("sortProcesses", () => {
  it("sorts by memory desc by default with pid tiebreak", () => {
    const sorted = sortProcesses(LIST, DEFAULT_PROCESS_SORT);
    expect(sorted.map((x) => x.pid)).toEqual([10, 20, 40, 30]);
  });

  it("sorts by name case-insensitively", () => {
    const sorted = sortProcesses(LIST, { key: "name", direction: "asc" });
    expect(sorted.map((x) => x.name)).toEqual(["Code.exe", "Discord.exe", "firefox.exe", "svchost.exe"]);
  });

  it("sorts by cpu and pid", () => {
    expect(sortProcesses(LIST, { key: "cpuPercent", direction: "desc" })[0]?.pid).toBe(10);
    expect(sortProcesses(LIST, { key: "pid", direction: "desc" })[0]?.pid).toBe(40);
  });

  it("does not mutate the input", () => {
    const copy = LIST.slice();
    sortProcesses(LIST, { key: "name", direction: "asc" });
    expect(LIST).toEqual(copy);
  });
});

describe("filterProcesses", () => {
  it("matches name, pid and exe", () => {
    expect(filterProcesses(LIST, "code").map((x) => x.pid)).toEqual([20]);
    expect(filterProcesses(LIST, "30").map((x) => x.pid)).toEqual([30]);
    expect(filterProcesses(LIST, "mozilla").map((x) => x.pid)).toEqual([10]);
    expect(filterProcesses(LIST, "   ")).toHaveLength(4);
    expect(filterProcesses(LIST, "nothing")).toHaveLength(0);
  });
});

describe("toggleSort", () => {
  it("flips direction on the same key and picks sensible defaults", () => {
    expect(toggleSort({ key: "memoryBytes", direction: "desc" }, "memoryBytes")).toEqual({
      key: "memoryBytes",
      direction: "asc",
    });
    expect(toggleSort({ key: "memoryBytes", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
    expect(toggleSort({ key: "name", direction: "asc" }, "cpuPercent")).toEqual({
      key: "cpuPercent",
      direction: "desc",
    });
  });
});
