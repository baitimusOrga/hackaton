import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth, authError, CANTONS, ProfileUpdate } from './auth';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="account-card" aria-labelledby="profile-heading">
      <h1 id="profile-heading">Your profile</h1>
      <p class="muted">{{ auth.user()?.email }}</p>
      <p>Your contact preference is private. It does not publish your email address.</p>
      @if (notice()) { <p role="status" class="notice">{{ notice() }}</p> }
      @if (error()) { <p role="alert" class="error">{{ error() }} <a routerLink="/login">Sign in</a></p> }
      <form #form="ngForm" (ngSubmit)="save()">
        <label for="profile-name">Display name</label>
        <input id="profile-name" name="displayName" [(ngModel)]="profile.displayName" required maxlength="80" autocomplete="nickname" />
        <label for="location">Location</label>
        <input id="location" name="location" [(ngModel)]="profile.location" maxlength="120" autocomplete="address-level2" placeholder="e.g. Luzern" />
        <label for="canton">Canton</label>
        <select id="canton" name="canton" [(ngModel)]="profile.canton" autocomplete="address-level1">
          <option [ngValue]="null">Prefer not to say</option>
          @for (canton of cantons; track canton) { <option [value]="canton">{{ canton }}</option> }
        </select>
        <label for="contact">Preferred contact method</label>
        <select id="contact" name="contactPreference" [(ngModel)]="profile.contactPreference">
          <option value="IN_APP">In the app</option>
          <option value="EMAIL">Email</option>
        </select>
        <button type="submit" [disabled]="form.invalid || busy()">{{ busy() ? 'Saving…' : 'Save profile' }}</button>
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
