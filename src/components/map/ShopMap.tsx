import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { DEMO_CENTER } from "@/data/demo";
import type { Shop } from "@/lib/types";

function MapController({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, map]);

  return null;
}

/** Browser-only: loaded lazily after hydration. OpenStreetMap tiles, no paid APIs. */
export default function ShopMap({
  shops,
  userLocation,
  onShopSelect,
}: {
  shops: Shop[];
  userLocation: { lat: number; lng: number } | null;
  onShopSelect: (shopId: string) => void;
}) {
  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [DEMO_CENTER.latitude, DEMO_CENTER.longitude];

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={15}
      className="h-full w-full"
      scrollWheelZoom
    >
      <MapController userLocation={userLocation} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{ color: "#C084FC", fillOpacity: 0.9 }}
        >
          <Popup>Your location</Popup>
        </CircleMarker>
      )}
      {shops.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.latitude, s.longitude]}
          radius={10}
          pathOptions={{ color: "#7C3AED", fillColor: "#8B5CF6", fillOpacity: 0.8 }}
          eventHandlers={{
            click: () => onShopSelect(s.id),
          }}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />
            <Link to="/shops/$shopId" params={{ shopId: s.id }}>
              View shop
            </Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
