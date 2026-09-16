"use client";

import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { AppUser } from "@/lib/auth";
import { useAuthSession } from "@/lib/auth-session";
import { useDriverProfile } from "@/lib/driver-profile";
import { useAuthRedirect } from "@/lib/use-auth-guard";

function DriverProfileForm({ user }: { user: AppUser }) {
  const { profile, updateProfile } = useDriverProfile(user);
  const [name, setName] = useState(profile.name);
  const [vehicleNumber, setVehicleNumber] = useState(profile.vehicleNumber);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateProfile({
      name: name.trim() || user.name,
      vehicleNumber: vehicleNumber.trim(),
      phoneNumber: phoneNumber.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ display: "grid", gap: 2 }}>
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
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save changes
          </Button>
          {saved ? <Alert severity="success" sx={{ py: 0 }}>Saved. Applied to future journeys.</Alert> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DriverProfilePage() {
  const { user, token } = useAuthSession();
  const authorized = user?.role === "driver" && Boolean(token);
  useAuthRedirect("driver", authorized);

  if (!authorized || !user) {
    return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  }

  return (
    <Box sx={{ display: "grid", gap: 2, width: "100%", maxWidth: 640 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>
          Profile
        </Typography>
        <Typography variant="body1" sx={{ mb: 2, color: "#cbd5e1" }}>
          These details are attached to every journey you record.
        </Typography>
      </Box>

      <DriverProfileForm key={user.id} user={user} />
    </Box>
  );
}