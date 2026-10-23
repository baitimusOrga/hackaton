import { InjectionToken } from '@angular/core';
import { createAuthClient } from 'better-auth/client';
import { jwtClient } from 'better-auth/client/plugins';

function createClient() {
  return createAuthClient({ baseURL: window.location.origin, plugins: [jwtClient()] });
}

export type AuthClient = ReturnType<typeof createClient>;
export type AuthUser = AuthClient['$Infer']['Session']['user'];
export const AUTH_CLIENT = new InjectionToken<AuthClient>('Better Auth client', {
  providedIn: 'root',
  factory: createClient,
});
