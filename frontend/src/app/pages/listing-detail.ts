import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Api, Listing, errorMessage } from '../api';
import { Auth } from '../auth';

@Component({
  selector: 'app-listing-detail',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <p><a routerLink="/">&larr; All listings</a></p>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (listing(); as l) {
      <article class="card">
        @if (l.imageUrl) {
          <img [src]="l.imageUrl" [alt]="l.title" />
        }
        <div class="body">
          <h1>{{ l.title }}</h1>
          <p class="price">{{ l.priceCents === null ? 'Free' : (l.priceCents / 100 | currency: 'CHF') }}</p>
          <p class="description">{{ l.description }}</p>
          <p class="muted">by {{ l.ownerName }} · {{ l.createdAt | date: 'medium' }}</p>
          @if (mine()) {
            <button type="button" class="secondary" (click)="remove(l)">Delete</button>
          }
        </div>
      </article>
    }
  `,
  styles: `
    img {
      width: 100%;
      max-height: 480px;
      object-fit: contain;
      background: var(--border);
      display: block;
    }
    .body {
      padding: 1rem 1.25rem;
    }
    h1 {
      margin: 0 0 0.25rem;
    }
    .price {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }
    .description {
      white-space: pre-line;
    }
  `,
})
export class ListingDetail {
  /** Route parameter :id (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly listing = signal<Listing | null>(null);
  protected readonly error = signal('');
  protected readonly mine = computed(() => this.listing()?.ownerId === this.auth.user()?.id);

  constructor() {
    effect(() => {
      this.api.listing(this.id()).subscribe({
        next: (l) => this.listing.set(l),
        error: (err) => this.error.set(errorMessage(err)),
      });
    });
  }

  remove(l: Listing): void {
    if (!confirm(`Delete "${l.title}"?`)) return;
    this.api.deleteListing(l.id).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
