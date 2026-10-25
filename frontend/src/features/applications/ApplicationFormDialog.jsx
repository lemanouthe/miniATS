import { Dialog, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import ApplicationForm from "./ApplicationForm";
import { useCreateApplication, useUpdateApplication } from "./hooks";
import { useNotify } from "../../components/Notifications";

// Création si `application` est absent, édition sinon.
export default function ApplicationFormDialog({ open, onClose, application, onCreated }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const notify = useNotify();
  const isEdit = Boolean(application);

  const onSubmit = async (values) => {
    if (isEdit) {
      await update.mutateAsync({ id: application.id, ...values });
      notify("Candidature mise à jour.");
    } else {
      const created = await create.mutateAsync(values);
      notify("Candidature ajoutée.");
      onCreated?.(created);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? "Modifier la candidature" : "Nouvelle candidature"}</DialogTitle>
      <DialogContent>
        {/* key : remonte le formulaire à chaque ouverture pour repartir des bonnes valeurs. */}
        {open && (
          <ApplicationForm
            key={application?.id ?? "new"}
            defaultValues={application}
            onSubmit={onSubmit}
            onCancel={onClose}
            submitLabel={isEdit ? "Enregistrer" : "Ajouter"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
