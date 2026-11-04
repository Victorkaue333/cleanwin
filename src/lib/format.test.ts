import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatCapacity,
  formatDuration,
  formatPercent,
  formatRate,
  formatTemperature,
  formatUptimeLong,
  formatUptimeShort,
  scaleBytes,
  shortenPath,
  splitUptime,
} from "./format";

const GB = 1024 ** 3;
const TB = 1024 ** 4;

describe("scaleBytes", () => {
  it("picks binary units", () => {
    expect(scaleBytes(0)).toEqual({ value: 0, unit: "B" });
    expect(scaleBytes(1023)).toEqual({ value: 1023, unit: "B" });
    expect(scaleBytes(1024)).toEqual({ value: 1, unit: "KB" });
    expect(scaleBytes(1.5 * GB).unit).toBe("GB");
    expect(scaleBytes(2 * TB).unit).toBe("TB");
  });

  it("handles invalid input", () => {
    expect(scaleBytes(-5)).toEqual({ value: 0, unit: "B" });
    expect(scaleBytes(Number.NaN)).toEqual({ value: 0, unit: "B" });
  });
});

describe("formatBytes", () => {
  it("uses pt-BR decimal comma like the mockup", () => {
    expect(formatBytes(162.03 * GB, "pt-BR")).toBe("162,03 GB");
    expect(formatBytes(482.7 * 1024 ** 2, "pt-BR")).toBe("482,7 MB");
    expect(formatBytes(15.95 * GB, "pt-BR")).toBe("15,95 GB");
  });

  it("uses en-US formatting", () => {
    expect(formatBytes(162.03 * GB, "en-US")).toBe("162.03 GB");
  });

  it("uses no decimals for bytes/KB, one for MB, two for GB+", () => {
    expect(formatBytes(512, "pt-BR")).toBe("512 B");
    expect(formatBytes(900.4 * GB, "pt-BR")).toBe("900,4 GB");
    expect(formatBytes(3.5 * 1024, "pt-BR")).toBe("4 KB");
    expect(formatBytes(1024 ** 2, "pt-BR")).toBe("1 MB");
  });
});

describe("formatCapacity", () => {
  it("rounds whole capacities", () => {
    expect(formatCapacity(24 * GB, "pt-BR")).toBe("24 GB");
    expect(formatCapacity(TB, "pt-BR")).toBe("1 TB");
    expect(formatCapacity(931.5 * GB, "pt-BR")).toBe("932 GB");
  });
});

describe("formatRate", () => {
  it("formats decimal kB/s like the mockup", () => {
    expect(formatRate(230_000, "pt-BR")).toBe("230 kB/s");
    expect(formatRate(772_000, "pt-BR")).toBe("772 kB/s");
    expect(formatRate(0, "pt-BR")).toBe("0 B/s");
    expect(formatRate(12_345_678, "pt-BR")).toBe("12,3 MB/s");
  });
});

describe("formatPercent", () => {
  it("clamps and handles nulls", () => {
    expect(formatPercent(22.4, "pt-BR")).toBe("22%");
    expect(formatPercent(66.5, "pt-BR", 1)).toBe("66,5%");
    expect(formatPercent(150, "pt-BR")).toBe("100%");
    expect(formatPercent(-3, "pt-BR")).toBe("0%");
    expect(formatPercent(null, "pt-BR")).toBe("—");
  });
});

describe("formatTemperature", () => {
  it("formats celsius", () => {
    expect(formatTemperature(56.4)).toBe("56°C");
    expect(formatTemperature(null)).toBe("—");
  });
});

describe("uptime", () => {
  it("splits seconds", () => {
    expect(splitUptime(5 * 3600 + 23 * 60 + 7)).toEqual({ days: 0, hours: 5, minutes: 23 });
    expect(splitUptime(2 * 86_400 + 4 * 3600)).toEqual({ days: 2, hours: 4, minutes: 0 });
    expect(splitUptime(-10)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it("formats the compact header value", () => {
    expect(formatUptimeShort(5 * 3600 + 23 * 60)).toBe("5H 23M");
    expect(formatUptimeShort(2 * 86_400 + 4 * 3600)).toBe("2D 4H");
  });

  it("formats the long value", () => {
    expect(formatUptimeLong(5 * 3600 + 23 * 60)).toBe("5 h 23 min");
    expect(formatUptimeLong(90)).toBe("1 min");
  });
});

describe("formatDuration", () => {
  it("scales units", () => {
    expect(formatDuration(450, "pt-BR")).toBe("450 ms");
    expect(formatDuration(1500, "pt-BR")).toBe("1,5 s");
    expect(formatDuration(125_000, "pt-BR")).toBe("2 min 5 s");
  });
});

describe("shortenPath", () => {
  it("keeps short paths and shortens long ones", () => {
    expect(shortenPath("C:\\Temp\\a.tmp")).toBe("C:\\Temp\\a.tmp");
    const long = "C:\\Users\\victor\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\f_000123";
    expect(shortenPath(long, 30)).toBe("C:\\…\\Cache\\f_000123");
  });
});
