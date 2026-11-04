import { describe, expect, it } from "vitest";

import { DICTIONARIES, interpolate, translate, translateDynamic } from "./index";
import { ptBR } from "./pt-BR";

function leaves(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leaves(v as Record<string, unknown>, `${prefix}${k}.`),
  );
}

describe("dictionaries", () => {
  it("en-US has exactly the same keys as pt-BR", () => {
    const pt = leaves(ptBR as unknown as Record<string, unknown>).sort();
    const en = leaves(DICTIONARIES["en-US"] as unknown as Record<string, unknown>).sort();
    expect(en).toEqual(pt);
  });

  it("covers every backend error code and category id", () => {
    for (const code of ["io", "permission_denied", "not_found", "invalid_operation", "protected", "unsupported", "busy", "cancelled", "internal"]) {
      expect(ptBR.errors[code as keyof typeof ptBR.errors]).toBeTypeOf("string");
    }
    for (const id of ["user_temp", "windows_temp", "browser_cache", "crash_reports", "shader_cache", "thumbnail_cache", "inet_cache"]) {
      expect(ptBR.cleaning.cat[id as keyof typeof ptBR.cleaning.cat].name).toBeTypeOf("string");
    }
  });
});

describe("translate", () => {
  it("interpolates params", () => {
    expect(interpolate("{a} de {b}", { a: 1, b: "x" })).toBe("1 de x");
    expect(interpolate("{missing}", {})).toBe("{missing}");
    expect(translate("pt-BR", "metrics.storageFree", { free: "162,03 GB", total: "1 TB" })).toBe(
      "162,03 GB livres de 1 TB",
    );
    expect(translate("en-US", "health.healthy")).toBe("System healthy");
  });

  it("falls back to pt-BR and then to the key / fallback for unknown entries", () => {
    expect(translateDynamic("en-US", "cleaning.cat.nope.name", "nope")).toBe("nope");
    expect(translateDynamic("en-US", "health.reasons.cpu_high", "cpu_high")).toBe("High CPU usage");
  });
});
