"use client";

import dynamic from "next/dynamic";
import { Box, Typography } from "@mui/material";
import { useAuthSession } from "@/lib/auth-session";
import { useAuthRedirect } from "@/lib/use-auth-guard";

const JourneyHistory = dynamic(() => import("@/lib/journey-history"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading journey history...</Typography>,
});

export default function AdminHistoryPage() {
  const { user, token } = useAuthSession();
  const authorized = user?.role === "admin" && Boolean(token);
  useAuthRedirect("admin", authorized);

  if (!authorized) {
    return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  }

  return <JourneyHistory token={token!} selectedDriverId="" />;
}