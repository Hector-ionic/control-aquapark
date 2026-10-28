import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const AUDIT_ACTIONS = {
  LOGIN_EXITOSO: 'LOGIN_EXITOSO',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  RESTABLECER_PASSWORD: 'RESTABLECER_PASSWORD',
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
    return { success: false, error };
  }
}

/**
 * Suscripción en tiempo real a los últimos registros de auditoría.
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
 * Exporta logs a formato CSV optimizado para Excel en español (delimitado por punto y coma y BOM UTF-8).
 */
export function exportAuditLogsCSV(logs = []) {
  const headers = ['Fecha', 'Hora', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Detalle de Actividad', 'ID Referencia'];
  const rows = logs.map(l => [
    l.dateString || '',
    l.timeString || '',
    l.userName || '',
    (l.userRole || '').toUpperCase(),
    l.module || '',
    l.action || '',
    (l.details || '').replace(/\r?\n|\r/g, ' '),
    l.targetId || ''
  ]);

  // Usamos ';' como separador estándar para Excel en español y directiva sep=;
  const csvContent = 'sep=;\r\n' + [headers, ...rows]
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_aquapark_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta logs a formato Excel nativo (.xls) con diseño de tabla corporativa y estilos.
 */
export function exportAuditLogsExcel(logs = []) {
  const now = new Date();
  const fechaGeneracion = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES');

  const rowsHtml = logs.map((l, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${l.dateString || ''}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${l.timeString || ''}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 500;">${l.userName || 'Anónimo'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0369a1;">${(l.userRole || '').toUpperCase()}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${l.module || ''}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 500;">${l.action || ''}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${(l.details || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; color: #64748b;">${l.targetId || ''}</td>
      </tr>
    `;
  }).join('');

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Bitácora de Auditoría</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td colspan="8" style="font-size: 16pt; font-weight: bold; color: #0f172a; padding: 12px 0;">
            AQUAPARK CONTROL — BITÁCORA OFICIAL DE AUDITORÍA Y TRAZABILIDAD
          </td>
        </tr>
        <tr>
          <td colspan="8" style="font-size: 9pt; color: #64748b; padding-bottom: 12px;">
            Generado el: ${fechaGeneracion} | Total de registros: ${logs.length}
          </td>
        </tr>
        <thead>
          <tr style="background-color: #0284c7; color: #ffffff; font-weight: bold; text-align: left;">
            <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Fecha</th>
            <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Hora</th>
            <th style="padding: 10px; border: 1px solid #0369a1;">Usuario</th>
            <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Rol</th>
            <th style="padding: 10px; border: 1px solid #0369a1;">Módulo</th>
            <th style="padding: 10px; border: 1px solid #0369a1;">Acción</th>
            <th style="padding: 10px; border: 1px solid #0369a1;">Detalle de Actividad</th>
            <th style="padding: 10px; border: 1px solid #0369a1;">ID Referencia</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([`\uFEFF${excelTemplate}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_aquapark_${now.toISOString().split('T')[0]}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
