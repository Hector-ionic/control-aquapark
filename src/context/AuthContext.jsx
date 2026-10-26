import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

// Mapeo seguro de roles oficiales requeridos: 'admin' | 'encargado' | 'pasante'
const normalizeRole = (roleStr, email = '') => {
  if (!roleStr && email) {
    const cleanEmail = email.toLowerCase();
    if (cleanEmail.includes('admin')) return 'admin';
    if (cleanEmail.includes('encargado') || cleanEmail.includes('supervisor')) return 'encargado';
    return 'pasante';
  }

  const normalized = (roleStr || '').toLowerCase().trim();
  if (normalized === 'admin' || normalized === 'administrador') return 'admin';
  if (normalized === 'encargado' || normalized === 'supervisor') return 'encargado';
  return 'pasante';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'encargado' | 'pasante'
  const [loading, setLoading] = useState(true);

  // Escuchar cambios de sesión en Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Intentar obtener el rol y datos desde la colección 'users' en Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          let userRole = 'pasante';

          if (userDoc.exists()) {
            const data = userDoc.data();
            userRole = normalizeRole(data.role, firebaseUser.email);
          } else {
            // Si el usuario aún no tiene registro en Firestore, inferir rol y crearlo
            userRole = normalizeRole(null, firebaseUser.email);
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              role: userRole,
              createdAt: serverTimestamp()
            }, { merge: true });
          }

          setUser(firebaseUser);
          setRole(userRole);
        } catch (error) {
          console.error("Error al consultar el rol de usuario:", error);
          // Fallback seguro en caso de error de lectura
          const fallbackRole = normalizeRole(null, firebaseUser.email);
          setUser(firebaseUser);
          setRole(fallbackRole);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Iniciar sesión con email y contraseña
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  // Registrar un nuevo usuario (opcional para administración)
  const register = async (email, password, desiredRole = 'pasante', displayName = '') => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    if (displayName) {
      await updateProfile(newUser, { displayName });
    }

    const officialRole = normalizeRole(desiredRole, email);

    // Guardar en Firestore con el rol oficial
    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email: newUser.email,
      displayName: displayName || email.split('@')[0],
      role: officialRole,
      createdAt: serverTimestamp()
    });

    return newUser;
  };

  // Cerrar sesión
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const value = {
    user,
    role, // 'admin' | 'encargado' | 'pasante'
    loading,
    login,
    logout,
    register
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
