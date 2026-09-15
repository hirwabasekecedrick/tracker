"use client";

import dynamic from "next/dynamic";
import { Box, Grid, Link, Typography } from "@mui/material";
import { useCallback, useState } from "react";
import type { UserJourneyState } from "@/lib/types";

const AdminLiveMap = dynamic(() => import("@/components/admin-live-map"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading map...</Typography>,
});

export default function AdminWorkspace({ token }: { token: string }) {
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const handleDriversChange = useCallback((drivers: UserJourneyState[]) => {
    setSelectedDriverId((current) => !current || drivers.some((driver) => driver.userId === current) ? current : "");
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <Box id="dispatch-map" sx={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 4, boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)", p: { xs: 2, md: 3 } }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>Dispatch Live Map</Typography>
          <Typography variant="body1" sx={{ mb: 2, color: "#cbd5e1" }}>Live rider locations and delivery route history.</Typography>
          <AdminLiveMap token={token} selectedDriverId={selectedDriverId} onSelectedDriverChange={setSelectedDriverId} onDriversChange={handleDriversChange} />
          <Link href="/admin/history" underline="hover" sx={{ display: "inline-block", mt: 2, fontWeight: 700 }}>View previous journeys by rider</Link>
        </Box>
      </Grid>
    </Grid>
  );
}
