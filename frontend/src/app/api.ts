import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from './config';

export interface Info {
  env: string;
  release: string;
  revision: string;
}

/** All calls to the backend. Paths are relative to apiUrl from config.json (normally "/api"). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).apiUrl;

  info(): Observable<Info> {
    return this.http.get<Info>(`${this.base}/info`);
  }
}
