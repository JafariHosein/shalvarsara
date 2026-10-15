import * as React from "react";
import { ExternalLink, LocateFixed, Trash2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A map pin. Kept in sync with the form value. */
export interface LatLng {
  lat: number;
  lng: number;
}

interface AddressMapPickerProps {
  value: LatLng | null;
  onChange: (next: LatLng | null) => void;
  className?: string;
}

/** Fallback centre: Tehran, shown until the customer puts the first pin. */
const TEHRAN = { lat: 35.6892, lng: 51.389 };

/** OSM tiles are the free, keyless default; swap the URL to move providers. */
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  'دادهٔ نقشه © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/**
 * Inline SVG pin instead of Leaflet's default marker images: those are PNG
 * files relative to the CSS URL, which Vite does not rewrite and bundlers
 * cannot find — the classic broken-marker bug. `currentColor` keeps it themed.
 */
const PIN_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="#2563EB" stroke="#ffffff" stroke-width="1.5"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.6" fill="#ffffff" stroke="none"/></svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

/** Formats a coordinate with a fixed, readable precision. */
function fmt(value: number): string {
  return value.toFixed(6);
}

/**
 * Map picker for an address: tap to place the pin, drag to fine-tune.
 *
 * The pin is optional — an address stays valid without one — so a failed tile
 * connection never blocks saving; the two small fields below the map accept the
 * coordinates by hand in that case.
 */
export function AddressMapPicker({ value, onChange, className }: AddressMapPickerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const [tilesFailed, setTilesFailed] = React.useState(false);

  // The effect below must not be re-created by every value change, so the
  // current pin is read through a ref instead of a dependency.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const start = valueRef.current ?? TEHRAN;
    const map = L.map(container, {
      center: [start.lat, start.lng],
      zoom: start === TEHRAN ? 11 : 15,
      // Wheel zoom over the map would hijack the page scroll inside the dialog.
      scrollWheelZoom: false,
    });

    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    // A blocked or offline tile server is not fatal: say so and let the manual
    // fields do the job.
    tiles.on("tileerror", () => setTilesFailed(true));

    const place = (latlng: L.LatLng) => {
      const next = { lat: latlng.lat, lng: latlng.lng };
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng, { icon: PIN_ICON, draggable: true }).addTo(map);
        markerRef.current.on("drag", () => {
          const dragged = markerRef.current!.getLatLng();
          onChange({ lat: dragged.lat, lng: dragged.lng });
        });
      }
      onChange(next);
    };

    // Clicking the map places (or moves) the pin. The handler is named so the
    // cleanup can detach exactly this listener.
    const onMapClick = (event: L.LeafletMouseEvent) => place(event.latlng);
    map.on("click", onMapClick);

    mapRef.current = map;

    // The container may still be inside an opening dialog animation, so the
    // size is measured again on the next tick and on every later resize.
    const sizeNow = window.setTimeout(() => map.invalidateSize(), 120);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      window.clearTimeout(sizeNow);
      observer.disconnect();
      map.off("click", onMapClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The caller changed the value (edit form, manual field): move the pin. */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (value === null) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      markerRef.current = L.marker([value.lat, value.lng], { icon: PIN_ICON, draggable: true }).addTo(map);
      markerRef.current.on("drag", () => {
        const dragged = markerRef.current!.getLatLng();
        onChange({ lat: dragged.lat, lng: dragged.lng });
      });
    }
    map.panTo([value.lat, value.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current;
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        onChange(next);
        map?.setView([next.lat, next.lng], 16);
      },
      () => {
        // No permission or no fix: the map stays where it is, the manual fields work.
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        ref={containerRef}
        role="application"
        aria-label="نقشهٔ انتخاب نشانی"
        className="h-56 w-full overflow-hidden rounded-lg bg-muted"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={useMyLocation}>
          <LocateFixed className="size-4" />
          موقعیت فعلی من
        </Button>

        {value ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-4" />
              حذف نشان
            </Button>
            <a
              href={`https://www.openstreetmap.org/?mlat=${fmt(value.lat)}&mlon=${fmt(value.lng)}#map=17/${fmt(value.lat)}/${fmt(value.lng)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              مشاهده در نقشهٔ بزرگ
            </a>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">برای انتخاب، روی نقشه کلیک کنید.</p>
        )}
      </div>

      {/* Fallback for when tiles cannot load, plus a precise manual entry. */}
      {tilesFailed && (
        <p className="rounded-lg bg-warning/10 p-2.5 text-xs leading-6 text-warning">
          نقشه بارگذاری نشد (اتصال به سرور نقشه). مختصات را در کادرهای زیر وارد کنید؛
          ذخیرهٔ نشانی همچنان کار می‌کند.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="map-lat" className="text-xs">
            عرض جغرافیایی
          </Label>
          <Input
            id="map-lat"
            dir="ltr"
            inputMode="decimal"
            className="text-end text-sm tabular-nums"
            placeholder="35.6892"
            value={value ? fmt(value.lat) : ""}
            onChange={(event) => {
              const lat = Number(event.target.value.replace(",", "."));
              if (Number.isFinite(lat) && Math.abs(lat) <= 90) {
                onChange({ lat, lng: value?.lng ?? TEHRAN.lng });
              } else if (event.target.value.trim() === "") {
                onChange(null);
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="map-lng" className="text-xs">
            طول جغرافیایی
          </Label>
          <Input
            id="map-lng"
            dir="ltr"
            inputMode="decimal"
            className="text-end text-sm tabular-nums"
            placeholder="51.3890"
            value={value ? fmt(value.lng) : ""}
            onChange={(event) => {
              const lng = Number(event.target.value.replace(",", "."));
              if (Number.isFinite(lng) && Math.abs(lng) <= 180) {
                onChange({ lat: value?.lat ?? TEHRAN.lat, lng });
              } else if (event.target.value.trim() === "") {
                onChange(null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
