import { devicePosition } from './device-location';

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
