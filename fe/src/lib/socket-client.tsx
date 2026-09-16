"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import type { AppUser } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-profile";
import dynamic from "next/dynamic";
import type { LocationPoint, UserJourneyState } from "@/lib/types";

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
  accuracy: number | null;
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

const MIN_ROUTE_POINTS = 2;

const ACCURACY_THRESHOLD_M = 20;

type JourneySummary = {
  startedAt: number;
  endedAt: number;
  points: number;
  distanceKm: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineKm = (a: LocationPoint, b: LocationPoint) => {
  const R = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

const computeJourneySummary = (points: LocationPoint[]): JourneySummary | null => {
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last) {
    return null;
  }

  let distanceKm = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversineKm(points[i - 1], points[i]);
  }

  return {
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    points: points.length,
    distanceKm,
  };
};

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
  const [journeySummary, setJourneySummary] = useState<JourneySummary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const { profile } = useDriverProfile(user);
  const journeyActiveRef = useRef(false);
  const riderDetailsRef = useRef({ name: profile.name, vehicleNumber: profile.vehicleNumber, phoneNumber: profile.phoneNumber });

  useEffect(() => {
    journeyActiveRef.current = journeyActive;
  }, [journeyActive]);

  useEffect(() => {
    riderDetailsRef.current = { name: profile.name, vehicleNumber: profile.vehicleNumber, phoneNumber: profile.phoneNumber };
  }, [profile]);

  const refreshPendingCount = () => {
    setPendingCount(readEventQueue(userIdRef.current).length);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    if (!token) {
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

        const timeoutId = window.setTimeout(() => {
          flushingQueueRef.current = false;
        }, 8000);

        const acknowledge = (acknowledgement?: { ok?: boolean }) => {
          window.clearTimeout(timeoutId);

          if (!acknowledgement?.ok) {
            flushingQueueRef.current = false;
            return;
          }

          writeEventQueue(userIdRef.current, pending.slice(1));
          refreshPendingCount();
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

    const handleUsersUpdate = (states: unknown) => {
      if (!Array.isArray(states)) {
        return;
      }

      const mine = states.find(
        (state): state is UserJourneyState =>
          typeof state === "object" && state !== null && (state as UserJourneyState).userId === userIdRef.current
      );

      if (!mine) {
        return;
      }

      journeyActiveRef.current = mine.active;
      setJourneyActive(mine.active);
      setStatus(mine.active ? "On delivery" : "Available for deliveries");

      setRoutePath((current) => {
        const serverPath = Array.isArray(mine.path) ? mine.path : [];

        if (current.length >= serverPath.length) {
          return current;
        }

        if (serverPath.length) {
          return serverPath;
        }

        if (mine.lastLocation) {
          return [{ latitude: mine.lastLocation.latitude, longitude: mine.lastLocation.longitude, timestamp: mine.lastLocation.timestamp }];
        }

        return current;
      });

      if (mine.lastLocation) {
        setLocation({
          userId: userIdRef.current,
          ...riderDetailsRef.current,
          latitude: mine.lastLocation.latitude,
          longitude: mine.lastLocation.longitude,
          timestamp: mine.lastLocation.timestamp,
          accuracy: null,
        });
      }
    };

    const handleConnect = () => {
      setConnected(true);
      setStatus(journeyActiveRef.current ? "On delivery" : "Available for deliveries");
      refreshPendingCount();
      flushEventQueue();
    };

    const handleDisconnect = () => {
      setConnected(false);
      flushingQueueRef.current = false;
      setStatus("Disconnected from tracker — points keep recording locally");
      refreshPendingCount();
    };

    const handleConnectError = (error: Error) => {
      setConnected(false);
      setStatus(`Connection error: ${error.message} — points keep recording locally`);
      console.error("Tracker socket connection error", error);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("usersUpdate", handleUsersUpdate);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracyMeters = typeof position.coords.accuracy === "number" ? Math.round(position.coords.accuracy) : null;
        setAccuracy(accuracyMeters);

        if (accuracyMeters !== null && accuracyMeters > ACCURACY_THRESHOLD_M) {
          setStatus(`GPS precision ±${accuracyMeters} m — waiting for a better fix (need ≤ ${ACCURACY_THRESHOLD_M} m)`);
          return;
        }

        const payload: LocationUpdate = {
          userId: userIdRef.current,
          ...riderDetailsRef.current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: accuracyMeters,
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
            setStatus(`${queue.length} point(s) waiting to sync`);
          }
          refreshPendingCount();
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
        improvedAccuracyiOS: true,
        maximumAge: 0,
        timeout: 15000,
      } as PositionOptions & { improvedAccuracyiOS?: boolean }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("usersUpdate", handleUsersUpdate);
      socket.disconnect();
      flushEventQueueRef.current = null;
    };
  }, [token, user.id]);

  const getAccuratePosition = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        improvedAccuracyiOS: true,
        maximumAge: 0,
        timeout: 10000,
      } as PositionOptions & { improvedAccuracyiOS?: boolean }
    );
  });

  const startJourney = async () => {
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

    const accurate = await getAccuratePosition();
    const accurateEnough =
      accurate &&
      (typeof accurate.coords.accuracy !== "number" || accurate.coords.accuracy <= ACCURACY_THRESHOLD_M);

    const seed: LocationPoint | null = accurateEnough
      ? {
          latitude: accurate!.coords.latitude,
          longitude: accurate!.coords.longitude,
          timestamp: Date.now(),
        }
      : location && (location.accuracy === null || location.accuracy <= ACCURACY_THRESHOLD_M)
        ? { latitude: location.latitude, longitude: location.longitude, timestamp: location.timestamp }
        : null;

    const queue = [...readEventQueue(userIdRef.current), event];

    if (seed) {
      const startingPayload: LocationUpdate = {
        userId: userIdRef.current,
        ...riderDetailsRef.current,
        latitude: seed.latitude,
        longitude: seed.longitude,
        timestamp: seed.timestamp,
        accuracy: typeof accurate?.coords.accuracy === "number" ? Math.round(accurate.coords.accuracy) : null,
      };
      setLocation(startingPayload);
      queue.push({ ...startingPayload, type: "locationUpdate", eventId: createQueueId() });
    }

    writeEventQueue(userIdRef.current, queue);
    refreshPendingCount();
    setJourneyActive(true);
    setJourneySummary(null);
    journeyActiveRef.current = true;
    setRoutePath(seed ? [seed] : []);
    setStatus(socketRef.current?.connected ? "Starting delivery" : "Start queued for reconnection");

    flushEventQueueRef.current?.();
  };

  const stopJourney = () => {
    if (!token) {
      return;
    }

    setJourneySummary(computeJourneySummary(routePath));
    const event: JourneyStopEvent = {
      type: "journey:stop",
      eventId: createQueueId(),
      payload: { userId: userIdRef.current },
    };
    const queue = [...readEventQueue(userIdRef.current), event];
    writeEventQueue(userIdRef.current, queue);
    refreshPendingCount();
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
        {accuracy !== null ? (
          <Chip
            label={`GPS precision ±${accuracy} m`}
            color={accuracy <= ACCURACY_THRESHOLD_M ? "success" : "warning"}
            variant="filled"
          />
        ) : null}
        {journeyActive ? <Chip label={`Vehicle ${profile.vehicleNumber || "unassigned"}`} variant="outlined" /> : null}
        {pendingCount > 0 ? (
          <Chip label={`${pendingCount} queued for sync`} color="warning" variant="filled" />
        ) : null}
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" color="success" onClick={startJourney} disabled={journeyActive || !token || !location}>
          Start journey
        </Button>
        <Button variant="outlined" color="error" onClick={stopJourney} disabled={!journeyActive || routePath.length < MIN_ROUTE_POINTS}>
          End journey
        </Button>
      </Stack>

      {!connected && !journeyActive ? (
        <Typography variant="body2" sx={{ color: "#f59e0b" }}>
          You are offline. You can still start a journey — GPS points will be stored locally and synced automatically
          once the connection is restored.
        </Typography>
      ) : null}

      {journeyActive && routePath.length < MIN_ROUTE_POINTS ? (
        <Typography variant="body2" sx={{ color: "#f59e0b" }}>
          A journey needs at least {MIN_ROUTE_POINTS} GPS points before it can be ended. Current points: {routePath.length}. Keep moving so the route is recorded.
        </Typography>
      ) : null}

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
              {location.accuracy !== null ? ` · precision ±${location.accuracy} m` : ""}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body1" sx={{ mt: 1, color: "#cbd5e1" }}>
            Waiting for GPS signal...
          </Typography>
        )}
      </Box>

      {journeyActive || journeySummary ? <DriverLiveMap path={routePath} /> : null}

      {journeySummary ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }} id="journey-summary">
          <CardContent sx={{ display: "grid", gap: 1.5 }}>
            <Typography variant="overline" sx={{ color: "#94a3b8", letterSpacing: 1.4 }}>
              Journey completed
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>Distance travelled</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {journeySummary.distanceKm.toFixed(2)} km
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>Duration</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {Math.max(0, Math.round((journeySummary.endedAt - journeySummary.startedAt) / 60000))} min
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>GPS points recorded</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {journeySummary.points}
                </Typography>
              </Box>
            </Stack>
            <Divider />
            <Typography variant="body2" sx={{ color: "#94a3b8" }}>
              Started {new Date(journeySummary.startedAt).toLocaleTimeString()} · Ended{" "}
              {new Date(journeySummary.endedAt).toLocaleTimeString()}. The route and coordinates are saved and can be
              reviewed by the admin.
            </Typography>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}