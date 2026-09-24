import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile, AppSettings } from '../types/models';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient';

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  category_assigned?: string;
}

interface AuthContextType {
  user: Profile | null;
  role: 'admin' | 'seleccionador';
  isLoading: boolean;
  users: Profile[];
  appSettings: AppSettings;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: (role: 'admin' | 'seleccionador') => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addUser: (data: RegisterData & { role?: 'admin' | 'seleccionador' }) => Profile;
  updateUser: (userId: string, data: Partial<Profile>) => void;
  toggleUserStatus: (userId: string) => void;
  deleteUser: (userId: string) => void;
  updateAppSettings: (newSettings: Partial<AppSettings>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lista inicial de usuarios predeterminados oficiales
const INITIAL_USERS: Profile[] = [
  {
    id: 'd5bfd350-8478-40a5-bda9-80bfc7e953bb',
    email: 'seleccio.castello.2026@gmail.com',
    password: 'castello.2026',
    full_name: 'Administrador FFCV Castelló',
    role: { id: 'r1', name: 'admin', description: 'Administrador principal' },
    is_active: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toLocaleDateString('es-ES') + ' 16:45h'
  },
  {
    id: 'bb640183-cd48-47ce-aa4d-730becd6e747',
    email: 'victorzanpra@gmail.com',
    password: 'castello.2026',
    full_name: 'Víctor Zandalinas',
    category_assigned: 'Infantil',
    role: { id: 'r2', name: 'seleccionador', description: 'Seleccionador Infantil FFCV' },
    is_active: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toLocaleDateString('es-ES') + ' 10:15h'
  },
  {
    id: 'fea9aa09-c9fd-489f-9bf1-61c64c1b1bfe',
    email: 'rtenacs@hotmail.com',
    password: 'castello.2026',
    full_name: 'Raúl Tena',
    category_assigned: 'Cadet',
    role: { id: 'r2', name: 'seleccionador', description: 'Seleccionador Cadet FFCV' },
    is_active: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toLocaleDateString('es-ES') + ' 09:30h'
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Selecció Valenciana Castelló Futbol',
  season: '2025/2026',
  allowPublicRegistration: true,
  maintenanceMode: false,
  categories: ['Sub-12', 'Sub-14', 'Sub-16', 'Sub-19', 'Femení Sub-15', 'Femení Sub-17']
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<Profile[]>(() => {
    const savedUsers = localStorage.getItem('app_users_db');
    if (!savedUsers) {
      localStorage.setItem('app_users_db', JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      const parsed: Profile[] = JSON.parse(savedUsers);
      // Filtrar usuarios de prueba antiguos ("Vicent Ribes", "Carles Beltrán", "Marc Soler", emails antiguos ficticios)
      const cleaned = parsed.filter(
        (u) =>
          u.full_name !== 'Vicent Ribes' &&
          u.full_name !== 'Carles Beltrán' &&
          u.full_name !== 'Marc Soler' &&
          u.email !== 'victorzandalinas@selecciocastello.val'
      );
      // Asegurar que Administrador, Victor y Raul están presentes
      INITIAL_USERS.forEach((initialUser) => {
        if (!cleaned.some((u) => u.email.toLowerCase() === initialUser.email.toLowerCase())) {
          cleaned.push(initialUser);
        }
      });
      localStorage.setItem('app_users_db', JSON.stringify(cleaned));
      return cleaned;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [user, setUser] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null; // Exigir login si no hay usuario activo
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const userEmail = session.user.email || '';
        const roleName = meta.role_name || (userEmail.includes('admin') ? 'admin' : 'seleccionador');

        const activeProfile: Profile = {
          id: session.user.id,
          email: userEmail,
          full_name: meta.full_name || userEmail.split('@')[0],
          category_assigned: meta.category_assigned || 'Sub-16',
          role: {
            id: roleName === 'admin' ? 'r1' : 'r2',
            name: roleName,
            description: roleName === 'admin' ? 'Administrador total' : 'Seleccionador del planter'
          },
          is_active: true,
          created_at: session.user.created_at || new Date().toISOString(),
          last_login: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };

        setUser(activeProfile);
        localStorage.setItem('auth_user', JSON.stringify(activeProfile));
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Guardar usuarios en localStorage cuando cambien
  const saveUsers = (newUsers: Profile[]) => {
    setUsers(newUsers);
    localStorage.setItem('app_users_db', JSON.stringify(newUsers));
  };

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const targetEmail = email.trim().toLowerCase();

    // 1. Intentar autenticación directa en la nube con Supabase Auth (solo si está configurado)
    if (isSupabaseConfigured()) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: password || ''
        });

        if (!authError && authData?.user) {
          const meta = authData.user.user_metadata || {};
          const roleName = meta.role_name || (targetEmail.includes('admin') ? 'admin' : 'seleccionador');

          const loggedUser: Profile = {
            id: authData.user.id,
            email: authData.user.email || targetEmail,
            password: password,
            full_name: meta.full_name || targetEmail.split('@')[0],
            category_assigned: meta.category_assigned || 'Sub-16',
            role: {
              id: roleName === 'admin' ? 'r1' : 'r2',
              name: roleName,
              description: roleName === 'admin' ? 'Administrador total' : 'Seleccionador del planter'
            },
            is_active: true,
            created_at: authData.user.created_at || new Date().toISOString(),
            last_login: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          };

          setUser(loggedUser);
          localStorage.setItem('auth_user', JSON.stringify(loggedUser));

          // Sincronizar en la lista local de usuarios
          setUsers((prev) => {
            const exists = prev.some((u) => u.email.toLowerCase() === targetEmail);
            const next = exists
              ? prev.map((u) => (u.email.toLowerCase() === targetEmail ? { ...u, ...loggedUser } : u))
              : [loggedUser, ...prev];
            localStorage.setItem('app_users_db', JSON.stringify(next));
            return next;
          });

          setIsLoading(false);
          return { success: true };
        }

        // Si Supabase devuelve error de credenciales explícito
        if (authError && authError.message.includes('Invalid login credentials')) {
          // Verificar si existe en la lista local con otra contraseña o modo demo
          const localMatch = users.find((u) => u.email.toLowerCase() === targetEmail);
          if (localMatch && localMatch.password === password) {
            const updatedUser: Profile = {
              ...localMatch,
              last_login: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            };
            setUser(updatedUser);
            localStorage.setItem('auth_user', JSON.stringify(updatedUser));
            setIsLoading(false);
            return { success: true };
          }
          setIsLoading(false);
          return { success: false, error: 'Contrasenya o correu electrònic incorrecte.' };
        }

        if (authError && authError.message.includes('Email not confirmed')) {
          setIsLoading(false);
          return { success: false, error: 'El compte està pendent de confirmació.' };
        }
      } catch (cloudErr) {
        console.warn('Supabase auth attempt offline/error, checking local storage:', cloudErr);
      }
    }

    // 2. Fallback local para usuarios locales / demo
    const foundUser = users.find((u) => u.email.toLowerCase() === targetEmail);

    if (!foundUser) {
      setIsLoading(false);
      return { success: false, error: 'El correu electrònic no està registrat.' };
    }

    if (!foundUser.is_active) {
      setIsLoading(false);
      return { success: false, error: 'Aquest compte està inactiu. Contacta amb l’administrador.' };
    }

    if (password && foundUser.password && foundUser.password !== password) {
      setIsLoading(false);
      return { success: false, error: 'La contrasenya és incorrecta.' };
    }

    const updatedUser: Profile = {
      ...foundUser,
      last_login: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));

    // Actualizar último acceso en BD local
    const updatedUsersList = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    saveUsers(updatedUsersList);

    setIsLoading(false);
    return { success: true };
  };

  const loginDemo = (roleName: 'admin' | 'seleccionador') => {
    setIsLoading(true);
    setTimeout(() => {
      const demoUser = users.find((u) => u.role?.name === roleName) || (roleName === 'admin' ? INITIAL_USERS[0] : INITIAL_USERS[1]);
      setUser(demoUser);
      localStorage.setItem('auth_user', JSON.stringify(demoUser));
      setIsLoading(false);
    }, 200);
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    if (!appSettings.allowPublicRegistration) {
      return { success: false, error: 'El registre públic de seleccionadors està desactivat actualment.' };
    }

    const emailTrim = data.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailTrim)) {
      return { success: false, error: 'Aquest correu electrònic ja està registrat en la plataforma.' };
    }

    setIsLoading(true);
    let userId: string = crypto.randomUUID();

    // Registrar en Supabase Auth en segundo plano
    try {
      const { data: signUpData } = await supabase.auth.signUp({
        email: emailTrim,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name.trim(),
            category_assigned: data.category_assigned || 'Sub-16',
            role_name: 'seleccionador'
          }
        }
      });
      if (signUpData?.user?.id) {
        userId = signUpData.user.id;
      }
    } catch (err) {
      console.warn('Supabase Auth signUp:', err);
    }

    const newUser: Profile = {
      id: userId,
      email: emailTrim,
      password: data.password,
      full_name: data.full_name.trim(),
      category_assigned: data.category_assigned || 'Sub-16',
      role: { id: 'r2', name: 'seleccionador', description: 'Seleccionador registrat' },
      is_active: true,
      created_at: new Date().toISOString(),
      last_login: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    const newUsersList = [newUser, ...users.filter((u) => u.email.toLowerCase() !== emailTrim)];
    saveUsers(newUsersList);
    setUser(newUser);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setIsLoading(false);

    return { success: true };
  };

  const addUser = (data: RegisterData & { role?: 'admin' | 'seleccionador' }): Profile => {
    const roleName = data.role || 'seleccionador';
    const emailTrim = data.email.trim().toLowerCase();
    const newUser: Profile = {
      id: crypto.randomUUID(),
      email: emailTrim,
      password: data.password || 'castello.2026',
      full_name: data.full_name.trim(),
      category_assigned: data.category_assigned || 'Sub-16',
      role: {
        id: roleName === 'admin' ? 'r1' : 'r2',
        name: roleName,
        description: roleName === 'admin' ? 'Administrador total' : 'Seleccionador del planter'
      },
      is_active: true,
      created_at: new Date().toISOString(),
      last_login: 'Sense accés encara'
    };

    // Registrar en Supabase Auth en segundo plano para que aparezca en el Dashboard de Supabase
    supabase.auth.signUp({
      email: emailTrim,
      password: data.password || 'castello.2026',
      options: {
        data: {
          full_name: data.full_name.trim(),
          category_assigned: data.category_assigned || 'Sub-16',
          role_name: roleName
        }
      }
    }).catch((err) => {
      console.warn('Supabase Auth signUp:', err);
    });

    const newUsersList = [newUser, ...users];
    saveUsers(newUsersList);
    return newUser;
  };

  const updateUser = (userId: string, data: Partial<Profile>) => {
    const newUsersList = users.map((u) => {
      if (u.id === userId) {
        return { ...u, ...data, updated_at: new Date().toISOString() };
      }
      return u;
    });
    saveUsers(newUsersList);
    if (user?.id === userId) {
      const updatedCurrentUser = { ...user, ...data };
      setUser(updatedCurrentUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedCurrentUser));
    }
  };

  const toggleUserStatus = (userId: string) => {
    const newUsersList = users.map((u) => {
      if (u.id === userId) {
        return { ...u, is_active: !u.is_active };
      }
      return u;
    });
    saveUsers(newUsersList);
  };

  const deleteUser = (userId: string) => {
    const newUsersList = users.filter((u) => u.id !== userId);
    saveUsers(newUsersList);
  };

  const updateAppSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...newSettings };
    setAppSettings(updated);
    localStorage.setItem('app_settings', JSON.stringify(updated));
  };

  const logout = () => {
    supabase.auth.signOut().catch(() => {});
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const role = user?.role?.name || 'seleccionador';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        users,
        appSettings,
        login,
        loginDemo,
        register,
        logout,
        addUser,
        updateUser,
        toggleUserStatus,
        deleteUser,
        updateAppSettings
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

