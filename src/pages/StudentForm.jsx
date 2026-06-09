import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Link as LinkIcon, Send, FileDown, Loader, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Función mágica para aplastar imágenes gigantes de Canva sin perder mucha calidad visual
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const maxWidth = 1024;
        const maxHeight = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height *= maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width *= maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Retorna Base64 comprimido al 65% de calidad JPEG (suficiente para leerse perfecto en un PDF)
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export default function StudentForm({ isEncargadoMode = false, encargadoName = '', onCancel = null }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startTime] = useState(new Date());
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [formData, setFormData] = useState({
    name: isEncargadoMode ? encargadoName : '',
    career: isEncargadoMode ? 'Encargado de Área' : '',
    institution: isEncargadoMode ? 'Control AquaPark' : '',
    supervisor: isEncargadoMode ? 'Administrador' : 'Hector Calle',
    turno: '',
    conclusion: ''
  });

  const [activities, setActivities] = useState([
    { id: 1, description: '', link: '', fileName: '', fileBase64: null, fileType: null }
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // CARGAR AUTOGUARDADO
  useEffect(() => {
    const savedForm = localStorage.getItem('aquapark_draft_form');
    const savedActivities = localStorage.getItem('aquapark_draft_activities');
    if (savedForm) {
      try { setFormData(JSON.parse(savedForm)); } catch(e){}
    }
    if (savedActivities) {
      try { setActivities(JSON.parse(savedActivities)); } catch(e){}
    }
  }, []);

  // GUARDAR AUTOGUARDADO
  useEffect(() => {
    localStorage.setItem('aquapark_draft_form', JSON.stringify(formData));
    const safeActivities = activities.map(act => {
      const { rawFile, ...rest } = act; // Removemos rawFile porque no se puede guardar en localStorage
      return rest;
    });
    localStorage.setItem('aquapark_draft_activities', JSON.stringify(safeActivities));
  }, [formData, activities]);

  const handleAddActivity = () => {
    setActivities([
      ...activities,
      { id: Date.now(), description: '', link: '', fileName: '', fileBase64: null, fileType: null }
    ]);
  };

  const handleRemoveActivity = (id) => {
    if (activities.length > 1) {
      setActivities(activities.filter(act => act.id !== id));
    }
  };

  const handleActivityChange = (id, field, value) => {
    setActivities(activities.map(act => 
      act.id === id ? { ...act, [field]: value } : act
    ));
  };

  const handleFileChange = async (id, e) => {
    const file = e.target.files[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      const isWord = file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx');
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      let type = 'other';
      if (isImage) type = 'image';
      if (isPdf) type = 'pdf';
      if (isWord) type = 'word';
      if (isVideo) type = 'video';

      // Límite generoso de 50MB para documentos pesados y videos
      if (!isImage && file.size > 50 * 1024 * 1024) {
        alert("El documento es demasiado pesado. El máximo permitido en la nube es 50MB por razones de conexión de red.");
        e.target.value = null; // reset
        return;
      }

      // Límite extremo de seguridad para evitar cuelgues del navegador (300MB)
      if (isImage && file.size > 300 * 1024 * 1024) {
        alert("La imagen es tan pesada que tu navegador se colgaría intentando comprimirla (máximo 300MB permitidos).");
        e.target.value = null;
        return;
      }

      try {
        let finalBase64 = null;
        
        if (isImage) {
           // Mantenemos la compresión SOLO para mostrar la vista previa local rápida en el navegador
           finalBase64 = await compressImage(file);
        }

        setActivities(activities.map(act => 
          act.id === id ? { 
            ...act, 
            fileName: file.name, 
            fileType: type,
            fileBase64: finalBase64,
            rawFile: file // Guardamos el archivo original para subirlo a Firebase Storage al dar Enviar
          } : act
        ));
      } catch (err) {
        console.error("Error al procesar el archivo:", err);
        alert("Hubo un error al procesar la imagen. Intenta con un formato común (JPG, PNG).");
      }
    }
  };

  const exportPDF = () => {
    return new Promise((resolve) => {
      setIsGeneratingPDF(true);
      const element = document.getElementById('pdf-formal-template');
      
      const opt = {
        margin:       0.5,
        filename:     `Informe_${formData.name || 'Pasante'}_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      element.style.display = 'block';

      html2pdf().set(opt).from(element).save().then(() => {
        element.style.display = 'none';
        setIsGeneratingPDF(false);
        resolve();
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // VALIDACIONES ESTRICTAS ANTIBASURA
    if (formData.conclusion.trim().length < 10) {
      alert("❌ Tu conclusión es demasiado corta. Por favor escribe al menos 10 caracteres resumiendo tu día.");
      return;
    }

    const hasValidActivity = activities.some(act => act.description.trim().length > 5 || act.rawFile);
    if (!hasValidActivity) {
      alert("❌ Reporte vacío: Debes escribir al menos una actividad válida (más de 5 letras) o subir un archivo adjunto.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const hasFiles = activities.some(act => act.rawFile);
      if (hasFiles) {
        setUploadStatus('Subiendo archivos pesados (videos/documentos), no cierres la ventana...');
      }

      const processedActivities = await Promise.all(activities.map(async (act) => {
        let finalUrl = null;

        if (act.rawFile) {
          const cloudFormData = new FormData();
          cloudFormData.append('file', act.rawFile);
          cloudFormData.append('upload_preset', 'ldqkrdsr');

          try {
            const res = await fetch('https://api.cloudinary.com/v1_1/dqrc7vc9y/auto/upload', {
              method: 'POST',
              body: cloudFormData
            });
            const data = await res.json();
            
            if (data.secure_url) {
              finalUrl = data.secure_url;
            } else {
              throw new Error("No se recibió URL de Cloudinary");
            }
          } catch (cloudErr) {
            console.error("Error subiendo a Cloudinary:", cloudErr);
            throw new Error("No se pudo subir el archivo " + act.rawFile.name + ". Revisa tu conexión a internet.");
          }
        }

        return {
          description: act.description,
          link: act.link || '',
          fileBase64: act.fileBase64 || null,
          fileUrl: finalUrl || null,
          fileType: act.fileType || null,
          fileName: act.fileName || ''
        };
      }));

      const submitTime = new Date();

      let calculatedTimeStart = startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      if (formData.turno === 'Mañana' || formData.turno === 'Jornada Completa') {
        calculatedTimeStart = '08:00';
      } else if (formData.turno === 'Tarde') {
        calculatedTimeStart = '14:00';
      }

      const reportData = {
        student: formData.name,
        career: formData.career,
        institution: formData.institution,
        supervisor: formData.supervisor.toLowerCase().trim(),
        supervisorOriginal: formData.supervisor,
        turno: formData.turno,
        conclusion: formData.conclusion,
        activities: processedActivities,
        status: 'Nuevo',
        createdAt: serverTimestamp(),
        dateString: submitTime.toLocaleDateString('es-ES'),
        timeStart: calculatedTimeStart,
        timeEnd: submitTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };

      await addDoc(collection(db, "reports"), reportData);

      // LIMPIAR AUTOGUARDADO TRAS ÉXITO
      localStorage.removeItem('aquapark_draft_form');
      localStorage.removeItem('aquapark_draft_activities');

      const wantsPDF = window.confirm("¡Reporte enviado con éxito al encargado!\n\n¿Deseas descargar tu propio informe en formato PDF para tus registros personales antes de que se limpie la pantalla?");
      
      if (wantsPDF) {
        await exportPDF();
      }
      
      if (isEncargadoMode && onCancel) {
        onCancel();
      } else {
        setFormData({ name: '', career: '', institution: '', supervisor: 'Hector Calle', turno: '', conclusion: '' });
        setActivities([{ id: 1, description: '', link: '', fileName: '', fileBase64: null, fileType: null }]);
      }
      
    } catch (error) {
      console.error("Error subiendo reporte: ", error);
      if (error.message && error.message.includes("payload is too large")) {
         alert("Hubo un error: Los archivos adjuntos son muy pesados para la base de datos. Por favor reduce su tamaño.");
      } else if (error.message) {
         alert("Error: " + error.message);
      } else {
         alert("Hubo un error al enviar el reporte. Asegúrate de tener conexión.");
      }
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const dateStr = currentTime.toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  let startStr = startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (formData.turno === 'Mañana' || formData.turno === 'Jornada Completa') {
    startStr = '08:00';
  } else if (formData.turno === 'Tarde') {
    startStr = '14:00';
  }
  
  const currentStr = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* PLANTILLA PDF OCULTA */}
      <div id="pdf-formal-template" style={{ display: 'none', background: 'white', color: 'black', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '15px', marginBottom: '20px' }}>
          <h1 style={{ color: '#1e3a8a', margin: '0 0 10px 0', fontSize: '24px' }}>INFORME DIARIO DE PASANTÍAS</h1>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>Control AquaPark - Sistema de Registro</p>
        </div>

        <table style={{ width: '100%', marginBottom: '25px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold', width: '30%' }}>Fecha y Horario:</td>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                {dateStr} | <strong>Inicio:</strong> {startStr} - <strong>Envío:</strong> {currentStr}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Remitente:</td>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{formData.name || 'Sin especificar'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Carrera / Institución:</td>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{formData.career || '-'} / {formData.institution || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Destinatario:</td>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{formData.supervisor}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>Turno:</td>
              <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{formData.turno || 'No especificado'}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ color: '#1e3a8a', fontSize: '18px', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>Actividades Realizadas</h2>
        {activities.map((act, idx) => (
          <div key={idx} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0' }}>{idx + 1}. Tarea Ejecutada</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.5' }}>{act.description || 'Sin descripción'}</p>
            {act.link && (
              <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>Referencia:</strong> <a href={act.link} style={{ color: '#2563eb' }}>{act.link}</a></p>
            )}
            
            {act.fileBase64 && act.fileType === 'image' && (
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px', textAlign: 'left' }}><strong>Evidencia Fotográfica:</strong></p>
                <img src={act.fileBase64} style={{ maxWidth: '400px', maxHeight: '300px', border: '1px solid #e5e7eb', padding: '5px' }} alt="Evidencia" />
              </div>
            )}

            {act.fileBase64 && (act.fileType === 'pdf' || act.fileType === 'word') && (
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
            {formData.conclusion || 'Sin conclusión proporcionada.'}
          </p>
        </div>
        
        <div style={{ marginTop: '50px', textAlign: 'center', pageBreakInside: 'avoid' }}>
          <div style={{ borderTop: '1px solid black', width: '250px', margin: '0 auto', paddingTop: '10px' }}>
            <strong>Firma del Remitente</strong><br/>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{formData.name}</span>
          </div>
        </div>
      </div>

      {/* UI PRINCIPAL */}
      <div className="glass-panel" id="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{isEncargadoMode ? 'Informe Directo a RR.HH' : 'Registro Diario de Actividades'}</h2>
          <p style={{ margin: 0 }}>{isEncargadoMode ? 'Redacta tu informe de encargado aquí.' : 'Llena este formulario al finalizar tu jornada.'}</p>
        </div>
        <div style={{ textAlign: 'right', background: 'var(--surface-border)', padding: '0.8rem 1.2rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', textTransform: 'capitalize', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{dateStr}</div>
          <div style={{ fontWeight: 600, color: 'var(--primary-dark)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Inicio: {startStr}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>Actual: {currentStr}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div className="glass-card">
          <h3 style={{ borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            1. Datos Generales
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {!isEncargadoMode ? (
              <>
                <div className="input-group">
                  <label>Nombre Completo</label>
                  <input type="text" required placeholder="Ej. Juan Pérez" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Carrera / Especialidad</label>
                  <select required value={formData.career} onChange={e => setFormData({...formData, career: e.target.value})}>
                    <option value="" disabled>Seleccione una carrera...</option>
                    <option value="Ingeniería en Sistemas">Ingeniería en Sistemas</option>
                    <option value="Ingeniería Comercial">Ingeniería Comercial</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Ingeniería Civil">Ingeniería Civil</option>
                    <option value="Arquitectura">Arquitectura</option>
                    <option value="Comercio Internacional">Comercio Internacional</option>
                    <option value="Administración de empresas">Administración de empresas</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Institución Educativa</label>
                  <input type="text" required placeholder="Ej. Universidad Tecnológica" value={formData.institution} onChange={e => setFormData({...formData, institution: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Enviar a (Encargado)</label>
                  <select required value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})}>
                    <option value="Hector Calle">Hector Calle</option>
                    <option value="Lizeth de la Cruz">Lizeth de la Cruz</option>
                    <option value="Jhuliana Quispe">Jhuliana Quispe</option>
                    <option value="Alvaro Mendoza">Alvaro Mendoza</option>
                    <option value="Limbert Tito">Limbert Tito</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label>Nombre del Remitente</label>
                  <input type="text" disabled value={formData.name} />
                </div>
                <div className="input-group">
                  <label>Destinatario Fijo</label>
                  <input type="text" disabled value="RR.HH (Administrador)" />
                </div>
              </>
            )}
            <div className="input-group">
              <label>Turno</label>
              <select required value={formData.turno} onChange={e => setFormData({...formData, turno: e.target.value})}>
                <option value="" disabled>Seleccione turno...</option>
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Jornada Completa">Jornada Completa</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>2. Actividades Realizadas</h3>
            <button type="button" className="btn btn-secondary" onClick={handleAddActivity} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              <Plus size={16} /> Agregar Actividad
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {activities.map((act, index) => (
              <div key={act.id} style={{ background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', position: 'relative' }}>
                
                {activities.length > 1 && (
                  <button type="button" onClick={() => handleRemoveActivity(act.id)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }} title="Eliminar Actividad">
                    <Trash2 size={18} />
                  </button>
                )}
                
                <h4 style={{ color: 'var(--primary-dark)', marginBottom: '1rem' }}>Actividad #{index + 1}</h4>
                
                <div className="input-group">
                  <label>Descripción de la Tarea</label>
                  <textarea required placeholder="Describe detalladamente qué hiciste..." value={act.description} onChange={e => handleActivityChange(act.id, 'description', e.target.value)} style={{ minHeight: '80px' }}></textarea>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Adjuntar Evidencia (Imagen, PDF, Word o Video)</label>
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                      <input type="file" accept="image/*,.pdf,.doc,.docx,video/*" onChange={(e) => handleFileChange(act.id, e)} style={{ position: 'absolute', opacity: 0, left: 0, top: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10, clipPath: 'none' }} />
                      <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', background: 'rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 }}>
                        <Upload size={18} /> {act.fileName || 'Seleccionar Archivo (Máx 800KB)'}
                      </button>
                    </div>
                    
                    {act.fileBase64 && act.fileType === 'image' && (
                      <div style={{ marginTop: '1rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', background: 'rgba(0,0,0,0.1)' }}>
                        <img src={act.fileBase64} alt={`Evidencia ${index + 1}`} style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px' }} />
                      </div>
                    )}
                    
                    {act.fileBase64 && (act.fileType === 'pdf' || act.fileType === 'word') && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={24} color={act.fileType === 'word' ? '#2563eb' : 'var(--primary)'} />
                        <span style={{ fontWeight: 500 }}>Documento {act.fileType === 'word' ? 'Word' : 'PDF'} listo ({act.fileName})</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Enlace Externo (Opcional)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', padding: '0 0.8rem', borderRadius: 'var(--radius-md)' }}>
                      <LinkIcon size={16} color="var(--text-muted)" />
                      <input type="url" placeholder="https://..." value={act.link} onChange={e => handleActivityChange(act.id, 'link', e.target.value)} style={{ border: 'none', background: 'transparent', boxShadow: 'none', color: 'var(--text-main)' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ borderBottom: '2px solid var(--primary-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            3. Conclusión Final
          </h3>
          <div className="input-group">
            <label>Resumen del Día</label>
            <textarea required placeholder="Escribe una conclusión general..." value={formData.conclusion} onChange={e => setFormData({...formData, conclusion: e.target.value})}></textarea>
          </div>
        </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isEncargadoMode && onCancel && (
              <button type="button" onClick={onCancel} className="btn btn-secondary hide-on-pdf">
                Cancelar
              </button>
            )}
            <button type="button" onClick={exportPDF} disabled={isGeneratingPDF} className="btn btn-secondary hide-on-pdf">
              {isGeneratingPDF ? <Loader className="animate-spin" size={18} /> : <FileDown size={18} />}
              Descargar Copia
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', justifyContent: 'center' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader className="animate-spin" size={24} /> 
                  {uploadStatus || 'Enviando...'}
                </>
              ) : (
                <>
                  <Send size={24} /> 
                  {isEncargadoMode ? 'Enviar al Administrador' : 'Enviar a Encargado'}
                </>
              )}
            </button>
          </div>

      </form>
    </div>
  );
}
