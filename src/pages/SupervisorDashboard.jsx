import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Key, Search, FileText, Eye, LogOut, Loader, Image as ImageIcon, Link as LinkIcon, FileDown, Trash2, BarChart3, Download, Clock, Sun, Moon } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

const USERS = {
  'hector calle': { role: 'Encargado', password: 'AquaPark#01', displayName: 'Hector Calle' },
  'lizeth de la cruz': { role: 'Encargado', password: 'AquaPark#02', displayName: 'Lizeth de la Cruz' },
  'jhuliana quispe': { role: 'Encargado', password: 'AquaPark#03', displayName: 'Jhuliana Quispe' },
  'alvaro mendoza': { role: 'Encargado', password: 'AquaPark#04', displayName: 'Alvaro Mendoza' },
  'administrador': { role: 'Administrador', password: 'AdminAquaPark#99', displayName: 'Administrador' }
};

export default function SupervisorDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTurno, setFilterTurno] = useState('Todos');
  
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
      .filter(r => r.student?.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(r => filterTurno === 'Todos' || r.turno === filterTurno);
  }, [reports, searchTerm, filterTurno]);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Nombre', 'Carrera', 'Institución', 'Turno', 'Fecha', 'Hora Inicio', 'Hora Envío', 'Actividades', 'Conclusión'];
    const rows = reports.map(r => [
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
      const q = query(
        collection(db, "reports"),
        where("supervisor", "==", supervisorName)
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedReports = [];
      querySnapshot.forEach((doc) => {
        fetchedReports.push({ id: doc.id, ...doc.data() });
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
    if (window.confirm("¿Estás seguro de que quieres eliminar este reporte permanentemente? Esta acción no se puede deshacer.")) {
      try {
        await deleteDoc(doc(db, "reports", reportId));
        setReports(reports.filter(r => r.id !== reportId));
        if (selectedReport && selectedReport.id === reportId) {
           setSelectedReport(null);
        }
      } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Hubo un error al eliminar el reporte.");
      }
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
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '0 0.8rem', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                <Mail size={18} color="var(--text-muted)" />
                <select 
                  required
                  value={loginData.username}
                  onChange={e => setLoginData({...loginData, username: e.target.value})}
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none', width: '100%', padding: '0.8rem 0.5rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="" disabled>Selecciona tu perfil...</option>
                  <option value="hector calle">Hector Calle</option>
                  <option value="lizeth de la cruz">Lizeth de la Cruz</option>
                  <option value="jhuliana quispe">Jhuliana Quispe</option>
                  <option value="alvaro mendoza">Alvaro Mendoza</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
            </div>
            
            <div className="input-group">
              <label>Contraseña</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '0 0.8rem', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                <Key size={18} color="var(--text-muted)" />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={e => setLoginData({...loginData, password: e.target.value})}
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                />
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
              
              {(act.fileType === 'image' || (!act.fileType && act.imageBase64)) && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', textAlign: 'left' }}><strong>Evidencia Fotográfica:</strong></p>
                  <img src={act.fileBase64 || act.imageBase64} style={{ maxWidth: '400px', maxHeight: '300px', border: '1px solid #e5e7eb', padding: '5px' }} alt="Evidencia" />
                </div>
              )}

              {(act.fileType === 'pdf' || act.fileType === 'word') && (
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    <strong>{act.fileType === 'pdf' ? '📄 Documento PDF Adjunto:' : '📝 Documento Word Adjunto:'}</strong> {act.fileName}
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
          <button onClick={() => setSelectedReport(null)} className="btn btn-secondary">
            Volver a la Bandeja
          </button>
          
          <button onClick={exportPDF} disabled={isGeneratingPDF} className="btn btn-primary">
            {isGeneratingPDF ? <Loader className="animate-spin" size={20} /> : <FileDown size={20} />}
            {isGeneratingPDF ? 'Generando Comprobante...' : 'Descargar Comprobante PDF (Para Firma)'}
          </button>
        </div>
        
        <div style={{ borderBottom: '2px solid var(--primary-light)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>Reporte de {selectedReport.student}</h2>
              <p style={{ margin: 0 }}><strong>Carrera/Área:</strong> {selectedReport.career} | <strong>Institución:</strong> {selectedReport.institution}</p>
              <p style={{ margin: 0 }}><strong>Fecha:</strong> {selectedReport.dateString} | <strong>Turno:</strong> {selectedReport.turno || 'N/A'} | <strong>Horario:</strong> Inicio {selectedReport.timeStart || 'N/A'} - Envío {selectedReport.timeEnd || 'N/A'}</p>
            </div>
            <button onClick={(e) => handleDeleteReport(selectedReport.id, e)} className="btn btn-danger" style={{ padding: '0.6rem 1rem' }}>
              <Trash2 size={18} /> Eliminar Reporte
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '1rem' }}>Actividades Realizadas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedReport.activities?.map((act, i) => {
                const isImage = act.fileType === 'image' || (!act.fileType && act.imageBase64);
                const isDoc = act.fileType === 'pdf' || act.fileType === 'word';
                const fileSource = act.fileBase64 || act.imageBase64;
                const fileName = act.fileName || `evidencia_actividad_${i+1}`;

                return (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Actividad #{i + 1}</h4>
                    <p>{act.description}</p>
                    
                    {isImage && fileSource && (
                      <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>Evidencia Fotográfica:</p>
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
                        <a href={fileSource} download={`${fileName}.jpg`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                          <ImageIcon size={16} /> Descargar Imagen
                        </a>
                      )}
                      
                      {isDoc && fileSource && (
                        <a href={fileSource} download={fileName} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                          <FileDown size={16} /> Descargar {act.fileType === 'word' ? 'Word' : 'PDF'} Adjunto
                        </a>
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

          <div style={{ background: 'rgba(0, 240, 255, 0.05)', padding: '1.5rem', border: '1px solid rgba(0, 240, 255, 0.2)', borderLeft: '3px solid var(--primary)' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Conclusión</h3>
            <p style={{ margin: 0, color: 'var(--text-main)', fontStyle: 'italic' }}>"{selectedReport.conclusion}"</p>
          </div>
        </div>
      </div>
    );
  }

  const statCardStyle = {
    flex: '1 1 150px', padding: '1.2rem', background: 'rgba(0, 240, 255, 0.05)',
    border: '1px solid rgba(0, 240, 255, 0.2)', textAlign: 'center',
    clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>Bandeja de Entrada ({currentUser.role})</h2>
          <p style={{ margin: 0 }}>Bienvenido(a), <strong>{currentUser.displayName}</strong>. Estos son los reportes que has recibido.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={exportCSV} style={{ padding: '0.5rem 1rem' }}>
            <Download size={16} /> EXPORTAR CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setCurrentUser(null)}>
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
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '0 0.8rem', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
              <Search size={16} color="var(--primary)" />
              <input 
                type="text" 
                placeholder="Buscar remitente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontSize: '0.9rem', width: '180px', clipPath: 'none' }}
              />
            </div>
            <select 
              value={filterTurno} 
              onChange={(e) => setFilterTurno(e.target.value)}
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 240, 255, 0.3)', color: 'var(--primary-light)', cursor: 'pointer', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
            >
              <option value="Todos">Todos los Turnos</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Jornada Completa">Jornada Completa</option>
            </select>
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
                padding: '1rem 1.2rem', background: 'rgba(0, 15, 30, 0.8)', 
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderLeft: `3px solid ${turnoColor}`,
                transition: 'var(--transition)',
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flex: 1 }} onClick={() => setSelectedReport(report)}>
                  <div style={{ background: `${turnoColor}22`, padding: '0.7rem', border: `1px solid ${turnoColor}`, color: turnoColor }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.05rem' }}>{report.student}</h4>
                      {isNew && <span style={{ background: 'var(--primary)', color: '#030712', fontSize: '0.6rem', padding: '0.15rem 0.5rem', fontWeight: 'bold', letterSpacing: '1px' }}>NUEVO</span>}
                      {report.turno && <span style={{ color: turnoColor, fontSize: '0.7rem', border: `1px solid ${turnoColor}`, padding: '0.1rem 0.4rem', fontWeight: 600 }}>{report.turno}</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8', display: 'flex', gap: '0.8rem', marginTop: '0.3rem' }}>
                      <span>{report.career}</span>
                      <span style={{ color: 'rgba(0,240,255,0.4)' }}>|</span>
                      <span>{report.dateString}</span>
                      <span style={{ color: 'rgba(0,240,255,0.4)' }}>|</span>
                      <span>{report.timeStart || '--:--'} → {report.timeEnd || '--:--'}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedReport(report)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    <Eye size={16} /> VER
                  </button>
                  <button className="btn btn-danger" onClick={(e) => handleDeleteReport(report.id, e)} style={{ padding: '0.4rem 0.6rem' }} title="Eliminar permanentemente">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
