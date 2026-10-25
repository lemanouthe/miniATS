import { createTheme } from "@mui/material";
import { frFR } from "@mui/material/locale";

export const theme = createTheme(
  {
    palette: {
      primary: { main: "#1f4fd8" },
      background: { default: "#f5f7fb" },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 700, fontSize: "1.75rem" },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiTableCell: { styleOverrides: { head: { fontWeight: 600 } } },
    },
  },
  frFR
);
