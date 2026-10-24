import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ListingMap, MapItem } from './listing-map';

@Component({
  imports: [ListingMap],
  template: `<app-listing-map [items]="items" label="Test map" />`,
})
class Host {
  items: MapItem[] = [
    { id: 1, title: 'With coordinates', latitude: 47.378, longitude: 8.523 },
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
});
