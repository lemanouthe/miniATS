import { Controller, useForm } from "react-hook-form";
import { Alert, Button, InputAdornment, Stack, TextField } from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

const FIELDS = ["first_name", "last_name", "job_title", "phone", "location", "linkedin_url", "bio"];

const toFormValues = (user) => Object.fromEntries(FIELDS.map((k) => [k, user[k] ?? ""]));

const adornment = (Icon) => ({
  input: { startAdornment: <InputAdornment position="start"><Icon fontSize="small" /></InputAdornment> },
});

export default function ProfileForm({ user, onSubmit }) {
  const { control, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: toFormValues(user),
  });

  const submit = async (values) => {
    try {
      const updated = await onSubmit(values);
      reset(toFormValues(updated));
    } catch (e) {
      const data = e.response?.data;
      if (!data || typeof data !== "object") {
        setError("root", { message: "Erreur réseau : l'enregistrement a échoué." });
        return;
      }
      Object.entries(data).forEach(([name, msgs]) =>
        setError(FIELDS.includes(name) ? name : "root", { message: [].concat(msgs).join(" ") })
      );
    }
  };

  const field = (name, label, { rules, ...mui } = {}) => (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: f, fieldState }) => (
        <TextField
          {...f}
          id={`profile-${name}`}
          label={label}
          required={Boolean(rules?.required)}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? mui.helperText}
          fullWidth
          {...mui}
        />
      )}
    />
  );

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit(submit)} noValidate>
      {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {field("first_name", "Prénom", { rules: { required: "Champ obligatoire" } })}
        {field("last_name", "Nom", { rules: { required: "Champ obligatoire" } })}
      </Stack>
      <TextField
        label="E-mail"
        value={user.email}
        disabled
        fullWidth
        helperText="L'adresse e-mail sert d'identifiant et ne peut pas être modifiée."
        slotProps={adornment(EmailOutlinedIcon)}
      />
      {field("job_title", "Poste recherché", { placeholder: "Ex. Développeur full stack React / Django" })}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {field("phone", "Téléphone", { type: "tel", slotProps: adornment(PhoneOutlinedIcon) })}
        {field("location", "Ville", { slotProps: adornment(PlaceOutlinedIcon) })}
      </Stack>
      {field("linkedin_url", "Profil LinkedIn", {
        type: "url",
        placeholder: "https://www.linkedin.com/in/…",
        slotProps: adornment(LinkedInIcon),
      })}
      {field("bio", "Présentation", { multiline: true, minRows: 4, helperText: "1000 caractères maximum." })}
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button onClick={() => reset()} disabled={!isDirty || isSubmitting}>Annuler les modifications</Button>
        <Button type="submit" variant="contained" loading={isSubmitting} disabled={!isDirty}>Enregistrer</Button>
      </Stack>
    </Stack>
  );
}
