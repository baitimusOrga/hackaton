# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below 720px the Angular app takes the phone layout of the "Mobile Layout Plus Button" mockup: a bottom tab bar with a round sell button, a slim header, a filter sheet on the find page, and every page clean at 393 × 852 px. From 720px nothing changes.

**Architecture:** One codebase, CSS breakpoints (`@media (max-width: 720px)`, the repo's existing phone breakpoint). New shell pieces: `TabBar` (fixed bottom nav), `Account` (Anmelden/Abmelden shared by header and footer), a `Saved` placeholder page. The find page gets a `filterOpen` signal that turns its filter column into a bottom sheet on phones. Everything else is CSS in `components.css` or a page's `styles`.

**Tech Stack:** Angular 22 standalone components + signals, Vitest (`ng test`), ESLint, Prettier, Tailwind 4 (tokens only; the app uses the `zw-*` classes in `frontend/src/components.css`). Spec: `docs/superpowers/specs/2026-10-24-mobile-layout-design.md`.

**Conventions (read before every task):**
- Work in `frontend/`. Run commands from there: `pnpm exec ng test --watch=false`, `pnpm exec ng lint`, `pnpm run format` (fixes formatting; run it before every commit).
- UI texts are German keys translated through `| t` (`src/app/i18n/i18n.ts`). A new German text needs FR/IT/EN entries in `src/app/i18n/messages/<area>.ts`, otherwise it is shown untranslated.
- Icons: `<app-icon name="…" [size]="24" />`, names from `src/app/ui/icons.ts`. Buttons: `<button appButton variant="primary|ghost" size="sm">`. Controls are 44px high, radius 2px, no shadows, no rounded corners except the one round sell button.
- Phone rules go into `@media (max-width: 720px) { … }`; never change the desktop rules.
- Commit after each task with `git add <files by name>` (never `git add -A`) and a message like the repo's: `Mobile: <what changed, one sentence>`. No `Co-Authored-By`, no "Generated with" lines.
- Model hint for the dispatcher: Tasks 4 and 7 are design and logic heavy → Opus. Tasks 1, 2, 3, 5, 6, 8 → Sonnet. Task 9 is run by the lead session in the browser pane.

---

## File structure

| File | Responsibility |
|---|---|
| `frontend/src/index.html` | viewport meta gets `viewport-fit=cover` |
| `frontend/src/app/ui/icons.ts` | + `home` icon |
| `frontend/src/app/i18n/messages/shell.ts`, `find.ts` | new translation keys |
| `frontend/src/app/pages/saved.ts` (+ `saved.spec.ts`) | "Meine Suchen" placeholder page |
| `frontend/src/app/app.routes.ts` | route `/saved` |
| `frontend/src/app/shell/account.ts` | Anmelden link / Abmelden button with the logout logic (moved out of `header.ts`) |
| `frontend/src/app/shell/header.ts`, `header.html` | uses `<app-account />`, "Meine Suchen" → `/saved` |
| `frontend/src/app/shell/footer.ts` (+ `footer.spec.ts`) | + `<app-account />` shown on phones |
| `frontend/src/app/shell/tab-bar.ts` (+ `tab-bar.spec.ts`) | the bottom tab bar |
| `frontend/src/app/app.html`, `app.ts` | renders `<app-tab-bar />` |
| `frontend/src/app/shell/error-toast.ts` | toast sits above the tab bar on phones |
| `frontend/src/components.css` | tab bar, phone header, phone footer, phone hero, phone main padding |
| `frontend/src/app/pages/home.html` | hero submit gets an `aria-label` (its text is hidden on phones) |
| `frontend/src/app/pages/find.ts`, `find.html`, `find.spec.ts` | Filter button, chip row, icon buttons, filter sheet |
| `frontend/src/app/pages/listing.ts`, `business.ts`, `sell.ts` | small phone CSS fixes |

---

### Task 1: Viewport, home icon, translations (Sonnet)

**Files:**
- Modify: `frontend/src/index.html:7`
- Modify: `frontend/src/app/ui/icons.ts`
- Modify: `frontend/src/app/i18n/messages/shell.ts`
- Modify: `frontend/src/app/i18n/messages/find.ts`

- [ ] **Step 1: Viewport meta**

In `frontend/src/index.html` replace the viewport line with:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- [ ] **Step 2: Home icon**

In `frontend/src/app/ui/icons.ts` add after the `plus` line:

```ts
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
```

- [ ] **Step 3: Shell translations**

In `frontend/src/app/i18n/messages/shell.ts` add inside `SHELL_MESSAGES` (next to `Nachrichten`):

```ts
  Start: { fr: 'Accueil', it: 'Inizio', en: 'Home' },
  'Verkaufen, neues Inserat': {
    fr: 'Vendre, nouvelle annonce',
    it: 'Vendi, nuovo annuncio',
    en: 'Sell, new listing',
  },
  'Hier siehst du bald deine gespeicherten Suchen.': {
    fr: 'Tu verras bientôt ici tes recherches enregistrées.',
    it: 'Qui vedrai presto le tue ricerche salvate.',
    en: 'Your saved searches will show up here soon.',
  },
```

- [ ] **Step 4: Find translations**

In `frontend/src/app/i18n/messages/find.ts` add inside `FIND_MESSAGES` (next to `Filter`):

```ts
  '{count} Treffer anzeigen': {
    fr: 'Afficher {count} résultats',
    it: 'Mostra {count} risultati',
    en: 'Show {count} results',
  },
  'Treffer anzeigen': { fr: 'Afficher les résultats', it: 'Mostra i risultati', en: 'Show results' },
  'Aus deinem Satz übernommen. Antippen zum Entfernen.': {
    fr: 'Repris de ta phrase. Touche pour retirer.',
    it: 'Ripreso dalla tua frase. Tocca per rimuovere.',
    en: 'Taken from your sentence. Tap to remove.',
  },
```

- [ ] **Step 5: Check and commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5`
Expected: lint clean, all tests pass (the i18n spec checks every key has fr/it/en).

```bash
git add frontend/src/index.html frontend/src/app/ui/icons.ts frontend/src/app/i18n/messages/shell.ts frontend/src/app/i18n/messages/find.ts
git commit -m "Mobile: viewport-fit, home icon and the texts of the tab bar and filter sheet"
```

---

### Task 2: "Meine Suchen" placeholder page at /saved (Sonnet)

**Files:**
- Create: `frontend/src/app/pages/saved.ts`
- Create: `frontend/src/app/pages/saved.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/shell/header.html` (two links `routerLink="/find"` with "Meine Suchen")

- [ ] **Step 1: Write the failing test**

`frontend/src/app/pages/saved.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Saved } from './saved';

describe('Saved', () => {
  it('shows the title and the placeholder line', () => {
    const fixture = TestBed.createComponent(Saved);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')!.textContent).toBe('Meine Suchen');
    expect(el.textContent).toContain('Hier siehst du bald deine gespeicherten Suchen.');
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd frontend && pnpm exec ng test --watch=false --include='**/saved.spec.ts' 2>&1 | tail -5`
Expected: fails, `./saved` cannot be resolved.

- [ ] **Step 3: Page**

`frontend/src/app/pages/saved.ts` (same shape as `messages.ts`):

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

// TODO: saved searches need a saved-search/alert API; replace this placeholder once it exists.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-saved',
  template: `<h1>{{ 'Meine Suchen' | t }}</h1>
    <p class="zw-muted">{{ 'Hier siehst du bald deine gespeicherten Suchen.' | t }}</p>`,
  styles: 'h1 { margin-bottom: var(--space-4); }',
})
export class Saved {}
```

- [ ] **Step 4: Route and header links**

In `frontend/src/app/app.routes.ts` add after the `messages` route:

```ts
  {
    path: 'saved',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/saved').then((m) => m.Saved),
  },
```

In `frontend/src/app/shell/header.html` change both "Meine Suchen" anchors from `routerLink="/find"` to `routerLink="/saved"` (the docked icon-only one with `aria-label` and the labelled one). Leave every other link alone.

- [ ] **Step 5: Run, lint, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5`
Expected: pass.

```bash
git add frontend/src/app/pages/saved.ts frontend/src/app/pages/saved.spec.ts frontend/src/app/app.routes.ts frontend/src/app/shell/header.html
git commit -m "Mobile: Meine Suchen placeholder page at /saved, header links point to it"
```

---

### Task 3: Account component, used by the header and (on phones) the footer (Sonnet)

**Files:**
- Create: `frontend/src/app/shell/account.ts`
- Create: `frontend/src/app/shell/footer.spec.ts`
- Modify: `frontend/src/app/shell/header.ts`, `header.html`
- Modify: `frontend/src/app/shell/footer.ts`
- Modify: `frontend/src/components.css` (footer section, around line 640)

- [ ] **Step 1: Write the failing footer test**

`frontend/src/app/shell/footer.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../auth/auth';
import { Footer } from './footer';

function setup(user: object | null) {
  const logout = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: Auth, useValue: { user: signal(user), logout } }],
  });
  const fixture = TestBed.createComponent(Footer);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, logout };
}

describe('Footer', () => {
  it('offers Anmelden when signed out', () => {
    const { el } = setup(null);
    const link = el.querySelector<HTMLAnchorElement>('app-account a')!;
    expect(link.textContent!.trim()).toBe('Anmelden');
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('offers Abmelden when signed in and signs out on click', async () => {
    const { fixture, el, logout } = setup({ id: '1', email: 'a@b.ch' });
    const button = el.querySelector<HTMLButtonElement>('app-account button')!;
    expect(button.textContent!.trim()).toBe('Abmelden');
    button.click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd frontend && pnpm exec ng test --watch=false --include='**/footer.spec.ts' 2>&1 | tail -5`
Expected: fails, `app-account a` is null.

- [ ] **Step 3: Account component**

`frontend/src/app/shell/account.ts` — the logout logic is the one from `header.ts` (`signingOut`, `logout()`), moved:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { ErrorBanner } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';

/** "Anmelden" link or "Abmelden" button; the header shows it, and on phones the footer. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  selector: 'app-account',
  host: { class: 'zw-account' },
  template: `@if (auth.user()) {
      <button type="button" class="zw-link" [disabled]="signingOut()" (click)="logout()">
        {{ 'Abmelden' | t }}
      </button>
    } @else {
      <a routerLink="/login">{{ 'Anmelden' | t }}</a>
    }`,
})
export class Account {
  protected readonly auth = inject(Auth);
  private readonly errors = inject(ErrorBanner);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  protected readonly signingOut = signal(false);

  protected async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch {
      this.errors.show(this.i18n.t('Abmelden hat nicht geklappt. Versuch es nochmals.'));
    } finally {
      this.signingOut.set(false);
    }
  }
}
```

- [ ] **Step 4: Header uses it**

In `frontend/src/app/shell/header.html` replace the block

```html
      @if (auth.user()) {
        <button type="button" class="zw-link" [disabled]="signingOut()" (click)="logout()">
          {{ 'Abmelden' | t }}
        </button>
      } @else {
        <a routerLink="/login">{{ 'Anmelden' | t }}</a>
      }
```

with

```html
      <app-account />
```

In `frontend/src/app/shell/header.ts`: import `Account` from `'./account'` and add it to `imports`; delete the `logout()` method, the `signingOut` signal and the now-unused fields `auth`, `errors`, `router` with their imports (`Auth`, `ErrorBanner`, `Router`; keep `RouterLink`, `signal`). `hero`, `i18n`, `location`, `locationLabel`, `docked`, `query` stay. (`app-icon` carries an inline `display` style, so never put a show/hide class on it directly; wrap it in a span.)

- [ ] **Step 5: Footer shows it on phones**

In `frontend/src/app/shell/footer.ts`: import `Account` from `'./account'`, add it to `imports`, and insert `<app-account />` right before `<span class="zw-footer__langs"`.

In `frontend/src/components.css`, after the `.zw-footer__langs { … }` rule add:

```css
.zw-account {
  display: contents;
}
/* The header carries the account link; the footer only shows it where the header's nav is hidden. */
.zw-footer .zw-account {
  display: none;
}
@media (max-width: 720px) {
  .zw-footer .zw-account {
    display: contents;
  }
  .zw-footer__bar {
    gap: var(--space-3) var(--space-6);
    padding-top: var(--space-6);
    padding-bottom: var(--space-6);
  }
  .zw-footer__bar a,
  .zw-footer__bar .zw-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .zw-footer__langs {
    width: 100%;
    margin-left: 0;
    gap: var(--space-4);
  }
  .zw-footer__langs button {
    min-height: 44px;
    padding: 0 var(--space-1);
  }
}
```

- [ ] **Step 6: Run, lint, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5`
Expected: pass, including the new footer spec.

```bash
git add frontend/src/app/shell/account.ts frontend/src/app/shell/footer.spec.ts frontend/src/app/shell/footer.ts frontend/src/app/shell/header.ts frontend/src/app/shell/header.html frontend/src/components.css
git commit -m "Mobile: Anmelden/Abmelden as one Account component, shown in the footer on phones"
```

---

### Task 4: Tab bar (Opus)

**Files:**
- Create: `frontend/src/app/shell/tab-bar.ts`
- Create: `frontend/src/app/shell/tab-bar.spec.ts`
- Modify: `frontend/src/app/app.html`, `frontend/src/app/app.ts`
- Modify: `frontend/src/components.css` (new "Tab bar" section after the footer section; `.zw-main` padding)
- Modify: `frontend/src/app/shell/error-toast.ts` (styles, the 720px block)

- [ ] **Step 1: Write the failing test**

`frontend/src/app/shell/tab-bar.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TabBar } from './tab-bar';

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'find', children: [] },
        { path: 'messages', children: [] },
        { path: 'saved', children: [] },
        { path: 'sell', outlet: 'modal', children: [] },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(TabBar);
  await TestBed.inject(Router).navigateByUrl(url);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const labels = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((a) => a.textContent!.trim());

describe('TabBar', () => {
  it('has five targets; the plus button opens the sell dialog', async () => {
    const el = await setup('/');
    expect(labels(el, 'a')).toEqual(['Start', 'Suchen', 'Verkaufen', 'Nachrichten', 'Meine Suchen']);
    const sell = el.querySelectorAll('a')[2];
    expect(sell.getAttribute('href')).toContain('modal:sell');
    expect(sell.getAttribute('aria-label')).toBe('Verkaufen, neues Inserat');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Start']);
  });

  it('marks the current page, Start only on /', async () => {
    const el = await setup('/find');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Suchen']);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd frontend && pnpm exec ng test --watch=false --include='**/tab-bar.spec.ts' 2>&1 | tail -5`
Expected: fails, `./tab-bar` cannot be resolved.

- [ ] **Step 3: Component**

`frontend/src/app/shell/tab-bar.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

/** Phone navigation, fixed at the bottom; hidden from 720px, where the header carries the nav. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, TranslatePipe],
  selector: 'app-tab-bar',
  host: { class: 'zw-tabs' },
  template: `<nav class="zw-tabs__bar" [attr.aria-label]="'Hauptnavigation' | t">
    <a
      routerLink="/"
      routerLinkActive="zw-tabs__item--active"
      [routerLinkActiveOptions]="{ exact: true }"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="home" [size]="24" />
      <span>{{ 'Start' | t }}</span>
    </a>
    <a
      routerLink="/find"
      routerLinkActive="zw-tabs__item--active"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="search" [size]="24" />
      <span>{{ 'Suchen' | t }}</span>
    </a>
    <a
      [routerLink]="[{ outlets: { modal: ['sell'] } }]"
      class="zw-tabs__item zw-tabs__sell"
      [attr.aria-label]="'Verkaufen, neues Inserat' | t"
    >
      <span class="zw-tabs__plus"><app-icon name="plus" [size]="28" /></span>
      <span>{{ 'Verkaufen' | t }}</span>
    </a>
    <a
      routerLink="/messages"
      routerLinkActive="zw-tabs__item--active"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="message" [size]="24" />
      <span>{{ 'Nachrichten' | t }}</span>
    </a>
    <a
      routerLink="/saved"
      routerLinkActive="zw-tabs__item--active"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="bookmark" [size]="24" />
      <span>{{ 'Meine Suchen' | t }}</span>
    </a>
  </nav>`,
})
export class TabBar {}
```

- [ ] **Step 4: Render it in the shell**

`frontend/src/app/app.html` — insert the tab bar after the footer:

```html
<app-header />
<main class="zw-main">
  <router-outlet />
</main>
<app-footer />
<app-tab-bar />
<router-outlet name="modal" />
<app-error-toast />
```

`frontend/src/app/app.ts`: `import { TabBar } from './shell/tab-bar';` and add `TabBar` to `imports`.

- [ ] **Step 5: Styles**

In `frontend/src/components.css` add a new section right before `/* Sections */`:

```css
/* Tab bar (phones only) */
.zw-tabs {
  display: none;
}
.zw-tabs__bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  height: 56px;
}
.zw-tabs__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px;
  font-size: 11px;
  line-height: 14px;
  font-weight: 500;
  color: var(--ink-muted);
  text-decoration: none;
}
.zw-tabs__item:hover,
.zw-tabs__item--active {
  color: var(--ink);
}
.zw-tabs__item--active::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 12px;
  right: 12px;
  height: 2px;
  background: var(--ink);
}
/* The sell button is the one round element: it rises 16px above the bar, its label sits under it. */
.zw-tabs__sell {
  justify-content: flex-end;
  padding-bottom: 2px;
  color: var(--ink);
}
.zw-tabs__plus {
  position: absolute;
  top: -16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--bg-900);
  color: var(--ink-inverse);
}
@media (max-width: 720px) {
  .zw-tabs {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    background: var(--bg-000);
    border-top: var(--border-1) solid var(--line-soft);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .zw-main {
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }
}
```

In `frontend/src/app/shell/error-toast.ts` change the 720px block to:

```css
    @media (max-width: 720px) {
      .toast {
        right: var(--space-4);
        bottom: calc(72px + var(--space-4) + env(safe-area-inset-bottom));
      }
    }
```

- [ ] **Step 6: Run, lint, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5`
Expected: pass.

```bash
git add frontend/src/app/shell/tab-bar.ts frontend/src/app/shell/tab-bar.spec.ts frontend/src/app/app.html frontend/src/app/app.ts frontend/src/components.css frontend/src/app/shell/error-toast.ts
git commit -m "Mobile: tab bar at the bottom with the round sell button in the middle"
```

---

### Task 5: Slim header on phones (Sonnet)

**Files:**
- Modify: `frontend/src/components.css` (the `@media (max-width: 720px)` block around line 617 that contains `.zw-header { position: static; }`)

- [ ] **Step 1: Replace the phone header block**

Replace

```css
@media (max-width: 720px) {
  /* The wrapped header takes a third of a phone screen; let it scroll away. */
  .zw-header {
    position: static;
  }
  .zw-dock {
    order: 3;
    flex-basis: 100%;
  }
}
```

with

```css
@media (max-width: 720px) {
  /* Phones: one row with the wordmark and the location chip; the tab bar carries the nav, /find its own search. */
  .zw-header {
    position: static;
  }
  .zw-header__bar {
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 56px;
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
  }
  .zw-wordmark__tagline,
  .zw-nav,
  .zw-dock {
    display: none;
  }
  .zw-header .zw-chip--location {
    height: 36px;
    max-width: 60%;
  }
}
```

Note: when the header is docked (every page but the top of Start) the location chip lives inside `.zw-dock`, so the phone header then shows only the wordmark. That is intended.

- [ ] **Step 2: Run, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng build 2>&1 | tail -3`
Expected: build succeeds.

```bash
git add frontend/src/components.css
git commit -m "Mobile: header is one row with wordmark and location chip"
```

---

### Task 6: Start page hero on phones (Sonnet)

**Files:**
- Modify: `frontend/src/app/pages/home.html` (hero submit button)
- Modify: `frontend/src/components.css` (hero rules around line 706–765, `.zw-cats`)

- [ ] **Step 1: Accessible name for the icon-only submit**

In `frontend/src/app/pages/home.html` give the hero submit an `aria-label` (its text is hidden on phones):

```html
    <button appButton variant="primary" type="submit" [attr.aria-label]="'Suchen' | t">
      <app-icon name="search" />
      <span>{{ 'Suchen' | t }}</span>
    </button>
```

- [ ] **Step 2: Phone hero styles**

In `frontend/src/components.css` replace the hero phone block

```css
@media (max-width: 720px) {
  .zw-hero__form {
    flex-direction: column;
  }
  .zw-hero__form .zw-btn {
    width: 100%;
  }
}
```

with

```css
@media (max-width: 720px) {
  /* Mockup 1a: left-aligned, input and icon button in one row, quick filters scroll sideways. */
  .zw-hero {
    align-items: stretch;
    gap: var(--space-3);
    padding-top: var(--space-4);
    padding-bottom: var(--space-6);
    text-align: left;
  }
  .zw-hero__title {
    font-size: 32px;
    line-height: 36px;
  }
  .zw-hero__lead {
    font-size: 15px;
    line-height: 22px;
  }
  .zw-hero__form .zw-input {
    min-height: 48px;
    font-size: 16px;
  }
  .zw-hero__form .zw-btn {
    width: 48px;
    min-height: 48px;
    padding: 0;
  }
  .zw-hero__form .zw-btn span {
    display: none;
  }
  .zw-hero__chips {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 calc(-1 * var(--space-4));
    padding: 0 var(--space-4);
  }
  .zw-hero__chips::-webkit-scrollbar {
    display: none;
  }
  .zw-hero__chips .zw-chip {
    flex: none;
  }
  .zw-hero__hint {
    display: none;
  }
  .zw-cats {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
    margin: var(--space-2) calc(-1 * var(--space-4)) 0;
    padding: 0 var(--space-4);
  }
  .zw-cats::-webkit-scrollbar {
    display: none;
  }
  .zw-cat {
    flex: none;
  }
}
```

- [ ] **Step 3: Run, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5 && pnpm exec ng build 2>&1 | tail -3`
Expected: pass; `home.spec.ts` still finds `#hero-q` and the submit.

```bash
git add frontend/src/app/pages/home.html frontend/src/components.css
git commit -m "Mobile: Start hero as in the mockup, quick filters and categories scroll sideways"
```

---

### Task 7: Find page: chip row, icon buttons, filter sheet (Opus)

**Files:**
- Modify: `frontend/src/app/pages/find.html`
- Modify: `frontend/src/app/pages/find.ts` (imports, styles, class)
- Modify: `frontend/src/app/pages/find.spec.ts`

Read `find.html` and `find.ts` fully first. The component auto-applies filter changes (`changed()` → `showMatches()`), so on phones the sheet's submit only closes the sheet; "Treffer aktualisieren" on the web keeps its behaviour.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('Find', …)` block in `frontend/src/app/pages/find.spec.ts`:

```ts
  it('the Filter button opens the filters as a sheet; submit closes it without matching again', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 12 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, 'working iMac');

    expect(el.querySelector('[role="dialog"]')).toBeNull();
    const open = el.querySelector<HTMLButtonElement>('.find__filter')!;
    expect(open.getAttribute('aria-expanded')).toBe('false');
    open.click();
    await fixture.whenStable();

    const sheet = el.querySelector<HTMLFormElement>('form[role="dialog"]')!;
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(sheet.querySelector('button[aria-label="Schliessen"]'));
    expect(sheet.querySelector('button[type="submit"]')!.textContent).toContain('1 Treffer anzeigen');
    expect(document.body.style.overflow).toBe('hidden');

    sheet.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(matches).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(open);
  });

  it('Escape and the scrim close the filter sheet', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, 'working iMac');

    const open = el.querySelector<HTMLButtonElement>('.find__filter')!;
    open.click();
    await fixture.whenStable();
    el.querySelector('form[role="dialog"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    open.click();
    await fixture.whenStable();
    el.querySelector<HTMLElement>('.find__scrim')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
```

- [ ] **Step 2: Run them, expect failure**

Run: `cd frontend && pnpm exec ng test --watch=false --include='**/find.spec.ts' 2>&1 | tail -8`
Expected: the two new tests fail (`.find__filter` is null); the old ones pass.

- [ ] **Step 3: Template**

In `frontend/src/app/pages/find.html`:

(a) The query submit gets an `aria-label` (its text is hidden on phones):

```html
  <button
    appButton
    type="submit"
    [disabled]="loading() || !text().trim()"
    [attr.aria-label]="'Suchen' | t"
  >
    <app-icon name="search" />
    <span>{{ (loading() ? 'Suche läuft…' : 'Suchen') | t }}</span>
  </button>
```

(b) The tip line gets a class so phones can hide it: `<p id="find-tip" class="zw-help find__web">`.

(c) The chip strip: a Filter button first (phones only), the web-only texts marked, the chips kept exactly as they are, and a phone-only help line after the strip. The strip becomes:

```html
  <div class="find__strip">
    <button
      #filterBtn
      type="button"
      class="zw-btn zw-btn--sm find__filter"
      aria-controls="find-filters"
      [attr.aria-expanded]="filterOpen()"
      (click)="openFilter()"
    >
      <app-icon name="menu" [size]="16" />
      <span>{{ 'Filter' | t }}</span>
    </button>
    <span class="zw-help find__web">{{ 'Aus deinem Satz übernommen:' | t }}</span>
    … the three chip blocks (@for rows, budget, region) unchanged …
    <span class="zw-help find__web">{{ 'Antippen zum Entfernen, links alles im Detail.' | t }}</span>
    <!-- TODO: "Suche speichern" needs a saved-search/alert API (immediate, daily, weekly; dedup of relists). -->
    <button appButton variant="primary" type="button" class="find__web" disabled>
      {{ 'Suche speichern' | t }}
    </button>
  </div>
  <p class="zw-help find__phone">{{ 'Aus deinem Satz übernommen. Antippen zum Entfernen.' | t }}</p>
```

(d) The adjust form's submit gets an icon for phones and an `aria-label`:

```html
    <button
      appButton
      type="submit"
      [disabled]="loading() || !adjust().trim()"
      [attr.aria-label]="'Anpassen' | t"
    >
      <span class="find__phone"><app-icon name="chevron" /></span>
      <span class="find__web">{{ 'Anpassen' | t }}</span>
    </button>
```

(e) The results bar: sort stays web-only, a phone-only save button joins:

```html
        <div class="find__bar">
          <span class="find__count">{{ '{count} Inserate' | t: { count: found.length } }}</span>
          <span class="zw-help">{{ '{count} verglichen' | t: { count: res.compared ?? 0 } }}</span>
          <!-- TODO: other sort orders; the backend returns the list by score. -->
          <label for="find-sort" class="find__web">{{ 'Sortieren' | t }}</label>
          <select id="find-sort" class="zw-input find__web" disabled>
            <option>{{ 'Beste Passung' | t }}</option>
          </select>
          <button appButton variant="ghost" size="sm" type="button" class="find__phone find__save" disabled>
            <app-icon name="bookmark" [size]="16" />
            <span>{{ 'Suche speichern' | t }}</span>
          </button>
        </div>
```

(f) The filter form becomes the sheet. Scrim before it, head/body/foot inside; the fieldsets move unchanged into the body:

```html
  <div class="find__cols">
    @if (filterOpen()) {
      <div class="find__scrim" (click)="closeFilter()"></div>
    }
    <form
      id="find-filters"
      class="find__filters"
      [class.find__filters--open]="filterOpen()"
      [attr.role]="filterOpen() ? 'dialog' : null"
      [attr.aria-modal]="filterOpen() ? 'true' : null"
      [attr.aria-label]="'Filter' | t"
      (ngSubmit)="submitFilters()"
      (keydown.escape)="closeFilter()"
    >
      <div class="find__sheet-head">
        <h3>{{ 'Filter' | t }}</h3>
        <button
          #closeBtn
          appButton
          variant="ghost"
          type="button"
          [attr.aria-label]="'Schliessen' | t"
          (click)="closeFilter()"
        >
          <app-icon name="x" />
        </button>
      </div>
      <div class="find__sheet-body">
        … every `.find__f` block and fieldset exactly as today (Anforderungen, Kategorie, Marke, Modell, Preis, Region, Zustand, Verkaufsart, Nur) …
      </div>
      <div class="find__sheet-foot">
        <button appButton type="submit" [disabled]="matching()">
          <span class="find__web">{{ (matching() ? 'Suche läuft…' : 'Treffer aktualisieren') | t }}</span>
          <span class="find__phone">{{ showLabel() }}</span>
        </button>
        <button appButton variant="ghost" size="sm" type="button" (click)="reset()">
          {{ 'Filter zurücksetzen' | t }}
        </button>
      </div>
    </form>
    <div class="find__results" …unchanged…>
```

Remove the old `[attr.aria-label]="'Filter' | t" (ngSubmit)="showMatches()"` attributes from the form, they are replaced above.

- [ ] **Step 4: Component class**

In `frontend/src/app/pages/find.ts`:

Imports: add `afterNextRender`, `computed`, `DestroyRef`, `ElementRef`, `Injector`, `viewChild` to the `@angular/core` import.

Fields (next to the other signals):

```ts
  /** Phones: the filter column is a sheet; on the web the button that opens it is hidden and this stays false. */
  protected readonly filterOpen = signal(false);
  protected readonly showLabel = computed(() => {
    if (this.matching()) return this.i18n.t('Suche läuft…');
    const res = this.results();
    return res
      ? this.i18n.t('{count} Treffer anzeigen', { count: res.matches?.length ?? 0 })
      : this.i18n.t('Treffer anzeigen');
  });
  private readonly filterBtn = viewChild<ElementRef<HTMLButtonElement>>('filterBtn');
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly injector = inject(Injector);
```

In the constructor (at its end) add: `inject(DestroyRef).onDestroy(() => (document.body.style.overflow = ''));`

Methods (next to `reset()`):

```ts
  protected openFilter(): void {
    this.filterOpen.set(true);
    document.body.style.overflow = 'hidden';
    afterNextRender(() => this.closeBtn()?.nativeElement.focus(), { injector: this.injector });
  }

  protected closeFilter(): void {
    if (!this.filterOpen()) return;
    this.filterOpen.set(false);
    document.body.style.overflow = '';
    this.filterBtn()?.nativeElement.focus();
  }

  /** Filters apply as they change; the sheet's button only closes it, the web button matches again. */
  protected submitFilters(): void {
    if (this.filterOpen()) this.closeFilter();
    else this.showMatches();
  }
```

If `afterNextRender` does not fire in the spec (focus assertion fails), replace it with `queueMicrotask(() => this.closeBtn()?.nativeElement.focus())` and drop `Injector`.

- [ ] **Step 5: Styles**

In the `styles` of `find.ts` add (web defaults first, then the phone block at the end):

```css
    .find__filter,
    .find__phone {
      display: none;
    }
    .find__count {
      font-weight: 600;
    }
    /* Web: head and foot dissolve into the plain filter column. */
    .find__sheet-head {
      display: none;
    }
    .find__sheet-body,
    .find__sheet-foot {
      display: contents;
    }
    @media (max-width: 720px) {
      .find__web {
        display: none;
      }
      .find__phone {
        display: revert;
      }
      .zw-btn.find__phone,
      .find__filter {
        display: inline-flex;
      }
      .find__query .zw-btn,
      .find__adjust .zw-btn {
        width: 44px;
        padding: 0;
      }
      .find__query .zw-btn span,
      .find__adjust .zw-btn span {
        display: none;
      }
      .find__adjust {
        max-width: none;
      }
      .find__strip {
        flex-wrap: nowrap;
        gap: var(--space-2);
        overflow-x: auto;
        scrollbar-width: none;
        margin: 0 calc(-1 * var(--space-4));
        padding: var(--space-4) var(--space-4) 0;
      }
      .find__strip::-webkit-scrollbar {
        display: none;
      }
      .find__strip > :last-child {
        margin-left: 0;
      }
      .find__strip .zw-chip,
      .find__filter {
        flex: none;
      }
      .find__filter {
        padding-right: var(--space-3);
        margin-right: var(--space-1);
        border-right: var(--border-1) solid var(--line-soft);
        border-radius: 0;
        border-top: 0;
        border-bottom: 0;
        border-left: 0;
      }
      .find__bar .find__save {
        margin-left: auto;
      }
      .find__cols {
        gap: 0;
        padding-top: var(--space-6);
      }
      .find__filters {
        display: none;
      }
      .find__scrim {
        position: fixed;
        inset: 0;
        z-index: 25;
        background: var(--overlay);
      }
      .find__filters--open {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 26;
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 88dvh;
        background: var(--bg-000);
        border-top: var(--border-1) solid var(--line);
      }
      .find__sheet-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
        border-bottom: var(--border-1) solid var(--line-soft);
      }
      .find__sheet-body {
        display: flex;
        flex-direction: column;
        gap: 28px;
        flex: 1 1 auto;
        overflow-y: auto;
        padding: var(--space-4);
      }
      .find__sheet-foot {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
        border-top: var(--border-1) solid var(--line-soft);
      }
      .find__sheet-foot .zw-btn[type='submit'] {
        width: 100%;
        min-height: 48px;
      }
    }
```

The Filter button keeps its `zw-btn zw-btn--sm` look except that on phones only a soft right border divides it from the chips, as in mockup 2a (the mockup draws it outlined; if the outlined look reads better in the screenshot, drop the four `border-*` overrides and keep `margin-right`).

- [ ] **Step 6: Run, lint, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -8`
Expected: all find specs pass, including the two new ones.

```bash
git add frontend/src/app/pages/find.html frontend/src/app/pages/find.ts frontend/src/app/pages/find.spec.ts
git commit -m "Mobile: Suchen with a Filter button, a scrolling chip row and the filters as a sheet"
```

---

### Task 8: The other pages at 393px (Sonnet)

**Files:**
- Modify: `frontend/src/app/pages/listing.ts` (styles)
- Modify: `frontend/src/app/pages/business.ts` (styles)
- Modify: `frontend/src/app/pages/sell.ts` (styles)
- Modify: `frontend/src/components.css` (phone block near `.zw-main`)

- [ ] **Step 1: Listing detail**

In the `styles` of `frontend/src/app/pages/listing.ts` add at the end:

```css
    @media (max-width: 720px) {
      .cols {
        padding-top: var(--space-4);
      }
      .fact {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }
    }
```

- [ ] **Step 2: Business list**

In the `styles` of `frontend/src/app/pages/business.ts` add:

```css
    @media (max-width: 720px) {
      .bz-name {
        min-width: 0;
        flex-basis: 100%;
      }
    }
```

- [ ] **Step 3: Sell page bottom safe area**

In the `styles` of `frontend/src/app/pages/sell.ts` change `.sell { … min-height: 100vh; }` to include the safe area:

```css
    .sell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding-bottom: env(safe-area-inset-bottom);
    }
```

- [ ] **Step 4: Global phone rules**

In `frontend/src/components.css`, inside the `@media (max-width: 720px)` block that sets `.zw-main { padding-bottom … }` (Task 4), add:

```css
  /* Long titles and prices must not widen a phone page. */
  h1,
  h2,
  h3 {
    overflow-wrap: anywhere;
  }
  img {
    max-width: 100%;
  }
  .zw-main > :not(.zw-container, .zw-bleed, router-outlet) {
    padding-top: var(--space-4);
  }
```

- [ ] **Step 5: Run, commit**

Run: `cd frontend && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5 && pnpm exec ng build 2>&1 | tail -3`
Expected: pass.

```bash
git add frontend/src/app/pages/listing.ts frontend/src/app/pages/business.ts frontend/src/app/pages/sell.ts frontend/src/components.css
git commit -m "Mobile: listing facts, business names, sell safe area and long titles fit a phone"
```

---

### Task 9: Verification at 393 × 852 and 1280 (lead session, browser pane)

**Files:** none (fixes found here go into the task's files and get their own commit `Mobile: <fix>`).

- [ ] **Step 1: Full checks**

Run from `frontend/`: `pnpm run format:check && pnpm exec ng lint && pnpm exec ng test --watch=false 2>&1 | tail -5 && pnpm exec ng build 2>&1 | tail -3`
Expected: all green.

- [ ] **Step 2: Start the app**

`preview_start` with a launch config for `pnpm start` on port 4200 (`.claude/launch.json`, name `frontend`). Try the backend first (`cd backend && ./mvnw spring-boot:run`, needs Docker); without it the pages still render with their empty states, which is enough for layout.

- [ ] **Step 3: Phone pass**

`resize_window` to width 393, height 852. Open and screenshot: `/`, `/find?q=iMac` (open the Filter sheet, screenshot, close), `/listings/1` (or any id the API returns; the 404 state otherwise), `/messages`, `/saved`, `/login`, `/register`, `/business`, `/search`, and `/` with the sell dialog opened from the plus button. Check each: no horizontal scroll (`document.documentElement.scrollWidth === 393` via `javascript_tool`), the tab bar is visible with the current tab marked, the content's last line and the footer clear the bar, the toast (trigger one by opening `/business` signed out, if it shows) sits above the bar.

- [ ] **Step 4: Web pass**

`resize_window` preset `desktop`, width 1280. Screenshot `/`, `/find?q=iMac`, `/listings/1`. Expected: identical to before this branch — no tab bar, header with nav and account link, filter column left, no Filter button, no "Suche speichern" in the results bar, the hero form with the labelled button.

- [ ] **Step 5: Fix and commit anything found; then report**

End with one or two lines on what was skipped or not checked and any risk (e.g. the backend was not running, so the find results were only covered by the spec).
