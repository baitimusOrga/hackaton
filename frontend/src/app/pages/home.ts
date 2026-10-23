import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { InfoService } from '../api/services';

@Component({
  selector: 'app-home',
  template: `
    <h1 class="text-2xl font-semibold">hackaton</h1>
    @if (info(); as i) {
      <p class="muted">{{ i.env }} · {{ i.release }} {{ i.revision }}</p>
    }
  `,
})
export class Home {
  protected readonly info = toSignal(inject(InfoService).info());
}
