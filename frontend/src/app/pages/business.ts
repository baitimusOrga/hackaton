import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ClearanceService } from '../api/services';
import { Button } from '../ui/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-business',
  imports: [DatePipe, RouterLink, Button],
  templateUrl: './business.html',
  styles: `
    .bz-head {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-top: var(--space-6);
    }
    .bz-list .zw-row {
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1) var(--space-4);
    }
    .bz-name {
      min-width: 240px;
      font-weight: 600;
      color: var(--ink);
    }
    .bz-new {
      border-top: var(--border-1) solid var(--line-soft);
    }
    .bz-form {
      display: grid;
      gap: var(--space-4);
      max-width: 480px;
    }
  `,
})
export class Business {
  private readonly api = inject(ClearanceService);
  private readonly router = inject(Router);
  protected readonly projects = toSignal(this.api.listProjects());
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly companyName = signal('');
  protected readonly postcode = signal('');
  protected readonly locality = signal('');
  protected readonly deadline = signal('');
  protected readonly busy = signal(false);

  protected create(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .createProject({
        body: {
          companyName: this.companyName(),
          postcode: this.postcode(),
          locality: this.locality(),
          deadline: this.deadline(),
        },
      })
      .subscribe({
        next: (project) => this.router.navigate(['/business', project.id]),
        error: () => this.busy.set(false),
      });
  }
}
