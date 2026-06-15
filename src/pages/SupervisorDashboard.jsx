import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Key, Search, FileText, Eye, EyeOff, LogOut, Loader, Image as ImageIcon, Link as LinkIcon, FileDown, Trash2, BarChart3, Download, Clock, Sun, Moon, ArrowLeft } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import StudentForm from './StudentForm';

const USERS = {
  'hector calle': { role: 'Encargado', password: 'AquaPark#01', displayName: 'Hector Calle' },
  'lizeth de la cruz': { role: 'Encargado', password: 'AquaPark#02', displayName: 'Lizeth de la Cruz' },
  'jhuliana quispe': { role: 'Encargado', password: 'AquaPark#03', displayName: 'Jhuliana Quispe' },
  'alvaro mendoza': { role: 'Encargado', password: 'AquaPark#04', displayName: 'Alvaro Mendoza' },
  'limbert tito': { role: 'Encargado', password: 'AquaPark#05', displayName: 'Limbert Tito' },
  'administrador': { role: 'Administrador', password: 'AdminAquaPark#99', displayName: 'Administrador' }
};

class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid red' }}>
          <h2 style={{ color: '#ef4444' }}>Error al cargar el reporte</h2>
          <p>Ocurrió un fallo en el navegador al intentar renderizar este reporte específico.</p>
          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', color: '#fca5a5' }}>
            {this.state.error?.toString()}
          </pre>
          <button className="btn btn-secondary" onClick={this.props.onReset} style={{ marginTop: '1rem' }}>
            Volver a la Bandeja
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SupervisorDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [view, setView] = useState('inbox');
  
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTurno, setFilterTurno] = useState('Todos');
  
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  // Analytics
  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString('es-ES');
    const todayReports = reports.filter(r => r.dateString === today);
    const manana = reports.filter(r => r.turno === 'Mañana').length;
    const tarde = reports.filter(r => r.turno === 'Tarde').length;
    const jornada = reports.filter(r => r.turno === 'Jornada Completa').length;
    return { total: reports.length, today: todayReports.length, manana, tarde, jornada };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports
      .filter(r => showTrash ? r.isDeleted === true : (r.isDeleted !== true))
      .filter(r => r.student?.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(r => filterTurno === 'Todos' || r.turno === filterTurno);
  }, [reports, searchTerm, filterTurno, showTrash]);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Nombre', 'Carrera', 'Institución', 'Turno', 'Fecha', 'Hora Inicio', 'Hora Envío', 'Actividades', 'Conclusión'];
    const rows = filteredReports.map(r => [
      r.student || '',
      r.career || '',
      r.institution || '',
      r.turno || 'N/A',
      r.dateString || '',
      r.timeStart || '',
      r.timeEnd || '',
      (r.activities?.map(a => a.description).join(' | ')) || '',
      r.conclusion || ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFile = async (e, url, fileName) => {
    e.preventDefault();
    
    // Si la URL viene de Cloudinary y tiene fl_attachment, lo removemos para evitar el Error 401
    let safeUrl = url;
    if (safeUrl.includes('cloudinary.com')) {
      safeUrl = safeUrl.replace(/fl_attachment(:[^/]*)?\//g, '');
      safeUrl = safeUrl.replace(/\/fl_attachment\//g, '/');
    }

    try {
      const response = await fetch(safeUrl);
      if (!response.ok) throw new Error('Error al descargar el archivo');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback seguro usando la URL limpia
      window.open(safeUrl, '_blank');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const userKey = loginData.username.toLowerCase().trim();
    const userObj = USERS[userKey];

    if (userObj && userObj.password === loginData.password) {
      setCurrentUser({ id: userKey, ...userObj });
      setError('');
      fetchReports(userKey);
    } else {
      setError('Credenciales incorrectas. Intenta nuevamente.');
    }
  };

  const fetchReports = async (supervisorName) => {
    setIsLoading(true);
    try {
      // Obtenemos todos y filtramos en cliente para evitar problemas de mayúsculas/minúsculas históricos
      const q = query(collection(db, "reports"));
      
      const querySnapshot = await getDocs(q);
      const fetchedReports = [];
      const userObj = USERS[supervisorName] || {};
      const isGlobalAdmin = userObj.role === 'Administrador';

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Si NO es Admin global, ignoramos por completo los borrados
        if (data.isDeleted === true && !isGlobalAdmin) return;
        
        const dbSupervisor = (data.supervisor || '').toLowerCase().trim();
        // Si no es admin, solo ve los suyos (ignorando mayúsculas)
        if (!isGlobalAdmin && dbSupervisor !== supervisorName) return;

        if (data.turno === 'Mañana' || data.turno === 'Jornada Completa') data.timeStart = '08:00';
        else if (data.turno === 'Tarde') data.timeStart = '14:00';
        fetchedReports.push({ id: doc.id, ...data });
      });
      
      fetchedReports.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setReports(fetchedReports);
    } catch (err) {
      console.error("Error fetching reports:", err);
      alert("Hubo un error al obtener los reportes.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation(); // Evitar abrir el detalle
    if (window.confirm("¿Estás seguro de que quieres enviar este reporte a la Papelera? (El Administrador podrá recuperarlo)")) {
      try {
        await updateDoc(doc(db, "reports", reportId), { isDeleted: true });
        setReports(reports.map(r => r.id === reportId ? { ...r, isDeleted: true } : r));
        if (selectedReport && selectedReport.id === reportId) {
           setSelectedReport(null);
        }
      } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Hubo un error al eliminar el reporte.");
      }
    }
  };

  const handleRestoreReport = async (reportId, e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "reports", reportId), { isDeleted: false });
      setReports(reports.map(r => r.id === reportId ? { ...r, isDeleted: false } : r));
      if (selectedReport && selectedReport.id === reportId) {
         setSelectedReport(null);
      }
    } catch (err) {
      console.error("Error restaurando:", err);
      alert("Hubo un error al restaurar el reporte.");
    }
  };

  const exportPDF = () => {
    setIsGeneratingPDF(true);
    const element = document.getElementById('supervisor-pdf-formal-template');
    
    const opt = {
      margin:       0.5,
      filename:     `Comprobante_${selectedReport.student}_${selectedReport.dateString.replace(/\//g, '-')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    element.style.display = 'block';

    html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none';
      setIsGeneratingPDF(false);
    });
  };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Acceso Administrativo</h2>
            <p style={{ margin: 0 }}>Inicia sesión para revisar tu buzón de reportes.</p>
          </div>
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: 'var(--error)', padding: '0.8rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="input-group">
              <label>Usuario / Encargado</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', padding: '0 0.8rem', borderRadius: 'var(--radius-md)' }}>
                <Mail size={18} color="var(--text-muted)" />
                <select 
                  required
                  value={loginData.username}
                  onChange={e => setLoginData({...loginData, username: e.target.value})}
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none', width: '100%', padding: '0.85rem 0.5rem', cursor: 'pointer', outline: 'none', color: 'var(--text-main)' }}
                >
                  <option value="" disabled>Selecciona tu perfil...</option>
                  <option value="hector calle">Hector Calle</option>
                  <option value="lizeth de la cruz">Lizeth de la Cruz</option>
                  <option value="jhuliana quispe">Jhuliana Quispe</option>
                  <option value="alvaro mendoza">Alvaro Mendoza</option>
                  <option value="limbert tito">Limbert Tito</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
            </div>
            
            <div className="input-group">
              <label>Contraseña</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', padding: '0 0.8rem', borderRadius: 'var(--radius-md)' }}>
                <Key size={18} color="var(--text-muted)" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={e => setLoginData({...loginData, password: e.target.value})}
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none', color: 'var(--text-main)' }}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (selectedReport) {
    return (
      <ReportErrorBoundary onReset={() => setSelectedReport(null)}>
        <div className="animate-fade-in glass-panel" style={{ position: 'relative' }}>
          
          {/* PLANTILLA PDF OCULTA PARA EL ENCARGADO */}
        <div id="supervisor-pdf-formal-template" style={{ display: 'none', background: 'white', color: 'black', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '15px', marginBottom: '20px' }}>
            <h1 style={{ color: '#1e3a8a', margin: '0 0 10px 0', fontSize: '24px' }}>INFORME DIARIO DE ACTIVIDADES</h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>Control AquaPark - Comprobante de Aprobación</p>
          </div>

          <table style={{ width: '100%', marginBottom: '25px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold', width: '30%' }}>Fecha y Horario:</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                  {selectedReport.dateString} | <strong>Inicio:</strong> {selectedReport.timeStart || 'N/A'} - <strong>Envío:</strong> {selectedReport.timeEnd || 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Remitente (Quien Reporta):</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{selectedReport.student || 'Sin especificar'}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Carrera / Institución:</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{selectedReport.career || '-'} / {selectedReport.institution || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Destinatario:</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{selectedReport.supervisorOriginal || selectedReport.supervisor}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Turno:</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{selectedReport.turno || 'No especificado'}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ color: '#1e3a8a', fontSize: '18px', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>Actividades Realizadas</h2>
          {selectedReport.activities?.map((act, idx) => (
            <div key={idx} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0' }}>{idx + 1}. Tarea Ejecutada</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.5' }}>{act.description || 'Sin descripción'}</p>
              {act.link && (
                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>Referencia:</strong> <a href={act.link} style={{ color: '#2563eb' }}>{act.link}</a></p>
              )}
              
              {(act.fileType === 'image' || (!act.fileType && (act.imageBase64 || act.fileUrl))) && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', textAlign: 'left' }}><strong>Evidencia Fotográfica:</strong></p>
                  <img src={act.fileBase64 || act.fileUrl || act.imageBase64} style={{ maxWidth: '400px', maxHeight: '300px', border: '1px solid #e5e7eb', padding: '5px' }} alt="Evidencia" />
                </div>
              )}

              {(act.fileType === 'pdf' || act.fileType === 'word') && (
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    <strong>{act.fileType === 'pdf' ? '📄 Documento PDF Adjunto:' : '📝 Documento Word Adjunto:'}</strong> {act.fileName}
                  </p>
                </div>
              )}

              {(act.fileType === 'video') && (
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    <strong>🎥 Video Adjunto:</strong> {act.fileName} (Ver en el sistema web)
                  </p>
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '18px', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>Conclusión del Día</h2>
            <p style={{ fontSize: '14px', lineHeight: '1.6', fontStyle: 'italic', backgroundColor: '#f9fafb', padding: '15px', borderLeft: '4px solid #1e3a8a' }}>
              {selectedReport.conclusion || 'Sin conclusión proporcionada.'}
            </p>
          </div>
          
          <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-around', pageBreakInside: 'avoid' }}>
            <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '10px' }}>
              <strong>Firma del Remitente</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{selectedReport.student}</span>
            </div>
            <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '10px' }}>
              <strong>Firma de Aprobación</strong><br/>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{selectedReport.supervisorOriginal || 'Sello y Firma'}</span>
            </div>
          </div>
        </div>

        {/* UI PRINCIPAL DEL DETALLE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <button onClick={() => setSelectedReport(null)} className="btn btn-solid-warning">
            <ArrowLeft size={18} /> Volver a la Bandeja
          </button>
          
          <button onClick={exportPDF} disabled={isGeneratingPDF} className="btn btn-primary">
            {isGeneratingPDF ? <Loader className="animate-spin" size={20} /> : <FileDown size={20} />}
            {isGeneratingPDF ? 'Generando Comprobante...' : 'Descargar Comprobante PDF (Para Firma)'}
          </button>
        </div>
        
        <div style={{ borderBottom: '2px solid var(--primary-light)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>Reporte de {selectedReport.student} {selectedReport.isDeleted ? '(EN PAPELERA)' : ''}</h2>
              <p style={{ margin: 0 }}><strong>Carrera/Área:</strong> {selectedReport.career} | <strong>Institución:</strong> {selectedReport.institution}</p>
              <p style={{ margin: 0 }}><strong>Fecha:</strong> {selectedReport.dateString} | <strong>Turno:</strong> {selectedReport.turno || 'N/A'} | <strong>Horario:</strong> Inicio {selectedReport.timeStart || 'N/A'} - Envío {selectedReport.timeEnd || 'N/A'}</p>
            </div>
            {selectedReport.isDeleted ? (
              <button onClick={(e) => handleRestoreReport(selectedReport.id, e)} className="btn btn-primary" style={{ padding: '0.6rem 1rem' }}>
                <LinkIcon size={18} /> Restaurar Reporte
              </button>
            ) : (
              <button onClick={(e) => handleDeleteReport(selectedReport.id, e)} className="btn btn-danger" style={{ padding: '0.6rem 1rem' }}>
                <Trash2 size={18} /> Enviar a Papelera
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '1rem' }}>Actividades Realizadas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedReport.activities?.map((act, i) => {
                const isImage = act.fileType === 'image' || (!act.fileType && (act.imageBase64 || act.fileUrl));
                const isDoc = act.fileType === 'pdf' || act.fileType === 'word';
                const isVideo = act.fileType === 'video';
                const fileSource = act.fileUrl || act.fileBase64 || act.imageBase64;
                const fileName = act.fileName || `evidencia_actividad_${i+1}`;

                return (
                  <div key={i} style={{ background: 'var(--surface-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Actividad #{i + 1}</h4>
                    <p style={{ color: 'var(--text-main)' }}>{act.description}</p>
                    
                    {isImage && fileSource && (
                      <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', display: 'inline-block', border: '1px solid var(--surface-border)' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Evidencia Fotográfica:</p>
                        <img src={fileSource} alt={`Evidencia ${i+1}`} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px' }} />
                      </div>
                    )}

                    {isDoc && fileSource && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={24} color={act.fileType === 'word' ? '#2563eb' : 'var(--primary)'} />
                        <span style={{ fontWeight: 500 }}>Documento {act.fileType === 'word' ? 'Word' : 'PDF'} Adjunto: {fileName}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      {isImage && fileSource && (
                        <a href={fileSource} onClick={(e) => handleDownloadFile(e, fileSource, `${fileName}.jpg`)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <ImageIcon size={16} /> Descargar Imagen
                        </a>
                      )}
                      
                      {isDoc && fileSource && (
                        <a href={fileSource} onClick={(e) => handleDownloadFile(e, fileSource, fileName)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <FileDown size={16} /> Descargar {act.fileType === 'word' ? 'Word' : 'PDF'} Adjunto
                        </a>
                      )}

                      {isVideo && fileSource && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>Video Adjunto:</p>
                          <video controls src={fileSource} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            Tu navegador no soporta video.
                          </video>
                          <a href={fileSource} onClick={(e) => handleDownloadFile(e, fileSource, `${fileName}.mp4`)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            <FileDown size={16} /> Descargar Video
                          </a>
                        </div>
                      )}

                      {act.link && (
                        <a href={act.link} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                          <LinkIcon size={16} /> Abrir Enlace
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--surface-secondary)', padding: '1.5rem', border: '1px solid var(--surface-border)', borderLeft: '3px solid var(--primary)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Conclusión</h3>
            <p style={{ margin: 0, color: 'var(--text-main)', fontStyle: 'italic' }}>"{selectedReport.conclusion}"</p>
          </div>
        </div>
      </div>
      </ReportErrorBoundary>
    );
  }

  const statCardStyle = {
    flex: '1 1 150px', padding: '1.2rem', background: 'var(--surface-secondary)',
    border: '1px solid var(--surface-border)', textAlign: 'center',
    borderRadius: 'var(--radius-md)'
  };

  if (view === 'compose') {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ marginBottom: '0.2rem' }}>Redactar Informe para RR.HH</h2>
            <p style={{ margin: 0 }}>Completa tu reporte de encargado. Será enviado directamente al Administrador.</p>
          </div>
          <button className="btn btn-solid-warning" onClick={() => setView('inbox')}>
            <ArrowLeft size={18} /> Volver a Bandeja
          </button>
        </div>
        <StudentForm isEncargadoMode={true} encargadoName={currentUser.displayName} onCancel={() => setView('inbox')} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>Bandeja de Entrada ({currentUser.role})</h2>
          <p style={{ margin: 0 }}>Bienvenido(a), <strong>{currentUser.displayName}</strong>. Estos son los reportes que has recibido.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {currentUser.role !== 'Administrador' && (
            <button className="btn btn-primary" onClick={() => setView('compose')} style={{ padding: '0.5rem 1rem' }}>
              <FileText size={16} /> REDACTAR INFORME
            </button>
          )}
          <button className="btn btn-primary" onClick={exportCSV} style={{ padding: '0.5rem 1rem' }}>
            <Download size={16} /> EXPORTAR CSV
          </button>
          <button className="btn btn-solid-danger" onClick={() => setCurrentUser(null)}>
            <LogOut size={18} /> SALIR
          </button>
        </div>
      </div>

      {/* ANALYTICS PANEL */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={statCardStyle}>
          <BarChart3 size={28} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Space Grotesk, monospace' }}>{stats.total}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Reportes</div>
        </div>
        <div style={statCardStyle}>
          <Clock size={28} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)', fontFamily: 'Space Grotesk, monospace' }}>{stats.today}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Hoy</div>
        </div>
        <div style={statCardStyle}>
          <Sun size={28} color="#FBBF24" style={{ margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FBBF24', fontFamily: 'Space Grotesk, monospace' }}>{stats.manana}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Mañana</div>
        </div>
        <div style={statCardStyle}>
          <Moon size={28} color="#818CF8" style={{ margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#818CF8', fontFamily: 'Space Grotesk, monospace' }}>{stats.tarde}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Tarde</div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Reportes Recientes</h3>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', padding: '0 0.8rem', borderRadius: 'var(--radius-md)' }}>
              <Search size={16} color="var(--primary)" />
              <input 
                type="text" 
                placeholder="Buscar remitente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontSize: '0.9rem', width: '180px' }}
              />
            </div>
            <select 
              value={filterTurno} 
              onChange={(e) => setFilterTurno(e.target.value)}
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', background: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: 'var(--radius-md)' }}
            >
              <option value="Todos">Todos los Turnos</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Jornada Completa">Jornada Completa</option>
            </select>
            {currentUser?.role === 'Administrador' && (
              <button 
                onClick={() => setShowTrash(!showTrash)} 
                className={`btn ${showTrash ? 'btn-danger' : 'btn-secondary'}`} 
                style={{ padding: '0.4rem 0.8rem' }}
                title="Ver reportes en papelera"
              >
                <Trash2 size={16} /> {showTrash ? 'Salir de Papelera' : 'Papelera'}
              </button>
            )}
            <button onClick={() => fetchReports(currentUser.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
              ACTUALIZAR
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader className="animate-spin" size={32} color="var(--primary)" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {reports.length === 0 ? 'No tienes reportes nuevos.' : 'No se encontraron reportes con ese filtro.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {filteredReports.map(report => {
              const isNew = report.createdAt ? (Math.abs(new Date() - report.createdAt.toDate()) / 36e5) < 24 : false;
              const turnoColor = report.turno === 'Mañana' ? '#FBBF24' : report.turno === 'Tarde' ? '#818CF8' : 'var(--primary)';
              return (
              <div key={report.id} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '1rem 1.2rem', background: 'var(--surface)', 
                border: '1px solid var(--surface-border)',
                borderLeft: `3px solid ${turnoColor}`,
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flex: 1 }} onClick={() => setSelectedReport(report)}>
                  <div style={{ background: `${turnoColor}22`, padding: '0.7rem', border: `1px solid ${turnoColor}`, color: turnoColor, borderRadius: 'var(--radius-md)' }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>{report.student}</h4>
                      {isNew && <span style={{ background: 'var(--primary)', color: '#ffffff', fontSize: '0.6rem', padding: '0.15rem 0.5rem', fontWeight: 'bold', letterSpacing: '1px', borderRadius: '4px' }}>NUEVO</span>}
                      {report.turno && <span style={{ color: turnoColor, fontSize: '0.7rem', border: `1px solid ${turnoColor}`, padding: '0.1rem 0.4rem', fontWeight: 600, borderRadius: '4px' }}>{report.turno}</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.8rem', marginTop: '0.3rem' }}>
                      <span>{report.career}</span>
                      <span style={{ color: 'var(--surface-border)' }}>|</span>
                      <span>{report.dateString}</span>
                      <span style={{ color: 'var(--surface-border)' }}>|</span>
                      <span>{report.timeStart || '--:--'} → {report.timeEnd || '--:--'}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedReport(report)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    <Eye size={16} /> VER
                  </button>
                  {report.isDeleted ? (
                    <button className="btn btn-primary" onClick={(e) => handleRestoreReport(report.id, e)} style={{ padding: '0.4rem 0.6rem' }} title="Restaurar de la Papelera">
                      <LinkIcon size={16} />
                    </button>
                  ) : (
                    <button className="btn btn-danger" onClick={(e) => handleDeleteReport(report.id, e)} style={{ padding: '0.4rem 0.6rem' }} title="Mover a la Papelera">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
