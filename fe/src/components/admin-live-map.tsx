"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { io, type Socket } from "socket.io-client";
import type { UserJourneyState } from "@/lib/types";

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  throw new Error("NEXT_PUBLIC_API_URL is required");
};

const getMarkerIcon = (user: UserJourneyState) =>
  L.divIcon({
    html: `
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: ${user.active ? "#22c55e" : "#f59e0b"};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        border: 3px solid white;
        box-shadow: 0 4px 18px rgba(0,0,0,0.35);
        font-size: 12px;
      ">
        ${user.name.charAt(0).toUpperCase()}
      </div>
    `,
    className: "custom-driver-marker",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

function FitToUsers({ users }: { users: UserJourneyState[] }) {
  const map = useMap();

  useEffect(() => {
    const activeUsers = users.filter((user) => user.active && user.lastLocation);

    if (!activeUsers.length) {
      map.setView([0, 0], 2);
      return;
    }

    const points = activeUsers.flatMap((user) =>
      user.path.length
        ? user.path.map((point) => [point.latitude, point.longitude] as [number, number])
        : user.lastLocation
          ? [[user.lastLocation.latitude, user.lastLocation.longitude] as [number, number]]
          : []
    );

    if (!points.length) {
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.3));
  }, [map, users]);

  return null;
}

export default function AdminLiveMap({ token }: { token: string }) {
  const [users, setUsers] = useState<UserJourneyState[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const apiBase = getApiBase();
    const socket = io(apiBase, {
      transports: ["websocket"],
      reconnection: true,
      auth: token ? { token } : undefined,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("usersUpdate", (payload: UserJourneyState[]) => {
      setUsers(Array.isArray(payload) ? payload : []);
    });

    fetch(`${apiBase}/api/journey/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("usersUpdate");
      socket.disconnect();
    };
  }, [token]);

  const visibleUsers = useMemo(
    () => users.filter((user) => user.active || user.lastLocation),
    [users]
  );

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Chip
          label={socketConnected ? "Socket live" : "Connecting..."}
          color={socketConnected ? "success" : "warning"}
        />
        <Chip label={`${visibleUsers.length} user(s)`} color="primary" />
      </Stack>

      <Card sx={{ overflow: "hidden", borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ height: 540, width: "100%" }}>
            <MapContainer center={[0, 0]} zoom={2} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitToUsers users={visibleUsers} />

              {visibleUsers.map((user) => {
                if (!user.lastLocation) {
                  return null;
                }

                const latest = user.lastLocation;
                const route = user.path.length ? user.path : [latest];

                return (
                  <div key={user.userId}>
                    <Polyline
                      positions={route.map((point) => [point.latitude, point.longitude] as [number, number])}
                      pathOptions={{ color: user.active ? "#22c55e" : "#f59e0b", weight: 5 }}
                    />

                    <Marker position={[latest.latitude, latest.longitude]} icon={getMarkerIcon(user)}>
                      <Popup>
                        <Box sx={{ minWidth: 180 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {user.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.deliveryStatus === "on_delivery"
                              ? "On delivery"
                              : user.deliveryStatus === "paused"
                                ? "Paused"
                                : "Available for deliveries"}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Vehicle:</strong> {user.vehicleNumber || "Unassigned"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Phone:</strong> {user.phoneNumber || "N/A"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Last seen:</strong> {new Date(latest.timestamp).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </MapContainer>
          </Box>
        </CardContent>
      </Card>

      <Stack spacing={1}>
        {visibleUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No users are currently tracking.
          </Typography>
        ) : (
          visibleUsers.map((user) => (
            <Card key={user.userId} variant="outlined">
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {user.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.deliveryStatus === "on_delivery"
                        ? "On delivery"
                        : user.deliveryStatus === "paused"
                          ? "Paused"
                          : "Available"}
                    </Typography>
                    <Box component="div" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {user.vehicleNumber || "Unassigned"} • {user.phoneNumber || "N/A"}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ textAlign: "right" }}>
                    {user.lastLocation ? (
                      <>
                        <Typography variant="body2">
                          {user.lastLocation.latitude.toFixed(5)}, {user.lastLocation.longitude.toFixed(5)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(user.lastLocation.timestamp).toLocaleTimeString()}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2">No coordinates</Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  );
}
