import { describe, expect, it } from "vitest";

import { historyMax, pushHistory, sparklinePoints } from "./history";
import { litSegments, temperatureLevel, usageLevel } from "./thresholds";

describe("usageLevel", () => {
  it("maps percentages to levels", () => {
    expect(usageLevel(0)).toBe("ok");
    expect(usageLevel(69.9)).toBe("ok");
    expect(usageLevel(70)).toBe("high");
    expect(usageLevel(89.9)).toBe("high");
    expect(usageLevel(90)).toBe("critical");
    expect(usageLevel(null)).toBe("ok");
  });

  it("maps temperatures", () => {
    expect(temperatureLevel(56)).toBe("ok");
    expect(temperatureLevel(80)).toBe("high");
    expect(temperatureLevel(95)).toBe("critical");
  });
});

describe("litSegments", () => {
  it("rounds to the nearest cell, never 0 for a positive value", () => {
    expect(litSegments(0)).toBe(0);
    expect(litSegments(1)).toBe(1);
    expect(litSegments(22)).toBe(2);
    expect(litSegments(66)).toBe(7);
    expect(litSegments(81)).toBe(8);
    expect(litSegments(100)).toBe(10);
    expect(litSegments(140)).toBe(10);
    expect(litSegments(null)).toBe(0);
    expect(litSegments(50, 6)).toBe(3);
  });
});

describe("history", () => {
  it("keeps a bounded series", () => {
    let h: number[] = [];
    for (let i = 0; i < 70; i += 1) h = pushHistory(h, i, 60);
    expect(h).toHaveLength(60);
    expect(h[0]).toBe(10);
    expect(h[59]).toBe(69);
  });

  it("ignores non-finite values and computes max", () => {
    const h = pushHistory([1, 2], Number.NaN);
    expect(h).toEqual([1, 2, 0]);
    expect(historyMax([1, 5, 3])).toBe(5);
    expect(historyMax([], 1)).toBe(1);
  });

  it("builds polyline points within the box", () => {
    const pts = sparklinePoints([0, 50, 100], 100, 20, 100, 0);
    expect(pts).toBe("0.0,20.0 50.0,10.0 100.0,0.0");
    expect(sparklinePoints([], 100, 20, 100)).toBe("");
  });
});
