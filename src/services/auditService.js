import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const AUDIT_ACTIONS = {
  LOGIN_EXITOSO: 'LOGIN_EXITOSO',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  LOGOUT: 'LOGOUT',
  CREAR_REPORTE: 'CREAR_REPORTE',
  ACTUALIZAR_ESTADO: 'ACTUALIZAR_ESTADO',
  ARCHIVAR_REPORTE: 'ARCHIVAR_REPORTE',
  RESTAURAR_REPORTE: 'RESTAURAR_REPORTE',
  ELIMINAR_REPORTE: 'ELIMINAR_REPORTE',
  DESCARGAR_PDF: 'DESCARGAR_PDF',
  EXPORTAR_CSV: 'EXPORTAR_CSV',
  ACCESO_DASHBOARD: 'ACCESO_DASHBOARD'
};

export const AUDIT_MODULES = {
  AUTH: 'Autenticación',
  REPORTES: 'Reportes Pasantes',
  SUPERVISION: 'Panel Supervisión',
  SISTEMA: 'Sistema General'
};

/**
 * Registra un nuevo evento en la bitácora de auditoría en Firestore.
 * @param {Object} params
 * @param {string} params.action - Acción ejecutada (de AUDIT_ACTIONS)
 * @param {string} params.module - Módulo donde ocurrió (de AUDIT_MODULES)
 * @param {string} params.details - Resumen explicativo del evento
 * @param {string} [params.targetId] - ID del documento o recurso afectado
 * @param {string} [params.userName] - Nombre del usuario responsable
 * @param {string} [params.userRole] - Rol ('admin', 'encargado', 'pasante')
 * @param {string} [params.userId] - Identificador único de usuario
 * @param {Object} [params.metadata] - Datos adicionales útiles
 */
export async function logAuditEvent({
  action,
  module = AUDIT_MODULES.SISTEMA,
  details = '',
  targetId = null,
  userName = 'Usuario Anónimo',
  userRole = 'pasante',
  userId = null,
  metadata = {}
}) {
  try {
    const now = new Date();
    const auditData = {
      action,
      module,
      details,
      targetId: targetId || null,
      userName: userName || 'Usuario Anónimo',
      userRole: (userRole || 'pasante').toLowerCase(),
      userId: userId || null,
      metadata: metadata || {},
      createdAt: serverTimestamp(),
      isoDate: now.toISOString(),
      dateString: now.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      timeString: now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), auditData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error registrando evento de auditoría:', error);
    // No bloqueamos la ejecución principal de la app si la auditoría falla
    return { success: false, error };
  }
}

/**
 * Suscripción en tiempo real a los últimos registros de auditoría.
 * @param {Function} callback - Función que recibe los logs actualizados
 * @param {number} maxLogs - Cantidad máxima de registros a traer (default: 200)
 */
export function subscribeToAuditLogs(callback, maxLogs = 200) {
  try {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('createdAt', 'desc'),
      limit(maxLogs)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(logs);
    }, (error) => {
      console.error('Error en listener de auditoría:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error al suscribir a logs de auditoría:', error);
    callback([]);
    return () => {};
  }
}

/**
 * Exporta un arreglo de logs a formato CSV descargable.
 * @param {Array} logs - Lista de registros
 */
export function exportAuditLogsCSV(logs = []) {
  const headers = ['Fecha', 'Hora', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Detalle', 'ID Objetivo'];
  const rows = logs.map(l => [
    l.dateString || '',
    l.timeString || '',
    l.userName || '',
    (l.userRole || '').toUpperCase(),
    l.module || '',
    l.action || '',
    l.details || '',
    l.targetId || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bitacora_auditoria_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
