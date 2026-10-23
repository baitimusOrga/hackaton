import { TestBed } from '@angular/core/testing';
import { Auth } from './auth/auth';
import { DraftEvent } from './api/models';
import { DraftStream } from './draft-stream';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

describe('DraftStream', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { token: () => Promise.resolve('jwt') } }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the token and parses events split across chunks', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamOf(
            'data:{"type":"DETECTION","detection":{"photo":1,"box":[0,0,1,1],"label":"Dell"}}\n\ndata: {"ty',
            'pe":"ERROR","detail":"x"}\n\n',
          ),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const events: DraftEvent[] = [];

    await TestBed.inject(DraftStream).run({ photoIds: [1], confirmedFacts: [] }, (e) =>
      events.push(e),
    );

    expect(events.map((e) => e.type)).toEqual(['DETECTION', 'ERROR']);
    expect(fetch.mock.calls[0][0]).toBe('/api/listing-drafts/stream');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
  });

  it('rejects with the problem detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Unknown photo.' }), { status: 400 }),
        ),
    );

    await expect(
      TestBed.inject(DraftStream).run({ photoIds: [1], confirmedFacts: [] }, vi.fn()),
    ).rejects.toThrow('Unknown photo.');
  });
});
