import { TestBed } from '@angular/core/testing';
import { Auth, safeReturnUrl } from './auth';
import { AUTH_CLIENT } from './auth-client';

const user = {
  id: 'seller-1',
  name: 'Seller',
  email: 'seller@example.com',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const jwt = (expires = Date.now() + 300_000) =>
  'header.' + btoa(JSON.stringify({ exp: Math.floor(expires / 1000) })) + '.signature';

describe('Better Auth identity and API tokens', () => {
  let client: {
    getSession: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof vi.fn>;
    signIn: { email: ReturnType<typeof vi.fn> };
    signUp: { email: ReturnType<typeof vi.fn> };
    signOut: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  let auth: Auth;
  beforeEach(() => {
    client = {
      getSession: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      token: vi.fn().mockResolvedValue({ data: { token: jwt() }, error: null }),
      signIn: { email: vi.fn().mockResolvedValue({ error: null }) },
      signUp: { email: vi.fn().mockResolvedValue({ error: null }) },
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AUTH_CLIENT, useValue: client }] });
    auth = TestBed.inject(Auth);
  });
  afterEach(() => vi.restoreAllMocks());

  it('restores a cookie session and shares concurrent session reads', async () => {
    await Promise.all([auth.restore(), auth.restore()]);
    expect(client.getSession).toHaveBeenCalledTimes(1);
    expect(auth.user()?.id).toBe('seller-1');
  });
  it('caches the API JWT in memory and shares concurrent token requests', async () => {
    await auth.restore();
    const [first, second] = await Promise.all([auth.token(), auth.token()]);
    expect(first).toBe(second);
    expect(await auth.token()).toBe(first);
    expect(client.token).toHaveBeenCalledTimes(1);
  });
  it('refreshes shortly before token expiry', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    client.token.mockResolvedValueOnce({ data: { token: jwt(now + 60_000) }, error: null });
    await auth.restore();
    await auth.token();
    vi.mocked(Date.now).mockReturnValue(now + 35_000);
    await auth.token();
    expect(client.token).toHaveBeenCalledTimes(2);
  });
  it('does not obtain a token for an anonymous visitor', async () => {
    expect(await auth.token()).toBeNull();
    expect(client.token).not.toHaveBeenCalled();
  });
  it('clears identity and tokens after logout', async () => {
    await auth.restore();
    await auth.token();
    await auth.logout();
    expect(auth.user()).toBeNull();
    expect(await auth.token()).toBeNull();
  });
  it('does not cache an in-flight token after logout', async () => {
    let resolve!: (value: unknown) => void;
    client.token.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await auth.restore();
    const pending = auth.token();
    await auth.logout();
    resolve({ data: { token: jwt() }, error: null });
    expect(await pending).toBeNull();
  });
  it('shows a new name at once and fetches a token with the new name claim', async () => {
    await auth.restore();
    await auth.token();
    await auth.updateName('Nora K.');
    expect(client.updateUser).toHaveBeenCalledWith({ name: 'Nora K.' });
    expect(auth.user()?.name).toBe('Nora K.');
    await auth.token();
    expect(client.token).toHaveBeenCalledTimes(2);
  });
  it('keeps Better Auth form errors available to the caller', async () => {
    client.signIn.email.mockResolvedValue({
      error: { status: 401, message: 'Invalid email or password.' },
    });
    await expect(auth.login('seller@example.com', 'wrong')).rejects.toThrow(
      'Invalid email or password.',
    );
    expect(auth.user()).toBeNull();
  });
  it('accepts internal return URLs and rejects external URLs and login loops', () => {
    expect(safeReturnUrl('/sell?draft=1')).toBe('/sell?draft=1');
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/login?returnUrl=/sell',
    ]) {
      expect(safeReturnUrl(value)).toBe('/');
    }
  });
});
