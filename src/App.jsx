import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ShieldCheck, Monitor, Sun, Moon } from 'lucide-react';

import StudentForm from './pages/StudentForm';
import SupervisorDashboard from './pages/SupervisorDashboard';

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
      <div className="app-container">
        <header className="app-header animate-fade-in hide-on-pdf">
          <div className="logo-container">
            <img src="/logo.svg" alt="AquaPark Logo" style={{ width: 120, height: 120, objectFit: 'contain' }} />
            <div>
              <h1 style={{fontSize: '1.5rem', margin: 0}}>Control AquaPark</h1>
              <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Plataforma Corporativa</span>
            </div>
          </div>
          
          <nav style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
            <select 
              value={theme} 
              onChange={e => setTheme(e.target.value)}
              style={{ padding: '0.4rem 0.8rem', borderRadius: '12px', border: '1px solid var(--surface-border)', background: 'var(--surface-secondary)', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', width: 'auto' }}
            >
              <option value="system">💻 Sistema</option>
              <option value="light">☀️ Claro</option>
              <option value="dark">🌙 Oscuro</option>
            </select>
            
            <Link to="/" className="btn btn-secondary" style={{padding: '0.5rem 1rem', fontSize: '0.9rem'}}>
              Nuevo Reporte
            </Link>
            <Link to="/supervisor" className="btn btn-primary" style={{padding: '0.5rem 1rem', fontSize: '0.9rem'}}>
              <ShieldCheck size={18} />
              Acceso Encargado
            </Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<StudentForm />} />
            <Route path="/supervisor" element={<SupervisorDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
