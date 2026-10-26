import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader, ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Estado de carga inicial mientras Firebase verifica la sesión
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '1rem' }}>
        <Loader className="animate-spin" size={36} color="var(--primary)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Verificando sesión y permisos...
        </span>
      </div>
    );
  }

  // Si no está autenticado, redirigir a Login guardando la ruta de origen
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se definieron roles permitidos y el rol del usuario no coincide
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '1rem' }}>
        <div className="glass-panel animate-fade-in" style={{ maxWidth: '480px', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            background: 'var(--error-bg)', color: 'var(--error)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', border: '1px solid var(--error-border)'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Acceso Restringido</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Tu cuenta actual tiene el rol de <strong style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{role}</strong>, 
            el cual no posee los permisos necesarios para acceder a este módulo.
          </p>

          <div style={{ 
            background: 'var(--surface-secondary)', 
            border: '1px solid var(--surface-border)', 
            padding: '0.75rem 1rem', 
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: '1.75rem'
          }}>
            Roles requeridos: {allowedRoles.join(', ')}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-secondary">
              <Home size={16} /> Ir al Inicio
            </Link>
            {role === 'admin' || role === 'encargado' ? (
              <Link to="/supervisor" className="btn btn-primary">
                Ir a Panel Supervisor
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return children;
}
