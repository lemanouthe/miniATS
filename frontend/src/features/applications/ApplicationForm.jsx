import { Controller, useForm } from "react-hook-form";
import { Alert, Button, MenuItem, Stack, TextField } from "@mui/material";
import { STATUSES } from "./constants";

const EMPTY = {
  company: "", position: "", status: "to_apply",
  job_url: "", applied_at: "", notes: "",
};

// L'API renvoie null pour les champs vides ; un TextField contrôlé attend "".
const toFormValues = (data = {}) =>
  Object.fromEntries(Object.entries(EMPTY).map(([k, v]) => [k, data[k] ?? v]));

const FIELD_OPTIONS = {
  company: { label: "Entreprise", rules: { required: "Champ obligatoire" } },
  position: { label: "Poste", rules: { required: "Champ obligatoire" } },
  status: {
    label: "Statut",
    mui: {
      select: true,
      children: STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>),
    },
  },
  job_url: { label: "Lien de l'offre", mui: { type: "url", placeholder: "https://…" } },
  applied_at: {
    label: "Date de candidature",
    mui: { type: "date", slotProps: { inputLabel: { shrink: true } } },
  },
  notes: { label: "Notes", mui: { multiline: true, minRows: 3 } },
};

/**
 * onSubmit doit renvoyer une promesse (mutateAsync) : c'est son rejet
 * qui permet d'afficher les erreurs de validation renvoyées par DRF.
 */
export default function ApplicationForm({ defaultValues, onSubmit, onCancel, submitLabel = "Enregistrer" }) {
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: toFormValues(defaultValues),
  });

  const submit = async (values) => {
    try {
      await onSubmit({ ...values, applied_at: values.applied_at || null });
    } catch (e) {
      const data = e.response?.data;
      if (!data || typeof data !== "object") {
        setError("root", { message: "Erreur réseau : l'enregistrement a échoué." });
        return;
      }
      Object.entries(data).forEach(([name, msgs]) => {
        const message = [].concat(msgs).join(" ");
        // non_field_errors, detail… : pas de champ correspondant, on les affiche en haut.
        setError(name in EMPTY ? name : "root", { message });
      });
    }
  };

  const renderField = (name) => {
    const { label, rules, mui } = FIELD_OPTIONS[name];
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            id={`application-${name}`}
            label={label}
            required={Boolean(rules?.required)}
            error={Boolean(fieldState.error)}
            helperText={fieldState.error?.message}
            fullWidth
            {...mui}
          />
        )}
      />
    );
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit(submit)} noValidate sx={{ pt: 1 }}>
      {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {renderField("company")}
        {renderField("position")}
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {renderField("status")}
        {renderField("applied_at")}
      </Stack>
      {renderField("job_url")}
      {renderField("notes")}
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        {onCancel && <Button onClick={onCancel} disabled={isSubmitting}>Annuler</Button>}
        <Button type="submit" variant="contained" loading={isSubmitting}>{submitLabel}</Button>
      </Stack>
    </Stack>
  );
}
