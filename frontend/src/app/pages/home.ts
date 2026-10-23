import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api } from '../api';

@Component({
  selector: 'app-home',
  template: `
    <h1>hackaton</h1>
    @if (info(); as i) {
      <p class="muted">{{ i.env }} · {{ i.release }} {{ i.revision }}</p>
    }
  `,
})
export class Home {
  protected readonly info = toSignal(inject(Api).info());
}
