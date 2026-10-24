# Find results screen after the Claude Design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the results screen of `/find` after the Claude Design: the buyer's sentence as a heading with tappable underlined tokens, one sticky facet bar, results in the groups Passt / Möglich / Alternativen with a why line per card.

**Architecture:** Two small backend additions (`Requirement.phrase` + `budgetPhrase`/`regionPhrase` from the parser, `conditions` as a hard filter), then the page: `find.ts` stays the orchestrator (state, URL, API calls), a generic `ui/facet.ts` dropdown, a page-local `pages/find-sentence.ts` for the heading, and `why`/`fit` inputs on the listing card. Facet edits search once when the panel closes; token taps search at once.

**Tech Stack:** Java 25, Spring Boot 4.1, JPQL, Mockito; Angular 22 (signals, `input`/`model`/`output`, `@if`/`@for`), generated OpenAPI client, Vitest.

Spec: `docs/superpowers/specs/2026-10-24-find-results-redesign-design.md`. Read `AGENTS.md` and `docs/LEAN-CODE.md` first. Work in the worktree `.claude/worktrees/find-redesign` (branch `find-redesign`); every path below is relative to it. Commit messages carry no tool signature.

**Model per task** (the orchestrator dispatches): Tasks 1–3 → Sonnet, Tasks 4–6 → Opus, Task 7 → the orchestrator. Order: 1 → 2; then 2, 3, 4, 5 may run in parallel (disjoint files); 6 after 2–5; 7 last.

---

## File map

| File | Change |
|---|---|
| `backend/src/main/java/one/absent/hackaton/search/Requirement.java` | `phrase` + 3-arg constructor |
| `backend/src/main/java/one/absent/hackaton/search/SearchRequirements.java` | `budgetPhrase`, `regionPhrase`, `conditions` + 10-arg constructor |
| `backend/src/main/java/one/absent/hackaton/search/SearchService.java` | `Parsed`, prompt, schema, `parse`, `canonical`, `candidates`, two constructor calls |
| `backend/src/test/java/one/absent/hackaton/search/SearchControllerTest.java` | phrases in the parse test, `Parsed` call sites, conditions test |
| `frontend/openapi.json`, `frontend/src/app/api/` | regenerated, never hand-edited |
| `frontend/src/app/i18n/messages/find.ts` | new strings |
| `frontend/src/components.css` | `.zw-card__why` |
| `frontend/src/app/ui/listing-card.ts`, `ui/summary-card.ts` | `why`, `fit` inputs |
| `frontend/src/app/ui/facet.ts`, `ui/facet.spec.ts` | new dropdown facet |
| `frontend/src/app/pages/find-sentence.ts`, `pages/find-sentence.spec.ts` | new heading with tokens |
| `frontend/src/app/pages/find.ts`, `find.html`, `find.spec.ts` | rewritten results screen |

Commands (from the worktree root):

- Backend search tests: `cd backend && ./mvnw -q test -Dtest='Search*Test'`
- Full backend check, rewrites `frontend/openapi.json`: `cd backend && ./mvnw -q verify`
- Frontend: `cd frontend && pnpm run api && pnpm run format && pnpm exec ng lint && pnpm exec ng test --watch=false && pnpm exec ng build`
- One spec file: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/find.spec.ts`

---

### Task 1: Backend — phrases from the parser, conditions as a filter

**Files:**
- Modify: `backend/src/main/java/one/absent/hackaton/search/Requirement.java`
- Modify: `backend/src/main/java/one/absent/hackaton/search/SearchRequirements.java`
- Modify: `backend/src/main/java/one/absent/hackaton/search/SearchService.java`
- Test: `backend/src/test/java/one/absent/hackaton/search/SearchControllerTest.java`

- [ ] **Step 1: Extend the parse test and add the conditions test**

In `SearchControllerTest.textBecomesCanonicalRequirements` replace the `Parsed` stub and add the phrase assertions. Old:

```java
                .thenReturn(new SearchService.Parsed(
                        List.of(new Requirement("model", "iMac", Requirement.Comparison.AT_LEAST),
                                new Requirement("Accessories", "mouse", null)),
                        List.of(new Requirement("Year", "2017", Requirement.Comparison.AT_LEAST)), "computers", List.of(" iMac ", "Apple"),
                        new BigDecimal("600"), "8001", 20, false));
```

New:

```java
                .thenReturn(new SearchService.Parsed(
                        List.of(new Requirement("model", "iMac", Requirement.Comparison.AT_LEAST, "  iMac 27 5K  "),
                                new Requirement("Accessories", "mouse", null)),
                        List.of(new Requirement("Year", "2017", Requirement.Comparison.AT_LEAST, "x".repeat(90))),
                        "computers", List.of(" iMac ", "Apple"), new BigDecimal("600"), "8001", 20, false,
                        "max 600 CHF", " near Zürich "));
```

After the line `.andExpect(jsonPath("$.nearMe").value(false));` in that test, add (keep the chain, so replace `;` with the new lines):

```java
                .andExpect(jsonPath("$.nearMe").value(false))
                // phrases come through trimmed and capped at 80, so a parse result always passes /matches
                .andExpect(jsonPath("$.mustHave[0].phrase").value("iMac 27 5K"))
                .andExpect(jsonPath("$.niceToHave[0].phrase").value("x".repeat(80)))
                .andExpect(jsonPath("$.budgetPhrase").value("max 600 CHF"))
                .andExpect(jsonPath("$.regionPhrase").value("near Zürich"))
                .andExpect(jsonPath("$.conditions").isEmpty());
```

The other three `new SearchService.Parsed(` stubs in this class get two `null` arguments at the end. Exact edits:

```java
// anImplausibleDistanceIsDropped — old:
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), null, List.of("chair"), null, "8001", 9000,
                        false));
// new:
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), null, List.of("chair"), null, "8001", 9000,
                        false, null, null));

// nearMeWithoutADistanceMeans25Km — old:
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), "Bikes", List.of("velo"), null, null, null,
                        true));
// new:
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), "Bikes", List.of("velo"), null, null, null,
                        true, null, null));

// refineSendsOriginalHistoryCurrentAndShownListingsToTheAi — old:
                        List.of("turntable"), new BigDecimal("200"), "8001", null, false));
// new:
                        List.of("turntable"), new BigDecimal("200"), "8001", null, false, null, null));
```

Add after `keywordsRankButNoLongerFilter`:

```java
    @Test
    void conditionsAreAHardFilter() {
        Listing used = listing("Used turntable", "100", AUDIO, "8004", Map.of());
        used.setCondition(Condition.USED);
        em.flush();
        var req = new SearchRequirements(List.of(), List.of(), "test audio", List.of(), null, null, null, false,
                null, null, null, null, List.of(Condition.USED, Condition.DEFECTIVE));

        assertThat(search.candidates(req)).extracting(ListingDetail::id).containsExactly(used.getId());
    }
```

- [ ] **Step 2: Run the tests to see them fail to compile**

Run: `cd backend && ./mvnw -q test -Dtest='SearchControllerTest' 2>&1 | grep -E "ERROR.*java|Tests run" | head`
Expected: compilation errors "constructor Requirement ... cannot be applied" / "constructor Parsed ... cannot be applied".

- [ ] **Step 3: `Requirement.phrase`**

Replace the record in `Requirement.java`:

```java
/**
 * {@code comparison}: how a numeric value is meant; null counts as EXACT. {@code phrase}: the words of the buyer's
 * text the requirement came from, null when set by hand.
 */
public record Requirement(@NotBlank @Size(max = 80) String attribute,
                          @NotBlank @Size(max = 200) String value,
                          @Schema(nullable = true) Comparison comparison,
                          @Schema(nullable = true) @Size(max = 80) String phrase) {

    public Requirement(String attribute, String value, Comparison comparison) {
        this(attribute, value, comparison, null);
    }

    public enum Comparison { AT_LEAST, EXACT, AT_MOST }
}
```

- [ ] **Step 4: `SearchRequirements` fields**

Replace the record in `SearchRequirements.java` (keep the imports, add `import one.absent.hackaton.listing.Condition;`):

```java
/**
 * What the buyer wants; {@code keywords}: lowercase search terms incl. synonyms, they only rank;
 * {@code nearMe}: the buyer means their own position; {@code latitude}/{@code longitude}: that position, only as
 * input to matches, never sent to the AI; {@code budgetPhrase}/{@code regionPhrase}: the buyer's words behind the
 * budget and the place; {@code conditions}: hard filter, null or empty = any.
 */
public record SearchRequirements(@NotNull @Size(max = 20) List<@Valid Requirement> mustHave,
                                 @NotNull @Size(max = 20) List<@Valid Requirement> niceToHave,
                                 @Schema(nullable = true) @Size(max = 80) String category,
                                 @NotNull @Size(max = 10) List<@Size(max = 80) String> keywords,
                                 @DecimalMin("0") @DecimalMax("1000000") BigDecimal maxBudgetChf,
                                 @Pattern(regexp = "[0-9]{0,4}") String postcode, @Min(0) @Max(500) Integer maxDistanceKm,
                                 @Schema(nullable = true) Boolean nearMe,
                                 @Schema(nullable = true) @DecimalMin("-90") @DecimalMax("90") Double latitude,
                                 @Schema(nullable = true) @DecimalMin("-180") @DecimalMax("180") Double longitude,
                                 @Schema(nullable = true) @Size(max = 80) String budgetPhrase,
                                 @Schema(nullable = true) @Size(max = 80) String regionPhrase,
                                 @Schema(nullable = true) @Size(max = 5) List<Condition> conditions) {

    public SearchRequirements(List<Requirement> mustHave, List<Requirement> niceToHave, String category,
                              List<String> keywords, BigDecimal maxBudgetChf, String postcode, Integer maxDistanceKm,
                              Boolean nearMe, Double latitude, Double longitude) {
        this(mustHave, niceToHave, category, keywords, maxBudgetChf, postcode, maxDistanceKm, nearMe, latitude,
                longitude, null, null, null);
    }
}
```

- [ ] **Step 5: `SearchService` — `Parsed`, schema, prompt**

`Parsed` record (replace):

```java
    record Parsed(List<Requirement> mustHave, List<Requirement> niceToHave, String category,
                  List<String> keywords, BigDecimal maxBudgetChf, String postcode, Integer maxDistanceKm,
                  Boolean nearMe, String budgetPhrase, String regionPhrase) {
    }
```

`REQUIREMENT_SCHEMA` (replace):

```java
    private static final String REQUIREMENT_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {"attribute": {"type": "string", "enum": %s}, "value": {"type": "string"},
               "comparison": {"type": "string", "enum": ["AT_LEAST", "EXACT", "AT_MOST"]},
               "phrase": {"type": ["string", "null"]}},
             "required": ["attribute", "value", "comparison", "phrase"]}""".formatted(json(ATTRIBUTES));
```

`PARSE_SCHEMA` (replace):

```java
    private static final String PARSE_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {
               "mustHave": {"type": "array", "items": %1$s},
               "niceToHave": {"type": "array", "items": %1$s},
               "category": {"type": ["string", "null"]},
               "keywords": {"type": "array", "items": {"type": "string"}},
               "maxBudgetChf": {"type": ["number", "null"]},
               "postcode": {"type": ["string", "null"]},
               "maxDistanceKm": {"type": ["integer", "null"]},
               "nearMe": {"type": "boolean"},
               "budgetPhrase": {"type": ["string", "null"]},
               "regionPhrase": {"type": ["string", "null"]}},
             "required": ["mustHave", "niceToHave", "category", "keywords", "maxBudgetChf", "postcode",
               "maxDistanceKm", "nearMe", "budgetPhrase", "regionPhrase"]}"""
            .formatted(REQUIREMENT_SCHEMA);
```

In `PARSE_SYSTEM`, after the line that starts with `- Never invent requirements the text does not state.` insert:

```
            - phrase (per requirement): the exact words of the buyer's text it comes from, copied verbatim
              ("iMac 2017", "mindestens 128 GB"); null when there are none.
```

and after the `- nearMe: ...` lines (the end of the prompt, before the closing `"""`) insert:

```
            - budgetPhrase / regionPhrase: the words that state the budget ("bis CHF 600") and the place, distance
              or "near me" ("Abholung nahe Zürich", "in meiner Nähe"); null when there are none.
```

- [ ] **Step 6: `SearchService` — `parse`, `canonical`, `candidates`, the two constructor calls**

`parse()` return statement (replace):

```java
        return new SearchRequirements(canonical(parsed.mustHave()), canonical(parsed.niceToHave()), category,
                keywords, parsed.maxBudgetChf(), postcode != null && postcode.matches("\\d{4}") ? postcode : null,
                distance, nearMe, null, null, phrase(parsed.budgetPhrase()), phrase(parsed.regionPhrase()), null);
```

`canonical()`: replace `new Requirement(a, value, comparison)` with `new Requirement(a, value, comparison, phrase(r.phrase()))`, and add next to `trim`:

```java
    /** A phrase the model returned, trimmed and capped so it passes the validation of a later request. */
    private static String phrase(String s) {
        String t = trim(s);
        return t == null ? null : cut(t, 80);
    }
```

`refine()`, `withoutPosition` (replace):

```java
        SearchRequirements withoutPosition = new SearchRequirements(c.mustHave(), c.niceToHave(), c.category(),
                c.keywords(), c.maxBudgetChf(), c.postcode(), c.maxDistanceKm(), c.nearMe(), null, null,
                c.budgetPhrase(), c.regionPhrase(), c.conditions());
```

`matches()`, the retry without category (replace):

```java
            candidates = candidates(new SearchRequirements(req.mustHave(), req.niceToHave(), null, req.keywords(),
                    req.maxBudgetChf(), req.postcode(), req.maxDistanceKm(), req.nearMe(), req.latitude(),
                    req.longitude(), req.budgetPhrase(), req.regionPhrase(), req.conditions()));
```

`candidates()`: after the `if (category != null) { ... }` block insert:

```java
        if (req.conditions() != null && !req.conditions().isEmpty()) {
            jpql.append(" and l.condition in :conditions");
            params.put("conditions", req.conditions());
        }
```

- [ ] **Step 7: Run the search tests**

Run: `cd backend && ./mvnw -q test -Dtest='Search*Test' 2>&1 | grep -E "Tests run|FAIL|ERROR\]" | head`
Expected: no output (quiet mode, all pass). `requirementWithoutValueIs400` and `textBecomesCanonicalRequirements` passing proves JSON still maps to the canonical record constructors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/search/Requirement.java backend/src/main/java/one/absent/hackaton/search/SearchRequirements.java backend/src/main/java/one/absent/hackaton/search/SearchService.java backend/src/test/java/one/absent/hackaton/search/SearchControllerTest.java
git commit -m "Search: the parser returns the buyer's words per requirement; conditions as a hard filter"
```

---

### Task 2: Regenerate the API contract and the client

**Files:**
- Regenerated: `frontend/openapi.json`, `frontend/src/app/api/`

- [ ] **Step 1: Backend verify (rewrites `openapi.json`)**

Run: `cd backend && ./mvnw -q verify 2>&1 | grep -E "Tests run:|FAIL|ERROR\]" | tail -5; echo "exit ${pipestatus[1]:-$?}"`
Expected: `exit 0`, no failures.

- [ ] **Step 2: Regenerate the client**

Run: `cd frontend && (ls node_modules >/dev/null 2>&1 || pnpm install --frozen-lockfile --silent) && pnpm run api >/dev/null && git -C .. status --short frontend/openapi.json frontend/src/app/api | head`
Expected: `openapi.json` and files under `src/app/api/models/` changed (`requirement.ts`, `search-requirements.ts`).

- [ ] **Step 3: Check the generated types**

Run: `grep -n "phrase\|conditions" frontend/src/app/api/models/requirement.ts frontend/src/app/api/models/search-requirements.ts`
Expected: `phrase?: string | null` in `requirement.ts`; `budgetPhrase`, `regionPhrase`, `conditions?: Array<Condition> | null` in `search-requirements.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/openapi.json frontend/src/app/api
git commit -m "Regenerate the API client for phrases and conditions"
```

---

### Task 3: Strings and the card's why line

**Files:**
- Modify: `frontend/src/app/i18n/messages/find.ts`
- Modify: `frontend/src/components.css`
- Modify: `frontend/src/app/ui/listing-card.ts`
- Modify: `frontend/src/app/ui/summary-card.ts`

- [ ] **Step 1: Strings**

Append inside `FIND_MESSAGES` in `find.ts` (before the closing `};`):

```ts
  // results screen after the Claude Design
  'Du suchst': { fr: 'Tu cherches', it: 'Cerchi', en: 'You are looking for' },
  'Deine Suche': { fr: 'Ta recherche', it: 'La tua ricerca', en: 'Your search' },
  'Unterstrichen ist, was wir verstanden haben. Antippen, um es nicht mehr zu verlangen.': {
    fr: 'Ce qui est souligné, nous l’avons compris. Touche pour ne plus l’exiger.',
    it: 'Sottolineato è ciò che abbiamo capito. Tocca per non richiederlo più.',
    en: 'Underlined is what we understood. Tap to stop requiring it.',
  },
  '{count} entfernt. Nochmals antippen, um es wieder zu verlangen.': {
    fr: '{count} retiré(s). Touche à nouveau pour l’exiger de nouveau.',
    it: '{count} rimossi. Tocca di nuovo per richiederlo ancora.',
    en: '{count} removed. Tap again to require it again.',
  },
  '{label} nicht mehr verlangen': {
    fr: 'Ne plus exiger {label}',
    it: 'Non richiedere più {label}',
    en: 'Stop requiring {label}',
  },
  '{label} wieder verlangen': {
    fr: 'Exiger à nouveau {label}',
    it: 'Richiedere di nuovo {label}',
    en: 'Require {label} again',
  },
  'Dazu:': { fr: 'En plus :', it: 'Inoltre:', en: 'Also:' },
  'Anpassen, z.B. „doch etwas neuere Modelle“': {
    fr: 'Ajuster, p. ex. « plutôt des modèles plus récents »',
    it: 'Modifica, p. es. «meglio modelli più recenti»',
    en: 'Adjust, e.g. “rather newer models”',
  },
  'Alle entfernen': { fr: 'Tout retirer', it: 'Rimuovi tutto', en: 'Clear all' },
  Zurücksetzen: { fr: 'Réinitialiser', it: 'Reimposta', en: 'Reset' },
  Übernehmen: { fr: 'Appliquer', it: 'Applica', en: 'Apply' },
  Alle: { fr: 'Toutes', it: 'Tutte', en: 'All' },
  Stichwort: { fr: 'Mot-clé', it: 'Parola chiave', en: 'Keyword' },
  '{attribute} entfernen': {
    fr: 'Retirer {attribute}',
    it: 'Rimuovi {attribute}',
    en: 'Remove {attribute}',
  },
  'ausserhalb deiner Suche': {
    fr: 'hors de ta recherche',
    it: 'fuori dalla tua ricerca',
    en: 'outside your search',
  },
```

- [ ] **Step 2: Card CSS**

In `components.css`, after the `.zw-card__green { ... }` rule insert:

```css
.zw-card__why {
  display: flex;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--ink-muted);
}
.zw-card__why--ok {
  color: var(--green-text);
}
```

- [ ] **Step 3: `ListingCard` inputs**

In `listing-card.ts`, after the `@if (co2Saved() !== null) { ... }` block in the template insert:

```html
    @if (why()) {
      <p class="zw-card__why" [class.zw-card__why--ok]="fit() === 'ok'">
        <span aria-hidden="true">{{ MARKS[fit() ?? 'maybe'] }}</span><span>{{ why() }}</span>
      </p>
    }
```

Above the `@Component` decorator add:

```ts
/** How a search match fits: decides the mark and colour of the card's why line. */
export type CardFit = 'ok' | 'maybe' | 'alt';
const MARKS: Record<CardFit, string> = { ok: '✓', maybe: '?', alt: '↗' };
```

In the class, after `readonly bids = input(0);` add:

```ts
  /** Search results: one line why the listing is shown, in the colour of `fit`. */
  readonly why = input('');
  readonly fit = input<CardFit | null>(null);
  protected readonly MARKS = MARKS;
```

- [ ] **Step 4: `SummaryCard` pass-through**

In `summary-card.ts` change the import to `import { CardFit, ListingCard } from './listing-card';`, add to the template after `[meta]="meta()"`:

```
    [why]="why()"
    [fit]="fit()"
```

and to the class after `readonly listing = input.required<ListingSummary>();`:

```ts
  readonly why = input('');
  readonly fit = input<CardFit | null>(null);
```

- [ ] **Step 5: Lint, format, tests**

Run: `cd frontend && pnpm run format >/dev/null && pnpm exec ng lint 2>&1 | tail -1 && pnpm exec ng test --watch=false 2>&1 | grep -E "Test Files|Tests "`
Expected: "All files pass linting.", all test files passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/i18n/messages/find.ts frontend/src/components.css frontend/src/app/ui/listing-card.ts frontend/src/app/ui/summary-card.ts
git commit -m "Listing card: optional why line for search matches; strings for the results screen"
```

---

### Task 4: `ui/facet.ts` — the dropdown facet

**Files:**
- Create: `frontend/src/app/ui/facet.ts`
- Create: `frontend/src/app/ui/facet.spec.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/app/ui/facet.spec.ts`:

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Facet } from './facet';

@Component({
  imports: [Facet],
  template: `<app-facet label="Preis" [summary]="summary" [(open)]="open" (cleared)="cleared = true">
    <input id="inner" />
  </app-facet>`,
})
class Host {
  summary = 'bis 600';
  open = false;
  cleared = false;
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, el };
}

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('Facet', () => {
  it('shows the label with the summary and opens the panel on click', async () => {
    const { fixture, host, el } = setup();
    const trigger = el.querySelector<HTMLButtonElement>('.facet__trigger')!;
    expect(trigger.textContent).toContain('Preis');
    expect(trigger.textContent).toContain('bis 600');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#inner')).toBeNull();

    trigger.click();
    await fixture.whenStable();

    expect(host.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[role="dialog"][aria-label="Preis"] #inner')).not.toBeNull();
  });

  it('closes on Escape and gives the focus back to the trigger', async () => {
    const { fixture, host, el } = setup();
    const trigger = el.querySelector<HTMLButtonElement>('.facet__trigger')!;
    trigger.click();
    await fixture.whenStable();

    escape();
    await fixture.whenStable();

    expect(host.open).toBe(false);
    expect(el.querySelector('#inner')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Zurücksetzen emits cleared and closes; Übernehmen only closes', async () => {
    const { fixture, host, el } = setup();
    el.querySelector<HTMLButtonElement>('.facet__trigger')!.click();
    await fixture.whenStable();
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.facet__foot button')];

    buttons.find((b) => b.textContent!.includes('Zurücksetzen'))!.click();
    await fixture.whenStable();
    expect(host.cleared).toBe(true);
    expect(host.open).toBe(false);

    host.cleared = false;
    el.querySelector<HTMLButtonElement>('.facet__trigger')!.click();
    await fixture.whenStable();
    [...el.querySelectorAll<HTMLButtonElement>('.facet__foot button')]
      .find((b) => b.textContent!.includes('Übernehmen'))!
      .click();
    await fixture.whenStable();
    expect(host.cleared).toBe(false);
    expect(host.open).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/ui/facet.spec.ts 2>&1 | grep -E "FAIL|Error|Tests " | head -5`
Expected: fails, `./facet` cannot be resolved.

- [ ] **Step 3: The component**

`frontend/src/app/ui/facet.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';
import { Button } from './button';
import { Icon } from './icon';

/**
 * A filter as a dropdown: a trigger with label and summary, the projected panel, a footer with reset and apply.
 * Bind `[(open)]`; the parent keeps one facet open at a time and searches when `open` turns false.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-facet',
  imports: [Button, Icon, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `<button
      #trigger
      type="button"
      class="facet__trigger"
      [class.facet__trigger--on]="summary()"
      [class.facet__trigger--open]="open()"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <span>{{ label() }}</span>
      @if (summary()) {
        <span class="facet__summary">{{ summary() }}</span>
      }
      <app-icon class="facet__chevron" name="chevron" [size]="16" />
    </button>
    @if (open()) {
      <div class="facet__backdrop" (click)="close()"></div>
      <div class="facet__panel" role="dialog" [attr.aria-label]="label()">
        <div class="facet__body"><ng-content /></div>
        <div class="facet__foot">
          <button appButton variant="ghost" size="sm" type="button" (click)="clear()">
            {{ 'Zurücksetzen' | t }}
          </button>
          <button appButton variant="primary" size="sm" type="button" (click)="close()">
            {{ 'Übernehmen' | t }}
          </button>
        </div>
      </div>
    }`,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .facet__trigger {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 8px 0 12px;
      font: 600 14px/20px var(--font-sans);
      white-space: nowrap;
      color: var(--ink);
      background: var(--bg-000);
      border: var(--border-1) solid var(--line-soft);
      border-radius: var(--radius-1);
      cursor: pointer;
    }
    .facet__trigger:hover,
    .facet__trigger--on,
    .facet__trigger--open {
      border-color: var(--line);
    }
    .facet__trigger--open {
      background: var(--bg-100);
    }
    .facet__trigger:focus-visible {
      outline: var(--border-2) solid var(--focus);
      outline-offset: 2px;
    }
    .facet__summary {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      color: var(--ink-muted);
    }
    .facet__chevron {
      transform: rotate(90deg);
      transition: transform 0.12s;
    }
    .facet__trigger--open .facet__chevron {
      transform: rotate(-90deg);
    }
    /* below the trigger row, so the other triggers stay clickable while one panel is open */
    .facet__backdrop {
      position: fixed;
      inset: 0;
      z-index: 0;
    }
    .facet__panel {
      position: absolute;
      left: 0;
      top: calc(100% + 8px);
      z-index: 20;
      width: 300px;
      display: flex;
      flex-direction: column;
      background: var(--bg-000);
      border: var(--border-1) solid var(--line);
      border-radius: var(--radius-1);
      animation: facetFade 0.12s linear both;
    }
    .facet__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      max-height: 320px;
      overflow-y: auto;
    }
    .facet__foot {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .facet__foot > :last-child {
      margin-left: auto;
    }
    @keyframes facetFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (max-width: 639px) {
      /* a bottom sheet on phones */
      .facet__backdrop {
        z-index: 19;
        background: var(--overlay);
      }
      .facet__panel {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        top: auto;
        width: auto;
        max-height: 70vh;
      }
      .facet__body {
        max-height: none;
      }
    }
  `,
})
export class Facet {
  readonly label = input.required<string>();
  /** What is set, shown next to the label; '' when the facet is inactive. */
  readonly summary = input('');
  readonly open = model(false);
  /** "Zurücksetzen": the parent empties this facet; the panel closes afterwards. */
  readonly cleared = output<void>();
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected clear(): void {
    this.cleared.emit();
    this.close();
  }
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/ui/facet.spec.ts 2>&1 | grep -E "FAIL|Tests "`
Expected: `Tests 3 passed (3)`.

- [ ] **Step 5: Format, lint, commit**

Run: `cd frontend && pnpm run format >/dev/null && pnpm exec ng lint 2>&1 | tail -1`
Expected: "All files pass linting."

```bash
git add frontend/src/app/ui/facet.ts frontend/src/app/ui/facet.spec.ts
git commit -m "Facet: dropdown filter with summary, reset and apply"
```

---

### Task 5: `pages/find-sentence.ts` — the heading with tokens

**Files:**
- Create: `frontend/src/app/pages/find-sentence.ts`
- Create: `frontend/src/app/pages/find-sentence.spec.ts`

- [ ] **Step 1: Write the failing tests**

`frontend/src/app/pages/find-sentence.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { FindSentence, place, Token } from './find-sentence';

const TOKENS: Token[] = [
  { key: 'must:Model', kind: 'must', label: 'Model: iMac', phrase: 'iMac' },
  { key: 'must:Year', kind: 'must', label: 'Year: 2017', phrase: '2017' },
  { key: 'nice:RAM', kind: 'nice', label: 'RAM: 16 GB', phrase: null },
  { key: 'budget', kind: 'budget', label: 'Bis CHF 600.–', phrase: 'bis chf 600' },
];
const TEXT = 'Ein iMac 2017 mit 5K, bis CHF 600';

describe('place', () => {
  it('cuts the sentence into plain text and tokens in text order; the rest become chips', () => {
    const { segments, chips } = place(TEXT, TOKENS);
    expect(segments.map((s) => [s.text, s.token?.key])).toEqual([
      ['Ein ', undefined],
      ['iMac', 'must:Model'],
      [' ', undefined],
      ['2017', 'must:Year'],
      [' mit 5K, ', undefined],
      ['bis CHF 600', 'budget'],
    ]);
    expect(chips.map((t) => t.key)).toEqual(['nice:RAM']);
  });

  it('never lets two tokens overlap and keeps the original spelling', () => {
    const tokens: Token[] = [
      { key: 'must:Model', kind: 'must', label: 'Model: iPhone 13', phrase: 'iphone 13' },
      { key: 'must:Storage', kind: 'must', label: 'Storage: 13', phrase: '13' },
    ];
    const { segments, chips } = place('IPHONE 13 mit 13 Monaten Garantie', tokens);
    expect(segments.map((s) => s.text)).toEqual(['IPHONE 13', ' mit ', '13', ' Monaten Garantie']);
    expect(chips).toEqual([]);
  });
});

describe('FindSentence', () => {
  function setup(off: ReadonlySet<string> = new Set()) {
    const fixture = TestBed.createComponent(FindSentence);
    fixture.componentRef.setInput('text', TEXT);
    fixture.componentRef.setInput('tokens', TOKENS);
    fixture.componentRef.setInput('off', off);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders tokens as underlined buttons and the rest as chips', () => {
    const { el } = setup();
    const tokens = [...el.querySelectorAll<HTMLButtonElement>('.token')];
    expect(tokens.map((b) => b.textContent)).toEqual(['iMac', '2017', 'bis CHF 600']);
    expect(tokens[0].getAttribute('aria-pressed')).toBe('true');
    expect(tokens[0].title).toBe('Model: iMac nicht mehr verlangen');
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('RAM: 16 GB');
    expect(el.textContent).toContain('Unterstrichen ist, was wir verstanden haben.');
  });

  it('shows off tokens struck through and counts them in the hint', () => {
    const { el } = setup(new Set(['must:Year']));
    const year = el.querySelectorAll<HTMLButtonElement>('.token')[1];
    expect(year.classList.contains('token--off')).toBe(true);
    expect(year.getAttribute('aria-pressed')).toBe('false');
    expect(year.title).toBe('Year: 2017 wieder verlangen');
    expect(el.textContent).toContain('1 entfernt.');
  });

  it('emits the key of a tapped token or chip', () => {
    const { fixture, el } = setup();
    const keys: string[] = [];
    fixture.componentInstance.toggle.subscribe((key) => keys.push(key));
    el.querySelectorAll<HTMLButtonElement>('.token')[1].click();
    el.querySelector<HTMLButtonElement>('.extra .zw-chip')!.click();
    expect(keys).toEqual(['must:Year', 'nice:RAM']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/find-sentence.spec.ts 2>&1 | grep -E "FAIL|Error|Tests " | head -5`
Expected: fails, `./find-sentence` cannot be resolved.

- [ ] **Step 3: The component**

`frontend/src/app/pages/find-sentence.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

export type TokenKind = 'must' | 'nice' | 'budget' | 'region';

/** A requirement, the budget or the region as the page shows it: `phrase` is where it sits in the sentence. */
export interface Token {
  key: string;
  kind: TokenKind;
  label: string;
  phrase: string | null;
}

export interface Segment {
  text: string;
  token?: Token;
}

/**
 * Places each token's phrase in the sentence: the first case-insensitive hit that overlaps no earlier token.
 * Tokens without a hit are returned as chips.
 */
export function place(text: string, tokens: Token[]): { segments: Segment[]; chips: Token[] } {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; token: Token }[] = [];
  const chips: Token[] = [];
  for (const token of tokens) {
    const phrase = token.phrase?.trim().toLowerCase();
    if (!phrase) {
      chips.push(token);
      continue;
    }
    let start = lower.indexOf(phrase);
    while (start >= 0 && ranges.some((r) => start < r.end && start + phrase.length > r.start)) {
      start = lower.indexOf(phrase, start + 1);
    }
    if (start < 0) chips.push(token);
    else ranges.push({ start, end: start + phrase.length, token });
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) segments.push({ text: text.slice(pos, r.start) });
    segments.push({ text: text.slice(r.start, r.end), token: r.token });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return { segments, chips };
}

/** "Du suchst": the sentence as a heading with tappable tokens; the page owns the off state. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find-sentence',
  imports: [Icon, TranslatePipe],
  template: `<p class="zw-caption">{{ 'Du suchst' | t }}</p>
    <p class="sentence">
      @for (s of placed().segments; track $index) {
        @if (s.token; as tok) {
          <button
            type="button"
            class="token"
            [class.token--nice]="tok.kind === 'nice'"
            [class.token--off]="off().has(tok.key)"
            [attr.aria-pressed]="!off().has(tok.key)"
            [title]="
              (off().has(tok.key) ? '{label} wieder verlangen' : '{label} nicht mehr verlangen')
                | t: { label: tok.label }
            "
            (click)="toggle.emit(tok.key)"
          >
            {{ s.text }}
          </button>
        } @else {
          <span>{{ s.text }}</span>
        }
      }
    </p>
    <p class="zw-help">{{ hint() }}</p>
    @if (placed().chips.length) {
      <div class="extra">
        <span class="zw-help">{{ 'Dazu:' | t }}</span>
        @for (tok of placed().chips; track tok.key) {
          <button
            type="button"
            class="zw-chip"
            [attr.aria-pressed]="!off().has(tok.key)"
            (click)="toggle.emit(tok.key)"
          >
            @if (!off().has(tok.key)) {
              <app-icon name="check" [size]="16" />
            }
            <span>{{ tok.label }}</span>
          </button>
        }
      </div>
    }`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .sentence {
      margin: 0;
      max-width: 960px;
      font-size: 28px;
      line-height: 38px;
      font-weight: 700;
      letter-spacing: -0.015em;
      text-wrap: pretty;
    }
    .token {
      display: inline;
      padding: 0;
      font: inherit;
      letter-spacing: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-thickness: 1.5px;
      text-underline-offset: 6px;
    }
    .token--nice {
      text-decoration-style: dotted;
    }
    .token--off {
      color: var(--ink-muted);
      text-decoration-line: line-through;
    }
    .token:hover {
      color: var(--blue-text);
    }
    .token:focus-visible {
      outline: var(--border-2) solid var(--focus);
      outline-offset: 2px;
    }
    .extra {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .extra .zw-chip {
      max-width: none;
    }
    @media (max-width: 639px) {
      .sentence {
        font-size: 22px;
        line-height: 30px;
      }
    }
  `,
})
export class FindSentence {
  readonly text = input.required<string>();
  readonly tokens = input.required<Token[]>();
  /** Keys of the tokens the buyer tapped off. */
  readonly off = input.required<ReadonlySet<string>>();
  readonly toggle = output<string>();
  private readonly i18n = inject(I18n);
  protected readonly placed = computed(() => place(this.text(), this.tokens()));
  protected readonly hint = computed(() => {
    const count = this.tokens().filter((t) => this.off().has(t.key)).length;
    return count
      ? this.i18n.t('{count} entfernt. Nochmals antippen, um es wieder zu verlangen.', { count })
      : this.i18n.t(
          'Unterstrichen ist, was wir verstanden haben. Antippen, um es nicht mehr zu verlangen.',
        );
  });
}
```

The button's text is `{{ s.text }}` on its own line: Angular trims the surrounding whitespace, the segment text itself keeps its spaces. If the first `place` test shows a token text with stray spaces, put `{{ s.text }}` directly between `>` and `</button>`.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/find-sentence.spec.ts 2>&1 | grep -E "FAIL|Tests "`
Expected: `Tests 5 passed (5)`.

- [ ] **Step 5: Format, lint, commit**

Run: `cd frontend && pnpm run format >/dev/null && pnpm exec ng lint 2>&1 | tail -1`
Expected: "All files pass linting."

```bash
git add frontend/src/app/pages/find-sentence.ts frontend/src/app/pages/find-sentence.spec.ts
git commit -m "Find: the sentence as a heading with tappable tokens"
```

---

### Task 6: The results screen in `find.ts` / `find.html`

Depends on Tasks 2–5. Rewrite the three files completely; the code below is the whole content.

**Files:**
- Rewrite: `frontend/src/app/pages/find.ts`
- Rewrite: `frontend/src/app/pages/find.html`
- Rewrite: `frontend/src/app/pages/find.spec.ts`

- [ ] **Step 1: The tests**

`frontend/src/app/pages/find.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SearchService } from '../api/services';
import { Find } from './find';

const TEXT = 'working iMac 2017, bis CHF 600 in Zürich';
const REQ = {
  mustHave: [
    { attribute: 'Model', value: 'iMac', phrase: 'iMac' },
    { attribute: 'Year', value: '2017', phrase: '2017' },
  ],
  niceToHave: [],
  category: 'Computers',
  keywords: ['imac'],
  maxBudgetChf: 600,
  budgetPhrase: 'bis CHF 600',
  postcode: '8001',
  regionPhrase: 'in Zürich',
  nearMe: false,
};

const IMAC = {
  listing: { id: 7, title: 'iMac 27" 5K', priceChf: 520, condition: 'GOOD', locality: 'Zürich' },
  score: 92,
  fit: 'MATCH',
  reason: 'Passt genau.',
  matched: ['Model: iMac'],
  missingDetails: [],
  differences: [],
};
const OLD = {
  ...IMAC,
  listing: { ...IMAC.listing, id: 8, title: 'iMac 2015' },
  score: 55,
  fit: 'ALTERNATIVE',
  reason: '2015 statt 2017.',
  differences: ['Year: 2015 instead of 2017'],
};

interface Fixture {
  whenStable(): Promise<unknown>;
}

function setup(service: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: SearchService, useValue: service }],
  });
  const fixture = TestBed.createComponent(Find);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

async function type(
  fixture: Fixture,
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function search(fixture: Fixture, el: HTMLElement, text: string) {
  await type(fixture, el.querySelector('textarea')!, text);
  el.querySelector<HTMLButtonElement>('.find__query button[type="submit"]')!.click();
  await fixture.whenStable();
}

function trigger(el: HTMLElement, label: string): HTMLButtonElement {
  return [...el.querySelectorAll<HTMLButtonElement>('.facet__trigger')].find((b) =>
    b.textContent!.includes(label),
  )!;
}

async function escape(fixture: Fixture) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await fixture.whenStable();
}

function geolocation(position: GeolocationPosition | null) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) =>
    position ? ok(position) : fail({ code: 1 } as GeolocationPositionError),
  );
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

describe('Find', () => {
  it('matches without a click: the sentence with tokens, then grouped results with a why line', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC, OLD], compared: 12 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, TEXT);

    expect(create).toHaveBeenCalledWith({ body: { text: TEXT } });
    expect(matches).toHaveBeenCalledTimes(1);
    const body = matches.mock.calls[0][0].body;
    expect(body.mustHave).toEqual(REQ.mustHave);
    expect(body.keywords).toEqual(['imac']);
    expect(body.conditions).toEqual([]);
    expect(body.latitude).toBeNull();

    expect(el.querySelector('textarea')).toBeNull();
    const tokens = [...el.querySelectorAll<HTMLButtonElement>('.token')].map((b) => b.textContent);
    expect(tokens).toEqual(['iMac', '2017', 'bis CHF 600', 'in Zürich']);

    const headings = [...el.querySelectorAll('.find__grp h2')].map((h) => h.textContent);
    expect(headings[0]).toContain('Passt');
    expect(headings[0]).toContain('1 · alles belegt');
    expect(headings[1]).toContain('Alternativen');
    expect(headings[1]).toContain('1 · ausserhalb deiner Suche');
    expect(el.textContent).not.toContain('Möglich');
    expect(el.querySelector('.zw-card__why--ok')!.textContent).toContain('Passt genau.');
    expect(el.textContent).toContain('Year: 2015 instead of 2017');
    expect(el.textContent).not.toContain('92 %');
    expect(el.textContent).toContain('2 Inserate');
    expect(el.textContent).toContain('12 verglichen');
  });

  it('tapping a token leaves it out of the next search; tapping again brings it back', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);
    const year = el.querySelector<HTMLButtonElement>('.token[title="Year: 2017 nicht mehr verlangen"]')!;

    year.click();
    await fixture.whenStable();
    expect(matches.mock.calls[1][0].body.mustHave).toEqual([REQ.mustHave[0]]);
    expect(year.classList.contains('token--off')).toBe(true);
    expect(el.textContent).toContain('1 entfernt.');
    expect(el.textContent).toContain('Noch nichts Passendes.');

    el.querySelector<HTMLButtonElement>('.token[title="Year: 2017 wieder verlangen"]')!.click();
    await fixture.whenStable();
    expect(matches.mock.calls[2][0].body.mustHave).toEqual(REQ.mustHave);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a requirement without a phrase is a chip below the sentence', async () => {
    const create = vi
      .fn()
      .mockReturnValue(of({ ...REQ, mustHave: [REQ.mustHave[0], { attribute: 'Year', value: '2017' }] }));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, TEXT);

    expect([...el.querySelectorAll('.token')].map((b) => b.textContent)).toEqual([
      'iMac',
      'bis CHF 600',
      'in Zürich',
    ]);
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('Year: 2017');
  });

  it('a facet change searches once when the panel closes, not before and not without a change', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    trigger(el, 'Preis').click();
    await fixture.whenStable();
    await type(fixture, el.querySelector<HTMLInputElement>('#find-budget')!, '500');
    expect(matches).toHaveBeenCalledTimes(1);

    await escape(fixture);
    expect(matches).toHaveBeenCalledTimes(2);
    expect(matches.mock.calls[1][0].body.maxBudgetChf).toBe(500);
    expect(trigger(el, 'Preis').textContent).toContain('bis 500');
    expect(el.querySelector('.token[title="Bis CHF 500.– nicht mehr verlangen"]')).not.toBeNull();

    trigger(el, 'Preis').click();
    await fixture.whenStable();
    await escape(fixture);
    expect(matches).toHaveBeenCalledTimes(2);
  });

  it('the condition facet sends conditions and shows what is set', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    trigger(el, 'Zustand').click();
    await fixture.whenStable();
    const boxes = [...el.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')];
    boxes[2].click(); // Gut
    boxes[3].click(); // Gebraucht
    await fixture.whenStable();
    await escape(fixture);

    expect(matches).toHaveBeenCalledTimes(2);
    expect(matches.mock.calls[1][0].body.conditions).toEqual(['GOOD', 'USED']);
    expect(trigger(el, 'Zustand').textContent).toContain('2');
    expect(el.textContent).toContain('Alle entfernen');
  });

  it('refines with the original prompt, history and top ids; a new prompt clears the history', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 12 }));
    const newer = {
      ...REQ,
      mustHave: [{ attribute: 'Year', value: '2019', comparison: 'AT_LEAST' }],
    };
    const refine = vi.fn().mockReturnValue(of(newer));
    const { fixture, el } = setup({ create, matches, refine });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    await type(
      fixture,
      el.querySelector<HTMLInputElement>('#find-adjust')!,
      'doch etwas neuere Modelle',
    );
    el.querySelector<HTMLButtonElement>('.find__adjust button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(refine).toHaveBeenCalledWith({
      body: {
        originalText: TEXT,
        refinements: [],
        current: expect.objectContaining({ category: 'Computers', mustHave: REQ.mustHave }),
        text: 'doch etwas neuere Modelle',
        topListingIds: [7],
      },
    });
    expect(matches.mock.calls[1][0].body.mustHave).toEqual(newer.mustHave);
    expect(el.textContent).toContain('↳ doch etwas neuere Modelle');
    // no phrase in the sentence: shown as a chip
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('Year: ≥ 2019');

    await TestBed.inject(Router).navigate([], { queryParams: { q: 'Bürostuhl' } });
    await fixture.whenStable();
    expect(create).toHaveBeenLastCalledWith({ body: { text: 'Bürostuhl' } });
    expect(el.textContent).not.toContain('↳ doch etwas neuere Modelle');
  });

  it('ignores a late answer to an older request', async () => {
    const first = new Subject();
    const second = new Subject();
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);
    el.querySelector<HTMLButtonElement>('.token[title="Year: 2017 nicht mehr verlangen"]')!.click();
    await fixture.whenStable();

    second.next({ matches: [IMAC], compared: 3 });
    first.next({
      matches: [{ ...IMAC, listing: { ...IMAC.listing, id: 8, title: 'Alte Antwort' } }],
      compared: 9,
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('3 verglichen');
    expect(el.textContent).not.toContain('Alte Antwort');
  });

  it('shows a skeleton while the listings are compared', async () => {
    const pending = new Subject();
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(pending);
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    expect(el.querySelector('.find__skeleton')).not.toBeNull();
    expect(el.querySelector('.find__grp')).toBeNull();

    pending.next({ matches: [IMAC], compared: 1 });
    await fixture.whenStable();
    expect(el.querySelector('.find__skeleton')).toBeNull();
    expect(el.querySelector('.find__grp')).not.toBeNull();
  });

  it('near me asks for the position and searches around it', async () => {
    const asked = geolocation({
      coords: { latitude: 47.37812, longitude: 8.52345 },
    } as GeolocationPosition);
    const create = vi.fn().mockReturnValue(
      of({ ...REQ, postcode: undefined, regionPhrase: 'in meiner Nähe', maxDistanceKm: 25, nearMe: true }),
    );
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 4 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, 'iMac in meiner Nähe');

    expect(asked).toHaveBeenCalledTimes(1);
    const body = matches.mock.calls[0][0].body;
    expect(body).toMatchObject({
      latitude: 47.378,
      longitude: 8.523,
      maxDistanceKm: 25,
      nearMe: true,
    });
    expect(body.postcode).toBeUndefined();
    expect(trigger(el, 'Region').textContent).toContain('25 km um deinen Standort');
    expect(el.querySelector('.token[title="25 km um deinen Standort nicht mehr verlangen"]')!.textContent).toBe(
      'in meiner Nähe',
    );
  });

  it('without a position it says so and searches Swiss-wide', async () => {
    geolocation(null);
    const create = vi.fn().mockReturnValue(of({ ...REQ, maxDistanceKm: 25, nearMe: true }));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, 'iMac in meiner Nähe');

    const body = matches.mock.calls[0][0].body;
    expect(body.latitude).toBeNull();
    expect(body.maxDistanceKm).toBeUndefined();
    expect(el.textContent).toContain('Standort nicht verfügbar.');
  });

  it('restores the filters, phrases and conditions from the URL without asking the assistant again', async () => {
    const create = vi.fn();
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SearchService, useValue: { create, matches } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'iMac bis 600 in Chur',
                kw: 'imac',
                max: '600',
                maxp: 'bis 600',
                plz: '7000',
                plzp: 'in Chur',
                km: '25',
                cond: 'GOOD,USED',
              }),
            ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Find);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(create).not.toHaveBeenCalled();
    expect(matches).toHaveBeenCalledTimes(1);
    expect(matches.mock.calls[0][0].body).toMatchObject({
      keywords: ['imac'],
      maxBudgetChf: 600,
      budgetPhrase: 'bis 600',
      postcode: '7000',
      regionPhrase: 'in Chur',
      maxDistanceKm: 25,
      conditions: ['GOOD', 'USED'],
    });
    expect([...el.querySelectorAll('.token')].map((b) => b.textContent)).toEqual(['bis 600', 'in Chur']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/find.spec.ts 2>&1 | grep -E "✓|×|FAIL|Tests " | head -20`
Expected: most tests fail (old markup).

- [ ] **Step 3: `find.ts`**

Whole file:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ListingsService, SearchService } from '../api/services';
import {
  ListingSummary,
  Requirement,
  SearchMatch,
  SearchRequirements,
  SearchResults,
} from '../api/models';
import { CATEGORIES } from '../categories';
import { Condition, CONDITION_LABELS } from '../conditions';
import { Position, SessionLocation } from '../device-location';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { chf } from '../ui/chf';
import { Facet } from '../ui/facet';
import { Icon } from '../ui/icon';
import { SummaryCard } from '../ui/summary-card';
import { FindSentence, Token } from './find-sentence';

const FILTER_KEYS = ['kw', 'cat', 'max', 'plz', 'km', 'must', 'nice', 'cond'];

/** True when the URL already holds exactly the filters the form shows (our own navigation). */
function sameQuery(params: ParamMap, query: Record<string, string | null>): boolean {
  return Object.entries(query).every(([k, v]) => params.get(k) === v);
}

type Row = 'mustHave' | 'niceToHave';

/** The three result groups, in page order; `mark` is the card's why-line style. */
const GROUPS = [
  { fit: 'MATCH', title: 'Passt', sub: 'alles belegt', mark: 'ok' },
  { fit: 'NEEDS_DETAILS', title: 'Möglich', sub: 'Angaben fehlen', mark: 'maybe' },
  { fit: 'ALTERNATIVE', title: 'Alternativen', sub: 'ausserhalb deiner Suche', mark: 'alt' },
] as const;
const NEAR_ME_KM = 25;
const NO_POSITION = 'Standort nicht verfügbar. Gib eine PLZ ein oder erlaube den Standortzugriff.';

/** Search: free text → the sentence with tokens + facets → results in three groups, refinable by text and position. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find',
  imports: [FormsModule, Button, Facet, FindSentence, Icon, SummaryCard, TranslatePipe],
  templateUrl: './find.html',
  styles: `
    .find__query {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .find__query textarea {
      flex: 1 1 auto;
      min-width: 0;
      padding-top: var(--space-2);
      padding-bottom: var(--space-2);
      resize: vertical;
    }
    .find__head {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-bottom: var(--space-6);
    }
    .find__history {
      list-style: none;
      padding: 0;
      margin: 0;
      font-weight: 500;
    }
    .find__adjust {
      display: flex;
      gap: var(--space-2);
      max-width: 40rem;
    }
    .find__adjust input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .find__bar {
      position: sticky;
      top: 72px;
      z-index: 6;
      background: var(--bg-000);
      border-top: var(--border-1) solid var(--line-soft);
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    @media (max-width: 720px) {
      /* the header is static on phones */
      .find__bar {
        top: 0;
      }
    }
    .find__bar-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-height: 32px;
      padding-top: var(--space-3);
    }
    .find__clear {
      margin-left: auto;
    }
    .find__facets {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-2) 0 var(--space-3);
    }
    .find__opt {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 44px;
      font-size: 16px;
      line-height: 24px;
      cursor: pointer;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .find__opt:last-child {
      border-bottom: 0;
    }
    .find__opt > input {
      flex: none;
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--blue);
    }
    .find__opt-text {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      line-height: 20px;
    }
    .find__opt-head {
      padding-top: var(--space-2);
    }
    .find__radii {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .find__count {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      min-height: 56px;
      padding: var(--space-2) 0;
      border-top: var(--border-1) solid var(--line-soft);
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .find__count .zw-help {
      font-weight: 400;
    }
    .find__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-8) var(--space-4);
    }
    .find__skeleton {
      padding-top: var(--space-6);
    }
    .find__bone {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .find__bone-media {
      aspect-ratio: 1 / 1;
      background: var(--bg-100);
    }
    .find__bone-line {
      height: 20px;
      background: var(--bg-100);
    }
    .find__bone-line--70 {
      width: 70%;
    }
    .find__bone-line--40 {
      width: 40%;
    }
    .find__grp {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding-top: var(--space-6);
      animation: findFade 0.2s ease-out both;
    }
    .find__grp h2 {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }
    .find__grp h2 span {
      font-size: 16px;
      line-height: 24px;
      font-weight: 400;
      color: var(--ink-muted);
    }
    .find__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .find__foot {
      padding-top: var(--space-8);
    }
    @keyframes findFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
})
export class Find {
  private readonly search = inject(SearchService);
  private readonly listings = inject(ListingsService);
  private readonly i18n = inject(I18n);

  protected readonly rows = [
    { key: 'mustHave', label: 'Muss', other: 'Wäre schön' },
    { key: 'niceToHave', label: 'Wäre schön', other: 'Muss' },
  ] as const;
  protected readonly radii = [5, 10, 25, 50, 100];
  protected readonly categories = CATEGORIES;
  protected readonly conditionOptions = Object.keys(CONDITION_LABELS) as Condition[];
  protected readonly conditionLabels = CONDITION_LABELS;
  protected readonly skeleton = [1, 2, 3, 4];

  protected readonly text = signal('');
  protected readonly adjust = signal('');
  protected readonly refinements = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly mustHave = signal<Requirement[]>([]);
  protected readonly niceToHave = signal<Requirement[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly budget = signal<number | null>(null);
  protected readonly budgetPhrase = signal<string | null>(null);
  protected readonly postcode = signal('');
  protected readonly regionPhrase = signal<string | null>(null);
  protected readonly radius = signal<number | null>(null);
  protected readonly keywords = signal('');
  protected readonly conditions = signal<Condition[]>([]);
  /** The buyer's position, rounded to ~100 m; kept in memory only, never in the URL or storage. */
  protected readonly position = signal<Position | null>(null);
  /** Keys of the tokens the buyer tapped off; their values stay, so a second tap restores them. */
  protected readonly off = signal<ReadonlySet<string>>(new Set());
  protected readonly openFacet = signal<string | null>(null);
  protected readonly matching = signal(false);
  protected readonly results = signal<SearchResults | null>(null);
  // shortcut: matches are filtered to auctions in the browser; move into SearchRequirements if lists get long
  protected readonly auctionsOnly = signal(false);
  /** All running auctions, shown on /find?mode=auction before a search. */
  protected readonly auctions = signal<ListingSummary[] | null>(null);
  protected readonly shown = computed(() => {
    const res = this.results();
    if (!res || !this.auctionsOnly()) return res;
    const auction = (m: SearchMatch) => m.listing?.saleMode === 'AUCTION';
    return { ...res, matches: (res.matches ?? []).filter(auction) };
  });
  protected readonly groups = computed(() => {
    const found = this.shown()?.matches ?? [];
    return GROUPS.map((g) => ({ ...g, items: found.filter((m) => m.fit === g.fit) })).filter(
      (g) => g.items.length,
    );
  });
  protected readonly busy = computed(() => this.loading() || this.matching());
  protected readonly progress = signal('');
  /** The status line: what runs right now, else the count. */
  protected readonly countText = computed(
    () =>
      this.progress() ||
      this.i18n.t('{count} Inserate', { count: this.shown()?.matches?.length ?? 0 }),
  );
  /** The sentence's tokens: requirements, budget and region, with where they sit in the sentence. */
  protected readonly tokens = computed<Token[]>(() => {
    const tokens: Token[] = [
      ...this.mustHave().map((r) => ({
        key: 'must:' + r.attribute,
        kind: 'must' as const,
        label: this.label(r),
        phrase: r.phrase ?? null,
      })),
      ...this.niceToHave().map((r) => ({
        key: 'nice:' + r.attribute,
        kind: 'nice' as const,
        label: this.label(r),
        phrase: r.phrase ?? null,
      })),
    ];
    if (this.budget() !== null) {
      tokens.push({
        key: 'budget',
        kind: 'budget',
        label: this.budgetLabel(),
        phrase: this.budgetPhrase(),
      });
    }
    if (this.postcode().trim() || this.position()) {
      tokens.push({
        key: 'region',
        kind: 'region',
        label: this.regionLabel(),
        phrase: this.regionPhrase(),
      });
    }
    return tokens;
  });
  /** What each facet trigger shows next to its label; '' = inactive. */
  protected readonly summaries = computed(() => {
    const on = (key: string) => !this.off().has(key);
    const count = (n: number) => (n ? String(n) : '');
    const conditions = this.conditions();
    const requirements =
      this.mustHave().filter((r) => on('must:' + r.attribute)).length +
      this.niceToHave().filter((r) => on('nice:' + r.attribute)).length;
    return {
      category: this.category() ? this.i18n.t(this.category()!) : '',
      price: on('budget') && this.budget() !== null ? `${this.i18n.t('bis')} ${this.budget()}` : '',
      conditions:
        conditions.length === 1
          ? this.i18n.t(CONDITION_LABELS[conditions[0]])
          : count(conditions.length),
      region:
        on('region') && (this.postcode().trim() || this.position()) ? this.regionLabel() : '',
      auction: this.auctionsOnly() ? this.i18n.t('Auktion') : '',
      requirements: count(requirements),
      keywords: count(this.keywordList().length),
    };
  });
  protected readonly hasActive = computed(() => {
    const s = this.summaries();
    return !!(s.category || s.price || s.conditions || s.region || s.auction || s.keywords);
  });
  private readonly router = inject(Router);
  private readonly location = inject(SessionLocation);
  /** The text the filters were read from; it stays in the URL next to the filters. */
  protected readonly asked = signal('');
  /** The filters as URL query params (null = not in the URL); the position and off tokens never go in. */
  private readonly query = computed(() => {
    const on = (key: string) => !this.off().has(key);
    const pc = on('region') ? this.postcode().trim() : '';
    const budget = on('budget') ? this.budget() : null;
    const json = (list: Requirement[]) => (list.length ? JSON.stringify(list) : null);
    return {
      q: this.asked() || null,
      kw: this.keywords().trim() || null,
      cat: this.category()?.trim() || null,
      max: budget === null ? null : String(budget),
      maxp: budget === null ? null : this.budgetPhrase(),
      plz: pc || null,
      plzp: pc ? this.regionPhrase() : null,
      km: pc && this.radius() ? String(this.radius()) : null,
      must: json(this.mustHave().filter((r) => on('must:' + r.attribute))),
      nice: json(this.niceToHave().filter((r) => on('nice:' + r.attribute))),
      cond: this.conditions().length ? this.conditions().join(',') : null,
      mode: this.auctionsOnly() ? 'auction' : null,
    };
  });
  private original = '';
  private nearMe = false;
  /** A facet changed something since it opened: search when it closes. */
  private dirty = false;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The header's location chip applies to a shown search that has no postcode of its own.
    effect(() => {
      const here = this.location.position();
      untracked(() => {
        if (!this.searched() || this.postcode().trim()) return;
        if (here && !this.position()) void this.useMyPosition();
        else if (!here && this.position()) this.clearRegion();
      });
    });

    // Keep the filters in the URL so a reload or a shared link shows the same search.
    effect(() => {
      const queryParams = this.query();
      if (!this.searched()) return;
      untracked(() =>
        this.router.navigate([this.router.url.split('?')[0]], { queryParams, replaceUrl: true }),
      );
    });

    // The header and the landing page search by navigating to /find?q=…; a URL with filters restores them.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        if (params.get('mode') === 'auction' && !this.auctionsOnly()) {
          this.auctionsOnly.set(true);
          this.listings.list({ saleMode: 'AUCTION' }).subscribe((list) => this.auctions.set(list));
        }
        if (FILTER_KEYS.some((k) => params.has(k))) {
          if (!this.searched() || !sameQuery(params, this.query())) this.restore(params);
          return;
        }
        const q = params.get('q')?.trim();
        if (!q || (this.searched() && sameQuery(params, this.query()))) return;
        this.text.set(q);
        this.find();
      });
  }

  /** A link with filters shows that search directly, without asking the assistant again. */
  private restore(params: ParamMap): void {
    const list = (key: string): Requirement[] => {
      try {
        return JSON.parse(params.get(key) ?? '[]');
      } catch {
        return [];
      }
    };
    const max = params.get('max');
    const km = params.get('km');
    this.text.set(params.get('q') ?? '');
    this.asked.set(params.get('q') ?? '');
    this.original = params.get('q') ?? '';
    this.searched.set(true);
    this.conditions.set(
      (params.get('cond') ?? '')
        .split(',')
        .filter((c): c is Condition => c in CONDITION_LABELS),
    );
    this.apply({
      mustHave: list('must'),
      niceToHave: list('nice'),
      category: params.get('cat'),
      keywords: (params.get('kw') ?? '').split(',').filter((k) => k.trim()),
      maxBudgetChf: max === null ? undefined : Number(max),
      budgetPhrase: params.get('maxp'),
      postcode: params.get('plz') ?? undefined,
      regionPhrase: params.get('plzp'),
      maxDistanceKm: km === null ? undefined : Number(km),
    });
    this.afterParse({ postcode: params.get('plz') ?? undefined });
  }

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    const text = this.text();
    this.loading.set(true);
    this.status(this.i18n.t('Lese deinen Wunsch…'), this.i18n.t('Mache Anforderungen daraus…'));
    this.search.create({ body: { text } }).subscribe({
      next: (req) => {
        this.original = text;
        this.asked.set(text.trim());
        this.refinements.set([]);
        this.conditions.set([]);
        this.apply(req);
        this.results.set(null);
        this.searched.set(true);
        this.loading.set(false);
        this.afterParse(req);
      },
      error: () => this.failed(),
    });
  }

  /** "Suche anpassen": the AI changes the requirements, knowing the original wish and what is shown. */
  protected refine(): void {
    const text = this.adjust().trim();
    if (this.loading() || !text) return;
    this.loading.set(true);
    this.status(this.i18n.t('Passe deine Suche an…'));
    const topListingIds = (this.results()?.matches ?? [])
      .slice(0, 5)
      .map((m) => m.listing?.id)
      .filter((id): id is number => id != null);
    const body = {
      originalText: this.original,
      refinements: this.refinements().slice(-5),
      current: this.requirements(),
      text,
      topListingIds,
    };
    this.search.refine({ body }).subscribe({
      next: (req) => {
        this.refinements.update((list) => [...list, text]);
        this.adjust.set('');
        this.apply(req);
        this.loading.set(false);
        this.afterParse(req);
      },
      error: () => this.failed(),
    });
  }

  /** Sets what the assistant (or the URL) says; conditions are the buyer's own filter and stay as they are. */
  private apply(req: SearchRequirements): void {
    this.mustHave.set(req.mustHave);
    this.niceToHave.set(req.niceToHave);
    this.category.set(req.category ?? null);
    this.budget.set(req.maxBudgetChf ?? null);
    this.budgetPhrase.set(req.budgetPhrase ?? null);
    this.postcode.set(req.postcode ?? '');
    this.regionPhrase.set(req.regionPhrase ?? null);
    this.radius.set(req.maxDistanceKm ?? null);
    this.keywords.set(req.keywords.join(', '));
    this.nearMe = !!req.nearMe;
    this.off.set(new Set());
  }

  /** Searches around the position if asked for, or if the user shared it this session and gave no postcode. */
  private afterParse(req: Pick<SearchRequirements, 'nearMe' | 'postcode'>): void {
    if (req.nearMe || (!req.postcode && this.location.position())) void this.useMyPosition();
    else this.showMatches();
  }

  /** A token tap: off ↔ on, then search at once. */
  protected toggleToken(key: string): void {
    this.off.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    this.showMatches();
  }

  private turnOn(key: string): void {
    if (!this.off().has(key)) return;
    this.off.update((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  /** One facet open at a time; a facet that changed something searches when it closes. */
  protected setOpen(key: string, open: boolean): void {
    if (!open && this.openFacet() !== key) return;
    this.openFacet.set(open ? key : null);
    if (!this.dirty) return;
    this.dirty = false;
    this.showMatches();
  }

  protected setCategory(value: string): void {
    this.category.set(value || null);
    this.dirty = true;
  }

  protected setBudget(value: string): void {
    const n = Number(value);
    this.budget.set(value.trim() && Number.isFinite(n) ? n : null);
    this.turnOn('budget');
    this.dirty = true;
  }

  protected toggleCondition(condition: Condition, checked: boolean): void {
    this.conditions.update((list) =>
      checked ? [...list, condition] : list.filter((c) => c !== condition),
    );
    this.dirty = true;
  }

  protected clearConditions(): void {
    this.conditions.set([]);
    this.dirty = true;
  }

  protected setPostcode(value: string): void {
    this.postcode.set(value);
    this.position.set(null);
    this.nearMe = false;
    this.turnOn('region');
    this.dirty = true;
  }

  protected setRadius(km: number | null): void {
    this.radius.set(km);
    this.turnOn('region');
    this.dirty = true;
  }

  protected setKeywords(value: string): void {
    this.keywords.set(value);
    this.dirty = true;
  }

  protected clearRequirements(): void {
    this.mustHave.set([]);
    this.niceToHave.set([]);
    this.dirty = true;
  }

  /** "Alle entfernen": the six filter facets go; the requirements from the sentence stay. */
  protected clearFilters(): void {
    this.category.set(null);
    this.conditions.set([]);
    this.auctionsOnly.set(false);
    this.keywords.set('');
    this.off.update((set) => new Set([...set, 'budget', 'region']));
    this.dirty = false;
    this.showMatches();
  }

  move(r: Requirement, from: Row): void {
    const to: Row = from === 'mustHave' ? 'niceToHave' : 'mustHave';
    this[from].update((list) => list.filter((x) => x !== r));
    this[to].update((list) => [...list, r]);
    this.dirty = true;
  }

  remove(r: Requirement, from: Row): void {
    this[from].update((list) => list.filter((x) => x !== r));
    this.dirty = true;
  }

  protected clearRegion(): void {
    this.postcode.set('');
    this.radius.set(null);
    this.position.set(null);
    this.nearMe = false;
    this.showMatches();
  }

  /** "Mein Standort": asks the browser once per session, then searches around the position instead of a postcode. */
  protected async useMyPosition(): Promise<void> {
    const position = await this.location.locate();
    if (!position) {
      this.position.set(null);
      this.radius.set(null);
      this.nearMe = false;
      return this.showMatches(this.i18n.t(NO_POSITION));
    }
    this.position.set(position);
    this.postcode.set('');
    if (this.radius() === null) this.radius.set(NEAR_ME_KM);
    this.nearMe = true;
    this.turnOn('region');
    this.showMatches();
  }

  showMatches(message = ''): void {
    const id = ++this.seq;
    this.matching.set(true);
    this.status(
      this.i18n.t('Durchsuche die Inserate…'),
      this.i18n.t('Vergleiche die Inserate mit deinen Anforderungen…'),
    );
    this.search.matches({ body: this.requirements() }).subscribe({
      next: (res) => {
        // a slower answer to an older request must not overwrite a newer one
        if (id !== this.seq) return;
        this.results.set(res);
        this.matching.set(false);
        this.status(message);
      },
      error: () => {
        if (id !== this.seq) return;
        this.matching.set(false);
        this.status(message);
      },
    });
  }

  private keywordList(): string[] {
    return this.keywords()
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k);
  }

  /** The effective requirements: off tokens are left out, their values stay for a second tap. */
  private requirements(): SearchRequirements {
    const on = (key: string) => !this.off().has(key);
    const position = on('region') ? this.position() : null;
    const budget = on('budget') ? this.budget() : null;
    return {
      mustHave: this.mustHave().filter((r) => on('must:' + r.attribute)),
      niceToHave: this.niceToHave().filter((r) => on('nice:' + r.attribute)),
      category: this.category()?.trim() || null,
      keywords: this.keywordList(),
      maxBudgetChf: budget ?? undefined,
      postcode: (on('region') && this.postcode().trim()) || undefined,
      maxDistanceKm: on('region') ? (this.radius() ?? undefined) : undefined,
      nearMe: on('region') && this.nearMe,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      conditions: this.conditions(),
      budgetPhrase: this.budgetPhrase(),
      regionPhrase: this.regionPhrase(),
    };
  }

  private failed(): void {
    this.loading.set(false);
    this.status('');
  }

  /** Shows `first`, and `second` after 1.5 s if the call is still running. */
  private status(first: string, second?: string): void {
    clearTimeout(this.timer);
    this.progress.set(first);
    if (second) this.timer = setTimeout(() => this.progress.set(second), 1500);
  }

  protected list(row: Row): Requirement[] {
    return this[row]();
  }

  protected label(r: Requirement): string {
    const prefix = r.comparison === 'AT_LEAST' ? '≥ ' : r.comparison === 'AT_MOST' ? '≤ ' : '';
    return `${r.attribute}: ${prefix}${r.value}`;
  }

  protected budgetLabel(): string {
    return this.i18n.t('Bis {price}', { price: chf(this.budget() ?? 0) });
  }

  protected regionLabel(): string {
    if (this.position())
      return this.i18n.t('{km} km um deinen Standort', { km: this.radius() ?? NEAR_ME_KM });
    const pc = this.postcode().trim();
    return this.radius() ? this.i18n.t('{km} km um {pc}', { km: this.radius()!, pc }) : pc;
  }

  protected details(m: SearchMatch): string[] {
    return [
      ...(m.missingDetails?.length
        ? [this.i18n.t('Nicht angegeben: {details}', { details: m.missingDetails.join(', ') })]
        : []),
      ...(m.differences ?? []),
    ];
  }
}
```

- [ ] **Step 4: `find.html`**

Whole file:

```html
@if (!searched()) {
  <form class="find__query" role="search" (ngSubmit)="find()">
    <label for="find-text" class="zw-sr-only">{{ 'Was suchst du?' | t }}</label>
    <textarea
      id="find-text"
      name="text"
      class="zw-input"
      [(ngModel)]="text"
      (keydown.control.enter)="find()"
      (keydown.meta.enter)="find()"
      required
      maxlength="500"
      rows="2"
      [placeholder]="'z.B. iMac 2017 mit 5K, bis CHF 600, Abholung in Zürich' | t"
      aria-describedby="find-tip"
    ></textarea>
    <button appButton type="submit" [disabled]="loading() || !text().trim()">
      <app-icon name="search" />
      <span>{{ (loading() ? 'Suche läuft…' : 'Suchen') | t }}</span>
    </button>
  </form>
  <p id="find-tip" class="zw-help">{{ 'Schreib es in deinen Worten. Tipp: ⌘ / Ctrl + Enter' | t }}</p>
  <p role="status" aria-live="polite" class="zw-help">{{ progress() }}</p>

  @if (auctions(); as list) {
    <section class="find__grp" aria-labelledby="find-auctions">
      <h2 id="find-auctions">{{ 'Alle Auktionen' | t }}</h2>
      @if (list.length) {
        <div class="zw-grid">
          @for (auction of list; track auction.id) {
            <app-summary-card [listing]="auction" />
          }
        </div>
      } @else {
        <p class="zw-muted">{{ 'Gerade läuft keine Auktion.' | t }}</p>
      }
    </section>
  }
} @else {
  <section class="find__head" [attr.aria-label]="'Deine Suche' | t">
    <app-find-sentence
      [text]="asked()"
      [tokens]="tokens()"
      [off]="off()"
      (toggle)="toggleToken($event)"
    />
    @if (refinements().length) {
      <ul class="find__history" [attr.aria-label]="'Deine Anpassungen' | t">
        @for (r of refinements(); track $index) {
          <li>↳ {{ r }}</li>
        }
      </ul>
    }
    <form
      class="find__adjust"
      role="search"
      [attr.aria-label]="'Suche anpassen' | t"
      (ngSubmit)="refine()"
    >
      <label for="find-adjust" class="zw-sr-only">{{ 'Suche anpassen' | t }}</label>
      <input
        id="find-adjust"
        name="adjust"
        class="zw-input"
        maxlength="200"
        [placeholder]="'Anpassen, z.B. „doch etwas neuere Modelle“' | t"
        [(ngModel)]="adjust"
      />
      <button appButton type="submit" [disabled]="loading() || !adjust().trim()">
        {{ 'Anpassen' | t }}
      </button>
    </form>
  </section>

  <div class="find__bar">
    <div class="find__bar-row">
      <span class="zw-caption">{{ 'Filter' | t }}</span>
      @if (hasActive()) {
        <button
          appButton
          variant="ghost"
          size="sm"
          type="button"
          class="find__clear"
          (click)="clearFilters()"
        >
          {{ 'Alle entfernen' | t }}
        </button>
      }
    </div>
    <div class="find__facets">
      <app-facet
        [label]="'Kategorie' | t"
        [summary]="summaries().category"
        [open]="openFacet() === 'category'"
        (openChange)="setOpen('category', $event)"
        (cleared)="setCategory('')"
      >
        <label class="find__opt">
          <input type="radio" name="category" value="" [checked]="!category()" (change)="setCategory('')" />
          <span>{{ 'Alle' | t }}</span>
        </label>
        @for (c of categories; track c) {
          <label class="find__opt">
            <input
              type="radio"
              name="category"
              [value]="c"
              [checked]="category() === c"
              (change)="setCategory(c)"
            />
            <span>{{ c | t }}</span>
          </label>
        }
      </app-facet>
      <app-facet
        [label]="'Preis' | t"
        [summary]="summaries().price"
        [open]="openFacet() === 'price'"
        (openChange)="setOpen('price', $event)"
        (cleared)="setBudget('')"
      >
        <label class="zw-label" for="find-budget">{{ 'Preis bis' | t }}</label>
        <input
          #budgetInput
          id="find-budget"
          class="zw-input zw-input--price"
          type="number"
          min="0"
          inputmode="decimal"
          [placeholder]="'bis' | t"
          [value]="off().has('budget') ? '' : (budget() ?? '')"
          (input)="setBudget(budgetInput.value)"
        />
      </app-facet>
      <app-facet
        [label]="'Zustand' | t"
        [summary]="summaries().conditions"
        [open]="openFacet() === 'condition'"
        (openChange)="setOpen('condition', $event)"
        (cleared)="clearConditions()"
      >
        @for (c of conditionOptions; track c) {
          <label class="find__opt">
            <input
              #cond
              type="checkbox"
              [checked]="conditions().includes(c)"
              (change)="toggleCondition(c, cond.checked)"
            />
            <span>{{ conditionLabels[c] | t }}</span>
          </label>
        }
      </app-facet>
      <app-facet
        [label]="'Region' | t"
        [summary]="summaries().region"
        [open]="openFacet() === 'region'"
        (openChange)="setOpen('region', $event)"
        (cleared)="clearRegion()"
      >
        <label class="zw-label" for="find-postcode">{{ 'PLZ' | t }}</label>
        <input
          #pcInput
          id="find-postcode"
          class="zw-input"
          inputmode="numeric"
          maxlength="4"
          [value]="off().has('region') ? '' : postcode()"
          (input)="setPostcode(pcInput.value)"
        />
        <div class="find__radii" role="group" [attr.aria-label]="'Umkreis' | t">
          @for (km of radii; track km) {
            <button
              type="button"
              class="zw-chip"
              [attr.aria-pressed]="radius() === km"
              (click)="setRadius(km)"
            >
              {{ km }} km
            </button>
          }
          <button
            type="button"
            class="zw-chip"
            [attr.aria-pressed]="radius() === null"
            (click)="setRadius(null)"
          >
            {{ 'Ganze Schweiz' | t }}
          </button>
        </div>
        <button appButton variant="ghost" size="sm" type="button" (click)="useMyPosition()">
          <app-icon name="pin" [size]="16" />
          <span>{{ (position() ? 'Standort aktualisieren' : 'Mein Standort') | t }}</span>
        </button>
      </app-facet>
      <app-facet
        [label]="'Verkaufsart' | t"
        [summary]="summaries().auction"
        [open]="openFacet() === 'mode'"
        (openChange)="setOpen('mode', $event)"
        (cleared)="auctionsOnly.set(false)"
      >
        <label class="find__opt">
          <input
            #auctionInput
            type="checkbox"
            name="auctionsOnly"
            [checked]="auctionsOnly()"
            (change)="auctionsOnly.set(auctionInput.checked)"
          />
          <span>{{ 'Auktion' | t }}</span>
        </label>
      </app-facet>
      <app-facet
        [label]="'Anforderungen' | t"
        [summary]="summaries().requirements"
        [open]="openFacet() === 'requirements'"
        (openChange)="setOpen('requirements', $event)"
        (cleared)="clearRequirements()"
      >
        @for (row of rows; track row.key) {
          <span class="zw-caption find__opt-head">{{ row.label | t }}</span>
          <ul class="zw-list" [attr.data-testid]="row.key">
            @for (r of list(row.key); track r.attribute + r.value) {
              <li class="find__opt">
                <span class="find__opt-text">{{ label(r) }}</span>
                <button
                  appButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  (click)="move(r, row.key)"
                  [attr.aria-label]="
                    '{attribute} zu {other} verschieben'
                      | t: { attribute: r.attribute, other: row.other | t }
                  "
                >
                  → {{ row.other | t }}
                </button>
                <button
                  appButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  (click)="remove(r, row.key)"
                  [attr.aria-label]="'{attribute} entfernen' | t: { attribute: r.attribute }"
                >
                  <app-icon name="x" [size]="16" />
                </button>
              </li>
            } @empty {
              <li class="zw-help find__opt">{{ 'Keine.' | t }}</li>
            }
          </ul>
        }
      </app-facet>
      <app-facet
        [label]="'Stichwort' | t"
        [summary]="summaries().keywords"
        [open]="openFacet() === 'keywords'"
        (openChange)="setOpen('keywords', $event)"
        (cleared)="setKeywords('')"
      >
        <label class="zw-label" for="find-keywords">{{ 'Modell, Stichwort' | t }}</label>
        <input
          #kwInput
          id="find-keywords"
          class="zw-input"
          [value]="keywords()"
          (input)="setKeywords(kwInput.value)"
        />
        <span class="zw-help">{{ 'Mehrere mit Komma trennen' | t }}</span>
      </app-facet>
    </div>
    <div class="find__count">
      <span role="status" aria-live="polite">{{ countText() }}</span>
      @if (!busy()) {
        @if (shown(); as res) {
          <span class="zw-help">{{ '{count} verglichen' | t: { count: res.compared ?? 0 } }}</span>
        }
      }
    </div>
  </div>

  @if (busy()) {
    <div class="find__grid find__skeleton" aria-hidden="true">
      @for (i of skeleton; track i) {
        <div class="find__bone">
          <div class="find__bone-media"></div>
          <div class="find__bone-line find__bone-line--70"></div>
          <div class="find__bone-line find__bone-line--40"></div>
        </div>
      }
    </div>
  } @else if (shown()) {
    @if (!groups().length) {
      <p class="find__foot">
        {{ 'Noch nichts Passendes. Entferne eine Anforderung oder vergrössere den Umkreis.' | t }}
      </p>
    }
    @for (g of groups(); track g.fit) {
      <section class="find__grp" [attr.aria-labelledby]="'find-' + g.fit">
        <h2 [id]="'find-' + g.fit">
          {{ g.title | t }}
          <span>{{ g.items.length }} · {{ g.sub | t }}</span>
        </h2>
        <div class="find__grid">
          @for (m of g.items; track m.listing?.id) {
            <div class="find__item">
              <!-- TODO: total cost incl. shipping; listings have no shipping cost yet. -->
              <app-summary-card [listing]="m.listing ?? {}" [why]="m.reason ?? ''" [fit]="g.mark" />
              @for (d of details(m); track d) {
                <p class="zw-small zw-muted">{{ d }}</p>
              }
            </div>
          }
        </div>
      </section>
    }
    <p class="zw-help find__foot">
      {{ 'Nichts dabei?' | t }}
      <!-- TODO: "Gesuch aufgeben" needs a wanted-listing API; the buyer's budget must stay private. -->
      <button appButton variant="ghost" size="sm" type="button" disabled>
        {{ 'Gesuch aufgeben' | t }}
      </button>
      {{ 'Verkäufer sehen, dass jemand sucht. Dein Budget bleibt privat.' | t }}
    </p>
  }
}
```

- [ ] **Step 5: Run the find tests**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/find.spec.ts 2>&1 | grep -E "✓|×|FAIL|Tests |Error" | head -30`
Expected: `Tests 11 passed (11)`. If `'{count} verglichen'` is missing after a group renders, check that `shown()` is set before `matching` turns false (it is, in `showMatches`). If the token titles do not match, print `[...el.querySelectorAll('.token')].map(b => b.title)` once and align the test's expected label.

- [ ] **Step 6: Whole frontend check**

Run: `cd frontend && pnpm run format >/dev/null && pnpm run format:check 2>&1 | tail -1 && pnpm exec ng lint 2>&1 | tail -1 && pnpm exec ng test --watch=false 2>&1 | grep -E "Test Files|Tests " && pnpm exec ng build 2>&1 | grep -E "ERROR|bundle generation"`
Expected: Prettier clean, lint clean, all test files pass, "Application bundle generation complete".

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/pages/find.ts frontend/src/app/pages/find.html frontend/src/app/pages/find.spec.ts
git commit -m "Find: results screen after the Claude Design — sentence with tokens, facet bar, three groups"
```

---

### Task 7: Full checks and a look in the browser (orchestrator)

- [ ] **Step 1: Both sides**

Run from the worktree root:

```bash
cd backend && ./mvnw -q verify 2>&1 | grep -E "Tests run:|FAIL|ERROR\]" | tail -3; cd ../frontend && pnpm run api >/dev/null && git -C .. status --short frontend/openapi.json frontend/src/app/api && pnpm run format:check 2>&1 | tail -1 && pnpm exec ng lint 2>&1 | tail -1 && pnpm exec ng test --watch=false 2>&1 | grep -E "Test Files|Tests " && pnpm exec ng build 2>&1 | grep -E "ERROR|bundle generation"
```

Expected: no test failures, `git status` prints nothing (client up to date), lint/format clean, build complete.

- [ ] **Step 2: In the browser**

Start the backend of the worktree on a free port against a copy of the demo data and the frontend with a proxy to it (the same recipe as for PR #85: `--server.port=8081 --spring.datasource.url=jdbc:postgresql://localhost:5432/hackaton_exp --spring.docker.compose.enabled=false`, `ng serve --port 4300 --proxy-config <proxy with 8081>`). Open `/find?q=Funktionierender iMac 2017 mit 5K, bis CHF 600, Abholung in Zürich` at desktop width and at 375 px, and check:

1. The sentence shows underlined tokens; tapping "2017" strikes it through and the list reloads; tapping again restores it.
2. The facet bar sticks under the header; Preis → 500 → Übernehmen reloads once; on 375 px the panel is a bottom sheet.
3. Groups Passt / Möglich / Alternativen with the why line on each card; the skeleton shows while loading.
4. A reload of the URL shows the same search without a parse call (network tab: only `matches`).

Stop the servers afterwards.

- [ ] **Step 3: Push and open the PR**

Only when the user asks. PR text: what changed (backend phrases + conditions, the page), what was left out and why (facets without data), checks run, one line on what was not checked.
