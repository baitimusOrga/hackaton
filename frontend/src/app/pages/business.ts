import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ClearanceService } from '../api/services';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-business',
  imports: [DatePipe, RouterLink],
  template: `
    <section class="mx-auto grid max-w-3xl gap-6 p-4">
      <div>
        <h1 class="text-2xl font-semibold">Business clearance</h1>
        <p class="mt-1">
          Clear an office in one project: read the inventory, compare three routes, publish.
        </p>
      </div>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" class="text-lg font-semibold">Your projects</h2>
        <ul class="mt-2 grid gap-2">
          @for (project of projects(); track project.id) {
            <li class="rounded-md border border-slate-300 bg-white p-3">
              <a [routerLink]="['/business', project.id]" class="font-semibold underline">{{
                project.companyName
              }}</a>
              <p class="text-sm">
                {{ project.locality }} · deadline {{ project.deadline | date: 'dd.MM.yyyy' }} ·
                {{ project.itemLines }} item lines
              </p>
            </li>
          } @empty {
            <li class="text-sm">No projects yet.</li>
          }
        </ul>
      </section>

      <form
        class="grid gap-3 rounded-md border border-slate-300 bg-white p-4"
        aria-labelledby="new-heading"
        (submit)="create($event)"
      >
        <h2 id="new-heading" class="text-lg font-semibold">New clearance project</h2>
        <label class="grid gap-1 font-semibold"
          >Company
          <input
            name="companyName"
            required
            maxlength="120"
            class="rounded-md border border-slate-400 p-3 font-normal"
            [value]="companyName()"
            (input)="companyName.set($any($event.target).value)"
        /></label>
        <label class="grid gap-1 font-semibold"
          >Postcode
          <input
            name="postcode"
            required
            pattern="[0-9]{4}"
            inputmode="numeric"
            class="rounded-md border border-slate-400 p-3 font-normal"
            [value]="postcode()"
            (input)="postcode.set($any($event.target).value)"
        /></label>
        <label class="grid gap-1 font-semibold"
          >Locality
          <input
            name="locality"
            required
            maxlength="120"
            class="rounded-md border border-slate-400 p-3 font-normal"
            [value]="locality()"
            (input)="locality.set($any($event.target).value)"
        /></label>
        <label class="grid gap-1 font-semibold"
          >Deadline
          <input
            name="deadline"
            type="date"
            required
            [min]="today"
            class="rounded-md border border-slate-400 p-3 font-normal"
            [value]="deadline()"
            (input)="deadline.set($any($event.target).value)"
        /></label>
        <button
          type="submit"
          class="cursor-pointer rounded-md bg-teal-800 p-3 text-white disabled:opacity-50"
          [disabled]="busy()"
        >
          {{ busy() ? 'Creating…' : 'Create' }}
        </button>
      </form>
    </section>
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
