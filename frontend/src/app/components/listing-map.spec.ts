import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ListingMap, MapItem } from './listing-map';

@Component({
  imports: [ListingMap],
  template: `<app-listing-map [items]="items" [areaKm]="areaKm" label="Test map" />`,
})
class Host {
  items: MapItem[] = [
    { id: 1, title: 'With coordinates', latitude: 47.378, longitude: 8.523 },
    { id: 2, title: 'Without coordinates' },
  ];
  areaKm?: number;
}

describe('ListingMap', () => {
  async function render(areaKm?: number) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.areaKm = areaKm;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a labelled region with the OSM attribution and one marker per listing with coordinates', async () => {
    const element = await render();
    expect(element.querySelector('[role="region"]')!.getAttribute('aria-label')).toBe('Test map');
    expect(element.querySelector('.leaflet-control-attribution')!.textContent).toContain(
      'OpenStreetMap',
    );
    expect(element.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
  });

  it('draws an area instead of a marker popup when areaKm is set', async () => {
    const element = await render(2);
    expect(element.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
  });
});
