import { DatePipe } from '@angular/common';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map, switchMap } from 'rxjs';
import { Order } from '../api/models';
import { OrdersService } from '../api/services';
import { HANDLES_ERRORS, messageOf } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';

/** A sold listing as seen by its seller and buyer; the seller marks it as shipped. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-order',
  imports: [DatePipe, RouterLink, Button, ChfPipe, TranslatePipe],
  styles: `
    .item {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: center;
      margin: var(--space-8) 0;
    }
    .ph {
      width: 96px;
      height: 96px;
      background: var(--bg-100);
      object-fit: cover;
    }
  `,
  template: `
    @if (order(); as order) {
      <h1>{{ 'Bestellung' | t }}</h1>
      <div class="item">
        @if (order.listing?.imageUrl) {
          <img class="ph" [src]="order.listing!.imageUrl" alt="" />
        } @else {
          <span class="ph"></span>
        }
        <a [routerLink]="['/listings', order.listing?.id]">{{ order.listing?.title }}</a>
        <span>{{ order.listing?.currentBidChf ?? order.listing?.priceChf ?? 0 | chf }}</span>
      </div>
      @if (order.shippedAt) {
        <p role="status">
          {{ 'Versendet am {date}' | t: { date: (order.shippedAt | date: 'dd.MM.yyyy') ?? '' } }}
        </p>
      } @else if (order.seller) {
        <p>{{ 'Verpacke den Artikel und schicke ihn dem Käufer.' | t }}</p>
        <button appButton variant="primary" type="button" [disabled]="shipping()" (click)="ship()">
          {{ 'Als versendet markieren' | t }}
        </button>
        @if (error()) {
          <p class="zw-help zw-help--error" role="alert">{{ error() }}</p>
        }
      } @else {
        <p role="status">{{ 'Der Verkäufer hat noch nicht versendet.' | t }}</p>
      }
    }
  `,
})
export class OrderPage {
  private readonly api = inject(OrdersService);
  private readonly i18n = inject(I18n);
  private readonly id$ = inject(ActivatedRoute).paramMap.pipe(
    map((params) => Number(params.get('id'))),
    filter((id) => Number.isSafeInteger(id) && id > 0),
  );
  private readonly loaded = toSignal(this.id$.pipe(switchMap((id) => this.api.getOrder({ id }))));
  private readonly shipped = signal<Order | undefined>(undefined);
  protected readonly order = () => this.shipped() ?? this.loaded();
  protected readonly shipping = signal(false);
  protected readonly error = signal('');

  protected ship(): void {
    if (this.shipping()) return;
    this.shipping.set(true);
    this.error.set('');
    this.api
      .ship({ id: this.order()!.listing!.id! }, new HttpContext().set(HANDLES_ERRORS, true))
      .subscribe({
        next: (order) => {
          this.shipped.set(order);
          this.shipping.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.shipping.set(false);
          this.error.set(messageOf(err, this.i18n));
        },
      });
  }
}
