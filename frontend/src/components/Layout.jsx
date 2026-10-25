import { useState } from "react";
import { Link as RouterLink, Outlet } from "react-router-dom";
import {
  AppBar, Box, ButtonBase, Container, Divider, ListItemIcon, Menu, MenuItem, Toolbar, Typography,
} from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { useAuth } from "../auth/AuthContext";
import UserAvatar from "./UserAvatar";

export default function Layout() {
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <WorkOutlinedIcon color="primary" sx={{ mr: 1 }} />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/applications"
            sx={{ flexGrow: 1, color: "inherit", textDecoration: "none", fontWeight: 600 }}
          >
            Mini ATS
          </Typography>
          <ButtonBase
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Menu du compte"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            sx={{ borderRadius: 6, pl: { sm: 1.5 }, pr: 0.5, py: 0.5, gap: 1.5, "&:hover": { bgcolor: "action.hover" } }}
          >
            {user && (
              <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" }, fontWeight: 500 }}>
                {user.full_name}
              </Typography>
            )}
            <UserAvatar user={user} size={36} />
          </ButtonBase>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={close}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 220 } } }}
          >
            {user && (
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2">{user.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              </Box>
            )}
            {user && <Divider />}
            <MenuItem component={RouterLink} to="/profile" onClick={close}>
              <ListItemIcon><PersonOutlinedIcon fontSize="small" /></ListItemIcon>
              Mon profil
            </MenuItem>
            <MenuItem onClick={() => { close(); logout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Déconnexion
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
