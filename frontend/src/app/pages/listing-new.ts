import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../api';

@Component({
  selector: 'app-listing-new',
  imports: [ReactiveFormsModule],
  template: `
    <h1>New listing</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Title
        <input formControlName="title" maxlength="120" required />
      </label>
      <label>
        Description
        <textarea formControlName="description" rows="6" maxlength="4000" required></textarea>
      </label>
      <p>
        <button type="button" class="secondary" (click)="suggest()" [disabled]="suggesting() || !form.value.title">
          {{ suggesting() ? 'Writing…' : 'Suggest a description (AI)' }}
        </button>
        @if (aiError()) {
          <span class="error"> {{ aiError() }}</span>
        }
      </p>
      <label>
        Price in CHF (empty = free)
        <input formControlName="price" type="number" min="0" step="0.05" />
      </label>
      <label>
        Image (JPEG, PNG or WebP, max 5 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" (change)="pick($event)" />
      </label>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <p><button type="submit" [disabled]="form.invalid || saving()">Publish</button></p>
    </form>
  `,
})
export class ListingNew {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    price: [null as number | null, Validators.min(0)],
  });
  protected readonly saving = signal(false);
  protected readonly suggesting = signal(false);
  protected readonly error = signal('');
  protected readonly aiError = signal('');
  private image: File | null = null;

  pick(event: Event): void {
    this.image = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  /** Example LLM feature: the backend asks Claude (API key stays on the server). */
  suggest(): void {
    const { title, description } = this.form.getRawValue();
    this.suggesting.set(true);
    this.aiError.set('');
    this.api.describe(title, description).subscribe({
      next: (r) => {
        this.form.patchValue({ description: r.text });
        this.suggesting.set(false);
      },
      error: (err) => {
        this.aiError.set(errorMessage(err));
        this.suggesting.set(false);
      },
    });
  }

  submit(): void {
    const { title, description, price } = this.form.getRawValue();
    const data = new FormData();
    data.set('title', title);
    data.set('description', description);
    if (price !== null && `${price}` !== '') data.set('priceCents', String(Math.round(price * 100)));
    if (this.image) data.set('image', this.image);
    this.saving.set(true);
    this.error.set('');
    this.api.createListing(data).subscribe({
      next: (l) => this.router.navigate(['/listings', l.id]),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
