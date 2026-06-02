import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { HardHat, ShieldCheck } from 'lucide-react';

import StudentForm from './pages/StudentForm';
import SupervisorDashboard from './pages/SupervisorDashboard';

function App() {
  return (
    <BrowserRouter>
      <div className="robotic-scanline"></div>
      <div className="app-container">
        <header className="app-header animate-fade-in hide-on-pdf">
          <div className="logo-container">
            <HardHat className="logo-icon" size={36} />
            <div>
              <h1 style={{fontSize: '1.5rem', marginBottom: 0}}>Control AquaPark</h1>
              <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Sistema de Pasantías</span>
            </div>
          </div>
          <nav style={{display: 'flex', gap: '1rem'}}>
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
