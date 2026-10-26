/**
 * Servicio de Notificaciones por Correo Electrónico (Microservicio Google Apps Script)
 * Permite despachar el reporte de actividades directamente al Gmail de los encargados/licenciados.
 */

const GOOGLE_SCRIPT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwdYYEiVap5uBPGjKfvPaLUWfeO1jdsLvuK41RsJN7h5nC3vo8DJRpiSqcc-zSSJdxm/exec';

/**
 * Envía los datos del reporte al microservicio de Google para despachar el correo vía Gmail.
 * Se ejecuta en segundo plano de manera no bloqueante.
 * @param {Object} reportData - Datos del informe registrado
 */
export async function sendReportEmail(reportData) {
  if (!GOOGLE_SCRIPT_WEBHOOK_URL) {
    console.warn('Webhook de Google no configurado.');
    return { success: false, message: 'URL no configurada' };
  }

  try {
    const payload = {
      student: reportData.student || 'Pasante',
      career: reportData.career || 'Sin especificar',
      institution: reportData.institution || 'Sin especificar',
      turno: reportData.turno || 'Sin especificar',
      supervisor: reportData.supervisorOriginal || reportData.supervisor || 'Encargado General',
      conclusion: reportData.conclusion || 'Sin conclusión registrada.',
      dateString: reportData.dateString || new Date().toLocaleDateString('es-ES'),
      timeStart: reportData.timeStart || '08:00',
      timeEnd: reportData.timeEnd || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      activities: (reportData.activities || []).map(act => ({
        description: act.description || '',
        fileUrl: act.fileUrl || '',
        fileName: act.fileName || '',
        fileType: act.fileType || ''
      }))
    };

    // Google Apps Script requiere text/plain en fetch para evitar bloqueos de pre-flight CORS
    await fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    console.log('Notificación por correo despachada exitosamente al microservicio de Google.');
    return { success: true };
  } catch (error) {
    console.error('Error al enviar notificación por correo mediante Google Apps Script:', error);
    // Retornamos sin romper el flujo principal
    return { success: false, error };
  }
}
