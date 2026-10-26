import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

// Cuentas predeterminadas para pruebas rápidas en Frontend
export const PREDEFINED_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Administrador General',
    email: 'admin@aquapark.com',
    password: 'admin',
    role: 'admin',
    area: 'Dirección General'
  },
  {
    id: 'usr-encargado-01',
    name: 'Hector Calle',
    email: 'hector.calle@aquapark.com',
    password: '123',
    role: 'encargado',
    area: 'Supervisión de Pasantes'
  },
  {
    id: 'usr-encargado-02',
    name: 'Lizeth de la Cruz',
    email: 'lizeth.delacruz@aquapark.com',
    password: '123',
    role: 'encargado',
    area: 'Recursos Humanos'
  },
  {
    id: 'usr-pasante-01',
    name: 'Juan Pérez (Pasante)',
    email: 'juan.perez@aquapark.com',
    password: '123',
    role: 'pasante',
    area: 'Sistemas e Informática'
  }
];

const STORAGE_KEY = 'aquapark_auth_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'encargado' | 'pasante'
  const [loading, setLoading] = useState(true);

  // 1. Cargar sesión persistida en localStorage al montar la app (resistente a F5)
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.role) {
          setUser(parsed);
          setRole(parsed.role);
        }
      }
    } catch (err) {
      console.error("Error al leer sesión de localStorage:", err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Iniciar sesión en Frontend y persistir en localStorage
  const login = ({ email, password, role: selectedRole, name }) => {
    // Buscar si coincide con alguna cuenta predeterminada
    const cleanEmail = (email || '').trim().toLowerCase();
    const existing = PREDEFINED_USERS.find(
      u => u.email.toLowerCase() === cleanEmail && u.password === password
    );

    let sessionData;

    if (existing) {
      sessionData = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role, // 'admin' | 'encargado' | 'pasante'
        area: existing.area,
        loginAt: new Date().toISOString()
      };
    } else {
      // Si el usuario introduce sus propios datos personalizados
      const assignedRole = selectedRole || (cleanEmail.includes('admin') ? 'admin' : cleanEmail.includes('encargado') ? 'encargado' : 'pasante');
      sessionData = {
        id: `usr-${Date.now()}`,
        name: name || cleanEmail.split('@')[0] || 'Usuario AquaPark',
        email: cleanEmail || 'usuario@aquapark.com',
        role: assignedRole,
        area: assignedRole === 'admin' ? 'Administración' : assignedRole === 'encargado' ? 'Supervisión' : 'Pasante',
        loginAt: new Date().toISOString()
      };
    }

    // Guardar en estado y en localStorage
    setUser(sessionData);
    setRole(sessionData.role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));

    return sessionData;
  };

  // 3. Inicio de sesión rápido con un clic (perfiles demo)
  const quickLogin = (predefinedUser) => {
    const sessionData = {
      id: predefinedUser.id,
      name: predefinedUser.name,
      email: predefinedUser.email,
      role: predefinedUser.role,
      area: predefinedUser.area,
      loginAt: new Date().toISOString()
    };

    setUser(sessionData);
    setRole(sessionData.role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));

    return sessionData;
  };

  // 4. Cerrar sesión y limpiar localStorage
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setRole(null);
  };

  const value = {
    user,
    role, // 'admin' | 'encargado' | 'pasante'
    loading,
    login,
    quickLogin,
    logout,
    predefinedUsers: PREDEFINED_USERS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
