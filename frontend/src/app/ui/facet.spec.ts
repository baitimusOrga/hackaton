import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Facet } from './facet';

@Component({
  imports: [Facet],
  template: `<app-facet
    label="Preis"
    [summary]="summary"
    [(open)]="open"
    (cleared)="cleared = true"
  >
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
