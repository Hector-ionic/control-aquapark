import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, User, Lock, Mail, ArrowRight, 
  Sparkles, ShieldAlert, GraduationCap, Briefcase, Eye, EyeOff, Waves,
  KeyRound, X, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_MODULES } from '../services/auditService';
import { sendPasswordResetNotification } from '../services/mailService';
import { createPasswordRequest } from '../services/passwordRequestService';

export default function Login() {
  const { login, resetPassword, predefinedUsers = [], user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Estados para el Modal de Restablecer Contraseña
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
        password: formData.password
      });

      toast.success(`¡Bienvenido(a), ${loggedUser.name}! (Rol: ${loggedUser.role})`);
      const destination = location.state?.from?.pathname || (loggedUser.role === 'pasante' ? '/' : '/supervisor');
      navigate(destination, { replace: true });
      // Auditoría: Login exitoso
      logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_EXITOSO,
        module: AUDIT_MODULES.AUTH,
        details: `Acceso autorizado a ${loggedUser.name} con rol ${loggedUser.role}.`,
        userName: loggedUser.name,
        userRole: loggedUser.role
      });
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || 'Ocurrió un error al iniciar sesión.';
      toast.error(errorMsg);
      // Auditoría: Login fallido / bloqueo por rol
      logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FALLIDO,
        module: AUDIT_MODULES.AUTH,
        details: `Acceso rechazado para "${formData.email}": ${errorMsg}`,
        userName: formData.email,
        userRole: "No autenticado"
      });
    }
  };

  // Manejador para restablecer contraseña
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!resetEmail.trim()) {
      toast.error('Por favor ingresa tu correo o usuario registrado');
      return;
    }

    if (!newPassword.trim() || newPassword.length < 4) {
      toast.error('La nueva contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden. Por favor verifícalas');
      return;
    }

    setIsResetting(true);
    try {
      const inputIdentifier = resetEmail.trim().toLowerCase();
      const userFound = predefinedUsers.find(u => 
        u.email.toLowerCase() === inputIdentifier || 
        (u.aliases && u.aliases.some(alias => alias.toLowerCase() === inputIdentifier))
      );

      if (!userFound) {
        throw new Error(`El usuario o correo "${resetEmail}" no está registrado en el sistema.`);
      }

      // Crear solicitud en Firestore y despachar correo a Gmail del Administrador (Carlos)
      await createPasswordRequest({
        name: userFound.name,
        email: userFound.email,
        role: userFound.role,
        requestedPassword: newPassword
      });

      toast.success(`🔔 Solicitud enviada al Administrador. Se ha notificado a su Gmail y aparecerá en su panel para admitirte.`);

      // Auditoría: Solicitud de restablecimiento registrada
      logAuditEvent({
        action: AUDIT_ACTIONS.RESTABLECER_PASSWORD,
        module: AUDIT_MODULES.AUTH,
        details: `Solicitud de restablecimiento de contraseña registrada para ${userFound.name} (${userFound.email}). Notificación enviada al Admin.`,
        userName: userFound.name,
        userRole: userFound.role,
        userId: userFound.id
      });

      setFormData(prev => ({ ...prev, email: resetEmail, password: '' }));
      setShowResetModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || 'No se pudo enviar la solicitud.';
      toast.error(errorMsg);

      // Auditoría: Intento fallido
      logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FALLIDO,
        module: AUDIT_MODULES.AUTH,
        details: `Intento fallido de solicitar restablecimiento para "${resetEmail}": ${errorMsg}`,
        userName: resetEmail,
        userRole: 'No autenticado'
      });
    } finally {
      setIsResetting(false);
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
          boxShadow: 'var(--shadow-md)',
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

          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            Acceso al Sistema
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Control de Bitácoras & Supervisión — <strong>AquaPark</strong>
          </p>
        </div>

        {/* FORMULARIO DE ACCESO */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
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

          {/* ENLACE RESTAURAR CONTRASEÑA */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.4rem', marginBottom: '0.2rem' }}>
            <button
              type="button"
              onClick={() => {
                setResetEmail(formData.email || '');
                setNewPassword('');
                setConfirmPassword('');
                setShowResetModal(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.82rem',
                cursor: 'pointer',
                padding: '0.2rem 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 500,
                textDecoration: 'underline'
              }}
            >
              <KeyRound size={13} />
              <span>¿Olvidaste tu contraseña?</span>
            </button>
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
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span>Ingresar al Sistema</span>
            <ArrowRight size={17} />
          </button>

        </form>

        <div style={{ marginTop: '1.6rem', paddingTop: '1.2rem', borderTop: '1px solid var(--surface-border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            AquaPark Corporate Platform • Seguridad SSL
          </span>
        </div>

      </div>

      {/* MODAL PARA RESTABLECER CONTRASEÑA */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div 
            className="animate-fade-in"
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              position: 'relative',
              color: '#f8fafc'
            }}
          >
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              style={{
                position: 'absolute',
                top: '1.2rem',
                right: '1.2rem',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            {/* Cabecera del Modal */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                <KeyRound size={28} />
              </div>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                Restablecer Contraseña
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                Ingresa tu correo o usuario y la clave solicitada. El Administrador recibirá la alerta en su Gmail para admitirte.
              </p>
            </div>

            {/* Formulario de Restablecimiento */}
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div className="input-group">
                <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                  <Mail size={13} color="#38bdf8" /> Correo o Usuario *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="ej. juan.perez@aquapark.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div className="input-group">
                <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                  <Lock size={13} color="#38bdf8" /> Nueva Contraseña *
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 4 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.2rem 0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#f8fafc',
                      fontSize: '0.9rem'
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ 
                      position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                  <CheckCircle2 size={13} color="#38bdf8" /> Confirmar Nueva Contraseña *
                </label>
                <input 
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{
                    flex: 1.5,
                    padding: '0.65rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: '1px solid #0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: isResetting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  {isResetting ? 'Enviando Solicitud...' : 'Solicitar al Administrador'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
