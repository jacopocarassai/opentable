// let's be honest: who's searching for restaurants scrolling a results' grid? 
// Having a map layer is much better! ;)

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useGeoSearch } from "react-instantsearch";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapMoveListener({ enabled, onMoved }) {
  useMapEvents({
    moveend(e) {
      if (!enabled) return;
      const bounds = e.target.getBounds();
      onMoved({
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      });
    },
  });
  return null;
}

function AutoFitBounds({ items, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    if (items.length === 1) {
      map.setView([items[0]._geoloc.lat, items[0]._geoloc.lng], 13);
      return;
    }

    const bounds = L.latLngBounds(
      items.map((item) => [item._geoloc.lat, item._geoloc.lng])
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [items, enabled, map]);

  return null;
}

export default function MapView({ userCoords }) {
  const { items, refine } = useGeoSearch();
  const [searchAsMove, setSearchAsMove] = useState(false);

  const initialCenter = userCoords ? [userCoords.lat, userCoords.lng] : [39.8283, -98.5795];

  return (
    <div className="map-view">
      <label className="map-toggle">
        <input
          type="checkbox"
          checked={searchAsMove}
          onChange={(e) => setSearchAsMove(e.target.checked)}
        />
        Search as I move the map
      </label>

      <MapContainer center={initialCenter} zoom={4} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFitBounds items={items} enabled={!searchAsMove} />
        <MapMoveListener enabled={searchAsMove} onMoved={refine} />

        {items.map((item) => (
          <Marker key={item.objectID} position={[item._geoloc.lat, item._geoloc.lng]} icon={defaultIcon}>
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {item.cuisine} · {item.price_tier_label}
              <br />
              ★ {item.rating?.toFixed(1)} ({item.review_count} reviews)
              <br />
              {item.location_label}
              {item.is_chain && (
                <>
                  <br />
                  <em>{item.chain_location_count} locations. Check you've got the right one!</em>
                </>
              )}
              <br />
              <a href={item.reserve_url} target="_blank" rel="noreferrer">
                Reserve a table
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}