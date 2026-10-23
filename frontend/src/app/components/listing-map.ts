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
  priceChf?: number;
  latitude?: number | null;
  longitude?: number | null;
}

const SWITZERLAND = L.latLng(46.8, 8.2);

/** OpenStreetMap with one area circle per cluster of listings within `areaKm` of each other, labelled with its listing count; a click lists them. The exact spot stays private. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing-map',
  template: `<div
    #map
    role="region"
    [attr.aria-label]="label()"
    class="isolate h-80 w-full rounded-xl border border-(--line-soft)"
  ></div>`,
})
export class ListingMap {
  readonly items = input.required<MapItem[]>();
  readonly areaKm = input(5);
  readonly label = input('Karte der Inserate');

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
          // shortcut: greedy, joins the first cluster within range of its start; fine while listings are few
          const radius = this.areaKm() * 1000;
          const areas: { at: L.LatLng; group: MapItem[] }[] = [];
          for (const item of this.items()) {
            if (item.latitude == null || item.longitude == null) continue;
            const at = L.latLng(item.latitude, item.longitude);
            const area = areas.find((a) => a.at.distanceTo(at) <= radius);
            if (area) area.group.push(item);
            else areas.push({ at, group: [item] });
          }
          for (const { at, group } of areas) {
            L.circle(at, { radius, weight: 2 })
              .bindPopup(this.popup(group))
              .bindTooltip(String(group.length), { permanent: true, direction: 'center' })
              .addTo(shapes);
          }
          if (shapes.getLayers().length) map.fitBounds(shapes.getBounds(), { maxZoom: 13 });
        },
        { injector },
      );
    });
  }

  // real elements, not an HTML string: titles are user input
  private popup(group: MapItem[]) {
    const list = document.createElement('ul');
    for (const item of group) {
      const link = document.createElement('a');
      link.href = `/listings/${item.id}`;
      link.textContent = `${item.title ?? 'Listing'} · CHF ${item.priceChf}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        void this.router.navigate(['/listings', item.id]);
      });
      const row = list.appendChild(document.createElement('li'));
      row.append(link);
    }
    return list;
  }
}
