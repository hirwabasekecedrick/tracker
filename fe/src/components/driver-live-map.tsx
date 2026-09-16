"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Box, Typography } from "@mui/material";
import type { LocationPoint } from "@/lib/types";

const riderIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:12px">R</div>`,
  className: "driver-live-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const KIGALI_CENTER: [number, number] = [-1.9441, 30.0619];

function FollowRider({ location }: { location: LocationPoint | null }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.panTo([location.latitude, location.longitude]);
    }
  }, [location, map]);

  return null;
}

export default function DriverLiveMap({ path }: { path: LocationPoint[] }) {
  const latest = path.at(-1) || null;
  const center: [number, number] = latest ? [latest.latitude, latest.longitude] : KIGALI_CENTER;

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography variant="overline" sx={{ color: "#cbd5e1", letterSpacing: 1.4 }}>
        Your live route
      </Typography>
      <Box sx={{ height: 300, width: "100%", overflow: "hidden", borderRadius: 2 }}>
        <MapContainer center={center} zoom={latest ? 16 : 13} maxZoom={20} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
          />
          <FollowRider location={latest} />
          {path.length > 1 ? (
            <Polyline
              positions={path.map((point) => [point.latitude, point.longitude] as [number, number])}
              pathOptions={{ color: "#22c55e", weight: 5 }}
            />
          ) : null}
          {path[0] ? (
            <CircleMarker
              center={[path[0].latitude, path[0].longitude]}
              radius={8}
              pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1 }}
            >
              <Popup>Journey started here</Popup>
            </CircleMarker>
          ) : null}
          {latest ? <Marker position={[latest.latitude, latest.longitude]} icon={riderIcon} /> : null}
        </MapContainer>
      </Box>
    </Box>
  );
}