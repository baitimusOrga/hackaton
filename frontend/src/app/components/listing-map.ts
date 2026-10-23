import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';

export interface MapItem {
  id?: number;
  title?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const SWITZERLAND = L.latLng(46.8, 8.2);

/** OpenStreetMap with one marker per listing, or, with `areaKm`, a circle instead (no exact spot). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing-map',
  template: `<div
    #map
    role="region"
    [attr.aria-label]="label()"
    class="isolate h-80 w-full rounded-xl border border-slate-300"
  ></div>`,
})
export class ListingMap {
  readonly items = input.required<MapItem[]>();
  readonly areaKm = input<number>();
  readonly label = input('Map of the listings');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly router = inject(Router);

  constructor() {
    const injector = inject(Injector);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const map = L.map(this.host().nativeElement).setView(SWITZERLAND, 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const shapes = L.featureGroup().addTo(map);
      destroyRef.onDestroy(() => map.remove());
      effect(
        () => {
          shapes.clearLayers();
          const areaKm = this.areaKm();
          for (const item of this.items()) {
            if (item.latitude == null || item.longitude == null) continue;
            const at = L.latLng(item.latitude, item.longitude);
            (areaKm
              ? L.circle(at, { radius: areaKm * 1000, weight: 2 })
              : L.circleMarker(at, { radius: 9, weight: 2, fillOpacity: 0.7 }).bindPopup(
                  this.popup(item),
                )
            ).addTo(shapes);
          }
          if (shapes.getLayers().length) map.fitBounds(shapes.getBounds(), { maxZoom: 13 });
        },
        { injector },
      );
    });
  }

  // a real element, not an HTML string: titles are user input
  private popup(item: MapItem) {
    const link = document.createElement('a');
    link.href = `/listings/${item.id}`;
    link.textContent = item.title ?? 'Listing';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      void this.router.navigate(['/listings', item.id]);
    });
    return link;
  }
}
