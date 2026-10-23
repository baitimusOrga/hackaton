import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { csrfInterceptor } from './auth/auth';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { errorInterceptor } from './errors';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor, csrfInterceptor])),
    provideApiConfiguration(''),
  ],
};
