import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, PlusCircle, LogIn, LogOut, User, Sparkles, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import StudentForm from './pages/StudentForm';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AuditDashboard from './pages/AuditDashboard';
import DynamicBackground from './components/DynamicBackground';

function NavigationHeader({ theme, setTheme }) {
  const location = useLocation();
  const { user, role, logout } = useAuth();
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
            <span className="status-dot"></span>
            <span>Sistema en Línea</span>
          </div>
        </div>
      </Link>
      
      <nav style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* SELECTOR DE TEMA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <select 
            value={theme} 
            onChange={e => setTheme(e.target.value)}
            aria-label="Selector de tema visual"
            style={{ 
              padding: '0.5rem 0.75rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--surface-border)', 
              background: 'var(--surface-secondary)', 
              color: 'var(--text-main)', 
              outline: 'none', 
              cursor: 'pointer', 
              width: 'auto',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            <option value="system">💻 Sistema</option>
            <option value="light">☀️ Claro</option>
            <option value="dark">🌙 Oscuro</option>
          </select>

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

        <Link 
          to="/supervisor" 
          className={`btn ${isSupervisor ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
        >
          <ShieldCheck size={16} />
          Bandeja Supervisor
        </Link>

        {/* BOTÓN AUDITORÍA (VISIBLE PARA ADMIN O PARA AUDITAR) */}
        {(!user || role === 'admin') && (
          <Link 
            to="/auditoria" 
            className={`btn ${isAudit ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
          >
            <ShieldAlert size={16} />
            Auditoría
          </Link>
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
