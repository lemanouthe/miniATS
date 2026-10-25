import { useRef } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import UserAvatar from "../../components/UserAvatar";
import { useNotify } from "../../components/Notifications";
import { useRemoveAvatar, useUploadAvatar } from "./hooks";

const MAX_SIZE = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function AvatarUploader({ user }) {
  const inputRef = useRef(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const notify = useNotify();
  const busy = upload.isPending || remove.isPending;

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de resélectionner le même fichier
    if (!file) return;
    // Vérification côté client pour un retour immédiat ; le serveur revalide.
    if (!ACCEPTED.includes(file.type)) return notify("Format accepté : JPG, PNG, WebP ou GIF.", "error");
    if (file.size > MAX_SIZE) return notify("La photo ne doit pas dépasser 2 Mo.", "error");
    upload.mutate(file, {
      onSuccess: () => notify("Photo mise à jour."),
      onError: (err) => notify(err.response?.data?.avatar?.[0] ?? "L'envoi de la photo a échoué.", "error"),
    });
  };

  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => notify("Photo retirée."),
      onError: () => notify("La photo n'a pas pu être retirée.", "error"),
    });

  return (
    <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
      <Box sx={{ position: "relative" }}>
        <UserAvatar user={user} size={120} />
        {busy && (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.6)" }}>
            <CircularProgress size={32} />
          </Box>
        )}
      </Box>
      <Box>
        <Typography variant="h6">{user.full_name}</Typography>
        {user.job_title && <Typography color="text.secondary">{user.job_title}</Typography>}
      </Box>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} hidden onChange={onFile} data-testid="avatar-input" />
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" startIcon={<PhotoCameraOutlinedIcon />} onClick={() => inputRef.current.click()} disabled={busy}>
          {user.avatar ? "Changer la photo" : "Ajouter une photo"}
        </Button>
        {user.avatar && (
          <Button color="error" onClick={onRemove} disabled={busy}>Retirer</Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">JPG, PNG, WebP ou GIF, 2 Mo maximum.</Typography>
    </Stack>
  );
}
