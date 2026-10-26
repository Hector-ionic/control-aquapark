import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, User, Lock, Mail, ArrowRight, 
  Sparkles, ShieldAlert, GraduationCap, Briefcase, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, quickLogin, user, role, predefinedUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: '',
    email: 'admin@aquapark.com',
    password: 'admin',
    role: 'admin' // 'admin' | 'encargado' | 'pasante'
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

  const handleQuickAccess = (predefined) => {
    const loggedUser = quickLogin(predefined);
    toast.success(`Acceso rápido: ${loggedUser.name} (${loggedUser.role.toUpperCase()})`);
    const destination = location.state?.from?.pathname || (loggedUser.role === 'pasante' ? '/' : '/supervisor');
    navigate(destination, { replace: true });
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

        {/* ACCESOS RÁPIDOS POR ROL PARA EVALUACIÓN */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Acceso Rápido para Pruebas (1 Clic)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {predefinedUsers.slice(0, 3).map((item) => {
              const roleColors = {
                admin: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--error)', border: 'rgba(239, 68, 68, 0.3)' },
                encargado: { bg: 'var(--primary-light)', text: 'var(--primary)', border: 'var(--accent-glow)' },
                pasante: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success-border)' }
              };
              const style = roleColors[item.role] || roleColors.pasante;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleQuickAccess(item)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    background: style.bg,
                    color: style.text,
                    border: `1px solid ${style.border}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'var(--transition)'
                  }}
                  title={`Ingresar como ${item.name} (${item.role})`}
                >
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.role}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {item.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--surface-border)' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>O inicia manualmente</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--surface-border)' }}></div>
        </div>

        {/* FORMULARIO MANUAL CON SELECTOR DE ROL */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="input-group">
            <label><ShieldCheck size={14} color="var(--primary)" /> Rol a Simular *</label>
            <select
              value={formData.role}
              onChange={(e) => {
                const newRole = e.target.value;
                setFormData({
                  ...formData,
                  role: newRole,
                  email: newRole === 'admin' ? 'admin@aquapark.com' : newRole === 'encargado' ? 'hector.calle@aquapark.com' : 'juan.perez@aquapark.com',
                  password: newRole === 'admin' ? 'admin' : '123'
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
            Sesión guardada en <strong>localStorage</strong> (persistente ante recargas F5).
          </span>
        </div>

      </div>

    </div>
  );
}
