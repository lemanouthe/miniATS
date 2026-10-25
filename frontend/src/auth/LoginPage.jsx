import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: "", password: "" },
  });

  const from = location.state?.from?.pathname ?? "/applications";
  if (isAuthenticated) return <Navigate to={from} replace />;

  const onSubmit = async ({ email, password }) => {
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(
        e.response?.status === 401
          ? "E-mail ou mot de passe incorrect."
          : "Impossible de joindre le serveur. Réessayez dans un instant."
      );
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ alignItems: "center", mb: 3 }}>
            <WorkOutlinedIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5" component="h1">Mini ATS</Typography>
            <Typography variant="body2" color="text.secondary">Suivez vos candidatures</Typography>
          </Stack>
          <Stack component="form" spacing={2} onSubmit={handleSubmit(onSubmit)} noValidate>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              autoFocus
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              {...register("email", {
                required: "Champ obligatoire",
                pattern: { value: /^\S+@\S+\.\S+$/, message: "Adresse e-mail invalide" },
              })}
            />
            <TextField
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...register("password", { required: "Champ obligatoire" })}
            />
            <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
              Se connecter
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              Compte de démo : demo@example.com / demo12345
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
