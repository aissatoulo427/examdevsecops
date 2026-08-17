import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearToken, readStoredToken, signIn as demanderConnexion, storeToken } from './authService';

type AuthValue = {
  token: string | null;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // L'état React fait autorité ; sessionStorage ne sert qu'à survivre à un
  // rafraîchissement de page et n'est relu qu'au montage.
  const [token, setToken] = useState<string | null>(() => readStoredToken());

  const signIn = useCallback(async (username: string, password: string) => {
    const nouveau = await demanderConnexion(username, password);
    storeToken(nouveau);
    setToken(nouveau);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
  }, []);

  const valeur = useMemo<AuthValue>(
    () => ({ token, isAuthenticated: token !== null, signIn, signOut }),
    [token, signIn, signOut],
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const valeur = useContext(AuthContext);
  if (valeur === undefined) {
    throw new Error('useAuth doit être utilisé à l’intérieur d’un AuthProvider.');
  }
  return valeur;
}
