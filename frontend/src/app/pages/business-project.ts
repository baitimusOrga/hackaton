import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ClearanceService } from '../api/services';
import { ItemView, ProjectDetail, RouteOption, Totals } from '../api/models';
import { CATEGORIES } from '../categories';
import { Condition, CONDITION_LABELS } from '../conditions';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';

type Item = Required<ItemView>;
type Option = Required<RouteOption>;
type Route = Option['route'];
type Project = Omit<Required<ProjectDetail>, 'items' | 'routes' | 'totals'> & {
  items: Item[];
  routes: Option[];
  totals: Required<Totals>;
};

export const SAMPLE_INVENTORY = `Menge;Gegenstand;Notizen
12;Dell P2419H 24"-Monitore;guter Zustand, mit Standfuss
20;Giroflex 64 Bürostühle;Stoff, Armlehnen teils abgenutzt
3;HP LaserJet Pro M404dn Drucker;funktionieren, Toner fast leer
8;Lenovo ThinkPad T14 Laptops (2021);gelöscht, mit Ladegerät
ca. 6;höhenverstellbare Pulte;elektrisch, Zählung morgen`;

const ROUTE_NAMES: Record<Route, string> = {
  SELF_SERVICE: 'Selbst verkaufen',
  MANAGED: 'Wir verkaufen',
  DIRECT_PURCHASE: 'Wir kaufen',
};
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-business-project',
  imports: [DatePipe, RouterLink, Badge, Button, ChfPipe],
  templateUrl: './business-project.html',
  styles: `
    .bp-head {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-bottom: var(--space-8);
    }
    .bp-head .zw-link {
      align-self: flex-start;
    }
    .bp-ink {
      color: var(--ink);
    }
    .bp-totals {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4) var(--space-8);
      margin: var(--space-4) 0 0;
    }
    .bp-totals dd {
      margin: 0;
    }
    .bp-rule {
      border-top: var(--border-1) solid var(--line-soft);
    }
    .bp-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .bp-scroll {
      overflow-x: auto;
    }
    .bp-table {
      width: 100%;
      min-width: 1100px;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
      line-height: 20px;
    }
    .bp-table th {
      padding: var(--space-2);
      border-bottom: var(--border-1) solid var(--line);
      font-weight: 600;
    }
    .bp-table td {
      padding: var(--space-2);
      vertical-align: top;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .bp-table .zw-input {
      font-size: 14px;
    }
    .bp-w-name {
      width: 220px;
    }
    .bp-w-qty {
      width: 88px;
    }
    .bp-w-notes {
      width: 220px;
    }
    .bp-num {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .bp-status {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }
    .bp-routes {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
    }
    @media (min-width: 720px) {
      .bp-routes {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .bp-route {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-top: var(--space-4);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .bp-route--chosen {
      border-top: var(--border-2) solid var(--ink);
    }
  `,
})
export class BusinessProject implements OnInit {
  readonly id = input.required<string>();
  protected readonly api = inject(ClearanceService);
  protected readonly names = ROUTE_NAMES;
  protected readonly categories = CATEGORIES;
  protected readonly conditions = CONDITIONS;
  protected readonly conditionNames = CONDITION_LABELS;
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
    const priced = 'unitPriceChf' in patch || item.priceConfirmed;
    if (!(next.quantity >= 1) || (priced && !(next.unitPriceChf > 0))) {
      return this.run(this.api.getProject({ id: this.project()!.id }));
    }
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
          // only a price the company set or accepted counts; the estimate alone stays unconfirmed
          unitPriceChf: priced ? next.unitPriceChf : null,
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
