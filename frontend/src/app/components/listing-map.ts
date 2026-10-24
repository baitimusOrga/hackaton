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
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { ListingSummary } from '../api/models';
import { TranslatePipe } from '../i18n/i18n';
import { SummaryCard } from '../ui/summary-card';

export type MapItem = ListingSummary;

const SWITZERLAND = L.latLng(46.8, 8.2);

// explicit icon: Leaflet's default-icon path detection breaks with the bundler's file names
const PIN = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

/** OpenStreetMap with one area circle per cluster of listings within `areaKm` of each other, labelled with its listing count; a click lists them under the map and scrolls there. With `pin`, a plain marker per listing instead. The exact spot stays private. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing-map',
  imports: [SummaryCard, TranslatePipe],
  template: `<div
      #map
      role="region"
      [attr.aria-label]="label()"
      class="isolate h-80 w-full zw-map"
    ></div>
    @if (selected().length) {
      <p #list class="zw-muted mt-4">
        {{ 'Gefundene Inserate: {count}' | t: { count: selected().length } }}
      </p>
      <div class="zw-grid mt-2">
        @for (item of selected(); track item.id) {
          <app-summary-card [listing]="item" />
        }
      </div>
    }`,
})
export class ListingMap {
  readonly items = input.required<MapItem[]>();
  readonly areaKm = input(5);
  readonly label = input('Karte der Inserate');
  readonly pin = input(false);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  protected readonly selected = signal<MapItem[]>([]);

  constructor() {
    const injector = inject(Injector);
    const destroyRef = inject(DestroyRef);
    // the list only exists after the render that follows the click
    effect(() =>
      this.list()?.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
    );
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
          this.selected.set([]);
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
            if (this.pin()) {
              L.marker(at, { icon: PIN, keyboard: false, interactive: false }).addTo(shapes);
              continue;
            }
            L.circle(at, { radius, className: 'zw-map-area' })
              .on('click', () => this.selected.set(group))
              .bindTooltip(String(group.length), {
                permanent: true,
                direction: 'center',
                opacity: 1,
                className: 'zw-map-count',
              })
              .addTo(shapes);
          }
          if (shapes.getLayers().length) map.fitBounds(shapes.getBounds(), { maxZoom: 13 });
        },
        { injector },
      );
    });
  }
}
