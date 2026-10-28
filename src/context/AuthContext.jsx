import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

// Directorio oficial de cuentas autorizadas en AquaPark Control
export const PREDEFINED_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Administrador General',
    email: 'admin@aquapark.com',
    aliases: ['admin', 'administrador', 'administrador general'],
    passwords: ['admin', 'AdminAquaPark#99'],
    role: 'admin',
    area: 'Dirección General'
  },
  {
    id: 'usr-encargado-01',
    name: 'Hector Calle',
    email: 'hector.calle@aquapark.com',
    aliases: ['hector calle', 'hector'],
    passwords: ['123', 'AquaPark#01'],
    role: 'encargado',
    area: 'Mantenimiento / Operaciones'
  },
  {
    id: 'usr-encargado-02',
    name: 'Lizeth de la Cruz',
    email: 'lizeth.delacruz@aquapark.com',
    aliases: ['lizeth de la cruz', 'lizeth'],
    passwords: ['123', 'AquaPark#02'],
    role: 'encargado',
    area: 'Recursos Humanos'
  },
  {
    id: 'usr-encargado-03',
    name: 'Alvaro Mendoza',
    email: 'alvaro.mendoza@aquapark.com',
    aliases: ['alvaro mendoza', 'alvaro'],
    passwords: ['123', 'AquaPark#04'],
    role: 'encargado',
    area: 'Sistemas e Informática'
  },
  {
    id: 'usr-encargado-04',
    name: 'Limbert Tito',
    email: 'limbert.tito@aquapark.com',
    aliases: ['limbert tito', 'limbert'],
    passwords: ['123', 'AquaPark#05'],
    role: 'encargado',
    area: 'Supervisión General'
  },
  {
    id: 'usr-encargado-05',
    name: 'Camila Alejo',
    email: 'camila.alejo@aquapark.com',
    aliases: ['camila alejo', 'camila'],
    passwords: ['123', 'AquaPark#06'],
    role: 'encargado',
    area: 'Atención al Cliente'
  },
  {
    id: 'usr-encargado-06',
    name: 'Yven Cardozo',
    email: 'yven.cardozo@aquapark.com',
    aliases: ['yven cardozo', 'yven'],
    passwords: ['123', 'AquaPark#07'],
    role: 'encargado',
    area: 'Seguridad y Logística'
  },
  {
    id: 'usr-encargado-07',
    name: 'Moises Ramos',
    email: 'moises.ramos@aquapark.com',
    aliases: ['moises ramos', 'moises'],
    passwords: ['123', 'AquaPark#08'],
    role: 'encargado',
    area: 'Finanzas y Caja'
  },
  {
    id: 'usr-pasante-01',
    name: 'Juan Pérez',
    email: 'juan.perez@aquapark.com',
    aliases: ['juan perez', 'juan pérez', 'juan'],
    passwords: ['123', 'pasante123'],
    role: 'pasante',
    area: 'Sistemas e Informática'
  },
  {
    id: 'usr-pasante-02',
    name: 'Carlos Apaza',
    email: 'carlos.apaza@aquapark.com',
    aliases: ['carlos apaza', 'carlos'],
    passwords: ['123', 'pasante123'],
    role: 'pasante',
    area: 'Sistemas e Informática'
  }
];

const STORAGE_KEY = 'aquapark_auth_session';
const PASSWORDS_STORAGE_KEY = 'aquapark_custom_passwords';

const getCustomPasswords = () => {
  try {
    const raw = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

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

  // 2. Iniciar sesión en Frontend con validación estricta de credenciales y rol
  const login = ({ email, password, role: selectedRole }) => {
    const inputIdentifier = (email || '').trim().toLowerCase();
    const inputPassword = (password || '').trim();
    const targetRole = selectedRole ? selectedRole.trim().toLowerCase() : null;

    // 1. Buscar si el usuario existe por correo o por alias
    const userFound = PREDEFINED_USERS.find(u => 
      u.email.toLowerCase() === inputIdentifier || 
      (u.aliases && u.aliases.some(alias => alias.toLowerCase() === inputIdentifier))
    );

    if (!userFound) {
      throw new Error(`Usuario o correo "${email}" no registrado en el sistema.`);
    }

    // 2. Validar contraseña
    const isPasswordValid = userFound.passwords 
      ? userFound.passwords.includes(inputPassword) 
      : userFound.password === inputPassword;

    if (!isPasswordValid) {
      throw new Error('Contraseña incorrecta. Verifica tus datos de acceso.');
    }

    // 3. VALIDACIÓN ESTRICTA DE ROL (seguridad: impide que un pasante ingrese como encargado o admin)
    if (targetRole && userFound.role.toLowerCase() !== targetRole) {
      const rolNombres = {
        admin: 'Administrador',
        encargado: 'Encargado',
        pasante: 'Pasante'
      };
      const rolReal = rolNombres[userFound.role] || userFound.role;
      const rolIntento = rolNombres[targetRole] || targetRole;
      
      throw new Error(`Acceso denegado: Tu cuenta (${userFound.name}) es de nivel "${rolReal}". No tienes permisos para ingresar como "${rolIntento}".`);
    }

    const sessionData = {
      id: userFound.id,
      name: userFound.name,
      email: userFound.email,
      role: userFound.role,
      area: userFound.area,
      loginAt: new Date().toISOString()
    };

    // Guardar en estado y en localStorage
    setUser(sessionData);
    setRole(sessionData.role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));

    return sessionData;
  };


  // Función para restablecer contraseña de usuario
  const resetPassword = ({ email, newPassword }) => {
    const inputIdentifier = (email || '').trim().toLowerCase();
    const cleanPassword = (newPassword || '').trim();

    if (!cleanPassword || cleanPassword.length < 4) {
      throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
    }

    const userFound = PREDEFINED_USERS.find(u => 
      u.email.toLowerCase() === inputIdentifier || 
      (u.aliases && u.aliases.some(alias => alias.toLowerCase() === inputIdentifier))
    );

    if (!userFound) {
      throw new Error(`El usuario o correo "${email}" no está registrado en el sistema.`);
    }

    const customPasswords = getCustomPasswords();
    customPasswords[userFound.id] = cleanPassword;
    customPasswords[userFound.email.toLowerCase()] = cleanPassword;
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(customPasswords));

    return userFound;
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
    resetPassword,
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
