import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly errors = inject(ErrorBanner);
}
