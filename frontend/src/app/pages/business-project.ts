import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ClearanceService } from '../api/services';
import { ItemView, ProjectDetail, RouteOption, Totals } from '../api/models';
import { CATEGORIES } from '../categories';

type Item = Required<ItemView>;
type Option = Required<RouteOption>;
type Route = Option['route'];
type Project = Omit<Required<ProjectDetail>, 'items' | 'routes' | 'totals'> & {
  items: Item[];
  routes: Option[];
  totals: Required<Totals>;
};

export const SAMPLE_INVENTORY = `Qty;Item;Notes
12;Dell P2419H 24" monitors;good condition, with stands
20;Giroflex 64 office chairs;fabric, some worn armrests
3;HP LaserJet Pro M404dn printers;working, toner low
8;Lenovo ThinkPad T14 laptops (2021);wiped, chargers included
ca. 6;height-adjustable desks;electric, count tomorrow`;

const ROUTE_NAMES: Record<Route, string> = {
  SELF_SERVICE: 'Self-service',
  MANAGED: 'Managed selling',
  DIRECT_PURCHASE: 'Direct purchase',
};
const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'USED', 'DEFECTIVE'] as const;

@Component({
  selector: 'app-business-project',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    @if (project(); as p) {
      <article class="mx-auto grid max-w-5xl gap-6 p-4">
        <header>
          <a routerLink="/business" class="text-sm underline">All projects</a>
          <h1 class="text-2xl font-semibold">{{ p.companyName }}</h1>
          <p>
            {{ p.postcode }} {{ p.locality }} · deadline {{ p.deadline | date: 'dd.MM.yyyy' }} ·
            <strong>{{ p.daysLeft }} days left</strong>
          </p>
          <dl
            class="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-slate-300 bg-white p-3"
            data-testid="totals"
          >
            <div>
              <dt class="inline">Item lines:</dt>
              <dd class="ml-1 inline font-semibold">{{ p.totals.itemLines }}</dd>
            </div>
            <div>
              <dt class="inline">Units:</dt>
              <dd class="ml-1 inline font-semibold">{{ p.totals.units }}</dd>
            </div>
            <div>
              <dt class="inline">Estimated resale:</dt>
              <dd class="ml-1 inline font-semibold">
                CHF {{ p.totals.estimatedResaleChf | number: '1.0-0' }}
              </dd>
            </div>
            <div>
              <dt class="inline">Draft / listed / sold:</dt>
              <dd class="ml-1 inline font-semibold">
                {{ p.totals.draft }} / {{ p.totals.listed }} / {{ p.totals.sold }}
              </dd>
            </div>
          </dl>
        </header>

        <section class="grid gap-2" aria-labelledby="add-heading">
          <h2 id="add-heading" class="text-lg font-semibold">1. Add inventory</h2>
          <label class="grid gap-1 font-semibold"
            >Inventory list
            <textarea
              rows="7"
              maxlength="10000"
              class="rounded-md border border-slate-400 p-3 font-mono text-sm font-normal"
              [value]="text()"
              (input)="text.set($any($event.target).value)"
            ></textarea>
          </label>
          <label class="grid gap-1 font-semibold"
            >Photos (optional, up to 5)
            <input
              type="file"
              accept="image/*"
              multiple
              class="font-normal"
              (change)="photos.set(files($any($event.target)))"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-secondary" (click)="text.set(sample)">
              Use sample inventory
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="busy() || (!text().trim() && !photos().length)"
              (click)="extract()"
            >
              {{ reading() ? 'Reading…' : 'Read inventory' }}
            </button>
          </div>
        </section>

        <section class="grid gap-2" aria-labelledby="review-heading">
          <h2 id="review-heading" class="text-lg font-semibold">2. Review items</h2>
          @if (p.items.length) {
            <div class="overflow-x-auto">
              <table class="w-full min-w-[56rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-400">
                    <th scope="col" class="p-1">Name</th>
                    <th scope="col" class="p-1">Qty</th>
                    <th scope="col" class="p-1">Category</th>
                    <th scope="col" class="p-1">Condition</th>
                    <th scope="col" class="p-1">Notes</th>
                    <th scope="col" class="p-1">Estimate</th>
                    <th scope="col" class="p-1">Status</th>
                    <th scope="col" class="p-1"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of p.items; track item.id) {
                    @let locked = item.status !== 'DRAFT';
                    <tr class="border-b border-slate-200 align-top" data-testid="item">
                      <td class="p-1">
                        <input
                          aria-label="Name"
                          maxlength="120"
                          class="w-52 rounded border border-slate-400 p-1"
                          [disabled]="locked"
                          [value]="item.name"
                          (change)="edit(item, { name: $any($event.target).value })"
                        />
                      </td>
                      <td class="p-1">
                        <input
                          aria-label="Quantity"
                          type="number"
                          min="1"
                          max="10000"
                          class="w-20 rounded border border-slate-400 p-1"
                          [disabled]="locked"
                          [value]="item.quantity"
                          (change)="edit(item, { quantity: $any($event.target).valueAsNumber })"
                        />
                      </td>
                      <td class="p-1">
                        <select
                          aria-label="Category"
                          class="rounded border border-slate-400 p-1"
                          [disabled]="locked"
                          (change)="edit(item, { category: $any($event.target).value })"
                        >
                          @for (category of categories; track category) {
                            <option [value]="category" [selected]="category === item.category">
                              {{ category }}
                            </option>
                          }
                        </select>
                      </td>
                      <td class="p-1">
                        <select
                          aria-label="Condition"
                          class="rounded border border-slate-400 p-1"
                          [disabled]="locked"
                          (change)="edit(item, { condition: $any($event.target).value })"
                        >
                          @for (condition of conditions; track condition) {
                            <option [value]="condition" [selected]="condition === item.condition">
                              {{ condition }}
                            </option>
                          }
                        </select>
                      </td>
                      <td class="p-1">
                        <input
                          aria-label="Notes"
                          maxlength="1000"
                          class="w-56 rounded border border-slate-400 p-1"
                          [disabled]="locked"
                          [value]="item.notes ?? ''"
                          (change)="edit(item, { notes: $any($event.target).value })"
                        />
                      </td>
                      <td class="p-1 whitespace-nowrap">
                        CHF {{ item.estimatedUnitChf | number: '1.0-0' }} × {{ item.quantity
                        }}<br />= CHF
                        {{ item.estimatedTotalChf | number: '1.0-0' }}
                      </td>
                      <td class="p-1">
                        @if (item.quantityConfirmed) {
                          <span
                            class="rounded bg-emerald-100 px-2 text-emerald-900"
                            data-testid="badge"
                            >Confirmed</span
                          >
                        } @else {
                          <span class="rounded bg-amber-100 px-2 text-amber-900" data-testid="badge"
                            >Provisional</span
                          >
                        }
                        @if (
                          !item.quantityConfirmed && item.notes?.startsWith('Quantity approximate')
                        ) {
                          <p class="text-xs">Quantity approximate</p>
                        }
                        <p data-testid="status">
                          @if (item.listingId) {
                            <a [routerLink]="['/listings', item.listingId]" class="underline">{{
                              item.status === 'SOLD' ? 'Sold' : 'Listed'
                            }}</a>
                          } @else {
                            Draft
                          }
                        </p>
                      </td>
                      <td class="p-1">
                        <button
                          type="button"
                          class="underline disabled:opacity-50"
                          [disabled]="locked || busy()"
                          [attr.aria-label]="'Delete ' + item.name"
                          (click)="remove(item)"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <button
              type="button"
              class="btn-secondary w-fit"
              [disabled]="busy()"
              (click)="run(api.confirmQuantities({ id: p.id }))"
            >
              Confirm all quantities
            </button>
          } @else {
            <p class="text-sm">No items yet. Read an inventory first.</p>
          }
        </section>

        <section class="grid gap-2" aria-labelledby="routes-heading">
          <h2 id="routes-heading" class="text-lg font-semibold">3. Compare routes</h2>
          <div class="grid gap-3 md:grid-cols-3">
            @for (option of p.routes; track option.route) {
              <div
                class="grid content-start gap-1 rounded-md border bg-white p-3"
                [class.border-teal-800]="p.route === option.route"
                [class.border-slate-300]="p.route !== option.route"
                data-testid="route"
              >
                <h3 class="font-semibold">{{ names[option.route] }}</h3>
                @if (option.route === p.recommendedRoute) {
                  <p>
                    <span class="rounded bg-teal-100 px-2 text-teal-900" data-testid="recommended"
                      >Recommended</span
                    >
                  </p>
                  <p class="text-sm">{{ p.recommendationReason }}</p>
                }
                <p class="text-3xl font-semibold">CHF {{ option.netChf | number: '1.0-0' }}</p>
                <p class="text-sm">{{ option.certain ? 'Fixed offer' : 'Estimate' }}</p>
                @if (option.serviceFeeChf) {
                  <p class="text-sm">
                    incl. service fee CHF {{ option.serviceFeeChf | number: '1.0-0' }}
                  </p>
                }
                <p class="text-sm">{{ option.timeframe }}</p>
                <p class="text-sm">Your work: {{ option.yourWork }}</p>
                <button
                  type="button"
                  class="btn-primary mt-1"
                  [disabled]="busy() || p.route === option.route"
                  [attr.aria-label]="'Choose ' + names[option.route]"
                  (click)="run(api.chooseRoute({ id: p.id, body: { route: option.route } }))"
                >
                  {{ p.route === option.route ? 'Chosen' : 'Choose' }}
                </button>
              </div>
            }
          </div>
          <p class="text-xs">
            Assumptions, not offers: Self-service sells 70 % of the estimated resale value. Managed
            selling sells 85 % and keeps a 15 % service fee on the proceeds. Direct purchase pays 45
            % of the estimated resale value within 5 working days.
          </p>
          @if (p.route === 'MANAGED' || p.route === 'DIRECT_PURCHASE') {
            <p class="rounded-md bg-teal-50 p-3" role="status">
              Request recorded — our team contacts you within one working day (demo).
            </p>
          }
        </section>

        @if (p.route === 'SELF_SERVICE') {
          <section class="grid gap-2" aria-labelledby="publish-heading">
            <h2 id="publish-heading" class="text-lg font-semibold">4. Publish</h2>
            <ul class="grid gap-1">
              @for (item of drafts(p); track item.id) {
                <li>
                  <label class="flex items-center gap-2"
                    ><input
                      type="checkbox"
                      [disabled]="!item.quantityConfirmed"
                      [checked]="selected().has(item.id)"
                      (change)="toggle(item.id)"
                    />
                    {{ item.name }} ({{ item.quantity }})
                    @if (!item.quantityConfirmed) {
                      <span class="text-sm">— confirm the quantity first</span>
                    }
                  </label>
                </li>
              } @empty {
                <li class="text-sm">Nothing left to publish.</li>
              }
            </ul>
            <button
              type="button"
              class="btn-primary w-fit"
              [disabled]="busy() || !selected().size"
              (click)="publish(p)"
            >
              Publish {{ selected().size }} items
            </button>
          </section>
        }
      </article>
    }
  `,
  styles: `
    .btn-primary {
      background: #115e59;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .btn-secondary {
      border: 1px solid #115e59;
      color: #115e59;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class BusinessProject implements OnInit {
  readonly id = input.required<string>();
  protected readonly api = inject(ClearanceService);
  protected readonly names = ROUTE_NAMES;
  protected readonly categories = CATEGORIES;
  protected readonly conditions = CONDITIONS;
  protected readonly sample = SAMPLE_INVENTORY;
  protected readonly project = signal<Project | null>(null);
  protected readonly text = signal('');
  protected readonly photos = signal<File[]>([]);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly busy = signal(false);
  protected readonly reading = signal(false);

  ngOnInit(): void {
    this.run(this.api.getProject({ id: Number(this.id()) }));
  }

  protected files(input: HTMLInputElement): File[] {
    return Array.from(input.files ?? []).slice(0, 5);
  }

  protected drafts(project: Project): Item[] {
    return project.items.filter((item) => item.status === 'DRAFT');
  }

  protected toggle(id: number): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected extract(): void {
    const body: { text?: string; photos?: File[] } = { photos: this.photos() };
    if (this.text().trim()) body.text = this.text();
    this.reading.set(true);
    this.run(this.api.extractItems({ id: this.project()!.id, body }), () => {
      this.text.set('');
      this.photos.set([]);
    });
  }

  protected edit(item: Item, patch: Partial<Item>): void {
    const next = { ...item, ...patch };
    if (!(next.quantity >= 1)) return this.run(this.api.getProject({ id: this.project()!.id }));
    this.run(
      this.api.updateItem({
        id: this.project()!.id,
        itemId: item.id,
        body: {
          name: next.name,
          category: next.category,
          quantity: next.quantity,
          quantityConfirmed: next.quantityConfirmed,
          condition: next.condition,
          notes: next.notes ?? undefined,
        },
      }),
    );
  }

  protected remove(item: Item): void {
    this.run(this.api.deleteItem({ id: this.project()!.id, itemId: item.id }));
  }

  protected publish(project: Project): void {
    this.run(
      this.api.publishItems({ id: project.id, body: { itemIds: [...this.selected()] } }),
      () => this.selected.set(new Set()),
    );
  }

  /** Every mutation answers with the fresh project; a failed call leaves the screen as it was. */
  protected run(call: Observable<ProjectDetail>, done?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: (project) => {
        this.project.set(project as Project);
        done?.();
        this.busy.set(false);
        this.reading.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.reading.set(false);
      },
    });
  }
}
