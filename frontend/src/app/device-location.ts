import { Injectable, signal } from '@angular/core';

export interface Position {
  latitude: number;
  longitude: number;
}

/**
 * The device position, rounded to about 100 m (enough for a postcode or a search radius, and no
 * more precise than needed); null when the user denies it or the browser cannot tell.
 */
export function devicePosition(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: round(coords.latitude), longitude: round(coords.longitude) }),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** The device position for this session: asked only when the user wants it, then kept in memory. */
@Injectable({ providedIn: 'root' })
export class SessionLocation {
  readonly position = signal<Position | null>(null);
  readonly locating = signal(false);

  /** The known position, or asks the browser once; null when denied. */
  async locate(): Promise<Position | null> {
    if (this.position()) return this.position();
    this.locating.set(true);
    const position = await devicePosition();
    this.position.set(position);
    this.locating.set(false);
    return position;
  }

  forget(): void {
    this.position.set(null);
  }
}
