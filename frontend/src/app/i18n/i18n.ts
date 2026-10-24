import { Injectable, Pipe, PipeTransform, effect, inject, signal } from '@angular/core';
import { MESSAGES } from './messages';

export const LANGS = ['de', 'fr', 'it', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** German source text → its translations. German is the key, so `de` is only set for English-keyed texts (backend errors). */
export type Messages = Record<string, Record<Exclude<Lang, 'de'>, string> & { de?: string }>;

type Params = Record<string, string | number | null | undefined>;

const STORAGE_KEY = 'lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(stored as Lang)) return stored as Lang;
  } catch {
    // storage blocked: fall through to the browser language
  }
  const browser = (typeof navigator === 'undefined' ? '' : navigator.language).slice(0, 2);
  return LANGS.includes(browser as Lang) ? (browser as Lang) : 'de';
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(initialLang());

  constructor() {
    effect(() => {
      const lang = this.lang();
      document.documentElement.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // storage blocked: the choice just lasts for this visit
      }
    });
  }

  /** Translates `key` (the German text); `{name}` placeholders are filled from `params`. Reads the lang signal, so callers in templates and computeds update on a switch. */
  t(key: string, params?: Params): string {
    const lang = this.lang();
    const text = MESSAGES[key]?.[lang] ?? key;
    return params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')) : text;
  }
}

/** `{{ 'Meine Suchen' | t }}` or `{{ 'Hallo {name}' | t: { name } }}` */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(key: string, params?: Params): string {
    return this.i18n.t(key, params);
  }
}
