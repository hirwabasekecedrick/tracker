"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import type { AppUser } from "@/lib/auth";

type LocationUpdate = {
  userId: string;
  name: string;
  vehicleNumber: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  timestamp: number;
};

const getSocketUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:4000";
  }

  const host = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "https" : "http";

  return `${protocol}://${host}:4000`;
};

export default function LocationTrackerClient({ user, token }: { user: AppUser; token: string }) {
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(user.id);
  const [status, setStatus] = useState("Waiting for location");
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [name, setName] = useState(user.name || "Driver 1");
  const [vehicleNumber, setVehicleNumber] = useState(user.vehicleNumber || "Vehicle 01");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "+1 555 000 0000");

  useEffect(() => {
    setName(user.name || "Driver 1");
    setVehicleNumber(user.vehicleNumber || "Vehicle 01");
    setPhoneNumber(user.phoneNumber || "+1 555 000 0000");
  }, [user]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported on this device");
      return;
    }

    if (!token) {
      setStatus("Please log in to start tracking");
      return;
    }

    const socket = io(getSocketUrl(), {
      transports: ["websocket"],
      reconnection: true,
      auth: {
        token,
      },
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      setStatus(journeyActive ? "On delivery" : "Available for deliveries");
    };

    const handleDisconnect = () => {
      setConnected(false);
      setStatus("Disconnected from tracker");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload: LocationUpdate = {
          userId: userIdRef.current,
          name,
          vehicleNumber,
          phoneNumber,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };

        setLocation(payload);

        if (journeyActive) {
          setStatus("Sending live coordinates");
          socket.emit("locationUpdate", payload);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        const messages: Record<number, string> = {
          1: "Location permission was denied. Please allow location access and reload the page.",
          2: "Location is unavailable on this device right now.",
          3: "Location request timed out. Please try again.",
        };

        setStatus(messages[error.code] ?? `Location access error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [journeyActive, name, phoneNumber, token, vehicleNumber]);

  const startJourney = () => {
    if (!socketRef.current || !token) {
      return;
    }

    socketRef.current.emit("journey:start", {
      userId: userIdRef.current,
      name,
      vehicleNumber,
      phoneNumber,
    });
    setJourneyActive(true);
    setStatus("On delivery");
  };

  const stopJourney = () => {
    if (!socketRef.current || !token) {
      return;
    }

    socketRef.current.emit("journey:stop", { userId: userIdRef.current });
    setJourneyActive(false);
    setStatus("Available for deliveries");
  };

  return (
    <Box sx={{ display: "grid", gap: 2, width: "100%" }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Chip
          label={connected ? "Connected" : "Connecting..."}
          color={connected ? "success" : "warning"}
          variant="filled"
        />
        <Chip label={journeyActive ? "On delivery" : "Available"} color={journeyActive ? "success" : "default"} />
        <Chip label={status} color="primary" variant="outlined" />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <TextField
          label="Driver name"
          value={name}
          onChange={(event) => setName(event.target.value || "Driver 1")}
          size="small"
          sx={{ input: { color: "#f8fafc" }, label: { color: "#cbd5e1" } }}
        />
        <TextField
          label="Vehicle number"
          value={vehicleNumber}
          onChange={(event) => setVehicleNumber(event.target.value || "Vehicle 01")}
          size="small"
          sx={{ input: { color: "#f8fafc" }, label: { color: "#cbd5e1" } }}
        />
        <TextField
          label="Phone number"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value || "+1 555 000 0000")}
          size="small"
          sx={{ input: { color: "#f8fafc" }, label: { color: "#cbd5e1" } }}
        />
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" color="success" onClick={startJourney} disabled={journeyActive || !connected || !token}>
          Start journey
        </Button>
        <Button variant="outlined" color="error" onClick={stopJourney} disabled={!journeyActive}>
          Stop journey
        </Button>
      </Stack>

      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          border: "1px solid rgba(148, 163, 184, 0.4)",
        }}
      >
        <Typography variant="overline" sx={{ color: "#cbd5e1", letterSpacing: 1.4 }}>
          Current position
        </Typography>

        {location ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Typography>
            <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
              Updated: {new Date(location.timestamp).toLocaleTimeString()}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body1" sx={{ mt: 1, color: "#cbd5e1" }}>
            Waiting for GPS signal...
          </Typography>
        )}
      </Box>
    </Box>
  );
}