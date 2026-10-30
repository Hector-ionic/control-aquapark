import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldAlert, Activity, Search, Filter, Download, User, Calendar, 
  Clock, CheckCircle, AlertTriangle, FileText, Lock, RefreshCw,
  Eye, ShieldCheck, Terminal, RotateCcw, Copy, Check, BarChart2, FileSpreadsheet,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  subscribeToAuditLogs, 
  exportAuditLogsCSV,
  exportAuditLogsExcel, 
  AUDIT_ACTIONS, 
  AUDIT_MODULES 
} from '../services/auditService';

export default function AuditDashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logLimit, setLogLimit] = useState(200);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todos');
  const [selectedModule, setSelectedModule] = useState('todos');
  const [timePreset, setTimePreset] = useState('todos'); // 'todos' | 'hoy' | 'semana' | 'mes'

  // Estados visuales
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Paginación interactiva
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAuditLogs((data) => {
      setLogs(data);
      setIsLoading(false);
    }, logLimit);

    return () => unsubscribe();
  }, [logLimit]);

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedRole('todos');
    setSelectedAction('todos');
    setSelectedModule('todos');
    setTimePreset('todos');
    toast.success('Filtros restablecidos');
  }, []);

  const handleCopyId = useCallback((id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('ID copiado al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Métricas y distribución porcentual optimizada
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    let todayCount = 0;
    let logins = 0;
    let reports = 0;
    let revisions = 0;
    let critical = 0;

    logs.forEach(l => {
      if (l.dateString === todayStr) todayCount++;

      if (l.action?.includes('LOGIN')) logins++;
      else if (l.action?.includes('REPORTE') && l.action !== AUDIT_ACTIONS.ELIMINAR_REPORTE) reports++;
      else if (l.action === AUDIT_ACTIONS.ACTUALIZAR_ESTADO || l.action === AUDIT_ACTIONS.EXPORTAR_CSV) revisions++;
      else if (l.action === AUDIT_ACTIONS.ELIMINAR_REPORTE || l.action === AUDIT_ACTIONS.ARCHIVAR_REPORTE || l.action === AUDIT_ACTIONS.LOGIN_FALLIDO) critical++;
    });

    const total = logs.length || 1;
    const loginPct = Math.round((logins / total) * 100);
    const reportsPct = Math.round((reports / total) * 100);
    const revisionsPct = Math.round((revisions / total) * 100);
    const criticalPct = Math.max(0, 100 - loginPct - reportsPct - revisionsPct);

    return {
      total: logs.length,
      today: todayCount,
      logins,
      reports,
      revisions,
      critical,
      percentages: { loginPct, reportsPct, revisionsPct, criticalPct }
    };
  }, [logs]);

  // Filtrado de logs eficiente
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return logs.filter(log => {
      // 1. Filtro temporal
      if (timePreset === 'hoy') {
        if (log.dateString !== todayStr) return false;
      } else if (timePreset === 'semana') {
        const logDate = log.createdAt?.toDate ? log.createdAt.toDate() : (log.isoDate ? new Date(log.isoDate) : null);
        if (logDate && logDate < sevenDaysAgo) return false;
      } else if (timePreset === 'mes') {
        const logDate = log.createdAt?.toDate ? log.createdAt.toDate() : (log.isoDate ? new Date(log.isoDate) : null);
        if (logDate && (logDate.getFullYear() !== currentYear || logDate.getMonth() !== currentMonth)) return false;
      }

      // 2. Filtro textual
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesUser = (log.userName?.toLowerCase() || '').includes(term);
        const matchesDetail = (log.details?.toLowerCase() || '').includes(term);
        const matchesAction = (log.action?.toLowerCase() || '').includes(term);
        const matchesTarget = (log.targetId?.toLowerCase() || '').includes(term);
        if (!matchesUser && !matchesDetail && !matchesAction && !matchesTarget) return false;
      }

      // 3. Filtro por Rol
      if (selectedRole !== 'todos') {
        if ((log.userRole || '').toLowerCase() !== selectedRole.toLowerCase()) return false;
      }

      // 4. Filtro por Acción
      if (selectedAction !== 'todos') {
        if (log.action !== selectedAction) return false;
      }

      // 5. Filtro por Módulo
      if (selectedModule !== 'todos') {
        if (log.module !== selectedModule) return false;
      }

      return true;
    });
  }, [logs, searchTerm, selectedRole, selectedAction, selectedModule, timePreset]);

  // Reiniciar a la página 1 cuando cambien filtros o tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole, selectedAction, selectedModule, timePreset, itemsPerPage, logLimit]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleExportExcel = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.error('No hay registros filtrados para exportar');
      return;
    }
    exportAuditLogsExcel(filteredLogs);
    toast.success('Bitácora descargada en formato Excel (.xls)');
  }, [filteredLogs]);

  const handleExportCSV = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.error('No hay registros filtrados para exportar');
      return;
    }
    exportAuditLogsCSV(filteredLogs);
    toast.success('Bitácora de auditoría exportada exitosamente');
  }, [filteredLogs]);

  const getActionBadge = (action) => {
    switch (action) {
      case AUDIT_ACTIONS.LOGIN_EXITOSO:
        return <span className="badge badge-success">Login Exitoso</span>;
      case AUDIT_ACTIONS.LOGIN_FALLIDO:
        return <span className="badge badge-error" style={{ animation: 'pulse 2s infinite' }}>Login Fallido</span>;
      case AUDIT_ACTIONS.RESTABLECER_PASSWORD:
        return <span className="badge badge-warning">Clave Restablecida</span>;
      case AUDIT_ACTIONS.CREAR_REPORTE:
        return <span className="badge badge-primary">Reporte Creado</span>;
      case AUDIT_ACTIONS.ACTUALIZAR_ESTADO:
        return <span className="badge badge-info">Estado Modificado</span>;
      case AUDIT_ACTIONS.ARCHIVAR_REPORTE:
        return <span className="badge badge-warning">Archivado</span>;
      case AUDIT_ACTIONS.RESTAURAR_REPORTE:
        return <span className="badge badge-success">Restaurado</span>;
      case AUDIT_ACTIONS.ELIMINAR_REPORTE:
        return <span className="badge badge-error">Depuración/Baja</span>;
      case AUDIT_ACTIONS.DESCARGAR_PDF:
        return <span className="badge" style={{ background: 'rgba(255, 149, 0, 0.15)', color: '#ff9500' }}>Descarga PDF</span>;
      case AUDIT_ACTIONS.EXPORTAR_CSV:
        return <span className="badge badge-secondary">Exportación CSV</span>;
      default:
        return <span className="badge">{action?.replace(/_/g, ' ') || 'Acción'}</span>;
    }
  };

  const getRoleBadge = (role) => {
    const r = (role || 'pasante').toLowerCase();
    if (r === 'admin' || r === 'administrador') {
      return <span className="badge badge-primary" style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>Admin</span>;
    }
    if (r === 'encargado') {
      return <span className="badge badge-info">Encargado</span>;
    }
    if (r === 'desconocido') {
      return <span className="badge badge-error">Desconocido</span>;
    }
    return <span className="badge badge-secondary">Pasante</span>;
  };

  const hasActiveFilters = searchTerm !== '' || selectedRole !== 'todos' || selectedAction !== 'todos' || selectedModule !== 'todos' || timePreset !== 'todos';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      
      {/* Header del módulo */}
      <div 
        className="glass-panel"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1.25rem', 
          marginBottom: '1.5rem', 
          padding: '1.5rem 2rem' 
        }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
              <ShieldAlert size={28} color="var(--primary)" />
              Módulo de Auditoría y Trazabilidad
            </h2>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>En Tiempo Real</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: '0.4rem 0 0 0' }}>
            Registro inmutable de actividades, accesos, creaciones y modificaciones en la plataforma.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={logLimit}
            onChange={(e) => setLogLimit(Number(e.target.value))}
            title="Cantidad máxima de registros a cargar"
            style={{ 
              padding: '0.55rem 0.8rem', 
              fontSize: '0.85rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--surface-border)', 
              background: 'var(--surface-secondary)', 
              color: 'var(--text-main)',
              cursor: 'pointer' 
            }}
          >
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={200}>Últimos 200</option>
            <option value={500}>Últimos 500</option>
          </select>

          <button 
            onClick={handleExportExcel} 
            className="btn btn-primary"
            style={{ 
              padding: '0.6rem 1.1rem', 
              fontSize: '0.88rem', 
              background: '#16a34a', 
              borderColor: '#15803d',
              color: '#ffffff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Descargar en formato Excel (.xls)"
          >
            <FileSpreadsheet size={17} />
            Descargar Excel ({filteredLogs.length})
          </button>

          <button 
            onClick={handleExportCSV} 
            className="btn btn-secondary"
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Exportar archivo CSV con formato de lista"
          >
            <Download size={17} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.25rem' 
      }}>
        <div className="glass-card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0, 102, 204, 0.12)', color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Total de Eventos</span>
            <strong style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(52, 199, 89, 0.12)', color: 'var(--success)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Eventos Hoy</span>
            <strong style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.today}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(50, 173, 230, 0.12)', color: 'var(--info)' }}>
            <FileText size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Reportes Bitácora</span>
            <strong style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.reports}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255, 59, 48, 0.12)', color: 'var(--error)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Alertas / Críticos</span>
            <strong style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.critical}</strong>
          </div>
        </div>
      </div>

      {/* Barra de Distribución Visual de Actividades */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BarChart2 size={16} color="var(--primary)" />
            Distribución de la Actividad Registrada
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Muestra de {stats.total} eventos</span>
        </div>

        {/* Barra de progreso multicolor */}
        <div style={{ 
          height: '10px', 
          width: '100%', 
          borderRadius: '999px', 
          overflow: 'hidden', 
          display: 'flex', 
          background: 'var(--surface-secondary)',
          border: '1px solid var(--surface-border)'
        }}>
          <div title={`Logins: ${stats.percentages.loginPct}%`} style={{ width: `${stats.percentages.loginPct}%`, background: 'var(--success)', transition: 'width 0.4s ease' }} />
          <div title={`Reportes: ${stats.percentages.reportsPct}%`} style={{ width: `${stats.percentages.reportsPct}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }} />
          <div title={`Revisiones: ${stats.percentages.revisionsPct}%`} style={{ width: `${stats.percentages.revisionsPct}%`, background: 'var(--info)', transition: 'width 0.4s ease' }} />
          <div title={`Alertas/Críticos: ${stats.percentages.criticalPct}%`} style={{ width: `${stats.percentages.criticalPct}%`, background: 'var(--error)', transition: 'width 0.4s ease' }} />
        </div>

        {/* Leyenda interactiva */}
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
            <span>Accesos / Logins ({stats.percentages.loginPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></span>
            <span>Reportes Pasantes ({stats.percentages.reportsPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--info)' }}></span>
            <span>Revisiones / Descargas ({stats.percentages.revisionsPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)' }}></span>
            <span>Alertas / Bajas ({stats.percentages.criticalPct}%)</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        {/* Fila 1: Presets rápidos de tiempo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.3rem', fontWeight: 500 }}>
              Período:
            </span>
            {[
              { id: 'todos', label: 'Todo el historial' },
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Últimos 7 días' },
              { id: 'mes', label: 'Este mes' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimePreset(p.id)}
                className={`btn ${timePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: 'var(--error)' }}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={14} />
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Fila 2: Búsqueda y desplegables */}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Input de Búsqueda */}
          <div style={{ flex: '1 1 240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={17} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input 
              type="text"
              placeholder="Buscar por usuario, acción o detalle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '2.4rem',
                width: '100%',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Filtro por Rol */}
          <div style={{ minWidth: '140px' }}>
            <select 
              value={selectedRole} 
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="todos">Todos los Roles</option>
              <option value="admin">Administrador</option>
              <option value="encargado">Encargado</option>
              <option value="pasante">Pasante</option>
            </select>
          </div>

          {/* Filtro por Módulo */}
          <div style={{ minWidth: '150px' }}>
            <select 
              value={selectedModule} 
              onChange={(e) => setSelectedModule(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="todos">Todos los Módulos</option>
              {Object.entries(AUDIT_MODULES).map(([key, label]) => (
                <option key={key} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Acción */}
          <div style={{ minWidth: '160px' }}>
            <select 
              value={selectedAction} 
              onChange={(e) => setSelectedAction(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="todos">Todas las Acciones</option>
              {Object.entries(AUDIT_ACTIONS).map(([key, val]) => (
                <option key={key} value={val}>{val.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem' }} />
            <p>Cargando registros de auditoría en tiempo real...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Terminal size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>No hay registros que coincidan</h3>
            <p style={{ fontSize: '0.88rem', margin: '0.5rem 0 0' }}>Prueba ajustando los filtros de búsqueda o restableciéndolos.</p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                Restablecer Filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Cabecera superior interna de la tabla de auditoría (100% contraste en Claro y Oscuro) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1.25rem',
              background: 'var(--surface-secondary)',
              borderBottom: '1px solid var(--surface-border)',
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={16} color="var(--primary)" />
                <span>
                  Mostrando <strong>{filteredLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</strong> de <strong>{filteredLogs.length}</strong> {filteredLogs.length === 1 ? 'evento registrado' : 'eventos registrados'}
                </span>
              </div>
              {totalPages > 1 && (
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                  Página {currentPage} de {totalPages}
                </span>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Fecha / Hora</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Usuario</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Rol</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Módulo</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Acción</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Detalle de la Actividad</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s ease' }}
                    className="audit-row"
                  >
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>{log.dateString}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.timeString}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                          {(log.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span>{log.userName || 'Anónimo'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getRoleBadge(log.userRole)}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.module}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getActionBadge(log.action)}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', maxWidth: '340px' }}>
                      <div style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        color: 'var(--text-main)' 
                      }}>
                        {log.details || 'Sin descripción adicional'}
                      </div>
                      {log.targetId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            Ref: {log.targetId.substring(0, 10)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(log.targetId)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}
                            title="Copiar ID de referencia"
                          >
                            {copiedId === log.targetId ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedLogDetail(log)}
                        className="btn btn-secondary" 
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        title="Ver detalle completo"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BARRA DE CONTROLES DE PAGINACIÓN */}
          {filteredLogs.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--surface-border)',
              background: 'var(--surface-secondary)',
              flexWrap: 'wrap',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.88rem', color: 'var(--text-main)', flexWrap: 'wrap' }}>
                <span>
                  Mostrando del <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> al <strong>{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</strong> de <strong>{filteredLogs.length}</strong> eventos
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.82rem' }}>Por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{
                      width: 'auto',
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--surface-border)',
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    opacity: currentPage === 1 ? 0.45 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>

                {/* Botones de Páginas */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span style={{ padding: '0 0.4rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPage(page);
                          window.scrollTo({ top: 400, behavior: 'smooth' });
                        }}
                        className={`btn ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          minWidth: '36px',
                          padding: '0.4rem 0.7rem',
                          fontSize: '0.82rem',
                          fontWeight: currentPage === page ? 700 : 500
                        }}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    opacity: currentPage === totalPages ? 0.45 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Modal de Detalle de Log */}
      {selectedLogDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card animate-fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.8rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                <ShieldCheck size={22} color="var(--primary)" />
                Detalle del Registro de Auditoría
              </h3>
              <button 
                onClick={() => setSelectedLogDetail(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              >
                ✕ Cerrar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.2rem', fontSize: '0.88rem' }}>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Fecha y Hora</strong>
                <span>{selectedLogDetail.dateString} - {selectedLogDetail.timeString}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Usuario Responsable</strong>
                <span>{selectedLogDetail.userName} ({selectedLogDetail.userRole})</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Módulo</strong>
                <span>{selectedLogDetail.module}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Acción Ejecutada</strong>
                <span>{selectedLogDetail.action}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem' }}>Descripción Completa</strong>
              <div style={{ padding: '0.8rem', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', fontSize: '0.9rem' }}>
                {selectedLogDetail.details}
              </div>
            </div>

            {selectedLogDetail.targetId && (
              <div style={{ marginBottom: '1.2rem' }}>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem' }}>ID del Recurso Vinculado</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code style={{ padding: '0.3rem 0.6rem', background: 'var(--surface-secondary)', borderRadius: '4px', border: '1px solid var(--surface-border)', display: 'inline-block', fontSize: '0.82rem' }}>
                    {selectedLogDetail.targetId}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyId(selectedLogDetail.targetId)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    {copiedId === selectedLogDetail.targetId ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {selectedLogDetail.metadata && Object.keys(selectedLogDetail.metadata).length > 0 && (
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem' }}>Metadatos Técnicos (JSON)</strong>
                <pre style={{ padding: '0.8rem', background: 'rgba(0,0,0,0.5)', color: '#38bdf8', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', overflowX: 'auto' }}>
                  {JSON.stringify(selectedLogDetail.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
