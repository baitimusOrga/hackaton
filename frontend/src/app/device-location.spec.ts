import { SessionLocation, devicePosition } from './device-location';

describe('devicePosition', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rounds the position to about 100 m', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 46.80187, longitude: 7.15123 } } as GeolocationPosition),
      },
    });

    expect(await devicePosition()).toEqual({ latitude: 46.802, longitude: 7.151 });
  });

  it('is null when denied or unavailable', async () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (_: PositionCallback, fail: () => void) => fail() },
    });
    expect(await devicePosition()).toBeNull();

    vi.stubGlobal('navigator', {});
    expect(await devicePosition()).toBeNull();
  });
});

describe('SessionLocation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the browser once per session until forgotten', async () => {
    const ask = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 46.8, longitude: 7.15 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: ask } });
    const location = new SessionLocation();

    await location.locate();
    expect(await location.locate()).toEqual({ latitude: 46.8, longitude: 7.15 });
    expect(ask).toHaveBeenCalledTimes(1);

    location.forget();
    expect(location.position()).toBeNull();
  });
});
