import { Injectable, inject, signal } from '@angular/core';
import { AUTH_CLIENT, AuthUser } from './auth-client';

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly client = inject(AUTH_CLIENT);
  readonly user = signal<AuthUser | null>(null);
  private sessionRequest?: Promise<AuthUser | null>;
  private tokenRequest?: Promise<string | null>;
  private cachedToken?: { value: string; expiresAt: number };
  private generation = 0;

  restore(): Promise<AuthUser | null> {
    if (!this.sessionRequest) {
      const generation = this.generation;
      this.sessionRequest = this.client
        .getSession()
        .then(({ data, error }) => {
          if (error)
            throw new AuthRequestError(error.message ?? 'Cannot check your session.', error.status);
          if (generation !== this.generation) return this.user();
          this.user.set(data?.user ?? null);
          if (!data) this.cachedToken = undefined;
          return this.user();
        })
        .finally(() => {
          this.sessionRequest = undefined;
        });
    }
    return this.sessionRequest;
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.client.signIn.email({ email, password });
    if (error) throw new AuthRequestError(error.message ?? 'Unable to sign in.', error.status);
    this.clear();
    await this.restore();
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const { error } = await this.client.signUp.email({ name, email, password });
    if (error)
      throw new AuthRequestError(error.message ?? 'Unable to create your account.', error.status);
    this.clear();
    await this.restore();
  }

  async logout(): Promise<void> {
    const { error } = await this.client.signOut();
    if (error) throw new AuthRequestError(error.message ?? 'Unable to sign out.', error.status);
    this.clear();
  }

  clear(): void {
    this.generation++;
    this.user.set(null);
    this.cachedToken = undefined;
    this.tokenRequest = undefined;
    this.sessionRequest = undefined;
  }

  token(): Promise<string | null> {
    if (!this.user()) return Promise.resolve(null);
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return Promise.resolve(this.cachedToken.value);
    }
    if (!this.tokenRequest) {
      const request = this.fetchToken(this.generation).finally(() => {
        if (this.tokenRequest === request) this.tokenRequest = undefined;
      });
      this.tokenRequest = request;
    }
    return this.tokenRequest;
  }

  private async fetchToken(generation: number): Promise<string | null> {
    const { data, error } = await this.client.token();
    if (generation !== this.generation) return null;
    if (error) {
      if (error.status === 401) {
        this.clear();
        return null;
      }
      throw new AuthRequestError(error.message ?? 'Cannot obtain an API token.', error.status);
    }
    if (!data?.token) throw new Error('The auth service did not return an API token.');
    const payload = JSON.parse(
      atob(data.token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')),
    ) as { exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      throw new Error('The auth service returned an expired API token.');
    }
    this.cachedToken = { value: data.token, expiresAt: payload.exp * 1000 };
    return data.token;
  }
}

export function safeReturnUrl(value: string | null): string {
  return value?.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/^\/(login|register)(\?|$)/.test(value)
    ? value
    : '/';
}
