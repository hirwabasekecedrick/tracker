"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { authStorage, type AppUser } from "@/lib/auth";

const DEMO_ACCOUNTS = [
  { email: "admin@tracker.app", password: "admin123", role: "admin", label: "Admin account" },
  { email: "driver@tracker.app", password: "driver123", role: "driver", label: "Driver account" },
];

type AuthPanelProps = {
  onLogin: (user: AppUser, token: string) => void;
  onLogout: () => void;
  user: AppUser | null;
};

export default function AuthPanel({ onLogin, onLogout, user }: AuthPanelProps) {
  const [email, setEmail] = useState("driver@tracker.app");
  const [password, setPassword] = useState("driver123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.hostname}:4000`
          : "http://localhost:4000");

      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      authStorage.save(data.user, data.token);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <Card sx={{ borderRadius: 3, background: "rgba(15, 23, 42, 0.8)" }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700 }}>
              Logged in as {user.name}
            </Typography>
            <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
              {user.email}
            </Typography>
            <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
              Role: {user.role}
            </Typography>
            <Button variant="outlined" color="error" onClick={onLogout}>
              Logout
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: 3, background: "rgba(15, 23, 42, 0.8)" }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700 }}>
            Login to tracker
          </Typography>

          <TextField
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            select
            label="Demo account"
            value={email}
            onChange={(event) => {
              const selected = DEMO_ACCOUNTS.find((account) => account.email === event.target.value);
              if (!selected) return;
              setEmail(selected.email);
              setPassword(selected.password);
            }}
            size="small"
            fullWidth
          >
            {DEMO_ACCOUNTS.map((account) => (
              <MenuItem key={account.email} value={account.email}>
                {account.label}
              </MenuItem>
            ))}
          </TextField>

          {error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : null}

          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
