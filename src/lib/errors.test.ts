import { describe, expect, it } from "vitest";

import { AppError, toAppError } from "./errors";

describe("toAppError", () => {
  it("keeps AppError instances", () => {
    const e = new AppError("busy", "x");
    expect(toAppError(e)).toBe(e);
  });

  it("maps the Rust payload shape", () => {
    const e = toAppError({ code: "protected", message: "csrss.exe (critical_windows_process)" });
    expect(e.code).toBe("protected");
    expect(e.message).toContain("csrss.exe");
  });

  it("falls back to internal for unknown codes", () => {
    expect(toAppError({ code: "weird", message: "m" }).code).toBe("internal");
  });

  it("parses JSON strings and plain strings", () => {
    expect(toAppError(JSON.stringify({ code: "not_found", message: "pid" })).code).toBe("not_found");
    const plain = toAppError("window.minimize not allowed");
    expect(plain.code).toBe("internal");
    expect(plain.message).toBe("window.minimize not allowed");
  });

  it("wraps Errors and unknown values", () => {
    expect(toAppError(new Error("boom")).message).toBe("boom");
    expect(toAppError(42).code).toBe("internal");
  });
});
