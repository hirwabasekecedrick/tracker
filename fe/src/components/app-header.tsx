"use client";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { AppBar, Avatar, Box, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
import type { AppUser } from "@/lib/auth";

type AppHeaderProps = {
  user: AppUser;
  isAdmin: boolean;
  onMenuClick: () => void;
  onLogout: () => void;
};

export default function AppHeader({ user, isAdmin, onMenuClick, onLogout }: AppHeaderProps) {
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);

  const closeAccountMenu = () => setAccountMenuAnchor(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "rgba(8, 15, 30, 0.88)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton aria-label="Open navigation" color="inherit" onClick={onMenuClick} sx={{ display: { xs: "inline-flex", md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {isAdmin ? "Dispatch Console" : "Rider Operations"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
              {isAdmin ? "Fleet command center" : "Active delivery workspace"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.name}</Typography>
            <Typography variant="caption" sx={{ color: "#94a3b8", textTransform: "capitalize" }}>{user.role}</Typography>
          </Box>
          <IconButton aria-label="Open account menu" color="inherit" onClick={(event) => setAccountMenuAnchor(event.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#14b8a6", color: "#06201f" }}>
              {user.name ? user.name.charAt(0).toUpperCase() : <AccountCircleIcon />}
            </Avatar>
          </IconButton>
          <Menu anchorEl={accountMenuAnchor} open={Boolean(accountMenuAnchor)} onClose={closeAccountMenu}>
            <MenuItem disabled>{user.email}</MenuItem>
            <MenuItem onClick={() => { closeAccountMenu(); onLogout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
