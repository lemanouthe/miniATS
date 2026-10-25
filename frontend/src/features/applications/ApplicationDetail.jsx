import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Divider, Grid, Link, Skeleton, Stack, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useNotify } from "../../components/Notifications";
import ApplicationFormDialog from "./ApplicationFormDialog";
import StatusSelect from "./StatusSelect";
import { formatDate } from "./constants";
import { useApplication, useDeleteApplication } from "./hooks";

function Info({ label, children }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Box>{children}</Box>
    </Grid>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const backTo = `/applications${location.state?.listSearch ?? ""}`;

  const { data: app, isLoading, isError, error, refetch } = useApplication(id);
  const remove = useDeleteApplication();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = () => {
    remove.mutate(app.id, {
      onSuccess: () => {
        notify("Candidature supprimée.");
        navigate(backTo, { replace: true });
      },
      onError: () => {
        setConfirmOpen(false);
        notify("La suppression a échoué.", "error");
      },
    });
  };

  const back = (
    <Button component={RouterLink} to={backTo} startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
      Retour à la liste
    </Button>
  );

  if (isLoading) {
    return (
      <Stack spacing={2}>
        {back}
        <Card variant="outlined"><CardContent>
          <Skeleton variant="text" width="40%" sx={{ fontSize: "2rem" }} />
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 2 }} />
        </CardContent></Card>
      </Stack>
    );
  }

  if (isError) {
    const notFound = error.response?.status === 404;
    return (
      <Stack spacing={2}>
        {back}
        <Alert
          severity={notFound ? "warning" : "error"}
          action={!notFound && <Button color="inherit" size="small" onClick={() => refetch()}>Réessayer</Button>}
        >
          {notFound ? "Cette candidature n'existe pas ou a été supprimée." : "Impossible de charger la candidature."}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {back}
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h4" component="h1">{app.position}</Typography>
              <Typography variant="h6" color="text.secondary">{app.company}</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)}>
                Modifier
              </Button>
              <Button color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setConfirmOpen(true)}>
                Supprimer
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3}>
            <Info label="Statut"><StatusSelect application={app} /></Info>
            <Info label="Date de candidature"><Typography>{formatDate(app.applied_at)}</Typography></Info>
            <Info label="Lien de l'offre">
              {app.job_url ? (
                <Link href={app.job_url} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, wordBreak: "break-all" }}>
                  Voir l'offre <OpenInNewIcon fontSize="inherit" />
                </Link>
              ) : <Typography color="text.secondary">—</Typography>}
            </Info>
            <Info label="Dernière modification"><Typography>{formatDate(app.updated_at)}</Typography></Info>
            <Grid size={12}>
              <Typography variant="overline" color="text.secondary">Notes</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }} color={app.notes ? "text.primary" : "text.secondary"}>
                {app.notes || "Aucune note."}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <ApplicationFormDialog open={editOpen} onClose={() => setEditOpen(false)} application={app} />
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer la candidature ?"
        message={`« ${app.position} » chez ${app.company} sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={onDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </Stack>
  );
}
