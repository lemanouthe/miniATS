import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, obtainToken } from "../api/auth";
import { tokenStorage } from "../api/client";

const AuthContext = createContext(null);
// eslint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(tokenStorage.access));
  const { data: user = null } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  const login = useCallback(async (email, password) => {
    tokenStorage.set(await obtainToken(email, password));
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    queryClient.clear();
    setIsAuthenticated(false);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  const value = useMemo(
    () => ({ isAuthenticated, user, login, logout }),
    [isAuthenticated, user, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
