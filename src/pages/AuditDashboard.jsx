import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, Activity, Search, Filter, Download, User, Calendar, 
  Clock, CheckCircle, AlertTriangle, FileText, Lock, RefreshCw,
  ArrowUpDown, Eye, ShieldCheck, Terminal
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  subscribeToAuditLogs, 
  exportAuditLogsCSV, 
  AUDIT_ACTIONS, 
  AUDIT_MODULES 
} from '../services/auditService';

export default function AuditDashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todos');
  const [selectedModule, setSelectedModule] = useState('todos');
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAuditLogs((data) => {
      setLogs(data);
      setIsLoading(false);
    }, 500);

    return () => unsubscribe();
  }, []);

  // Métricas rápidas
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const todayEvents = logs.filter(l => l.dateString === todayStr);
    const logins = logs.filter(l => l.action?.includes('LOGIN')).length;
    const reportEvents = logs.filter(l => l.action?.includes('REPORTE')).length;
    const criticalEvents = logs.filter(l => 
      l.action === AUDIT_ACTIONS.ELIMINAR_REPORTE || 
      l.action === AUDIT_ACTIONS.ARCHIVAR_REPORTE
    ).length;

    return {
      total: logs.length,
      today: todayEvents.length,
      logins,
      reportEvents,
      criticalEvents
    };
  }, [logs]);

  // Filtrado de logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        (log.userName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (log.action?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (log.targetId?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesRole = 
        selectedRole === 'todos' || 
        (log.userRole || '').toLowerCase() === selectedRole.toLowerCase();

      const matchesAction = 
        selectedAction === 'todos' || 
        log.action === selectedAction;

      const matchesModule = 
        selectedModule === 'todos' || 
        log.module === selectedModule;

      return matchesSearch && matchesRole && matchesAction && matchesModule;
    });
  }, [logs, searchTerm, selectedRole, selectedAction, selectedModule]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No hay registros para exportar');
      return;
    }
    exportAuditLogsCSV(filteredLogs);
    toast.success('Bitácora de auditoría exportada exitosamente');
  };

  const getActionBadge = (action) => {
    switch (action) {
      case AUDIT_ACTIONS.LOGIN_EXITOSO:
        return <span className="badge badge-success">Login Exitoso</span>;
      case AUDIT_ACTIONS.LOGIN_FALLIDO:
        return <span className="badge badge-error">Login Fallido</span>;
      case AUDIT_ACTIONS.CREAR_REPORTE:
        return <span className="badge badge-primary">Reporte Creado</span>;
      case AUDIT_ACTIONS.ACTUALIZAR_ESTADO:
        return <span className="badge badge-info">Estado Modificado</span>;
      case AUDIT_ACTIONS.ARCHIVAR_REPORTE:
        return <span className="badge badge-warning">Archivado</span>;
      case AUDIT_ACTIONS.RESTAURAR_REPORTE:
        return <span className="badge badge-success">Restaurado</span>;
      case AUDIT_ACTIONS.ELIMINAR_REPORTE:
        return <span className="badge badge-error">Eliminación</span>;
      case AUDIT_ACTIONS.DESCARGAR_PDF:
        return <span className="badge badge-secondary">Descarga PDF</span>;
      case AUDIT_ACTIONS.EXPORTAR_CSV:
        return <span className="badge badge-secondary">Exportación CSV</span>;
      default:
        return <span className="badge">{action || 'Acción'}</span>;
    }
  };

  const getRoleBadge = (role) => {
    const r = (role || 'pasante').toLowerCase();
    if (r === 'admin' || r === 'administrador') {
      return <span className="badge badge-primary" style={{ background: '#7c3aed', color: '#fff' }}>Admin</span>;
    }
    if (r === 'encargado') {
      return <span className="badge badge-info">Encargado</span>;
    }
    return <span className="badge badge-secondary">Pasante</span>;
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      
      {/* Header del módulo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldAlert size={28} color="var(--primary)" />
              Módulo de Auditoría y Trazabilidad
            </h2>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>En Tiempo Real</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: '0.4rem 0 0 0' }}>
            Registro inmutable de actividades, accesos, creaciones y modificaciones en la plataforma.
          </p>
        </div>

        <button 
          onClick={handleExportCSV} 
          className="btn btn-secondary"
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.88rem' }}
        >
          <Download size={17} />
          Exportar Bitácora CSV
        </button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0, 102, 204, 0.12)', color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Eventos Registrados</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.total}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(52, 199, 89, 0.12)', color: 'var(--success)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Eventos Hoy</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.today}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(50, 173, 230, 0.12)', color: 'var(--info)' }}>
            <FileText size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Actividad Reportes</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.reportEvents}</strong>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255, 59, 48, 0.12)', color: 'var(--error)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Acciones Críticas</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.criticalEvents}</strong>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Input de Búsqueda */}
        <div style={{ flex: '1 1 260px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input 
            type="text"
            placeholder="Buscar por usuario, acción o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              paddingLeft: '2.5rem',
              width: '100%',
              fontSize: '0.88rem'
            }}
          />
        </div>

        {/* Filtro por Rol */}
        <div style={{ minWidth: '150px' }}>
          <select 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ width: '100%', fontSize: '0.88rem' }}
          >
            <option value="todos">Todos los Roles</option>
            <option value="admin">Administrador</option>
            <option value="encargado">Encargado</option>
            <option value="pasante">Pasante</option>
          </select>
        </div>

        {/* Filtro por Módulo */}
        <div style={{ minWidth: '160px' }}>
          <select 
            value={selectedModule} 
            onChange={(e) => setSelectedModule(e.target.value)}
            style={{ width: '100%', fontSize: '0.88rem' }}
          >
            <option value="todos">Todos los Módulos</option>
            {Object.entries(AUDIT_MODULES).map(([key, label]) => (
              <option key={key} value={label}>{label}</option>
            ))}
          </select>
        </div>

        {/* Filtro por Acción */}
        <div style={{ minWidth: '170px' }}>
          <select 
            value={selectedAction} 
            onChange={(e) => setSelectedAction(e.target.value)}
            style={{ width: '100%', fontSize: '0.88rem' }}
          >
            <option value="todos">Todas las Acciones</option>
            {Object.entries(AUDIT_ACTIONS).map(([key, val]) => (
              <option key={key} value={val}>{val.replace(/_/g, ' ')}</option>
            ))}
          </select>
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
            <p style={{ fontSize: '0.88rem', margin: '0.5rem 0 0' }}>Prueba ajustando los filtros de búsqueda o registra una nueva acción.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Fecha / Hora</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Usuario</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Rol</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Módulo</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Acción</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Detalle de la Actividad</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Ver</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
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

                    <td style={{ padding: '0.85rem 1rem', maxWidth: '360px' }}>
                      <div style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        color: 'var(--text-main)' 
                      }}>
                        {log.details || 'Sin descripción adicional'}
                      </div>
                      {log.targetId && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          Ref ID: {log.targetId.substring(0, 10)}...
                        </span>
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
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Usuario</strong>
                <span>{selectedLogDetail.userName} ({selectedLogDetail.userRole})</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Módulo</strong>
                <span>{selectedLogDetail.module}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Acción</strong>
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
                <code style={{ padding: '0.3rem 0.6rem', background: 'var(--surface-secondary)', borderRadius: '4px', border: '1px solid var(--surface-border)', display: 'inline-block', fontSize: '0.82rem' }}>
                  {selectedLogDetail.targetId}
                </code>
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
