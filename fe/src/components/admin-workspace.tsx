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
    <Box sx={{ width: "100%", maxWidth: 1400, mx: "auto", py: { xs: 2, md: 1 }, px: { xs: 2, md: 3 } , display: "flex", flexDirection: "row", gap: 4 }}>
    <Grid container spacing={4} sx={{width: "100%", flex: 1, overflow: "hidden"}}>
      <Grid size={{ xs: 12 }}>
        <Box id="dispatch-map" sx={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 1, boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)", p: { xs: 2, md: 3 } }}>
          <AdminLiveMap token={token} selectedDriverId={selectedDriverId} onSelectedDriverChange={setSelectedDriverId} onDriversChange={handleDriversChange} />
          <Link href="/admin/history" underline="hover" sx={{ display: "inline-block", mt: 2, fontWeight: 700 }}>View previous journeys by rider</Link>
        </Box>
      </Grid>
    </Grid>
    <Box sx={{ width: 300, display: { xs: "none", md: "block" } }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>Rider Details</Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "#cbd5e1" }}>Click on a rider to view their details.</Typography>
      {selectedDriverId ? (
        <Box sx={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 4, boxShadow: "0 25px 80px rgba(15, 23, 42, 0.6)", p: { xs: 2, md: 3 } }}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, color: "#f8fafc" }}>Rider ID: {selectedDriverId}</Typography>
          <Typography variant="body2" sx={{ color: "#cbd5e1" }}>More details about the selected rider can be displayed here.</Typography>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: "#cbd5e1" }}>No rider selected.</Typography>
      )}
    </Box>
  </Box>
  );
}
