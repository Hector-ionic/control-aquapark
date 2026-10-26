import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, Key, Eye, EyeOff, LogIn, ShieldCheck, 
  UserPlus, AlertCircle, Loader, CheckCircle2, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, register, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    desiredRole: 'pasante' // 'admin' | 'encargado' | 'pasante'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Si ya hay usuario autenticado, redirigir automáticamente
  useEffect(() => {
    if (user && role) {
      const destination = location.state?.from?.pathname || (role === 'pasante' ? '/' : '/supervisor');
      navigate(destination, { replace: true });
    }
  }, [user, role, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!formData.displayName.trim()) {
          setErrorMsg('Por favor introduce tu nombre completo.');
          setLoading(false);
          return;
        }

        await register(
          formData.email.trim(),
          formData.password,
          formData.desiredRole,
          formData.displayName.trim()
        );
        toast.success(`Cuenta creada exitosamente como ${formData.desiredRole}`);
      } else {
        await login(formData.email.trim(), formData.password);
        toast.success('Sesión iniciada con éxito');
      }

      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      console.error("Error de autenticación:", err);
      let message = 'Error al procesar la solicitud.';

      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Correo electrónico o contraseña incorrectos.';
          break;
        case 'auth/email-already-in-use':
          message = 'Este correo ya se encuentra registrado. Intenta iniciar sesión.';
          break;
        case 'auth/invalid-email':
          message = 'El formato del correo electrónico es inválido.';
          break;
        case 'auth/weak-password':
          message = 'La contraseña debe tener al menos 6 caracteres.';
          break;
        case 'auth/network-request-failed':
          message = 'Fallo de conexión. Comprueba tu acceso a internet.';
          break;
        default:
          message = err.message || message;
      }

      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '68vh', padding: '1rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        
        {/* ENCABEZADO */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '56px', height: '56px', borderRadius: 'var(--radius-md)', 
            background: 'var(--primary-light)', color: 'var(--primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', border: '1px solid var(--accent-glow)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '0.35rem', fontWeight: 800 }}>
            {isRegisterMode ? 'Crear Nueva Cuenta' : 'Iniciar Sesión'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {isRegisterMode 
              ? 'Regístrate en la plataforma oficial de AquaPark' 
              : 'Ingresa con tus credenciales de Firebase Auth'}
          </p>
        </div>

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div style={{ 
            background: 'var(--error-bg)', border: '1px solid var(--error-border)', 
            color: 'var(--error)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', 
            marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' 
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {isRegisterMode && (
            <>
              <div className="input-group">
                <label>Nombre Completo *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Juan Pérez"
                  value={formData.displayName}
                  onChange={e => setFormData({...formData, displayName: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Rol Asignado *</label>
                <select 
                  value={formData.desiredRole} 
                  onChange={e => setFormData({...formData, desiredRole: e.target.value})}
                >
                  <option value="pasante">Pasante (Llenado de bitácoras)</option>
                  <option value="encargado">Encargado de Área (Revisión y Aprobación)</option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label><Mail size={14} color="var(--primary)" /> Correo Electrónico *</label>
            <input 
              type="email" 
              required 
              placeholder="tu.correo@aquapark.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="input-group">
            <label><Key size={14} color="var(--primary)" /> Contraseña *</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                style={{ paddingRight: '2.5rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem'
                }}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.85rem' }}
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                <span>Procesando...</span>
              </>
            ) : isRegisterMode ? (
              <>
                <UserPlus size={18} />
                <span>Registrar Cuenta</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Acceder al Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* ALTERNADOR DE MODO LOGIN / REGISTRO */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <button 
            type="button" 
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMsg('');
            }}
            style={{ 
              background: 'none', border: 'none', color: 'var(--primary)', 
              cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' 
            }}
          >
            {isRegisterMode 
              ? '¿Ya tienes una cuenta? Inicia sesión aquí' 
              : '¿No tienes cuenta aún? Regístrate aquí'}
          </button>
        </div>

        {/* PIE DE SEGURIDAD */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
            <Info size={13} /> Roles del sistema: <strong>admin</strong>, <strong>encargado</strong>, <strong>pasante</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
