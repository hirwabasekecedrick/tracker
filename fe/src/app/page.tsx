"use client";

import dynamic from "next/dynamic";
import { Box, Grid, Link, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import LocationTrackerClient from "@/lib/socket-client";
import AuthPanel from "@/components/auth-panel";
import { authStorage, type AppUser } from "@/lib/auth";

const AdminLiveMap = dynamic(() => import("@/components/admin-live-map"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading map...</Typography>,
});

const JourneyHistory = dynamic(() => import("@/lib/journey-history"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading journey history...</Typography>,
});

const isExpiredToken = (token: string) => {
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5;
    }

    const saved = authStorage.get();
    if (saved && !isExpiredToken(saved.token)) {
      setUser(saved.user);
      setToken(saved.token);
    } else if (saved) {
      authStorage.clear();
    }
    setAuthReady(true);
  }, []);

  return (
    <Box className="relative min-h-screen overflow-hidden bg-slate-950">
      <Box className="absolute inset-0 w-full">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover opacity-70"
        >
          <source src="/vids/animation.mp4" type="video/mp4" />
        </video>
        <Box className="absolute inset-0 bg-slate-950/75" />
      </Box>

      <Box className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <Grid container spacing={4} sx={{ width: "min(100%, 1400px)" }}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box
              sx={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(148, 163, 184, 0.28)",
                borderRadius: 4,
                boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)",
                p: { xs: 3, md: 5 },
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>
                Rider Operations
              </Typography>
              <Typography variant="body1" sx={{ mb: 3, color: "#cbd5e1" }}>
                Monitor riders and delivery routes in real time.
              </Typography>

              <Box sx={{ mb: 3 }}>
                <AuthPanel
                  user={user}
                  onLogin={(nextUser, nextToken) => {
                    setUser(nextUser);
                    setToken(nextToken);
                  }}
                  onLogout={() => {
                    authStorage.clear();
                    setUser(null);
                    setToken("");
                  }}
                />
              </Box>

              {authReady && user?.role === "driver" ? (
                <LocationTrackerClient user={user} token={token} />
              ) : authReady && user?.role === "admin" ? (
                <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
                  Management access enabled. Rider GPS tracking is disabled for administrators.
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
                  Login to start tracking and send location updates.
                </Typography>
              )}
            </Box>
          </Grid>

          {authReady && user?.role === "admin" && token ? (
            <Grid size={{ xs: 12, lg: 7 }}>
              <Box
                sx={{
                  background: "rgba(15, 23, 42, 0.75)",
                  border: "1px solid rgba(148, 163, 184, 0.28)",
                  borderRadius: 4,
                  boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)",
                  p: { xs: 2, md: 3 },
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>
                  Dispatch Live Map
                </Typography>
                <Typography variant="body1" sx={{ mb: 2, color: "#cbd5e1" }}>
                  Live rider locations and delivery route history.
                </Typography>

                <AdminLiveMap token={token} />
                <Link href="#previous-journeys" underline="hover" sx={{ mt: 2, fontWeight: 700 }}>
                  View previous journeys by rider
                </Link>
              </Box>
            </Grid>
          ) : null}

          {authReady && user?.role === "admin" && token ? (
            <Grid size={12}>
              <JourneyHistory token={token} />
            </Grid>
          ) : null}
        </Grid>
      </Box>
    </Box>
  );
}
