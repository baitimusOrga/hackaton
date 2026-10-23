import { registerLocaleData } from '@angular/common';
import localeEnCh from '@angular/common/locales/en-CH';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { errorInterceptor } from './errors';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth-interceptor';

// English UI with Swiss number format: CHF 1’250.00
registerLocaleData(localeEnCh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideApiConfiguration(''),
    { provide: LOCALE_ID, useValue: 'en-CH' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'CHF' },
  ],
};
