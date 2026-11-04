import type { Language } from "@/types/ipc";

import { enUS } from "./en-US";
import { ptBR, type Dictionary } from "./pt-BR";

export const DICTIONARIES: Record<Language, Dictionary> = { "pt-BR": ptBR, "en-US": enUS };
export const DEFAULT_LANGUAGE: Language = "pt-BR";
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
];

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every dot-separated leaf key of the dictionary, e.g. "cleaning.cat.user_temp.name". */
export type TranslationKey = Leaves<Dictionary>;

export type TranslationParams = Record<string, string | number>;

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(language: Language, key: TranslationKey, params?: TranslationParams) {
  const dict = DICTIONARIES[language] ?? ptBR;
  const text = lookup(dict, key) ?? lookup(ptBR, key) ?? key;
  return interpolate(text, params);
}

/** Translate a dynamic key (from backend ids) with a fallback. */
export function translateDynamic(
  language: Language,
  key: string,
  fallback: string,
  params?: TranslationParams,
): string {
  const dict = DICTIONARIES[language] ?? ptBR;
  const text = lookup(dict, key) ?? lookup(ptBR, key);
  return interpolate(text ?? fallback, params);
}

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export function createTranslator(language: Language): Translator {
  return (key, params) => translate(language, key, params);
}
