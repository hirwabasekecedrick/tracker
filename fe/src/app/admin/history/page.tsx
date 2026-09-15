"use client";

import dynamic from "next/dynamic";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import AuthenticatedShell from "@/components/authenticated-shell";
import { useAuthSession } from "@/lib/auth-session";

const JourneyHistory = dynamic(() => import("@/lib/journey-history"), {
  ssr: false,
  loading: () => <Typography variant="body2" color="text.secondary">Loading journey history...</Typography>,
});

export default function AdminHistoryPage() {
  const router = useRouter();
  const { user, token, ready, logout } = useAuthSession();

  if (!ready) return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  if (!user || user.role !== "admin" || !token) {
    router.replace("/login");
    return <Typography>Redirecting to login...</Typography>;
  }

  return (
    <AuthenticatedShell user={user} onLogout={() => { logout(); router.replace("/login"); }}>
      <JourneyHistory token={token} selectedDriverId="" />
    </AuthenticatedShell>
  );
}
