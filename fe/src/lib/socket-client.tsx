"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import type { AppUser } from "@/lib/auth";
import dynamic from "next/dynamic";
import type { LocationPoint } from "@/lib/types";

const DriverLiveMap = dynamic(() => import("@/components/driver-live-map"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading live map...</Typography>,
});

type LocationUpdate = {
  userId: string;
  name: string;
  vehicleNumber: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  timestamp: number;
};

type JourneyStartEvent = {
  type: "journey:start";
  eventId: string;
  payload: {
    userId: string;
    name: string;
    vehicleNumber: string;
    phoneNumber: string;
  };
};

type JourneyStopEvent = {
  type: "journey:stop";
  eventId: string;
  payload: { userId: string };
};

type LocationEvent = LocationUpdate & {
  type: "locationUpdate";
  eventId: string;
};

type OfflineEvent = JourneyStartEvent | JourneyStopEvent | LocationEvent;

const getQueueKey = (userId: string) => `tracker-event-queue-${userId}`;

const readEventQueue = (userId: string): OfflineEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(getQueueKey(userId));
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineEvent[]) : [];
  } catch {
    return [];
  }
};

const writeEventQueue = (userId: string, queue: OfflineEvent[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getQueueKey(userId), JSON.stringify(queue));
  } catch (error) {
    console.error("Unable to save offline location queue", error);
  }
};

const createQueueId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSocketUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is required");
  }

  return apiUrl;
};

export default function LocationTrackerClient({ user, token }: { user: AppUser; token: string }) {
  const socketRef = useRef<Socket | null>(null);
  const flushingQueueRef = useRef(false);
  const flushEventQueueRef = useRef<(() => void) | null>(null);
  const userIdRef = useRef<string>(user.id);
  const [status, setStatus] = useState("Waiting for location");
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [routePath, setRoutePath] = useState<LocationPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [name, setName] = useState(user.name || process.env.NEXT_PUBLIC_DEFAULT_RIDER_NAME || "");
  const [vehicleNumber, setVehicleNumber] = useState(user.vehicleNumber || process.env.NEXT_PUBLIC_DEFAULT_VEHICLE_NUMBER || "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || process.env.NEXT_PUBLIC_DEFAULT_RIDER_PHONE || "");
  const journeyActiveRef = useRef(false);
  const riderDetailsRef = useRef({ name, vehicleNumber, phoneNumber });

  useEffect(() => {
    setName(user.name || process.env.NEXT_PUBLIC_DEFAULT_RIDER_NAME || "");
    setVehicleNumber(user.vehicleNumber || process.env.NEXT_PUBLIC_DEFAULT_VEHICLE_NUMBER || "");
    setPhoneNumber(user.phoneNumber || process.env.NEXT_PUBLIC_DEFAULT_RIDER_PHONE || "");
  }, [user]);

  useEffect(() => {
    journeyActiveRef.current = journeyActive;
  }, [journeyActive]);

  useEffect(() => {
    riderDetailsRef.current = { name, vehicleNumber, phoneNumber };
  }, [name, phoneNumber, vehicleNumber]);

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
      transports: ["polling", "websocket"],
      upgrade: true,
      timeout: 15000,
      reconnection: true,
      auth: {
        token,
      },
    });

    socketRef.current = socket;

    const flushEventQueue = () => {
      if (flushingQueueRef.current || !socket.connected) {
        return;
      }

      const queue = readEventQueue(userIdRef.current);
      if (!queue.length) {
        return;
      }

      flushingQueueRef.current = true;
      const sendNext = () => {
        const pending = readEventQueue(userIdRef.current);
        const next = pending[0];

        if (!next || !socket.connected) {
          flushingQueueRef.current = false;
          return;
        }

        const acknowledge = (acknowledgement?: { ok?: boolean }) => {
          if (!acknowledgement?.ok) {
            flushingQueueRef.current = false;
            return;
          }

          writeEventQueue(userIdRef.current, pending.slice(1));
          sendNext();
        };

        if (next.type === "journey:start") {
          socket.emit("journey:start", next.payload, acknowledge);
        } else if (next.type === "journey:stop") {
          socket.emit("journey:stop", next.payload, acknowledge);
        } else {
          socket.emit("locationUpdate", next, acknowledge);
        }
      };

      sendNext();
    };

    flushEventQueueRef.current = flushEventQueue;

    const handleConnect = () => {
      setConnected(true);
      setStatus(journeyActiveRef.current ? "On delivery" : "Available for deliveries");
      flushEventQueue();
    };

    const handleDisconnect = () => {
      setConnected(false);
      setStatus("Disconnected from tracker");
    };

    const handleConnectError = (error: Error) => {
      setConnected(false);
      setStatus(`Connection error: ${error.message}`);
      console.error("Tracker socket connection error", error);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload: LocationUpdate = {
          userId: userIdRef.current,
          ...riderDetailsRef.current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };

        setLocation(payload);

        if (journeyActiveRef.current) {
          setRoutePath((currentPath) => [...currentPath, {
            latitude: payload.latitude,
            longitude: payload.longitude,
            timestamp: payload.timestamp,
          }]);
          const queuedPayload: LocationEvent = {
            ...payload,
            type: "locationUpdate",
            eventId: createQueueId(),
          };
          const queue = [...readEventQueue(userIdRef.current), queuedPayload];
          writeEventQueue(userIdRef.current, queue);

          if (socket.connected) {
            setStatus("Sending live coordinates");
            flushEventQueue();
          } else {
            setStatus(`${queue.length} location update(s) waiting to sync`);
          }
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. Please allow location access and reload the page.",
          2: "Location is unavailable on this device right now.",
          3: "Location request timed out. Please try again.",
        };
        const code = typeof error?.code === "number" ? error.code : 0;
        const message = typeof error?.message === "string" ? error.message : "The device did not provide a location.";

        setStatus(messages[code] ?? `Location access error: ${message}`);

        if (code === 1) {
          console.warn("Location permission was denied");
        } else if (code === 2) {
          console.warn("Location is unavailable on this device");
        } else if (code === 3) {
          console.warn("Location request timed out");
        } else {
          console.warn("Location error", { code, message });
        }
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
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      flushEventQueueRef.current = null;
    };
  }, [token, user.id]);

  const startJourney = () => {
    if (!token) {
      return;
    }

    const event: JourneyStartEvent = {
      type: "journey:start",
      eventId: createQueueId(),
      payload: {
        userId: userIdRef.current,
        ...riderDetailsRef.current,
      },
    };
    const queue = [...readEventQueue(userIdRef.current), event];
    writeEventQueue(userIdRef.current, queue);
    setJourneyActive(true);
    journeyActiveRef.current = true;
    setRoutePath(
      location
        ? [{ latitude: location.latitude, longitude: location.longitude, timestamp: location.timestamp }]
        : []
    );
    setStatus(socketRef.current?.connected ? "Starting delivery" : "Start queued for reconnection");

    flushEventQueueRef.current?.();
  };

  const stopJourney = () => {
    if (!token) {
      return;
    }

    const event: JourneyStopEvent = {
      type: "journey:stop",
      eventId: createQueueId(),
      payload: { userId: userIdRef.current },
    };
    const queue = [...readEventQueue(userIdRef.current), event];
    writeEventQueue(userIdRef.current, queue);
    setJourneyActive(false);
    journeyActiveRef.current = false;
    setStatus(socketRef.current?.connected ? "Ending delivery" : "Stop queued for reconnection");

    flushEventQueueRef.current?.();
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
          onChange={(event) => setName(event.target.value)}
          size="small"
          sx={{ input: { color: "#f8fafc" }, label: { color: "#cbd5e1" } }}
        />
        <TextField
          label="Vehicle number"
          value={vehicleNumber}
          onChange={(event) => setVehicleNumber(event.target.value)}
          size="small"
          sx={{ input: { color: "#f8fafc" }, label: { color: "#cbd5e1" } }}
        />
        <TextField
          label="Phone number"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
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

      {journeyActive ? <DriverLiveMap path={routePath} /> : null}
    </Box>
  );
}