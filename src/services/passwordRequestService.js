import { 
  collection, addDoc, updateDoc, doc, serverTimestamp, 
  query, orderBy, onSnapshot, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_MODULES } from './auditService';
import { sendPasswordResetNotification } from './mailService';

const COLLECTION_NAME = 'password_requests';
const LOCAL_STORAGE_BACKUP = 'aquapark_password_requests_backup';

function getLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalBackup(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP, JSON.stringify(list));
    window.dispatchEvent(new Event('password_requests_changed'));
  } catch (e) {}
}

/**
 * Crea una nueva solicitud de restablecimiento y notifica por Gmail
 */
export async function createPasswordRequest({ name, email, role, requestedPassword }) {
  const now = new Date();
  const requestData = {
    name: name || 'Usuario',
    email: email.trim().toLowerCase(),
    role: role || 'pasante',
    requestedPassword: requestedPassword || 'Aqua#2026',
    status: 'pendiente', // 'pendiente' | 'aprobada' | 'rechazada'
    createdAt: serverTimestamp(),
    dateString: now.toLocaleDateString('es-ES'),
    timeString: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  };

  // 1. Guardar en Firestore
  let firestoreId = null;
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), requestData);
    firestoreId = docRef.id;
  } catch (err) {
    console.warn("No se pudo persistir en Firestore, usando almacenamiento local:", err);
  }

  // 2. Respaldo local
  const backup = getLocalBackup();
  const localItem = {
    ...requestData,
    id: firestoreId || ('req-' + Date.now()),
    createdAt: new Date().toISOString()
  };
  backup.unshift(localItem);
  saveLocalBackup(backup);

  // 3. Notificar al Gmail de Carlos (Admin)
  try {
    await sendPasswordResetNotification({
      name: requestData.name,
      email: requestData.email,
      role: requestData.role
    });
  } catch (e) {
    console.error("Error al despachar correo:", e);
  }

  return localItem;
}

/**
 * Escucha las solicitudes en tiempo real
 */
export function subscribeToPasswordRequests(callback) {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveLocalBackup(list);
        callback(list);
      } else {
        callback(getLocalBackup());
      }
    }, (err) => {
      console.warn("Fallo en snapshot de Firestore, leyendo respaldo local:", err);
      callback(getLocalBackup());
    });

    return unsubscribe;
  } catch (e) {
    callback(getLocalBackup());
    const handler = () => callback(getLocalBackup());
    window.addEventListener('password_requests_changed', handler);
    return () => window.removeEventListener('password_requests_changed', handler);
  }
}

/**
 * Aprobar y admitir la solicitud de contraseña
 */
export async function approvePasswordRequest({ requestId, userEmail, newPassword, adminName = 'Carlos Apaza' }) {
  const cleanEmail = userEmail.trim().toLowerCase();
  const cleanPassword = newPassword.trim();

  // 1. Actualizar en Firestore si existe
  try {
    const docRef = doc(db, COLLECTION_NAME, requestId);
    await updateDoc(docRef, {
      status: 'aprobada',
      resolvedBy: adminName,
      resolvedAt: serverTimestamp(),
      assignedPassword: cleanPassword
    });
  } catch (e) {
    console.warn("Aprobación local de solicitud:", e);
  }

  // 2. Actualizar en localStorage para que el usuario pueda hacer login con la nueva clave
  try {
    const PASSWORDS_STORAGE_KEY = 'aquapark_custom_passwords';
    const raw = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    const customPasswords = raw ? JSON.parse(raw) : {};
    customPasswords[cleanEmail] = cleanPassword;
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(customPasswords));
  } catch (e) {}

  // 3. Actualizar respaldo local
  const backup = getLocalBackup().map(req => 
    req.id === requestId 
      ? { ...req, status: 'aprobada', resolvedBy: adminName, assignedPassword: cleanPassword } 
      : req
  );
  saveLocalBackup(backup);

  // 4. Registrar en Auditoría
  logAuditEvent({
    action: AUDIT_ACTIONS.RESTABLECER_PASSWORD,
    module: AUDIT_MODULES.AUTH,
    details: `Solicitud de restablecimiento ADMITIDA Y APROBADA por el Administrador (${adminName}) para "${cleanEmail}". Clave habilitada.`,
    userName: adminName,
    userRole: 'admin'
  });

  return true;
}

/**
 * Rechazar solicitud de contraseña
 */
export async function rejectPasswordRequest({ requestId, userEmail, adminName = 'Carlos Apaza' }) {
  const cleanEmail = userEmail.trim().toLowerCase();

  try {
    const docRef = doc(db, COLLECTION_NAME, requestId);
    await updateDoc(docRef, {
      status: 'rechazada',
      resolvedBy: adminName,
      resolvedAt: serverTimestamp()
    });
  } catch (e) {}

  const backup = getLocalBackup().map(req => 
    req.id === requestId 
      ? { ...req, status: 'rechazada', resolvedBy: adminName } 
      : req
  );
  saveLocalBackup(backup);

  logAuditEvent({
    action: AUDIT_ACTIONS.LOGIN_FALLIDO,
    module: AUDIT_MODULES.AUTH,
    details: `Solicitud de restablecimiento RECHAZADA por el Administrador (${adminName}) para "${cleanEmail}".`,
    userName: adminName,
    userRole: 'admin'
  });

  return true;
}
