import { Avatar } from "@mui/material";

const initials = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).map((s) => s[0].toUpperCase()).join("") ||
  user?.email?.[0]?.toUpperCase() ||
  "?";

export default function UserAvatar({ user, size = 40, src, sx, ...props }) {
  return (
    <Avatar
      src={src ?? user?.avatar ?? undefined}
      alt={user?.full_name ?? ""}
      sx={{ width: size, height: size, fontSize: size * 0.4, bgcolor: "primary.main", ...sx }}
      {...props}
    >
      {initials(user)}
    </Avatar>
  );
}
