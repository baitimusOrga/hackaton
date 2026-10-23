import { InjectionToken } from '@angular/core';

/**
 * Runtime configuration, fetched from /config.json before the app starts.
 * In the container it is written at start-up from environment variables (docker/40-config-json.sh),
 * so the same image runs in every environment. Locally it comes from public/config.json.
 */
export interface AppConfig {
  apiUrl: string;
  env: string;
  release: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

const DEFAULTS: AppConfig = { apiUrl: '/api', env: 'dev', release: 'dev' };

export async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    return { ...DEFAULTS, ...(await res.json()) };
  } catch {
    return DEFAULTS;
  }
}
