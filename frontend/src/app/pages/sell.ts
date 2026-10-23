import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { SellingService } from '../api/services';
import { CreateListingRequest } from '../api/models';

@Component({
  selector: 'app-sell',
  imports: [FormsModule],
  styles: `
    label {
      display: grid;
      gap: 0.25rem;
      font-weight: 600;
    }
    input,
    textarea,
    select {
      border: 1px solid #94a3b8;
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-weight: 400;
      background: white;
    }
    button {
      background: #115e59;
      color: white;
      padding: 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
    }
  `,
  template: `
    <h1 class="text-2xl font-semibold">Sell an item</h1>
    <p>Publish a text listing. Photo publishing is coming separately.</p>
    <form #form="ngForm" (ngSubmit)="publish(form)" class="mt-4 grid max-w-lg gap-3">
      <label>Title <input name="title" [(ngModel)]="draft.title" required maxlength="120" /></label>
      <label
        >Description
        <textarea
          name="description"
          [(ngModel)]="draft.description"
          required
          maxlength="4000"
        ></textarea>
      </label>
      <label
        >Category <input name="category" [(ngModel)]="draft.category" required maxlength="80"
      /></label>
      <label
        >Condition
        <select name="condition" [(ngModel)]="draft.condition" required>
          <option value="NEW">New</option>
          <option value="LIKE_NEW">Like new</option>
          <option value="GOOD">Good</option>
          <option value="USED">Used</option>
          <option value="DEFECTIVE">Defective</option>
        </select>
      </label>
      <label
        >Price (CHF)
        <input
          name="price"
          type="number"
          [(ngModel)]="draft.priceChf"
          required
          min="0.01"
          max="9999999999.99"
          step="0.01"
      /></label>
      <label
        >Postcode <input name="postcode" [(ngModel)]="draft.postcode" required pattern="[0-9]{4}"
      /></label>
      <label
        >Locality <input name="locality" [(ngModel)]="draft.locality" required maxlength="120"
      /></label>
      @if (submitted() && form.invalid) {
        <p role="alert">Please complete every field with a valid value.</p>
      }
      <button type="submit" [disabled]="busy()">
        {{ busy() ? 'Publishing…' : 'Publish listing' }}
      </button>
    </form>
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly draft: CreateListingRequest = {
    title: '',
    description: '',
    category: '',
    condition: 'GOOD',
    priceChf: 1,
    postcode: '',
    locality: '',
    attributes: {},
    photoIds: [],
  };

  protected publish(form: NgForm): void {
    this.submitted.set(true);
    if (form.invalid || this.busy()) return;
    this.busy.set(true);
    this.api.publish({ body: this.draft }).subscribe({
      next: (listing) => {
        void this.router.navigate(['/listings', listing.id]);
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }
}
