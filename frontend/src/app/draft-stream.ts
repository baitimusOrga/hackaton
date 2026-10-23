import { Injectable, inject } from '@angular/core';
import { DraftEvent, DraftRequest } from './api/models';
import { Auth } from './auth/auth';
import { Problem } from './errors';

/**
 * Reads the draft stream (server-sent events). The one hand-written API call: the generated client
 * cannot read a stream. Resolves when the stream ends, rejects with the server's message.
 */
// shortcut: a 401 here shows the message instead of redirecting to login like authInterceptor; upgrade if sessions expire mid-sell
@Injectable({ providedIn: 'root' })
export class DraftStream {
  private readonly auth = inject(Auth);

  async run(body: DraftRequest, onEvent: (event: DraftEvent) => void): Promise<void> {
    const token = await this.auth.token();
    const response = await fetch('/api/listing-drafts/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      const problem = (await response.json().catch(() => ({}))) as Problem;
      throw new Error(problem.detail ?? 'The draft could not be created.');
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const events = buffer.split('\n\n');
      buffer = events.pop()!;
      for (const event of events) {
        // Spring writes "data:{...}", the SSE spec also allows "data: {...}"
        if (event.startsWith('data:')) onEvent(JSON.parse(event.slice(5)) as DraftEvent);
      }
    }
  }
}
