import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { getDatabase } from '@/src/database/database';
import { ensureCommonFoods } from '@/src/database/foodRepository';
import { getProfileForUser } from '@/src/database/profileRepository';
import {
  ensureLocalUsers,
  listUsers,
  setActiveUser,
  type LocalUser,
} from '@/src/database/userRepository';
import type { Profile } from '@/src/types/profile';

type AppDataContextValue = {
  ready: boolean;
  authenticated: boolean;
  error: string | null;
  revision: number;
  profile: Profile | null;
  users: LocalUser[];
  activeUserId: number | null;
  refresh: () => Promise<void>;
  login: (userId: number) => Promise<void>;
  logout: () => void;
};

let bootstrapInFlight: Promise<LocalUser[]> | null = null;

const initializeLocalData = async (): Promise<LocalUser[]> => {
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    console.log('[MacroMind] Paso 1: abrir base de datos');
    await getDatabase();

    console.log('[MacroMind] Paso 2: cargar alimentos');
    await ensureCommonFoods();

    console.log('[MacroMind] Paso 3: preparar usuarios');
    await ensureLocalUsers();

    console.log('[MacroMind] Paso 4: listar usuarios');
    const nextUsers = await listUsers();
    console.log('[MacroMind] Usuarios encontrados:', nextUsers.length);
    return nextUsers;
  })().finally(() => {
    bootstrapInFlight = null;
  });

  return bootstrapInFlight;
};

const AppDataContext = createContext<AppDataContextValue>({
  ready: false,
  authenticated: false,
  error: null,
  revision: 0,
  profile: null,
  users: [],
  activeUserId: null,
  refresh: async () => undefined,
  login: async () => undefined,
  logout: () => undefined,
});

export function AppDataProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const sessionRef = useRef<{ authenticated: boolean; userId: number | null }>({ authenticated: false, userId: null });
  const loginInFlight = useRef<Promise<void> | null>(null);

  const loadUsers = useCallback(async (): Promise<void> => {
    try {
      const nextUsers = await initializeLocalData();
      setUsers(nextUsers);
      setReady(true);
      setError(null);
    } catch (cause) {
      setReady(false);
      console.error(
        '[MacroMind] Error cargando datos:',
        cause
      );

      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo abrir la base de datos'
      );
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, [loadUsers]);

  const refresh = useCallback(async (): Promise<void> => {
    setRevision((current) => current + 1);

    await loadUsers();

    const session = sessionRef.current;
    if (!session.authenticated || session.userId === null) {
      return;
    }

    try {
      const nextProfile = await getProfileForUser(session.userId);
      if (!sessionRef.current.authenticated || sessionRef.current.userId !== session.userId) return;
      setProfile(nextProfile);
    } catch (cause) {
      console.error(
        '[MacroMind] Error actualizando el perfil:',
        cause
      );

      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo actualizar el perfil'
      );
    }
  }, [loadUsers]);

  const login = useCallback(
    async (userId: number): Promise<void> => {
      if (sessionRef.current.authenticated && sessionRef.current.userId === userId) return;
      if (loginInFlight.current) return loginInFlight.current;

      const operation = (async () => {
      try {
        await setActiveUser(userId);

        const nextProfile = await getProfileForUser(userId);
        const nextUsers = await listUsers();

        sessionRef.current = { authenticated: true, userId };
        setActiveUserId(userId);
        setProfile(nextProfile);
        setUsers(nextUsers);
        setAuthenticated(true);
        setError(null);
        setRevision((current) => current + 1);

        console.log(
          '[MacroMind] Sesión iniciada para el usuario:',
          userId
        );
      } catch (cause) {
        console.error(
          '[MacroMind] Error al iniciar sesión:',
          cause
        );

        throw cause;
      }
      })();

      const guardedOperation = operation.finally(() => {
        if (loginInFlight.current === guardedOperation) loginInFlight.current = null;
      });
      loginInFlight.current = guardedOperation;
      return guardedOperation;
    }, []);

  const logout = useCallback((): void => {
    sessionRef.current = { authenticated: false, userId: null };
    setAuthenticated(false);
    setActiveUserId(null);
    setProfile(null);

    console.log('[MacroMind] Sesión cerrada');
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      error,
      revision,
      profile,
      users,
      activeUserId,
      refresh,
      login,
      logout,
    }),
    [
      ready,
      authenticated,
      error,
      revision,
      profile,
      users,
      activeUserId,
      refresh,
      login,
      logout,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = (): AppDataContextValue =>
  useContext(AppDataContext);
