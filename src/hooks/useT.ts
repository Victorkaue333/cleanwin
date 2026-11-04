import { useMemo } from "react";

import { createTranslator, translateDynamic, type Translator } from "@/i18n";
import * as fmt from "@/lib/format";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Language } from "@/types/ipc";

export function useLanguage(): Language {
  return useSettingsStore((s) => s.settings.language);
}

/** Translator bound to the current language. */
export function useT(): Translator {
  const language = useLanguage();
  return useMemo(() => createTranslator(language), [language]);
}

export function useTDynamic() {
  const language = useLanguage();
  return useMemo(
    () => (key: string, fallback: string, params?: Record<string, string | number>) =>
      translateDynamic(language, key, fallback, params),
    [language],
  );
}

/** Locale-bound formatting helpers. */
export function useFormat() {
  const language = useLanguage();
  return useMemo(
    () => ({
      bytes: (v: number, options?: fmt.FormatBytesOptions) => fmt.formatBytes(v, language, options),
      capacity: (v: number) => fmt.formatCapacity(v, language),
      rate: (v: number) => fmt.formatRate(v, language),
      percent: (v: number | null | undefined, digits?: number) =>
        fmt.formatPercent(v, language, digits),
      temperature: (v: number | null | undefined) => fmt.formatTemperature(v, language),
      integer: (v: number) => fmt.formatInteger(v, language),
      duration: (ms: number) => fmt.formatDuration(ms, language),
      frequency: (mhz: number) => fmt.formatFrequency(mhz, language),
      date: (ms: number | null) => fmt.formatDate(ms, language),
      uptimeShort: fmt.formatUptimeShort,
      uptimeLong: (s: number) => fmt.formatUptimeLong(s, language),
      shortenPath: fmt.shortenPath,
    }),
    [language],
  );
}
