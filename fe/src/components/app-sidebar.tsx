"use client";

import HistoryIcon from "@mui/icons-material/History";
import MapIcon from "@mui/icons-material/Map";
import PersonIcon from "@mui/icons-material/Person";
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import type { AppUser } from "@/lib/auth";

type AppSidebarProps = {
  user: AppUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function NavigationItems({ user, onNavigate }: { user: AppUser; onNavigate?: () => void }) {
  const isAdmin = user.role === "admin";

  return (
    <List>
      <ListItemButton component="a" href={isAdmin ? "/admin" : "/driver"} onClick={onNavigate}>
        <ListItemIcon><MapIcon /></ListItemIcon>
        <ListItemText primary={isAdmin ? "Live console" : "My Console"} />
      </ListItemButton>
      {isAdmin ? (
        <ListItemButton component="a" href="/admin/history" onClick={onNavigate}>
          <ListItemIcon><HistoryIcon /></ListItemIcon>
          <ListItemText primary="Previous journeys" />
        </ListItemButton>
      ) : (
        <>
          <ListItemButton component="a" href="/driver/history" onClick={onNavigate}>
            <ListItemIcon><HistoryIcon /></ListItemIcon>
            <ListItemText primary="My journeys" />
          </ListItemButton>
          <ListItemButton component="a" href="/driver/profile" onClick={onNavigate}>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            <ListItemText primary="Profile" />
          </ListItemButton>
        </>
      )}
    </List>
  );
}

export default function AppSidebar({ user, mobileOpen, onMobileClose }: AppSidebarProps) {
  return (
    <>
      <Drawer open={mobileOpen} onClose={onMobileClose} sx={{ display: { xs: "block", md: "none" } }}>
        <Box sx={{ width: 260, p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Navigation</Typography>
          <NavigationItems user={user} onNavigate={onMobileClose} />
        </Box>
      </Drawer>

      <Box component="aside" sx={{ display: { xs: "none", md: "block" }, width: 240, flexShrink: 0, height: "100%", overflow: "hidden", p: 2, borderRight: "1px solid rgba(148, 163, 184, 0.18)" }}>
        <Typography variant="overline" sx={{ color: "#94a3b8", letterSpacing: 1.5 }}>Workspace</Typography>
        <NavigationItems user={user} />
      </Box>
    </>
  );
}
