import type { ProcessInfo } from "@/types/ipc";

export type ProcessSortKey = "name" | "pid" | "cpuPercent" | "memoryBytes";
export type SortDirection = "asc" | "desc";

export interface ProcessSort {
  key: ProcessSortKey;
  direction: SortDirection;
}

export const DEFAULT_PROCESS_SORT: ProcessSort = { key: "memoryBytes", direction: "desc" };

export function sortProcesses(list: readonly ProcessInfo[], sort: ProcessSort): ProcessInfo[] {
  const dir = sort.direction === "asc" ? 1 : -1;
  const sorted = list.slice();
  sorted.sort((a, b) => {
    let cmp: number;
    switch (sort.key) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "pid":
        cmp = a.pid - b.pid;
        break;
      case "cpuPercent":
        cmp = a.cpuPercent - b.cpuPercent;
        break;
      case "memoryBytes":
      default:
        cmp = a.memoryBytes - b.memoryBytes;
        break;
    }
    if (cmp === 0) cmp = a.pid - b.pid;
    return cmp * dir;
  });
  return sorted;
}

/** Case-insensitive match on name, pid or executable path. */
export function filterProcesses(list: readonly ProcessInfo[], query: string): ProcessInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice();
  const asPid = /^\d+$/.test(q) ? Number(q) : null;
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (asPid !== null && p.pid === asPid) ||
      (p.exe?.toLowerCase().includes(q) ?? false),
  );
}

export function toggleSort(current: ProcessSort, key: ProcessSortKey): ProcessSort {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "name" || key === "pid" ? "asc" : "desc" };
}
