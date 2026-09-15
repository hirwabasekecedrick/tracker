"use client";

import { useState } from "react";
import { Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { authStorage, type AppUser } from "@/lib/auth";

type AuthPanelProps = {
  onLogin: (user: AppUser, token: string) => void;
  onLogout: () => void;
  user: AppUser | null;
};

export default function AuthPanel({ onLogin, onLogout, user }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL;

      if (!apiBase) {
        throw new Error("NEXT_PUBLIC_API_URL is required");
      }

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
    return null;
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
