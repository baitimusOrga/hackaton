import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api } from '../api';
import { Auth } from '../auth';

@Component({
  selector: 'app-home',
  template: `
    <h1>hackaton</h1>
    @if (auth.user(); as user) {
      <p>Logged in as {{ user.email }}.</p>
    }
    @if (info(); as i) {
      <p class="muted">API {{ i.env }} · {{ i.release }} {{ i.revision }}</p>
    }
  `,
})
export class Home {
  protected readonly auth = inject(Auth);
  protected readonly info = toSignal(inject(Api).info());
}
