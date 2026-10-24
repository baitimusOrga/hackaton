import { Injectable } from '@angular/core';

const DB = 'sell';
const STORE = 'drafts';
const KEY = 'current';

/**
 * Keeps the one unfinished sell draft in IndexedDB, photos included (too big for localStorage),
 * so a reload (e.g. when the phone's camera app evicts the tab) loses nothing. Every failure
 * (private mode, blocked storage, no IndexedDB) just means nothing is kept.
 */
@Injectable({ providedIn: 'root' })
export class DraftStore {
  load<T>(): Promise<T | undefined> {
    return this.request<T | undefined>('readonly', (store) => store.get(KEY));
  }

  async save(value: unknown): Promise<void> {
    await this.request('readwrite', (store) => store.put(value, KEY));
  }

  async clear(): Promise<void> {
    await this.request('readwrite', (store) => store.delete(KEY));
  }

  private request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T | undefined> {
    return new Promise((resolve) => {
      try {
        const open = indexedDB.open(DB, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(STORE);
        open.onerror = () => resolve(undefined);
        open.onsuccess = () => {
          const db = open.result;
          const request = run(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(undefined);
          request.transaction!.oncomplete = () => db.close();
        };
      } catch {
        resolve(undefined);
      }
    });
  }
}
