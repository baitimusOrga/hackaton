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
