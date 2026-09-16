"use client";

import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import AuthPanel from "@/components/auth-panel";

export default function LoginPage() {
  const router = useRouter();

  return (
    <Box className="relative min-h-screen overflow-hidden bg-slate-950">
      <Box className="absolute inset-0 w-full">
        <video autoPlay muted loop playsInline className="h-full w-full object-cover opacity-70">
          <source src="/vids/animation.mp4" type="video/mp4" />
        </video>
        <Box className="absolute inset-0 bg-slate-950/75" />
      </Box>
      <Box className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <Box sx={{ width: "min(100%, 480px)" }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>Rider Operations</Typography>
          <Typography variant="body1" sx={{ mb: 3, color: "#cbd5e1" }}>Sign in to manage deliveries or track your route.</Typography>
          <AuthPanel
            user={null}
            onLogin={(user) => router.replace(user.role === "admin" ? "/admin" : "/driver")}
            onLogout={() => undefined}
          />
        </Box>
      </Box>
    </Box>
  );
}
