"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import { Box, Card, CardContent, Chip, Link, Stack, Typography } from "@mui/material";
import type { LocationPoint } from "@/lib/types";

type HistoricalJourney = {
  id: string;
  userId: string;
  driverName: string;
  email: string;
  vehicleNumber: string;
  startedAt: number;
  endedAt: number | null;
  active: boolean;
  points: LocationPoint[];
};

const getApiBase = () => {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is required");
  }

  return process.env.NEXT_PUBLIC_API_URL;
};

export default function JourneyHistory({ token }: { token: string }) {
  const [journeys, setJourneys] = useState<HistoricalJourney[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${getApiBase()}/api/journey/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load previous journeys");
        }
        return response.json();
      })
      .then((data) => setJourneys(Array.isArray(data) ? data : []))
      .catch((requestError: Error) => setError(requestError.message));
  }, [token]);

  const groupedJourneys = useMemo(() => {
    return journeys.reduce<Record<string, HistoricalJourney[]>>((groups, journey) => {
      const key = journey.userId;
      groups[key] = groups[key] || [];
      groups[key].push(journey);
      return groups;
    }, {});
  }, [journeys]);

  return (
    <Box id="previous-journeys" sx={{ display: "grid", gap: 2, scrollMarginTop: 24 }}>
      <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Previous journeys
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Historical routes grouped by rider.
          </Typography>
        </Box>
        <Chip label={`${journeys.length} journey(s)`} color="primary" />
      </Stack>

      {error ? <Typography color="error">{error}</Typography> : null}
      {!error && !journeys.length ? (
        <Typography color="text.secondary">No previous journeys found.</Typography>
      ) : null}

      {Object.entries(groupedJourneys).map(([userId, driverJourneys]) => {
        const driver = driverJourneys[0];

        return (
          <Card key={userId} variant="outlined">
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {driver.driverName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {driver.email || "No email"} · {driver.vehicleNumber || "Unassigned vehicle"}
                </Typography>
              </Box>

              {driverJourneys.map((journey) => (
                <Box key={journey.id} sx={{ display: "grid", gap: 1 }}>
                  <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2">
                      {new Date(journey.startedAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {journey.points.length} GPS points
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 220, overflow: "hidden", borderRadius: 2 }}>
                    <MapContainer center={journey.points.length ? [journey.points[0].latitude, journey.points[0].longitude] : [0, 0]} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {journey.points.length > 1 ? (
                        <Polyline
                          positions={journey.points.map((point) => [point.latitude, point.longitude] as [number, number])}
                          pathOptions={{ color: journey.active ? "#22c55e" : "#f59e0b", weight: 5 }}
                        />
                      ) : null}
                    </MapContainer>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}