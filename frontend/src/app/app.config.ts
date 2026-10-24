import { registerLocaleData } from '@angular/common';
import localeEnCh from '@angular/common/locales/en-CH';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { errorInterceptor } from './errors';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth-interceptor';

// English UI with Swiss number format: CHF 1’250.00
registerLocaleData(localeEnCh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Forward navigation starts at the top, back/forward restore the position; without this the
    // router keeps the old scroll offset, e.g. a similar listing opens scrolled to its own bottom.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideApiConfiguration(''),
    { provide: LOCALE_ID, useValue: 'en-CH' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'CHF' },
  ],
};
