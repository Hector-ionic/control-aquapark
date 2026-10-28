import React, { useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, X, Clock, Mail, Shield, User, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { approvePasswordRequest, rejectPasswordRequest } from '../services/passwordRequestService';

export default function PasswordRequestsModal({ isOpen, onClose, requests = [], adminName = 'Carlos Apaza' }) {
  const [filterTab, setFilterTab] = useState('pendientes'); // 'pendientes' | 'historial'
  const [editingPasswords, setEditingPasswords] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  if (!isOpen) return null;

  const pendingRequests = requests.filter(r => r.status === 'pendiente');
  const resolvedRequests = requests.filter(r => r.status !== 'pendiente');
  const displayedRequests = filterTab === 'pendientes' ? pendingRequests : resolvedRequests;

  const handleApprove = async (req) => {
    const assignedPwd = editingPasswords[req.id] || req.requestedPassword || 'Aqua#2026';
    if (!assignedPwd || assignedPwd.trim().length < 4) {
      toast.error('La contraseña asignada debe tener al menos 4 caracteres.');
      return;
    }

    setActionLoading(req.id);
    try {
      await approvePasswordRequest({
        requestId: req.id,
        userEmail: req.email,
        newPassword: assignedPwd,
        adminName
      });
      toast.success(`✅ Solicitud admitida. Clave habilitada para ${req.name}: "${assignedPwd}"`);
    } catch (err) {
      console.error(err);
      toast.error('Error al admitir solicitud.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req) => {
    if (!window.confirm(`¿Estás seguro de RECHAZAR la solicitud de ${req.name}?`)) return;

    setActionLoading(req.id);
    try {
      await rejectPasswordRequest({
        requestId: req.id,
        userEmail: req.email,
        adminName
      });
      toast.success(`Solicitud de ${req.name} rechazada.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al rechazar solicitud.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div 
        className="glass-panel animate-fade-in"
        style={{
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--surface-border, rgba(255,255,255,0.15))',
          borderRadius: '16px',
          padding: '1.75rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          position: 'relative',
          color: 'var(--text-main, #f8fafc)'
        }}
      >
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.2rem',
            right: '1.2rem',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.2rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(56, 189, 248, 0.35)'
          }}>
            <KeyRound size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Bandeja de Admisión de Contraseñas
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
              Gestiona, aprueba o rechaza solicitudes de acceso para el personal y pasantes.
            </p>
          </div>
        </div>

        {/* Pestañas de Filtro */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--surface-border, rgba(255,255,255,0.1))', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setFilterTab('pendientes')}
            className={`btn ${filterTab === 'pendientes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Clock size={14} />
            <span>Pendientes ({pendingRequests.length})</span>
          </button>
          <button
            onClick={() => setFilterTab('historial')}
            className={`btn ${filterTab === 'historial' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <CheckCircle2 size={14} />
            <span>Atendidas ({resolvedRequests.length})</span>
          </button>
        </div>

        {/* Lista de Solicitudes */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.25rem' }}>
          {displayedRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #94a3b8)' }}>
              <AlertCircle size={36} color="var(--primary, #0284c7)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                {filterTab === 'pendientes' ? 'No hay solicitudes pendientes.' : 'No hay historial de solicitudes atendidas.'}
              </p>
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                {filterTab === 'pendientes' ? 'Cuando alguien solicite restablecer su clave, aparecerá aquí al instante.' : ''}
              </span>
            </div>
          ) : (
            displayedRequests.map((req) => {
              const isPending = req.status === 'pendiente';
              const isApproved = req.status === 'aprobada';

              return (
                <div 
                  key={req.id}
                  style={{
                    background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
                    border: '1px solid var(--surface-border, rgba(255,255,255,0.08))',
                    borderRadius: '12px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.98rem' }}>{req.name}</strong>
                        <span className="badge badge-primary" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                          {req.role || 'Pasante'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                        <Mail size={13} /> {req.email}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${isPending ? 'badge-warning' : (isApproved ? 'badge-success' : 'badge-danger')}`} style={{ fontSize: '0.75rem' }}>
                        {isPending ? '🟡 Pendiente' : (isApproved ? '🟢 Aprobada' : '🔴 Rechazada')}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.25rem' }}>
                        {req.dateString || ''} {req.timeString || ''}
                      </div>
                    </div>
                  </div>

                  {/* Acciones para solicitudes pendientes */}
                  {isPending ? (
                    <div style={{ 
                      marginTop: '0.4rem', 
                      paddingTop: '0.75rem', 
                      borderTop: '1px solid var(--surface-border, rgba(255,255,255,0.08))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '220px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>Clave a habilitar:</span>
                        <input
                          type="text"
                          placeholder="Aqua#2026"
                          value={editingPasswords[req.id] !== undefined ? editingPasswords[req.id] : (req.requestedPassword || 'Aqua#2026')}
                          onChange={(e) => setEditingPasswords({ ...editingPasswords, [req.id]: e.target.value })}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            background: 'var(--surface, #0f172a)',
                            border: '1px solid var(--surface-border, rgba(255,255,255,0.2))',
                            color: '#38bdf8',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            width: '130px'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={actionLoading === req.id}
                          className="btn"
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.8rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          <XCircle size={14} /> Rechazar
                        </button>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionLoading === req.id}
                          className="btn btn-primary"
                          style={{
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.8rem',
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            border: '1px solid #16a34a',
                            color: '#ffffff',
                            fontWeight: 700
                          }}
                        >
                          <CheckCircle2 size={14} /> {actionLoading === req.id ? 'Admitiendo...' : 'Admitir'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', borderTop: '1px solid var(--surface-border, rgba(255,255,255,0.05))', paddingTop: '0.4rem' }}>
                      Atendido por: <strong>{req.resolvedBy || 'Administrador'}</strong> {req.assignedPassword ? `• Clave: "${req.assignedPassword}"` : ''}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pie del modal */}
        <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--surface-border, rgba(255,255,255,0.1))', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
