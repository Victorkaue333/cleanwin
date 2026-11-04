import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SegmentedMeter } from "./SegmentedMeter";

function litCount() {
  return screen.getAllByTestId("meter-segment").filter((el) => el.dataset.lit === "true").length;
}

describe("SegmentedMeter", () => {
  it("renders 10 cells and lights them by percentage", () => {
    render(<SegmentedMeter percent={22} label="CPU" />);
    expect(screen.getAllByTestId("meter-segment")).toHaveLength(10);
    expect(litCount()).toBe(2);
    const meter = screen.getByRole("meter", { name: "CPU" });
    expect(meter).toHaveAttribute("aria-valuenow", "22");
    expect(meter).toHaveAttribute("data-level", "ok");
  });

  it("uses the high (orange) and critical (red) levels", () => {
    const { rerender } = render(<SegmentedMeter percent={81} label="Disco" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-level", "high");
    expect(litCount()).toBe(8);
    const lit = screen.getAllByTestId("meter-segment")[0];
    expect(lit?.className).toContain("bg-primary");

    rerender(<SegmentedMeter percent={95} label="Disco" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-level", "critical");
    expect(screen.getAllByTestId("meter-segment")[0]?.className).toContain("bg-danger");
  });

  it("renders empty for null", () => {
    render(<SegmentedMeter percent={null} label="GPU" />);
    expect(litCount()).toBe(0);
    expect(screen.getByRole("meter")).not.toHaveAttribute("aria-valuenow");
  });
});
