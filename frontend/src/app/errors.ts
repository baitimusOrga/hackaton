import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { I18n } from './i18n/i18n';

export interface Problem {
  status?: number;
  title?: string;
  detail?: string;
  errors?: Record<string, string>;
}

export const HANDLES_ERRORS = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class ErrorBanner {
  readonly message = signal<string | null>(null);

  show(message: string): void {
    this.message.set(message);
  }

  dismiss(): void {
    this.message.set(null);
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const banner = inject(ErrorBanner);
  const i18n = inject(I18n);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(HANDLES_ERRORS)) {
        banner.show(messageOf(err, i18n));
      }
      return throwError(() => err);
    }),
  );
};

const UNREACHABLE = 'Der Server ist gerade nicht erreichbar. Versuch es in einem Moment nochmals.';

/** The user-facing text for a failed request; never the raw "Http failure response …" message. */
export function messageOf(err: HttpErrorResponse, i18n: I18n): string {
  // 0: no connection; 502–504: the proxy is up but the backend is not.
  if (err.status === 0 || (err.status >= 502 && err.status <= 504)) return i18n.t(UNREACHABLE);
  const problem = typeof err.error === 'object' && err.error ? (err.error as Problem) : {};
  if (problem.detail) return translateError(problem.detail, i18n);
  if (err.status === 404) return i18n.t('Das haben wir nicht gefunden.');
  return i18n.t('Etwas ist schiefgelaufen. Versuch es nochmals.');
}

// Backend and auth errors are English sentences, some with a variable part.
const ERROR_PATTERNS: [RegExp, string][] = [
  [/^Unknown category: (?<category>.+)$/, 'Unknown category: {category}'],
  [/^Postcode (?<code>.+) not found\.$/, 'Postcode {code} not found.'],
  [/^(?<name>.+) is already listed\.$/, '{name} is already listed.'],
  [
    /^Your maximum must be at least CHF (?<amount>[\d.]+)\.$/,
    'Your maximum must be at least CHF {amount}.',
  ],
  [
    /^You already lead with a maximum of CHF (?<amount>[\d.]+)\.$/,
    'You already lead with a maximum of CHF {amount}.',
  ],
  [
    /^Please confirm the quantity of (?<name>.+) first\.$/,
    'Please confirm the quantity of {name} first.',
  ],
  [
    /^Please set the price per piece of (?<name>.+) first; the estimate is only a suggestion\.$/,
    'Please set the price per piece of {name} first; the estimate is only a suggestion.',
  ],
];

/** Translates a backend or auth error text; unknown texts stay as they are. */
export function translateError(message: string, i18n: I18n): string {
  for (const [pattern, key] of ERROR_PATTERNS) {
    const groups = pattern.exec(message)?.groups;
    if (groups) return i18n.t(key, groups);
  }
  return i18n.t(message);
}
