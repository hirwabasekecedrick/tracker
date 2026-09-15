"use client";

import { Box, Typography } from "@mui/material";
import LocationTrackerClient from "@/lib/socket-client";
import type { AppUser } from "@/lib/auth";

export default function DriverWorkspace({ user, token }: { user: AppUser; token: string }) {
  return (
    <Box id="rider-workspace" sx={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 4, boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)", p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>Rider Operations</Typography>
      <Typography variant="body1" sx={{ mb: 3, color: "#cbd5e1" }}>Start and monitor your active delivery route.</Typography>
      <LocationTrackerClient user={user} token={token} />
    </Box>
  );
}
