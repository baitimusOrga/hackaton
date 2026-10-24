import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ListingMap, MapItem } from './listing-map';

@Component({
  imports: [ListingMap],
  template: `<app-listing-map [items]="items" [pin]="pin" label="Test map" />`,
})
class Host {
  static pin = false;
  pin = Host.pin;
  items: MapItem[] = [
    { id: 1, title: 'With coordinates', priceChf: 20, latitude: 47.378, longitude: 8.523 },
    { id: 3, title: 'Same area', latitude: 47.379, longitude: 8.524 },
    { id: 2, title: 'Without coordinates' },
  ];
}

describe('ListingMap', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a labelled region with the OSM attribution and one area per neighbourhood with the listing count', async () => {
    const element = await render();
    expect(element.querySelector('[role="region"]')!.getAttribute('aria-label')).toBe('Test map');
    expect(element.querySelector('.leaflet-control-attribution')!.textContent).toContain(
      'OpenStreetMap',
    );
    expect(element.querySelectorAll('.leaflet-interactive')).toHaveLength(1);
    expect(element.querySelector('.leaflet-tooltip')!.textContent).toBe('2');
  });

  it('shows a plain pin without a count in pin mode', async () => {
    Host.pin = true;
    try {
      const element = await render();
      expect(element.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
      expect(element.querySelector('.leaflet-tooltip')).toBeNull();
    } finally {
      Host.pin = false;
    }
  });

  it('lists the listings of a clicked area under the map and scrolls there', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const element = await render();
    expect(element.querySelector('.zw-map-list')).toBeNull();
    element
      .querySelector('.leaflet-interactive')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await TestBed.inject(ApplicationRef).whenStable();
    const rows = [...element.querySelectorAll('.zw-map-list li')].map((li) => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('With coordinates');
    expect(rows[0]).toContain('CHF 20');
    expect(scroll).toHaveBeenCalled();
  });
});
