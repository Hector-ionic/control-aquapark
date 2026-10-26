import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, PlusCircle, CheckCircle2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import StudentForm from './pages/StudentForm';
import SupervisorDashboard from './pages/SupervisorDashboard';

function NavigationHeader({ theme, setTheme }) {
  const location = useLocation();
  const isSupervisor = location.pathname.startsWith('/supervisor');

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
      
      <nav style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select 
          value={theme} 
          onChange={e => setTheme(e.target.value)}
          aria-label="Selector de tema visual"
          style={{ 
            padding: '0.55rem 0.85rem', 
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
        
        <Link 
          to="/" 
          className={`btn ${!isSupervisor ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
        >
          <PlusCircle size={16} />
          Nuevo Reporte
        </Link>
        <Link 
          to="/supervisor" 
          className={`btn ${isSupervisor ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
        >
          <ShieldCheck size={16} />
          Acceso Encargado
        </Link>
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
            <Route path="/supervisor" element={<SupervisorDashboard />} />
          </Routes>
        </main>

        <footer className="hide-on-pdf" style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} <strong>AquaPark Control</strong> — Plataforma Corporativa de Bitácoras y Supervisión.
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
