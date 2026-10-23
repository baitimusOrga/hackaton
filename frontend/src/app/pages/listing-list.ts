import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, Listing, errorMessage } from '../api';

@Component({
  selector: 'app-listing-list',
  imports: [RouterLink, CurrencyPipe],
  template: `
    <h1>Listings</h1>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <div class="grid">
      @for (l of listings(); track l.id) {
        <a class="card item" [routerLink]="['/listings', l.id]">
          @if (l.imageUrl) {
            <img [src]="l.imageUrl" [alt]="l.title" loading="lazy" />
          } @else {
            <div class="placeholder" aria-hidden="true">{{ l.title.charAt(0) }}</div>
          }
          <div class="body">
            <strong>{{ l.title }}</strong>
            <span class="muted">
              {{ l.priceCents === null ? 'Free' : (l.priceCents / 100 | currency: 'CHF') }}
            </span>
          </div>
        </a>
      } @empty {
        @if (!loading()) {
          <p class="muted">No listings yet.</p>
        }
      }
    </div>
    @if (hasMore()) {
      <p><button type="button" class="secondary" (click)="load()" [disabled]="loading()">Load more</button></p>
    }
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .item {
      color: inherit;
      text-decoration: none;
    }
    img,
    .placeholder {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      display: block;
      background: var(--border);
    }
    .placeholder {
      display: grid;
      place-items: center;
      font-size: 2.5rem;
      color: var(--muted);
    }
    .body {
      display: grid;
      padding: 0.6rem 0.75rem;
    }
  `,
})
export class ListingList {
  private readonly api = inject(Api);
  protected readonly listings = signal<Listing[]>([]);
  protected readonly loading = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal('');
  private page = 0;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listings(this.page).subscribe({
      next: (p) => {
        this.listings.update((all) => [...all, ...p.items]);
        this.hasMore.set((p.page + 1) * p.size < p.total);
        this.page++;
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
