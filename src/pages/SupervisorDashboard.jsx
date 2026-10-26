import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mail, Key, Search, FileText, Eye, EyeOff, LogOut, Loader, Image as ImageIcon, 
  Link as LinkIcon, FileDown, Trash2, BarChart3, Download, Clock, Sun, Moon, 
  ArrowLeft, CheckCircle, AlertTriangle, AlertCircle, ShieldCheck, RefreshCw,
  Building2, GraduationCap, UserCheck, Calendar, Sparkles, Check, FileSpreadsheet, Users, UserPlus, X
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import StudentForm from './StudentForm';
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_MODULES } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { 
  getSupervisors, deleteSupervisor, restoreSupervisor, 
  toggleSupervisorActive, addSupervisor 
} from '../services/supervisorService';

const USERS = {
  'hector calle': { role: 'Encargado', password: 'AquaPark#01', displayName: 'Hector Calle' },
  'lizeth de la cruz': { role: 'Encargado', password: 'AquaPark#02', displayName: 'Lizeth de la Cruz' },
  'alvaro mendoza': { role: 'Encargado', password: 'AquaPark#04', displayName: 'Alvaro Mendoza' },
  'limbert tito': { role: 'Encargado', password: 'AquaPark#05', displayName: 'Limbert Tito' },
  'camila alejo': { role: 'Encargado', password: 'AquaPark#06', displayName: 'Camila Alejo' },
  'yven cardozo': { role: 'Encargado', password: 'AquaPark#07', displayName: 'Yven Cardozo' },
  'moises ramos': { role: 'Encargado', password: 'AquaPark#08', displayName: 'Moises Ramos' },
  'administrador': { role: 'Administrador', password: 'AdminAquaPark#99', displayName: 'Administrador' }
};

class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
          <h2 style={{ color: 'var(--error)' }}>Error al renderizar el reporte</h2>
          <p>Ocurrió una excepción al procesar los datos de este informe.</p>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 'var(--radius-sm)', overflowX: 'auto', fontSize: '0.8rem', color: '#fca5a5' }}>
            {this.state.error?.toString()}
          </pre>
          <button className="btn btn-secondary" onClick={this.props.onReset} style={{ marginTop: '1rem' }}>
            Volver a la Bandeja
          </button>        </div>
      );
    }
    return this.props.children;
  }
}

export default function SupervisorDashboard() {
  const { user: authUser, role: authRole } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState(() => getSupervisors(true));
  const [newStaff, setNewStaff] = useState({ name: '', area: '' });
  const [staffFilter, setStaffFilter] = useState('activos');

  const handleDeleteSupervisor = (sup) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${sup.name}? Ya no aparecerá en el formulario de nuevos reportes, pero todos sus reportes pasados y registros históricos permanecerán 100% intactos.`)) {
      const updated = deleteSupervisor(sup.id);
      setStaffList(updated);
      toast.success(`${sup.name} eliminado de la lista activa. Sus reportes pasados siguen guardados.`);
    }
  };

  const handleRestoreSupervisor = (sup) => {
    const updated = restoreSupervisor(sup.id);
    setStaffList(updated);
    toast.success(`${sup.name} ha sido reincorporado y vuelve a estar disponible.`);
  };

  const handleAddSupervisor = (e) => {
    e.preventDefault();
    if (!newStaff.name.trim()) return;
    addSupervisor(newStaff);
    setStaffList(getSupervisors(true));
    setNewStaff({ name: '', area: '' });
    toast.success(`Nuevo encargado ${newStaff.name} registrado con éxito.`);
  };

  // Sincronizar automáticamente la sesión global de AuthContext con el Dashboard
  useEffect(() => {
    if (authUser) {
      const isAdm = authRole === 'admin';
      setCurrentUser({
        id: isAdm ? 'administrador' : (authUser.name?.toLowerCase().trim() || 'encargado'),
        role: isAdm ? 'Administrador' : 'Encargado',
        displayName: authUser.name || (isAdm ? 'Administrador General' : 'Encargado')
      });
    }
  }, [authUser, authRole]);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [view, setView] = useState('inbox');
  
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterTurno, setFilterTurno] = useState('Todos');
  const [filterMonth, setFilterMonth] = useState('');
  const [isDeletingOld, setIsDeletingOld] = useState(false);
  
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Analytics
  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString('es-ES');
    const todayReports = reports.filter(r => r.dateString === today);
    const manana = reports.filter(r => r.turno === 'Mañana').length;
    const tarde = reports.filter(r => r.turno === 'Tarde').length;
    const jornada = reports.filter(r => r.turno === 'Jornada Completa').length;
    return { total: reports.length, today: todayReports.length, manana, tarde, jornada };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports
      .filter(r => showTrash ? r.isDeleted === true : (r.isDeleted !== true))
      .filter(r => (r.student?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (r.career?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
      .filter(r => filterTurno === 'Todos' || r.turno === filterTurno)
      .filter(r => {
        if (!filterMonth) return true;
        if (!r.createdAt) return true; 
        const date = r.createdAt.toDate ? r.createdAt.toDate() : new Date();
        const reportMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return reportMonth === filterMonth;
      });
  }, [reports, searchTerm, filterTurno, showTrash, filterMonth]);

  // Excel Export (.xls corporativo)
  const exportExcel = () => {
    if (filteredReports.length === 0) {
      toast.error("No hay reportes para exportar con los filtros actuales");
      return;
    }

    const now = new Date();
    const fechaGen = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES');

    const rowsHtml = filteredReports.map((r, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusColor = r.status === 'Aprobado' ? '#16a34a' : (r.status === 'Observado' ? '#ea580c' : '#2563eb');
      const actDesc = (r.activities?.map((a, i) => `[${i + 1}] ${a.description || ''}`).join(' | ')) || 'Sin actividades';

      return `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${statusColor};">${r.status || 'Nuevo'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${r.student || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${r.career || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${r.institution || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${r.turno || 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${r.dateString || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${r.timeStart || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${r.timeEnd || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${actDesc.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${(r.conclusion || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>
      `;
    }).join('');

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Reportes de Supervisión</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheet>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      </head>
      <body style="font-family: Arial, sans-serif;">
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td colspan="10" style="font-size: 16pt; font-weight: bold; color: #0284c7; padding: 12px 0;">
              AQUAPARK CONTROL — BITÁCORAS DE ACTIVIDADES DE PASANTES
            </td>
          </tr>
          <tr>
            <td colspan="10" style="font-size: 9pt; color: #64748b; padding-bottom: 12px;">
              Supervisor: ${currentUser?.displayName || 'Encargado'} | Fecha de emisión: ${fechaGen} | Total registros: ${filteredReports.length}
            </td>
          </tr>
          <thead>
            <tr style="background-color: #0284c7; color: #ffffff; font-weight: bold; text-align: left;">
              <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Estado</th>
              <th style="padding: 10px; border: 1px solid #0369a1;">Estudiante / Pasante</th>
              <th style="padding: 10px; border: 1px solid #0369a1;">Carrera</th>
              <th style="padding: 10px; border: 1px solid #0369a1;">Institución</th>
              <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Turno</th>
              <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">Fecha</th>
              <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">H. Inicio</th>
              <th style="padding: 10px; border: 1px solid #0369a1; text-align: center;">H. Envío</th>
              <th style="padding: 10px; border: 1px solid #0369a1;">Actividades Registradas</th>
              <th style="padding: 10px; border: 1px solid #0369a1;">Conclusión General</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([`\uFEFF${template}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes_supervision_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bitácora descargada en formato Excel (.xls)");

    logAuditEvent({
      action: AUDIT_ACTIONS.EXPORTAR_CSV,
      module: AUDIT_MODULES.SUPERVISION,
      details: `Exportación de ${filteredReports.length} reportes de supervisión a formato Excel (.xls).`,
      userName: currentUser?.displayName || 'Encargado',
      userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado',
      metadata: { totalExportados: filteredReports.length, turnoFiltro: filterTurno, mesFiltro: filterMonth || 'Todos', formato: 'XLS' }
    });
  };

  // CSV Export
  const exportCSV = () => {
    const headers = ['Nombre', 'Carrera', 'Institución', 'Turno', 'Fecha', 'Hora Inicio', 'Hora Envío', 'Actividades', 'Conclusión'];
    const rows = filteredReports.map(r => [
      r.student || '',
      r.career || '',
      r.institution || '',
      r.turno || 'N/A',
      r.dateString || '',
      r.timeStart || '',
      r.timeEnd || '',
      (r.activities?.map(a => a.description).join(' | ')) || '',
      r.conclusion || ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes_aquapark_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo CSV generado exitosamente");
    logAuditEvent({
      action: AUDIT_ACTIONS.EXPORTAR_CSV,
      module: AUDIT_MODULES.SUPERVISION,
      details: `Exportación de ${filteredReports.length} reportes a formato CSV.`,
      userName: currentUser?.displayName || 'Encargado',
      userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado',
      metadata: { totalExportados: filteredReports.length, turnoFiltro: filterTurno, mesFiltro: filterMonth || 'Todos' }
    });
  };

  const handleDownloadFile = async (e, url, fileName) => {
    e.preventDefault();
    let safeUrl = url;
    if (safeUrl.includes('cloudinary.com')) {
      safeUrl = safeUrl.replace(/fl_attachment(:[^/]*)?\//g, '');
      safeUrl = safeUrl.replace(/\/fl_attachment\//g, '/');
    }

    try {
      const response = await fetch(safeUrl);
      if (!response.ok) throw new Error('Error al descargar el archivo');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      window.open(safeUrl, '_blank');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const userKey = loginData.username.toLowerCase().trim();
    const userObj = USERS[userKey];

    if (userObj && userObj.password === loginData.password) {
      setCurrentUser({ id: userKey, ...userObj });
      setError('');
      toast.success(`Bienvenido(a), ${userObj.displayName}`);
      logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_EXITOSO,
        module: AUDIT_MODULES.AUTH,
        details: `Inicio de sesión exitoso como ${userObj.role} (${userObj.displayName}).`,
        userName: userObj.displayName,
        userRole: userObj.role === 'Administrador' ? 'admin' : 'encargado',
        userId: userKey
      });
    } else {
      setError('Credenciales incorrectas. Verifica tu usuario y contraseña.');
      logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FALLIDO,
        module: AUDIT_MODULES.AUTH,
        details: `Intento de acceso fallido para el usuario "${userKey || 'Desconocido'}".`,
        userName: userKey || 'Desconocido',
        userRole: 'desconocido',
        metadata: { intentoUsuario: userKey }
      });
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    
    setIsLoading(true);
    const userObj = USERS[currentUser.id] || {};
    const isGlobalAdmin = userObj.role === 'Administrador';
    
    let q;
    if (isGlobalAdmin) {
      q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(1000));
    } else {
      q = query(collection(db, "reports"), where("supervisor", "==", currentUser.id));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedReports = [];
      const isGlobalAdmin = (USERS[currentUser.id] || {}).role === 'Administrador';

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dbSupervisor = (data.supervisor || '').toLowerCase().trim();
        if (!isGlobalAdmin && dbSupervisor !== currentUser.id) return;

        if (data.turno === 'Mañana' || data.turno === 'Jornada Completa') data.timeStart = '08:00';
        else if (data.turno === 'Tarde') data.timeStart = '14:00';
        fetchedReports.push({ id: doc.id, ...data });
      });
      
      fetchedReports.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setReports(fetchedReports);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching real-time reports:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation();
    if (window.confirm("¿Deseas archivar este reporte? Podrás consultarlo en la sección de Archivados.")) {
      try {
        await updateDoc(doc(db, "reports", reportId), { isDeleted: true });
        setReports(reports.map(r => r.id === reportId ? { ...r, isDeleted: true } : r));
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(null);
        }
        toast.success("Reporte archivado");
        logAuditEvent({
          action: AUDIT_ACTIONS.ARCHIVAR_REPORTE,
          module: AUDIT_MODULES.SUPERVISION,
          details: `Reporte de ${selectedReport.student} archivado/enviado a papelera.`,
          targetId: selectedReport.id,
          userName: currentUser?.displayName || 'Encargado',
          userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado'
        });
      } catch (err) {
        console.error("Error al archivar:", err);
        toast.error("Hubo un error al archivar el reporte.");
      }
    }
  };

  const handleRestoreReport = async (reportId, e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "reports", reportId), { isDeleted: false });
      setReports(reports.map(r => r.id === reportId ? { ...r, isDeleted: false } : r));
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, isDeleted: false });
      }
      toast.success("Reporte restaurado a la bandeja principal");
      logAuditEvent({
        action: AUDIT_ACTIONS.RESTAURAR_REPORTE,
        module: AUDIT_MODULES.SUPERVISION,
        details: `Reporte de ${selectedReport.student} restaurado a la bandeja activa.`,
        targetId: selectedReport.id,
        userName: currentUser?.displayName || 'Encargado',
        userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado'
      });
    } catch (err) {
      console.error("Error restaurando:", err);
      toast.error("Hubo un error al restaurar el reporte.");
    }
  };

  const handleUpdateStatus = async (reportId, newStatus, e) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, "reports", reportId), { status: newStatus });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
      toast.success(`Estado actualizado a: ${newStatus}`);
      logAuditEvent({
        action: AUDIT_ACTIONS.ACTUALIZAR_ESTADO,
        module: AUDIT_MODULES.SUPERVISION,
        details: `Estado del reporte de ${selectedReport.student} cambiado a "${newStatus}".`,
        targetId: reportId,
        userName: currentUser?.displayName || 'Encargado',
        userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado'
      });
    } catch (err) {
      console.error("Error al actualizar estado:", err);
      toast.error("Hubo un error al actualizar el estado.");
    }
  };

  const handleMassDeleteOldReports = async () => {
    if (!window.confirm("¡ATENCIÓN! Esto eliminará DEFINITIVAMENTE todos los reportes de meses anteriores al actual. ¿Deseas continuar?")) return;
    
    setIsDeletingOld(true);
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let deletedCount = 0;
    
    for (const report of reports) {
      if (!report.createdAt) continue;
      const rDate = report.createdAt.toDate ? report.createdAt.toDate() : new Date();
      const reportMonth = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (reportMonth !== currentMonth) {
        try {
          await deleteDoc(doc(db, "reports", report.id));
          deletedCount++;
        } catch (e) {
          console.error("Error al eliminar reporte", report.id, e);
        }
      }
    }
    
    setIsDeletingOld(false);
    toast.success(`Limpieza completada: ${deletedCount} reportes antiguos depurados.`);
    logAuditEvent({
      action: AUDIT_ACTIONS.ELIMINAR_REPORTE,
      module: AUDIT_MODULES.SUPERVISION,
      details: `Depuración masiva de fin de mes: ${deletedCount} reportes antiguos eliminados.`,
      userName: currentUser?.displayName || 'Administrador',
      userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado',
      metadata: { reportesEliminados: deletedCount }
    });
  };

  const exportPDF = () => {
    setIsGeneratingPDF(true);
    const element = document.getElementById('supervisor-pdf-formal-template');
    
    const opt = {
      margin:       0.5,
      filename:     `Comprobante_${selectedReport.student || 'Reporte'}_${(selectedReport.dateString || '').replace(/\//g, '-')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    element.style.display = 'block';

    html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none';
      setIsGeneratingPDF(false);
      toast.success("Comprobante en PDF descargado");
      logAuditEvent({
        action: AUDIT_ACTIONS.DESCARGAR_PDF,
        module: AUDIT_MODULES.SUPERVISION,
        details: `Comprobante PDF generado para el reporte de ${selectedReport.student || 'Estudiante'}.`,
        targetId: selectedReport.id,
        userName: currentUser?.displayName || 'Encargado',
        userRole: (currentUser?.role === 'Administrador') ? 'admin' : 'encargado'
      });
    });
  };

  // VISTA 1: LOGIN ADMINISTRATIVO
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh', padding: '1rem' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.25rem' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: 'var(--radius-md)', 
              background: 'var(--primary-light)', color: 'var(--primary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', border: '1px solid var(--accent-glow)'
            }}>
              <ShieldCheck size={28} />
            </div>
            <h2 style={{ marginBottom: '0.35rem', fontSize: '1.4rem' }}>Portal de Supervisión</h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Acceso exclusivo para Encargados de Área y Administración
            </p>
          </div>
          
          {error && (
            <div style={{ 
              background: 'var(--error-bg)', border: '1px solid var(--error-border)', 
              color: 'var(--error)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', 
              marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' 
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label><Mail size={14} color="var(--primary)" /> Selecciona tu Perfil</label>
              <select 
                required
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
              >
                <option value="" disabled>Selecciona tu cuenta...</option>
                <option value="hector calle">Hector Calle (Encargado)</option>
                <option value="lizeth de la cruz">Lizeth de la Cruz (Encargada)</option>
                <option value="alvaro mendoza">Alvaro Mendoza (Encargado)</option>
                <option value="limbert tito">Limbert Tito (Encargado)</option>
                <option value="camila alejo">Camila Alejo (Encargada)</option>
                <option value="yven cardozo">Yven Cardozo (Encargado)</option>
                <option value="moises ramos">Moises Ramos (Encargado)</option>
                <option value="administrador">Administrador General</option>
              </select>
            </div>
            
            <div className="input-group">
              <label><Key size={14} color="var(--primary)" /> Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  placeholder="Introduce tu contraseña"
                  value={loginData.password}
                  onChange={e => setLoginData({...loginData, password: e.target.value})}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem'
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
              <ShieldCheck size={18} />
              Iniciar Sesión
            </button>
          </form>

          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
              AquaPark Corporate Platform • Seguridad SSL
            </span>
          </div>
        </div>
    </div>
  );
}

  // VISTA 2: DETALLE DEL REPORTE SELECCIONADO
  if (selectedReport) {
    return (
      <ReportErrorBoundary onReset={() => setSelectedReport(null)}>
        <div className="animate-fade-in glass-panel" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* PLANTILLA PDF OCULTA PARA COMPROBANTE */}
          <div id="supervisor-pdf-formal-template" style={{ display: 'none', background: 'white', color: 'black', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '15px', marginBottom: '20px' }}>
              <h1 style={{ color: '#0369a1', margin: '0 0 6px 0', fontSize: '22px' }}>COMPROBANTE OFICIAL DE REPORTE</h1>
              <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>Control AquaPark — Sistema de Aprobación de Actividades</p>
            </div>

            <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold', width: '30%' }}>Fecha y Horario:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                    {selectedReport.dateString} | Inicio: {selectedReport.timeStart || 'N/A'} — Cierre: {selectedReport.timeEnd || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Remitente:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{selectedReport.student || 'Sin especificar'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Carrera / Institución:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{selectedReport.career || '-'} / {selectedReport.institution || '-'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Encargado Destino:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{selectedReport.supervisorOriginal || selectedReport.supervisor}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Turno:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{selectedReport.turno || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Estado Actual:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: selectedReport.status === 'Aprobado' ? '#10b981' : '#f59e0b' }}>
                    {selectedReport.status || 'Nuevo'}
                  </td>
                </tr>
              </tbody>
            </table>

            <h2 style={{ color: '#0369a1', fontSize: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>Actividades Ejecutadas</h2>
            {selectedReport.activities?.map((act, idx) => (
              <div key={idx} style={{ marginBottom: '16px', pageBreakInside: 'avoid', borderBottom: '1px dashed #e2e8f0', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', margin: '8px 0 4px 0' }}>{idx + 1}. Tarea Ejecutada:</h3>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px', lineHeight: '1.5' }}>{act.description || 'Sin descripción'}</p>
                {act.link && (
                  <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}><strong>Referencia digital:</strong> {act.link}</p>
                )}
                {act.fileName && (
                  <p style={{ margin: 0, fontSize: '12px' }}><strong>Evidencia adjunta:</strong> {act.fileName}</p>
                )}
              </div>
            ))}

            <div style={{ marginTop: '24px', pageBreakInside: 'avoid' }}>
              <h2 style={{ color: '#0369a1', fontSize: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>Conclusión del Remitente</h2>
              <p style={{ fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '12px', borderLeft: '4px solid #0284c7' }}>
                {selectedReport.conclusion || 'Sin conclusión proporcionada.'}
              </p>
            </div>
            
            <div style={{ marginTop: '45px', display: 'flex', justifyContent: 'space-around', pageBreakInside: 'avoid' }}>
              <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '8px' }}>
                <strong style={{ fontSize: '12px' }}>Firma del Remitente</strong><br/>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{selectedReport.student}</span>
              </div>
              <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '8px' }}>
                <strong style={{ fontSize: '12px' }}>Sello y Firma Encargado</strong><br/>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{selectedReport.supervisorOriginal || 'Aprobado'}</span>
              </div>
            </div>
          </div>

          {/* BARRA SUPERIOR DE ACCIONES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
            <button onClick={() => setSelectedReport(null)} className="btn btn-secondary">
              <ArrowLeft size={16} /> Volver a la Bandeja
            </button>
            
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button onClick={exportPDF} disabled={isGeneratingPDF} className="btn btn-primary">
                {isGeneratingPDF ? <Loader className="animate-spin" size={16} /> : <FileDown size={16} />}
                Descargar Comprobante PDF
              </button>
            </div>
          </div>
          
          {/* HEADER DEL REPORTE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem' }}>{selectedReport.student}</h2>
                {selectedReport.status === 'Aprobado' && <span className="badge badge-success">Aprobado</span>}
                {selectedReport.status === 'Observado' && <span className="badge badge-warning">Observado</span>}
                {(!selectedReport.status || selectedReport.status === 'Nuevo') && <span className="badge badge-primary">Nuevo</span>}
                {selectedReport.isDeleted && <span className="badge badge-neutral">Archivado</span>}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GraduationCap size={15} color="var(--primary)" /> {selectedReport.career}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={15} color="var(--primary)" /> {selectedReport.institution}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} color="var(--primary)" /> {selectedReport.dateString}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={15} color="var(--primary)" /> {selectedReport.turno} ({selectedReport.timeStart || '--'} → {selectedReport.timeEnd || '--'})
                </span>
              </div>
            </div>

            {/* BOTONES DE CAMBIO DE ESTADO */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={(e) => handleUpdateStatus(selectedReport.id, 'Aprobado', e)} 
                className="btn" 
                style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', padding: '0.55rem 0.95rem' }}
              >
                <CheckCircle size={16} /> Aprobar
              </button>
              <button 
                onClick={(e) => handleUpdateStatus(selectedReport.id, 'Observado', e)} 
                className="btn" 
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)', padding: '0.55rem 0.95rem' }}
              >
                <AlertCircle size={16} /> Observar
              </button>
              {selectedReport.isDeleted ? (
                <button onClick={(e) => handleRestoreReport(selectedReport.id, e)} className="btn btn-secondary" style={{ padding: '0.55rem 0.95rem' }}>
                  <RefreshCw size={16} /> Restaurar
                </button>
              ) : (
                <button onClick={(e) => handleDeleteReport(selectedReport.id, e)} className="btn btn-danger" style={{ padding: '0.55rem 0.95rem' }}>
                  <Trash2 size={16} /> Archivar
                </button>
              )}
            </div>
          </div>

          {/* LISTA DE ACTIVIDADES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Actividades Realizadas ({selectedReport.activities?.length || 0})</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedReport.activities?.map((act, i) => {
                const isImage = act.fileType === 'image' || (!act.fileType && (act.imageBase64 || act.fileUrl));
                const isDoc = act.fileType === 'pdf' || act.fileType === 'word';
                const isVideo = act.fileType === 'video';
                const fileSource = act.fileUrl || act.fileBase64 || act.imageBase64;
                const fileName = act.fileName || `Evidencia_Tarea_${i + 1}`;

                return (
                  <div key={i} className="glass-card" style={{ padding: '1.25rem', background: 'var(--surface-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span className="badge badge-primary">Tarea #{i + 1}</span>
                      {act.link && (
                        <a href={act.link} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                          <LinkIcon size={14} /> Abrir Enlace
                        </a>
                      )}
                    </div>
                    
                    <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                      {act.description}
                    </p>
                    
                    {/* PREVIEWS DE ARCHIVO */}
                    {isImage && fileSource && (
                      <div style={{ marginTop: '1rem', padding: '0.65rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Evidencia Fotográfica:</span>
                          <a href={fileSource} onClick={(e) => handleDownloadFile(e, fileSource, `${fileName}.jpg`)} className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}>
                            <FileDown size={14} /> Descargar Imagen
                          </a>
                        </div>
                        <img src={fileSource} alt={`Evidencia ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '4px' }} />
                      </div>
                    )}

                    {isDoc && fileSource && (
                      <div style={{ marginTop: '0.85rem', padding: '0.85rem 1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <FileText size={22} color="var(--primary)" />
                          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{fileName}</span>
                        </div>
                        <a href={fileSource} onClick={(e) => handleDownloadFile(e, fileSource, fileName)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
                          <FileDown size={15} /> Descargar
                        </a>
                      </div>
                    )}

                    {isVideo && fileSource && (
                      <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '0.85rem' }}>Video Adjunto:</p>
                        <video controls src={fileSource} style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '4px' }}>
                          Tu navegador no soporta video.
                        </video>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONCLUSIÓN */}
          <div style={{ background: 'var(--surface-secondary)', padding: '1.35rem', border: '1px solid var(--surface-border)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--primary)', fontSize: '0.95rem' }}>Conclusión de la Jornada</h4>
            <p style={{ margin: 0, color: 'var(--text-main)', fontStyle: 'italic', fontSize: '0.92rem' }}>
              "{selectedReport.conclusion}"
            </p>
          </div>

        </div>
      </ReportErrorBoundary>
    );
  }

  // VISTA 3: REDACCIÓN DE INFORME PARA ENCARGADO
  if (view === 'compose') {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Redactar Informe Gerencial</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Este informe será emitido directamente a la Administración Central.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => setView('inbox')}>
            <ArrowLeft size={16} /> Volver a Bandeja
          </button>
        </div>
        <StudentForm isEncargadoMode={true} encargadoName={currentUser.displayName} onCancel={() => setView('inbox')} />
      </div>
    );
  }

  // VISTA 4: BANDEJA PRINCIPAL DE SUPERVISIÓN
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* HEADER DE BIENVENIDA */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-primary">
              <ShieldCheck size={13} /> {currentUser.role}
            </span>
            <span className="badge badge-neutral">Sesión Activa</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Panel de {currentUser.displayName}
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Monitoreo en tiempo real de actividades y reportes asignados.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {currentUser.role !== 'Administrador' && (
            <button className="btn btn-primary" onClick={() => setView('compose')}>
              <FileText size={16} /> Redactar Informe
            </button>
          )}
{currentUser.role === 'Administrador' && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setStaffList(getSupervisors(true));
                setShowStaffModal(true);
              }} 
              title="Gestionar altas, bajas y eliminación de encargados"
            >
              <Users size={16} color="var(--primary)" /> Gestión de Encargados
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={exportExcel} 
            style={{ 
              background: '#16a34a', 
              borderColor: '#15803d', 
              color: '#ffffff', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem' 
            }}
            title="Descargar todos los reportes formateados en Microsoft Excel (.xls)"
          >
            <FileSpreadsheet size={16} /> Descargar Excel
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} title="Descargar histórico en CSV / Excel">
            <Download size={16} /> Exportar CSV
          </button>
          <button className="btn btn-danger" onClick={() => setCurrentUser(null)} title="Cerrar sesión de supervisor">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </div>

      {/* ALERTA DE FIN DE MES (SOLO ADMIN) */}
      {currentUser?.role === 'Administrador' && new Date().getDate() >= 25 && (
        <div style={{ 
          background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', 
          padding: '1.15rem', borderRadius: 'var(--radius-md)', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' 
        }}>
          <div>
            <h4 style={{ color: 'var(--warning)', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <AlertTriangle size={18} /> Cierre mensual próximo
            </h4>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem' }}>
              Se sugiere descargar el consolidado en CSV antes de ejecutar la limpieza periódica de la base de datos.
            </p>
          </div>
          <button onClick={handleMassDeleteOldReports} disabled={isDeletingOld} className="btn btn-solid-warning" style={{ padding: '0.55rem 1rem' }}>
            {isDeletingOld ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />} 
            Limpieza Mensual
          </button>
        </div>
      )}

      {/* ANALYTICS PANEL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Reportes
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={16} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'JetBrains Mono, monospace' }}>
            {stats.total}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ingresados Hoy
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="var(--success)" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace' }}>
            {stats.today}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Turno Mañana
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sun size={16} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
            {stats.manana}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Turno Tarde
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Moon size={16} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#8b5cf6', fontFamily: 'JetBrains Mono, monospace' }}>
            {stats.tarde}
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Bitácoras Recibidas</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Mostrando {filteredReports.length} {filteredReports.length === 1 ? 'registro' : 'registros'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* BUSCADOR */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Buscar por nombre o carrera..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.4rem', fontSize: '0.85rem', padding: '0.55rem 0.75rem 0.55rem 2.25rem' }}
              />
            </div>

            {/* FILTRO MES */}
            <input 
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              title="Filtrar por mes"
              style={{ width: 'auto', padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
            />

            {/* FILTRO TURNO */}
            <select 
              value={filterTurno} 
              onChange={(e) => setFilterTurno(e.target.value)}
              style={{ width: 'auto', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
            >
              <option value="Todos">Todos los Turnos</option>
              <option value="Mañana">Turno Mañana</option>
              <option value="Tarde">Turno Tarde</option>
              <option value="Jornada Completa">Jornada Completa</option>
            </select>

            {/* BOTÓN PAPELERA */}
            <button 
              onClick={() => setShowTrash(!showTrash)} 
              className={`btn ${showTrash ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
              title="Ver reportes archivados"
            >
              <Trash2 size={15} /> {showTrash ? 'Viendo Archivados' : 'Archivados'}
            </button>

          </div>
        </div>

        {/* CONTENIDO DE LA LISTA */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 0', gap: '0.75rem' }}>
            <Loader className="animate-spin" size={32} color="var(--primary)" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Sincronizando reportes con la base de datos...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            <FileText size={40} color="var(--text-subtle)" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No hay reportes para mostrar</p>
            <span style={{ fontSize: '0.82rem' }}>
              {reports.length === 0 ? 'Aún no se han recibido registros en este buzón.' : 'Prueba cambiando los filtros de búsqueda.'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredReports.map(report => {
              const isNew = report.createdAt ? (Math.abs(new Date() - (report.createdAt.toDate ? report.createdAt.toDate() : new Date())) / 36e5) < 24 : false;
              const turnoBorder = report.turno === 'Mañana' ? '#f59e0b' : report.turno === 'Tarde' ? '#8b5cf6' : 'var(--primary)';

              return (
                <div 
                  key={report.id} 
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '1rem 1.25rem', background: 'var(--surface)', 
                    border: '1px solid var(--surface-border)',
                    borderLeft: `4px solid ${turnoBorder}`,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedReport(report)}
                  className="glass-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div style={{ 
                      width: '42px', height: '42px', borderRadius: '50%', 
                      background: 'var(--primary-light)', color: 'var(--primary)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1rem'
                    }}>
                      {(report.student || 'U')[0].toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{report.student}</h4>
                        {(!report.status || report.status === 'Nuevo') && isNew && (
                          <span className="badge badge-primary">Nuevo</span>
                        )}
                        {report.status === 'Aprobado' && (
                          <span className="badge badge-success">Aprobado</span>
                        )}
                        {report.status === 'Observado' && (
                          <span className="badge badge-warning">Observado</span>
                        )}
                        {report.turno && (
                          <span className="badge badge-neutral">{report.turno}</span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '0.6rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                        <span>{report.career}</span>
                        <span>•</span>
                        <span>{report.dateString}</span>
                        <span>•</span>
                        <span>{report.timeStart || '--'} → {report.timeEnd || '--'}</span>
                        <span>•</span>
                        <span>{report.activities?.length || 0} tareas</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedReport(report)} 
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                    >
                      <Eye size={15} /> Ver Detalle
                    </button>
                    {report.isDeleted ? (
                      <button 
                        className="btn btn-secondary" 
                        onClick={(e) => handleRestoreReport(report.id, e)} 
                        style={{ padding: '0.45rem 0.65rem' }} 
                        title="Restaurar a bandeja principal"
                      >
                        <RefreshCw size={15} />
                      </button>
                    ) : (
                      <button 
                        className="btn btn-secondary" 
                        onClick={(e) => handleDeleteReport(report.id, e)} 
                        style={{ padding: '0.45rem 0.65rem' }} 
                        title="Archivar reporte"
                      >
                        <Trash2 size={15} color="var(--error)" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      {/* MODAL DE GESTIÓN DE ENCARGADOS */}
      {showStaffModal && typeof document !== "undefined" && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2.25rem',
            position: 'relative',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-xl)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <button
              onClick={() => setShowStaffModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Gestión de Encargados de Área</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Administración de altas, bajas y reincorporación de supervisores
                </p>
              </div>
            </div>

            {/* AVISO DE CONSERVACIÓN DE REGISTROS */}
            <div style={{
              background: 'var(--primary-light)',
              border: '1px solid var(--accent-glow)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
              marginBottom: '1.5rem'
            }}>
              💡 <strong>Regla del Sistema:</strong> Al eliminar un encargado, <strong>se retira de la lista para nuevos reportes</strong> de pasantes, pero <strong>todos sus reportes y registros pasados se conservan intactos</strong> en la base de datos para auditoría.
            </div>

            {/* FORMULARIO PARA AGREGAR NUEVO ENCARGADO */}
            <form onSubmit={handleAddSupervisor} style={{
              background: 'var(--surface-secondary)',
              border: '1px solid var(--surface-border)',
              padding: '1.15rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                ➕ Registrar Nuevo Encargado
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <input
                  type="text"
                  required
                  placeholder="Nombre Completo (Ej. Carlos Apaza)"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                />
                <input
                  type="text"
                  placeholder="Área (Ej. Sistemas, Operaciones)"
                  value={newStaff.area}
                  onChange={(e) => setNewStaff({ ...newStaff, area: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
                <UserPlus size={15} /> Guardar Encargado
              </button>
            </form>

            {/* TABS DE FILTRO: ACTIVOS VS ELIMINADOS */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setStaffFilter('activos')}
                className={`btn ${staffFilter === 'activos' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Activos ({staffList.filter(s => !s.deleted).length})
              </button>
              <button
                type="button"
                onClick={() => setStaffFilter('eliminados')}
                className={`btn ${staffFilter === 'eliminados' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Eliminados / Inactivos ({staffList.filter(s => s.deleted).length})
              </button>
            </div>

            {/* LISTA DE ENCARGADOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {staffList
                .filter(s => staffFilter === 'activos' ? !s.deleted : s.deleted)
                .map((sup) => (
                  <div
                    key={sup.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      background: 'var(--surface-secondary)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {sup.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {sup.area || 'Sin área asignada'}
                      </div>
                    </div>

                    <div>
                      {!sup.deleted ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSupervisor(sup)}
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                          title="Eliminar de la lista de nuevos reportes"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreSupervisor(sup)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                          title="Reincorporar a la empresa"
                        >
                          <RefreshCw size={14} color="var(--success)" /> Reincorporar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
