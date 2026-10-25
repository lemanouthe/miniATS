import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

const NotifyContext = createContext(() => {});
// eslint-disable-next-line react/only-export-components
export const useNotify = () => useContext(NotifyContext);

export function NotificationsProvider({ children }) {
  const [current, setCurrent] = useState(null);

  const notify = useCallback((message, severity = "success") => {
    setCurrent({ message, severity, key: Date.now() });
  }, []);

  const close = (_, reason) => {
    if (reason !== "clickaway") setCurrent(null);
  };

  const value = useMemo(() => notify, [notify]);
  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={Boolean(current)}
        autoHideDuration={4000}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {current ? (
          <Alert onClose={close} severity={current.severity} variant="filled" sx={{ width: "100%" }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  );
}
