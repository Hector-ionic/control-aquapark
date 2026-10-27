import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, User, Lock, Mail, ArrowRight, 
  Sparkles, ShieldAlert, GraduationCap, Briefcase, Eye, EyeOff, Waves
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Si ya tiene sesión iniciada, redirigir
  useEffect(() => {
    if (user && role) {
      const destination = location.state?.from?.pathname || (role === 'pasante' ? '/' : '/supervisor');
      navigate(destination, { replace: true });
    }
  }, [user, role, navigate, location]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast.error('Por favor ingresa un correo o usuario');
      return;
    }

    try {
      const loggedUser = login({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        name: formData.name
      });

      toast.success(`¡Bienvenido(a), ${loggedUser.name}! (Rol: ${loggedUser.role})`);
      const destination = location.state?.from?.pathname || (loggedUser.role === 'pasante' ? '/' : '/supervisor');
      navigate(destination, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al iniciar sesión.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem',
      minHeight: 'calc(100vh - 160px)'
    }}>
      
      {/* TARJETA GLASSMORPHISM DE LOGIN ADAPTATIVA */}
      <div 
        className="glass-panel animate-fade-in" 
        style={{ 
          width: '100%', 
          maxWidth: '460px', 
          padding: '2.5rem',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          zIndex: 2
        }}
      >
        
        {/* LOGO Y ENCABEZADO */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', 
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)', 
            color: '#38bdf8', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', border: '1px solid rgba(56, 189, 248, 0.35)',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)'
          }}>
            <ShieldCheck size={34} />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary-light)', border: '1px solid var(--accent-glow)', padding: '0.2rem 0.65rem', borderRadius: '999px', marginBottom: '0.6rem' }}>
            <Waves size={13} color="var(--primary)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.04em' }}>PARQUE ACUÁTICO</span>
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Acceso al Sistema
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Control de Bitácoras & Supervisión — <strong>AquaPark</strong>
          </p>
        </div>

        {/* FORMULARIO MANUAL CON SELECTOR DE ROL */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div className="input-group">
            <label><ShieldCheck size={14} color="var(--primary)" /> Tipo de Cuenta / Rol *</label>
            <select
              value={formData.role}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  role: e.target.value
                });
              }}
              style={{ 
                fontWeight: 600, 
                background: 'rgba(30, 41, 59, 0.85)', 
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#f8fafc' 
              }}
            >
              <option value="admin">Administrador (Control total del sistema)</option>
              <option value="encargado">Encargado (Revisión y supervisión)</option>
              <option value="pasante">Pasante (Registro de actividades)</option>
            </select>
          </div>

          <div className="input-group">
            <label><Mail size={14} color="var(--primary)" /> Correo / Usuario *</label>
            <input 
              type="text" 
              required 
              placeholder="correo@aquapark.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ 
                background: 'rgba(30, 41, 59, 0.85)', 
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#f8fafc' 
              }}
            />
          </div>

          <div className="input-group">
            <label><Lock size={14} color="var(--primary)" /> Contraseña *</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                placeholder="Contraseña"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ 
                  paddingRight: '2.5rem',
                  background: 'rgba(30, 41, 59, 0.85)', 
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc' 
                }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem'
                }}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.85rem', 
              fontSize: '0.95rem', 
              marginTop: '0.4rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              borderColor: '#0284c7',
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>Iniciar Sesión como {formData.role.toUpperCase()}</span>
            <ArrowRight size={17} />
          </button>

        </form>

        <div style={{ marginTop: '1.6rem', paddingTop: '1.2rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            AquaPark Corporate Platform • Seguridad SSL
          </span>
        </div>

      </div>

    </div>
  );
}
