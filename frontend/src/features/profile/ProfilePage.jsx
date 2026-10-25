import { Link as RouterLink } from "react-router-dom";
import { Button, Card, CardContent, Grid, Skeleton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAuth } from "../../auth/AuthContext";
import { useNotify } from "../../components/Notifications";
import AvatarUploader from "./AvatarUploader";
import ProfileForm from "./ProfileForm";
import { useUpdateMe } from "./hooks";

export default function ProfilePage() {
  const { user } = useAuth();
  const update = useUpdateMe();
  const notify = useNotify();

  const onSubmit = async (values) => {
    const updated = await update.mutateAsync(values);
    notify("Profil mis à jour.");
    return updated;
  };

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} to="/applications" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
        Retour à l'accueil
      </Button>
      <Typography variant="h4" component="h1">Mon profil</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 4 }}>
              {user ? <AvatarUploader user={user} /> : (
                <Stack spacing={2} sx={{ alignItems: "center" }}>
                  <Skeleton variant="circular" width={120} height={120} />
                  <Skeleton width="60%" />
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
              {user ? <ProfileForm key={user.id} user={user} onSubmit={onSubmit} /> : <Skeleton variant="rectangular" height={360} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
