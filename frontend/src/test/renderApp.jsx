import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { NotificationsProvider } from "../components/Notifications";
import { theme } from "../theme";

export function renderApp(path = "/applications") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <NotificationsProvider>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider><App /></AuthProvider>
          </MemoryRouter>
        </NotificationsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
