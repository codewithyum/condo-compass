import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BuildingResult, GeocodeResult } from "@/lib/types";

interface Props {
  location: GeocodeResult | null;
  results: BuildingResult[];
  selectedId: string | null;
  showNoReviews: boolean;
  showUncertain: boolean;
  onSelect: (id: string) => void;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function bubbleIcon(b: BuildingResult, selected: boolean) {
  const label = escapeHtml(
    (b.name ?? b.address ?? "Building").slice(0, 22),
  );
  const rating = b.googleRating != null ? `★${b.googleRating}` : "";
  const score = b.recommendationScore != null ? `· ${b.recommendationScore}` : "";
  return L.divIcon({
    className: "scanner-bubble",
    html: `<div class="scanner-bubble-inner ${selected ? "is-selected" : ""}">${label} ${rating} ${score}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function dotIcon() {
  return L.divIcon({
    className: "scanner-dot",
    html: `<div class="scanner-dot-inner"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function centerIcon() {
  return L.divIcon({
    className: "scanner-dot",
    html: `<div class="scanner-center-inner"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function MapController({
  location,
  selected,
}: {
  location: GeocodeResult | null;
  selected: BuildingResult | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (location) map.setView([location.lat, location.lng], 15);
  }, [location, map]);

  useEffect(() => {
    if (selected) map.flyTo([selected.lat, selected.lng], 17, { duration: 0.6 });
  }, [selected, map]);

  return null;
}

export default function ScannerMap({
  location,
  results,
  selectedId,
  showNoReviews,
  onSelect,
}: Props) {
  const center: [number, number] = location
    ? [location.lat, location.lng]
    : [49.2827, -123.1207]; // Vancouver default
  const selected = results.find((r) => r.id === selectedId) ?? null;

  return (
    <MapContainer
      center={center}
      zoom={location ? 15 : 12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {location && (
        <Marker
          position={[location.lat, location.lng]}
          icon={centerIcon()}
          interactive={false}
        />
      )}

      {results.map((b) => {
        if (!b.hasReviews && !showNoReviews) return null;
        const icon = b.hasReviews
          ? bubbleIcon(b, b.id === selectedId)
          : dotIcon();
        return (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={icon}
            zIndexOffset={b.hasReviews ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(b.id) }}
          />
        );
      })}

      <MapController location={location} selected={selected} />
    </MapContainer>
  );
}
