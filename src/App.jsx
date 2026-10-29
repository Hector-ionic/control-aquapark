import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, PlusCircle, LogIn, LogOut, User, Sparkles, ShieldAlert, Image as ImageIcon, KeyRound, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import PasswordRequestsModal from './components/PasswordRequestsModal';
import { subscribeToPasswordRequests } from './services/passwordRequestService';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import StudentForm from './pages/StudentForm';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AuditDashboard from './pages/AuditDashboard';
import DynamicBackground from './components/DynamicBackground';
import { useNetworkStatus } from './hooks/useNetworkStatus';

function NavigationHeader({ theme, setTheme, isOnline = true }) {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordRequests, setPasswordRequests] = useState([]);

  useEffect(() => {
    if (role === 'admin') {
      const unsub = subscribeToPasswordRequests((list) => {
        setPasswordRequests(list || []);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [role]);

  const pendingRequestsCount = passwordRequests.filter(r => r.status === 'pendiente').length;
  const isSupervisor = location.pathname.startsWith('/supervisor');
  const isLogin = location.pathname.startsWith('/login');
  const isAudit = location.pathname.startsWith('/auditoria');
  const isHome = location.pathname === '/';

  // Estilos de badge según el rol oficial
  const roleBadgeStyles = {
    admin: { label: 'Admin', className: 'badge badge-warning', icon: '👑' },
    encargado: { label: 'Encargado', className: 'badge badge-primary', icon: '🛡️' },
    pasante: { label: 'Pasante', className: 'badge badge-success', icon: '📝' }
  };

  const currentRoleMeta = role ? (roleBadgeStyles[role] || { label: role, className: 'badge badge-neutral', icon: '👤' }) : null;

  return (
    <header className="app-header animate-fade-in hide-on-pdf">
      <Link to="/" className="logo-container">
        <div className="logo-icon-wrap">
          <img src="/logo.svg" alt="AquaPark Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>AquaPark Control</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '0.15rem 0.5rem' }}>Oficial</span>
          </div>
          <div className="status-indicator" style={{ fontSize: '0.72rem', marginTop: '0.15rem' }}>
            <span 
              className="status-dot" 
              style={{ 
                background: isOnline ? undefined : '#ef4444',
                boxShadow: isOnline ? undefined : '0 0 6px rgba(239, 68, 68, 0.8)'
              }}
            ></span>
            <span style={{ color: isOnline ? undefined : '#f87171', fontWeight: isOnline ? undefined : 600 }}>
              {isOnline ? 'Sistema en Línea' : 'Sin Conexión (Modo Local)'}
            </span>
          </div>
        </div>
      </Link>
      
      <nav style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* INTERRUPTOR DESLIZABLE (TOGGLE SWITCH) CLARO / OSCURO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
            style={{
              position: 'relative',
              width: '64px',
              height: '32px',
              borderRadius: '999px',
              background: theme === 'dark' ? '#0f172a' : '#e0f2fe',
              border: '1.5px solid var(--surface-border-strong)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 6px',
              transition: 'background 0.3s ease, border-color 0.3s ease',
              outline: 'none',
              userSelect: 'none'
            }}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Alternar tema claro y oscuro"
          >
            <Sun size={13} color="#f59e0b" style={{ opacity: theme === 'dark' ? 0.35 : 1, transition: 'opacity 0.25s ease' }} />
            <Moon size={13} color="#38bdf8" style={{ opacity: theme === 'dark' ? 1 : 0.35, transition: 'opacity 0.25s ease' }} />
            
            {/* Bolita deslizante */}
            <span
              style={{
                position: 'absolute',
                top: '2.5px',
                left: theme === 'dark' ? '34px' : '3px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: theme === 'dark' ? '#0284c7' : '#ffffff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {theme === 'dark' ? (
                <Moon size={12} color="#ffffff" />
              ) : (
                <Sun size={12} color="#f59e0b" />
              )}
            </span>
          </button>

          <button 
            type="button" 
            onClick={() => window.dispatchEvent(new CustomEvent('aquapark:next-bg'))}
            title="Cambiar fotografía de fondo del parque"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }}
            aria-label="Cambiar fotografía de fondo"
          >
            <ImageIcon size={16} />
          </button>
        </div>
        
        {/* ENLACES DE NAVEGACIÓN */}
        <Link 
          to="/" 
          className={`btn ${isHome ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
        >
          <PlusCircle size={16} />
          Nuevo Reporte
        </Link>

        {/* BANDEJA SUPERVISOR: Solo visible para Encargado o Admin autenticado */}
        {user && (role === 'encargado' || role === 'admin') && (
          <Link 
            to="/supervisor" 
            className={`btn ${isSupervisor ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
          >
            <ShieldCheck size={16} />
            Bandeja Supervisor
          </Link>
        )}

        {/* BOTÓN AUDITORÍA: Solo visible para Administrador autenticado */}
        {user && role === 'admin' && (
          <Link 
            to="/auditoria" 
            className={`btn ${isAudit ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
          >
            <ShieldAlert size={16} />
            Auditoría
          </Link>
        )}

        {/* BOTÓN SOLICITUDES DE CLAVE EN BARRA SUPERIOR (SOLO ADMIN) */}
        {user && role === 'admin' && (
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="btn btn-secondary"
            style={{ 
              padding: '0.5rem 0.95rem', 
              fontSize: '0.85rem', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: pendingRequestsCount > 0 ? '#38bdf8' : undefined,
              background: pendingRequestsCount > 0 ? 'rgba(2, 132, 199, 0.25)' : undefined,
              fontWeight: 600
            }}
            title="Ver y admitir solicitudes de restablecimiento de contraseña"
          >
            <KeyRound size={16} color="var(--primary)" />
            <span>Solicitudes Clave</span>
            {pendingRequestsCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 'bold',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                lineHeight: 1
              }}>
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}

        {/* ZONA DE USUARIO LOGUEADO / LOGIN */}
        {user ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.65rem', 
            background: 'var(--surface-secondary)', 
            padding: '0.35rem 0.75rem', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                {user.name}
              </span>
              <span className={currentRoleMeta?.className || 'badge'} style={{ fontSize: '0.62rem', padding: '0.1rem 0.45rem', marginTop: '0.15rem' }}>
                {currentRoleMeta?.icon} {currentRoleMeta?.label || role}
              </span>
            </div>

            <button 
              onClick={logout} 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
              title="Cerrar sesión activa"
            >
              <LogOut size={14} color="var(--error)" /> 
              <span>Cerrar Sesión</span>
            </button>
          </div>
        ) : (
          <Link 
            to="/login" 
            className={`btn ${isLogin ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
          >
            <LogIn size={16} />
            <span>Iniciar Sesión</span>
          </Link>
        )}
      </nav>

      {/* MODAL SOLICITUDES DE CONTRASEÑA */}
      <PasswordRequestsModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        requests={passwordRequests}
        adminName={user?.name || 'Carlos Apaza'}
      />
    </header>
  );
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('aquapark_theme') || 'system');

  useEffect(() => {
    localStorage.setItem('aquapark_theme', theme);
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <DynamicBackground theme={theme} />
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text-main)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.9rem'
            }
          }}
        />
        <div className="app-container">
          <NavigationHeader theme={theme} setTheme={setTheme} />

          <main>
            <Routes>
              <Route path="/" element={<StudentForm />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/supervisor" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'encargado']}>
                    <SupervisorDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/auditoria" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AuditDashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>

          <footer className="hide-on-pdf" style={{ marginTop: '3.5rem', marginBottom: '1rem', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--surface)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.6rem 1.6rem',
              boxShadow: 'var(--shadow-sm)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <span>© {new Date().getFullYear()}</span>
              <strong style={{ color: 'var(--primary)' }}>AquaPark Control</strong>
              <span>— Plataforma Corporativa de Bitácoras y Supervisión.</span>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
