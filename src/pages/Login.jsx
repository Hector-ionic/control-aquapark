import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, User, Lock, Mail, ArrowRight, 
  Sparkles, ShieldAlert, GraduationCap, Briefcase, Eye, EyeOff
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '1rem' }}>
      
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        
        {/* LOGO Y ENCABEZADO */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '60px', height: '60px', borderRadius: 'var(--radius-md)', 
            background: 'var(--primary-light)', color: 'var(--primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', border: '1px solid var(--accent-glow)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            Acceso al Sistema
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Manejo de Sesiones y Roles Oficiales — <strong>AquaPark Control</strong>
          </p>
        </div>

        {/* FORMULARIO MANUAL CON SELECTOR DE ROL */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
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
              style={{ fontWeight: 600 }}
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
                style={{ paddingRight: '2.5rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem'
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
            style={{ padding: '0.85rem', fontSize: '0.95rem', marginTop: '0.5rem' }}
          >
            <span>Iniciar Sesión como {formData.role.toUpperCase()}</span>
            <ArrowRight size={17} />
          </button>

        </form>

        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            AquaPark Corporate Platform • Seguridad SSL
          </span>
        </div>

      </div>

    </div>
  );
}
