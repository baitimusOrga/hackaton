import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth, authError, CANTONS, ProfileUpdate } from './auth';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section
      class="mx-auto my-8 max-w-lg rounded-xl border border-slate-200 bg-white p-7"
      aria-labelledby="profile-heading"
    >
      <h1 id="profile-heading">Your profile</h1>
      <p class="muted">{{ auth.user()?.email }}</p>
      <p>Your contact preference is private. It does not publish your email address.</p>
      @if (notice()) {
        <p role="status" class="rounded-md bg-emerald-50 p-3 text-emerald-900">{{ notice() }}</p>
      }
      @if (error()) {
        <p role="alert" class="rounded-md bg-red-50 p-3 text-red-800">
          {{ error() }} <a routerLink="/login">Sign in</a>
        </p>
      }
      <form class="grid gap-2" #form="ngForm" (ngSubmit)="save()">
        <label class="mt-2 font-semibold" for="profile-name">Display name</label>
        <input
          class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          id="profile-name"
          name="displayName"
          [(ngModel)]="profile.displayName"
          required
          maxlength="80"
          autocomplete="nickname"
        />
        <label class="mt-2 font-semibold" for="location">Location</label>
        <input
          class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          id="location"
          name="location"
          [(ngModel)]="profile.location"
          maxlength="120"
          autocomplete="address-level2"
          placeholder="e.g. Luzern"
        />
        <label class="mt-2 font-semibold" for="canton">Canton</label>
        <select
          class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          id="canton"
          name="canton"
          [(ngModel)]="profile.canton"
          autocomplete="address-level1"
        >
          <option [ngValue]="null">Prefer not to say</option>
          @for (canton of cantons; track canton) {
            <option [value]="canton">{{ canton }}</option>
          }
        </select>
        <label class="mt-2 font-semibold" for="contact">Preferred contact method</label>
        <select
          class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          id="contact"
          name="contactPreference"
          [(ngModel)]="profile.contactPreference"
        >
          <option value="IN_APP">In the app</option>
          <option value="EMAIL">Email</option>
        </select>
        <button
          class="mt-4 cursor-pointer rounded-md bg-teal-800 px-4 py-3 text-white disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          type="submit"
          [disabled]="form.invalid || busy()"
        >
          {{ busy() ? 'Saving…' : 'Save profile' }}
        </button>
      </form>
      <p><a routerLink="/forgot-password">Change or recover your password</a></p>
    </section>
  `,
})
export class ProfilePage {
  readonly auth = inject(Auth);
  readonly cantons = CANTONS;
  readonly notice = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly profile: ProfileUpdate = {
    displayName: this.auth.user()?.displayName ?? '',
    location: this.auth.user()?.location ?? '',
    canton: this.auth.user()?.canton ?? null,
    contactPreference: this.auth.user()?.contactPreference ?? 'IN_APP',
  };

  async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.auth.update(this.profile);
      this.notice.set('Profile saved.');
    } catch (error) {
      this.error.set(authError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
