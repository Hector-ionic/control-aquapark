import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Upload, Link as LinkIcon, Send, FileDown, Loader, 
  FileText, Clock, Calendar, User, Briefcase, GraduationCap, Building2, 
  CheckCircle2, Sparkles, Image as ImageIcon, AlertCircle, FileCheck, X, Save, RotateCcw, ArrowLeft, ArrowRight
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_MODULES } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { getSupervisors } from '../services/supervisorService';
import { sendReportEmail } from '../services/mailService';

// Función para comprimir imágenes de alta resolución sin degradar la legibilidad
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

        resolve(canvas.toDataURL('image/jpeg', 0.68));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export default function StudentForm({ isEncargadoMode = false, encargadoName = '', onCancel = null }) {
  const { user: authUser } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startTime] = useState(new Date());
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [availableSupervisors, setAvailableSupervisors] = useState(() => getSupervisors(false));

  useEffect(() => {
    const handleSupervisorsUpdate = () => {
      setAvailableSupervisors(getSupervisors(false));
    };
    window.addEventListener('supervisors_changed', handleSupervisorsUpdate);
    return () => window.removeEventListener('supervisors_changed', handleSupervisorsUpdate);
  }, []);

  const handleCloseSuccessModal = () => {
    setSubmittedReport(null);
    if (isEncargadoMode && onCancel) {
      onCancel();
    } else {
      setFormData({ 
        name: isEncargadoMode ? encargadoName : '', 
        career: '', 
        institution: '', 
        supervisor: '', 
        turno: '', 
        conclusion: '' 
      });
      setActivities([{ id: Date.now(), description: '', link: '', fileName: '', fileBase64: null, fileType: null }]);
      setCurrentStep(1);
    }
  };
  
  const [formData, setFormData] = useState({
    name: isEncargadoMode ? encargadoName : '',
    career: isEncargadoMode ? 'Encargado de Área' : '',
    institution: isEncargadoMode ? 'Control AquaPark' : '',
    supervisor: isEncargadoMode ? 'Administrador' : '',
    turno: '',
    conclusion: ''
  });

  const [activities, setActivities] = useState([
    { id: 1, description: '', link: '', fileName: '', fileBase64: null, fileType: null }
  ]);

  // Estado para gestión de borrador automático
  // Control de pasos del formulario (Wizard Stepper sin scroll)
  const [currentStep, setCurrentStep] = useState(1);

  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // Validadores y navegación entre pasos
  const handleNextFromStep1 = () => {
    if (!formData.name.trim() || !formData.career.trim() || !formData.institution.trim() || !formData.turno) {
      toast.error("⚠️ Por favor completa tu Nombre, Carrera, Institución y Turno antes de avanzar.");
      return;
    }
    if (!formData.supervisor) {
      toast.error("⚠️ Debes seleccionar al Encargado destinatario.");
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 140, behavior: 'smooth' });
  };

  const handleNextFromStep2 = () => {
    const emptyIndex = activities.findIndex(act => act.description.trim().length < 10);
    if (emptyIndex !== -1) {
      toast.error(`⚠️ La Actividad #${emptyIndex + 1} debe tener al menos 10 caracteres explicativos.`);
      return;
    }
    setCurrentStep(3);
    window.scrollTo({ top: 140, behavior: 'smooth' });
  };

  // Cargar borrador de localStorage al montar el formulario (modo pasante)
  useEffect(() => {
    if (!isEncargadoMode) {
      try {
        const raw = localStorage.getItem('aquapark_report_draft');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.formData || parsed.activities)) {
            if (parsed.formData) {
              setFormData(prev => ({ ...prev, ...parsed.formData }));
            }
            if (parsed.activities && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
              setActivities(parsed.activities.map((a, i) => ({
                id: a.id || Date.now() + i,
                description: a.description || '',
                link: a.link || '',
                fileName: a.fileName || '',
                fileBase64: null,
                fileType: null
              })));
            }
            setDraftSavedAt(parsed.savedAt ? new Date(parsed.savedAt) : new Date());
            toast.success("Borrador recuperado automáticamente", { icon: "💾", duration: 3000 });
          }
        }
      } catch (err) {
        console.warn("No se pudo leer el borrador:", err);
      }
    }
  }, [isEncargadoMode]);

  // Auto-guardar cambios de texto en localStorage cada 600ms
  useEffect(() => {
    if (isEncargadoMode) return;

    const hasAnyContent = 
      formData.name.trim() || 
      formData.career.trim() || 
      formData.institution.trim() || 
      formData.conclusion.trim() || 
      formData.turno || 
      activities.some(a => a.description.trim() || a.link.trim());

    if (!hasAnyContent) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          formData,
          activities: activities.map(a => ({
            id: a.id,
            description: a.description,
            link: a.link,
            fileName: a.fileName
          })),
          savedAt: new Date().toISOString()
        };
        localStorage.setItem('aquapark_report_draft', JSON.stringify(payload));
        setDraftSavedAt(new Date());
      } catch (e) {
        console.warn("Error guardando borrador en localStorage:", e);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData, activities, isEncargadoMode]);

  // Descartar borrador y limpiar
  const handleDiscardDraft = () => {
    if (window.confirm("¿Deseas descartar el borrador y limpiar todos los campos del formulario?")) {
      try {
        localStorage.removeItem('aquapark_report_draft');
      } catch (e) {}
      setFormData({
        name: isEncargadoMode ? encargadoName : '',
        career: '',
        institution: '',
        supervisor: '',
        turno: '',
        conclusion: ''
      });
      setActivities([{ id: Date.now(), description: '', link: '', fileName: '', fileBase64: null, fileType: null }]);
      setDraftSavedAt(null);
      toast.success("Borrador descartado. Formulario limpio.");
    }
  };

  // Cálculo de progreso de llenado en tiempo real
  const progressStats = useMemo(() => {
    const checks = [
      { key: 'name', label: 'Nombre Completo', ok: Boolean(formData.name.trim()) },
      { key: 'career', label: 'Carrera', ok: Boolean(formData.career.trim()) },
      { key: 'institution', label: 'Institución', ok: Boolean(formData.institution.trim()) },
      { key: 'turno', label: 'Turno', ok: Boolean(formData.turno) },
      { key: 'supervisor', label: 'Encargado Destino', ok: Boolean(formData.supervisor) },
      { key: 'activities', label: 'Tareas Detalladas', ok: activities.length > 0 && activities.every(a => a.description.trim().length >= 10) },
      { key: 'conclusion', label: 'Conclusión y Balance', ok: formData.conclusion.trim().length >= 10 }
    ];
    const completed = checks.filter(c => c.ok).length;
    const total = checks.length;
    const percentage = Math.round((completed / total) * 100);
    const missing = checks.filter(c => !c.ok).map(c => c.label);
    return { completed, total, percentage, missing, isComplete: completed === total };
  }, [formData, activities]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  

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
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isWord = file.type.includes('word') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
    const isExcel = file.type.includes('excel') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx');
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(lowerName);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(lowerName);

    let type = 'other';
    if (isImage) type = 'image';
    else if (isPdf) type = 'pdf';
    else if (isWord) type = 'word';
    else if (isExcel) type = 'excel';
    else if (isVideo) type = 'video';

    if (!isImage && file.size > 50 * 1024 * 1024) {
      toast.error("El documento es demasiado pesado. El máximo permitido es 50MB.");
      e.target.value = '';
      return;
    }

    if (isImage && file.size > 300 * 1024 * 1024) {
      toast.error("La imagen excede el límite permitido para compresión en navegador.");
      e.target.value = '';
      return;
    }

    try {
      let finalBase64 = null;
      if (isImage) {
        try {
          finalBase64 = await compressImage(file);
        } catch (imgErr) {
          console.warn("Error comprimiendo imagen, usando Base64 directo:", imgErr);
          finalBase64 = await new Promise((res) => {
            const reader = new FileReader();
            reader.onload = ev => res(ev.target.result);
            reader.readAsDataURL(file);
          });
        }
      }

      setActivities(prev => prev.map(act => 
        act.id === id ? { 
          ...act, 
          fileName: file.name, 
          fileType: type,
          fileBase64: finalBase64,
          rawFile: file 
        } : act
      ));

      toast.success(`Evidencia cargada: ${file.name}`);
    } catch (err) {
      console.error("Error al procesar el archivo:", err);
      toast.error("Hubo un error al procesar el archivo.");
    } finally {
      e.target.value = '';
    }
  };

  const removeFileAttachment = (id) => {
    setActivities(activities.map(act => 
      act.id === id ? { ...act, fileName: '', fileType: null, fileBase64: null, rawFile: null } : act
    ));
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

    if (!formData.name.trim() || !formData.career.trim() || !formData.institution.trim() || !formData.turno) {
      toast.error("❌ Faltan datos: Por favor llena tu Nombre, Carrera, Institución y Turno.");
      return;
    }

    if (!formData.supervisor) {
      toast.error("❌ ¡Atención! Debes seleccionar el Encargado destinatario.");
      return;
    }

    if (formData.conclusion.trim().length < 10) {
      toast.error("❌ Tu conclusión es muy breve. Por favor describe con mayor detalle el balance del día.");
      return;
    }

    const emptyActivityIndex = activities.findIndex(act => act.description.trim().length < 10);
    if (emptyActivityIndex !== -1) {
      toast.error(`❌ La Actividad #${emptyActivityIndex + 1} debe tener al menos 10 caracteres explicativos.`);
      return;
    }

    setIsSubmitting(true);
    
        try {
      const isDeviceOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const hasFiles = activities.some(act => act.rawFile);
      if (hasFiles) {
        setUploadStatus(isDeviceOnline ? 'Cargando evidencias multimedia a la nube corporativa...' : 'Procesando evidencias en modo local...');
      }

      const processedActivities = await Promise.all(activities.map(async (act) => {
        let finalUrl = null;

        if (act.rawFile || act.fileBase64) {
          if (isDeviceOnline) {
            try {
              const cloudFormData = new FormData();
              cloudFormData.append('file', act.rawFile || act.fileBase64);
              cloudFormData.append('upload_preset', 'ldqkrdsr');
              
              let resourceType = 'auto';
              if (act.rawFile && act.rawFile.name) {
                const ext = act.rawFile.name.split('.').pop().toLowerCase();
                if (['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
                  resourceType = 'raw';
                }
              }

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2500);

              const res = await fetch(`https://api.cloudinary.com/v1_1/dqrc7vc9y/${resourceType}/upload`, {
                method: 'POST',
                body: cloudFormData,
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const data = await res.json();
              
              if (data.secure_url) {
                finalUrl = data.secure_url;
              } else {
                finalUrl = act.fileBase64 || null;
              }
            } catch (cloudErr) {
              console.warn("Cloudinary omitido o cancelado por timeout/red:", cloudErr);
              finalUrl = act.fileBase64 || null;
            }
          } else {
            // Modo sin conexión: almacenar de inmediato Base64 sin retrasos
            finalUrl = act.fileBase64 || null;
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
        dateString: submitTime.toLocaleDateString('es-ES'),
        timeStart: calculatedTimeStart,
        timeEnd: submitTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };

      let docRef = null;
      let isStoredLocally = false;

      if (!isDeviceOnline) {
        // MODO OFFLINE INMEDIATO: Nunca bloquear ni esperar la red
        isStoredLocally = true;
        const localId = `offline_${Date.now()}`;
        docRef = { id: localId };

        try {
          const raw = localStorage.getItem('aquapark_offline_reports');
          const list = raw ? JSON.parse(raw) : [];
          list.push({ ...reportData, id: localId, isOffline: true });
          localStorage.setItem('aquapark_offline_reports', JSON.stringify(list));
        } catch (e) {
          console.warn("Error guardando reporte offline en localStorage:", e);
        }
      } else {
        // MODO ONLINE CON PROTECCIÓN DE TIMEOUT (2.5 segundos máximo)
        try {
          const firestorePromise = addDoc(collection(db, "reports"), {
            ...reportData,
            createdAt: serverTimestamp()
          });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), 2500)
          );
          docRef = await Promise.race([firestorePromise, timeoutPromise]);

          logAuditEvent({
            action: AUDIT_ACTIONS.CREAR_REPORTE,
            module: AUDIT_MODULES.REPORTES,
            details: `Bitácora enviada por ${formData.name} (${formData.turno}) asignada a ${formData.supervisor}.`,
            targetId: docRef?.id,
            userName: formData.name,
            userRole: isEncargadoMode ? 'encargado' : 'pasante',
            metadata: {
              turno: formData.turno,
              carrera: formData.career,
              institucion: formData.institution,
              totalActividades: processedActivities.length
            }
          });

          // Despachar notificación automática por correo (no bloqueante)
          sendReportEmail(reportData).catch(e => console.warn(e));
        } catch (err) {
          console.warn("Firestore demoró o conexión inestable, resguardando en modo local:", err);
          isStoredLocally = true;
          const localId = `offline_${Date.now()}`;
          docRef = { id: localId };

          try {
            const raw = localStorage.getItem('aquapark_offline_reports');
            const list = raw ? JSON.parse(raw) : [];
            list.push({ ...reportData, id: localId, isOffline: true });
            localStorage.setItem('aquapark_offline_reports', JSON.stringify(list));
          } catch (e) {}
        }
      }

      setSubmittedReport({
        id: docRef?.id,
        isOffline: isStoredLocally,
        ...reportData
      });

      if (isStoredLocally) {
        toast.success("📡 Bitácora resguardada en modo local. Se sincronizará automáticamente al volver la conexión.", {
          duration: 6000,
          icon: '💾'
        });
      } else {
        toast.success("✅ ¡Bitácora registrada con éxito!");
      }

      // Limpiar de inmediato el formulario para permitir un nuevo llenado limpio
      if (!isEncargadoMode) {
        localStorage.removeItem('aquapark_report_draft');
        setDraftSavedAt(null);
        setFormData({ 
          name: '', 
          career: '', 
          institution: '', 
          supervisor: '', 
          turno: '', 
          conclusion: '' 
        });
        setActivities([{ id: Date.now(), description: '', link: '', fileName: '', fileBase64: null, fileType: null }]);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error subiendo reporte: ", error);
      toast.error(error.message || "Error al procesar el reporte.");
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
  
  const currentStr = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* PLANTILLA PDF OCULTA PARA EXPORTACIÓN */}
      <div id="pdf-formal-template" style={{ display: 'none', background: 'white', color: 'black', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '15px', marginBottom: '20px' }}>
          <h1 style={{ color: '#0369a1', margin: '0 0 6px 0', fontSize: '22px', textTransform: 'uppercase' }}>
            {isEncargadoMode ? 'Informe Oficial de Encargado de Área' : 'Bitácora Diaria de Actividades'}
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>Control AquaPark — Plataforma de Gestión de Personal</p>
        </div>

        <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold', width: '28%' }}>Fecha y Registro:</td>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                {dateStr} | <strong>Inicio:</strong> {startStr} — <strong>Cierre:</strong> {currentStr}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Remitente:</td>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{formData.name || 'Sin especificar'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Carrera / Institución:</td>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{formData.career || '-'} / {formData.institution || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Supervisor Destino:</td>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{formData.supervisor}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>Turno:</td>
              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{formData.turno || 'No especificado'}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ color: '#0369a1', fontSize: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', marginTop: '20px' }}>
          Actividades Ejecutadas
        </h2>
        {activities.map((act, idx) => (
          <div key={idx} style={{ marginBottom: '16px', pageBreakInside: 'avoid', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', margin: '8px 0 4px 0', color: '#0f172a' }}>{idx + 1}. Detalle de la Tarea:</h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '13px', lineHeight: '1.5', color: '#334155' }}>{act.description || 'Sin descripción'}</p>
            {act.link && (
              <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}><strong>Referencia digital:</strong> <a href={act.link} style={{ color: '#0284c7' }}>{act.link}</a></p>
            )}
            
            {act.fileBase64 && act.fileType === 'image' && (
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                <img src={act.fileBase64} style={{ maxWidth: '380px', maxHeight: '250px', border: '1px solid #cbd5e1', padding: '4px', borderRadius: '4px' }} alt="Evidencia" />
              </div>
            )}

            {act.fileBase64 && (act.fileType === 'pdf' || act.fileType === 'word') && (
              <div style={{ marginTop: '8px', padding: '8px 12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  <strong>Documento adjunto:</strong> {act.fileName}
                </p>
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: '24px', pageBreakInside: 'avoid' }}>
          <h2 style={{ color: '#0369a1', fontSize: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>Conclusiones de la Jornada</h2>
          <p style={{ fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '12px', borderLeft: '4px solid #0284c7', marginTop: '8px' }}>
            {formData.conclusion || 'Sin conclusión registrada.'}
          </p>
        </div>
        
        <div style={{ marginTop: '45px', textAlign: 'center', pageBreakInside: 'avoid' }}>
          <div style={{ borderTop: '1px solid #0f172a', width: '220px', margin: '0 auto', paddingTop: '8px' }}>
            <strong style={{ fontSize: '13px' }}>Firma del Remitente</strong><br/>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{formData.name}</span>
          </div>
        </div>
      </div>

      {/* BANNER PRINCIPAL DE LA BITÁCORA */}
      <div className="glass-panel" id="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-primary">
              <Sparkles size={12} />
              {isEncargadoMode ? 'Canal Gerencial' : 'Bitácora Digital'}
            </span>
            <span className="badge badge-neutral">
              {activities.length} {activities.length === 1 ? 'Actividad' : 'Actividades'}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            {isEncargadoMode ? 'Informe Directo a RR.HH / Administración' : 'Registro Diario de Actividades'}
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
            {isEncargadoMode 
              ? 'Emite tu informe ejecutivo de encargado para su revisión administrativa.' 
              : 'Registra tus avances, tareas ejecutadas y evidencias antes de concluir tu jornada.'}
          </p>
        </div>

        <div style={{ 
          background: 'var(--surface-secondary)', 
          border: '1px solid var(--surface-border)', 
          padding: '0.85rem 1.25rem', 
          borderRadius: 'var(--radius-md)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.35rem',
          minWidth: '220px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Calendar size={14} color="var(--primary)" />
            <span style={{ textTransform: 'capitalize' }}>{dateStr}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            <Clock size={15} color="var(--primary)" />
            <span>Inicio: {startStr}</span>
            <span style={{ color: 'var(--surface-border-strong)' }}>|</span>
            <span style={{ color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace' }}>{currentStr}</span>
          </div>
        </div>
      </div>

      {/* BANNER DE PROGRESO DE LLENADO Y AUTO-GUARDADO DE BORRADOR */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Progreso del Reporte:
            </span>
            <span 
              className={progressStats.isComplete ? "badge badge-success" : "badge badge-primary"}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.55rem' }}
            >
              {progressStats.percentage}% ({progressStats.completed} de {progressStats.total})
            </span>
            {progressStats.isComplete ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={14} /> Listo para enviar
              </span>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Falta: {progressStats.missing.slice(0, 2).join(', ')}{progressStats.missing.length > 2 ? '...' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {draftSavedAt && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--primary)', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.3rem',
                background: 'rgba(2, 132, 199, 0.1)',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                <Save size={12} />
                Borrador guardado {draftSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {(draftSavedAt || formData.name || formData.conclusion || activities[0]?.description) && !isEncargadoMode && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                title="Descartar borrador y limpiar formulario"
              >
                <RotateCcw size={12} /> Descartar Borrador
              </button>
            )}
          </div>
        </div>

        {/* Barra visual de porcentaje */}
        <div style={{ 
          width: '100%', 
          height: '6px', 
          background: 'var(--surface-secondary)', 
          borderRadius: '999px', 
          overflow: 'hidden' 
        }}>
          <div 
            style={{ 
              width: `${progressStats.percentage}%`, 
              height: '100%', 
              background: progressStats.isComplete ? '#16a34a' : 'linear-gradient(90deg, #0284c7, #38bdf8)', 
              transition: 'width 0.35s ease-in-out',
              borderRadius: '999px'
            }} 
          />
        </div>
      </div>

            {/* INDICADOR VISUAL DE PASOS (SOLO ESTÉTICO - NAVEGACIÓN VÍA BOTONES INFERIORES) */}
      <div className="glass-card" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { step: 1, title: '01. Datos del Remitente', desc: 'Información y turno' },
            { step: 2, title: `02. Tareas Ejecutadas (${activities.length})`, desc: 'Actividades y evidencias' },
            { step: 3, title: '03. Conclusión & Envío', desc: 'Resumen y entrega final' }
          ].map((item) => {
            const isCurrent = currentStep === item.step;
            const isDone = currentStep > item.step;
            return (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: isCurrent ? 'var(--primary-light)' : 'transparent',
                  border: isCurrent ? '1.5px solid var(--primary)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.85rem',
                  cursor: 'default',
                  textAlign: 'left',
                  flex: '1 1 200px',
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isDone ? '#16a34a' : isCurrent ? 'var(--primary)' : 'var(--surface-secondary)',
                  color: isDone || isCurrent ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}>
                  {isDone ? '✓' : item.step}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--primary)' : 'var(--text-main)' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* SECCIÓN 1: DATOS GENERALES */}
        {currentStep === 1 && (
          <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.85rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', 
              background: 'var(--primary-light)', color: 'var(--primary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' 
            }}>
              01
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Datos Generales del Remitente</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Información institucional del remitente y asignación de turno</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {!isEncargadoMode ? (
              <>
                <div className="input-group">
                  <label><User size={14} color="var(--primary)" /> Nombre Completo *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Juan Carlos Pérez" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                
                <div className="input-group">
                  <label><GraduationCap size={14} color="var(--primary)" /> Carrera / Especialidad *</label>
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
                  <label><Building2 size={14} color="var(--primary)" /> Institución Educativa *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. UMSA, Franz Tamayo, EMI..." 
                    value={formData.institution} 
                    onChange={e => setFormData({...formData, institution: e.target.value})} 
                  />
                </div>

                <div className="input-group">
                  <label><Briefcase size={14} color="var(--primary)" /> Enviar a (Encargado) *</label>
                  <select required value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})}>
                    <option value="" disabled>Seleccione a su Encargado...</option>
                    {availableSupervisors.map(sup => (
                      <option key={sup.id} value={sup.name}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label><User size={14} color="var(--primary)" /> Nombre del Encargado</label>
                  <input type="text" disabled value={formData.name} style={{ opacity: 0.8 }} />
                </div>
                <div className="input-group">
                  <label><Building2 size={14} color="var(--primary)" /> Destinatario</label>
                  <input type="text" disabled value="RR.HH (Administración General)" style={{ opacity: 0.8 }} />
                </div>
              </>
            )}

            <div className="input-group">
              <label><Clock size={14} color="var(--primary)" /> Turno Asignado *</label>
              <select required value={formData.turno} onChange={e => setFormData({...formData, turno: e.target.value})}>
                <option value="" disabled>Seleccione turno...</option>
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Jornada Completa">Jornada Completa</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.25rem' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleNextFromStep1}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}
            >
              Siguiente: Tareas Ejecutadas <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: ACTIVIDADES REALIZADAS */}
      {currentStep === 2 && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', 
                background: 'var(--primary-light)', color: 'var(--primary)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' 
              }}>
                02
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Bitácora de Tareas Ejecutadas</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Describe puntualmente cada labor y adjunta su respaldo</p>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleAddActivity} 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Agregar Nueva Actividad
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activities.map((act, index) => (
              <div 
                key={act.id} 
                style={{ 
                  background: 'var(--surface-secondary)', 
                  padding: '1.35rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--surface-border)', 
                  position: 'relative',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-primary" style={{ padding: '0.2rem 0.55rem' }}>
                      Tarea #{index + 1}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {act.description ? `${act.description.length} caracteres` : 'Sin contenido aún'}
                    </span>
                  </div>

                  {activities.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveActivity(act.id)} 
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--error)', 
                        cursor: 'pointer', 
                        padding: '0.3rem',
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.8rem'
                      }} 
                      title="Eliminar esta actividad"
                    >
                      <Trash2 size={16} />
                      <span style={{ fontWeight: 500 }}>Quitar</span>
                    </button>
                  )}
                </div>
                
                <div className="input-group">
                  <label>Descripción de la Actividad *</label>
                  <textarea 
                    required 
                    placeholder="Describe de forma clara y técnica la labor desempeñada..." 
                    value={act.description} 
                    onChange={e => handleActivityChange(act.id, 'description', e.target.value)} 
                    style={{ minHeight: '85px' }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                  
                  {/* ADJUNTAR ARCHIVO */}
                  <div className="input-group">
                    <label><Upload size={14} color="var(--primary)" /> Evidencia Digital (Foto, PDF, Word)</label>
                    
                    {!act.fileName ? (
                      <div>
                        <label 
                          htmlFor={'file-upload-input-' + act.id}
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%', 
                            justifyContent: 'center', 
                            border: '1px dashed var(--surface-border-strong)', 
                            background: 'var(--surface)',
                            padding: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '0.5rem'
                          }}
                        >
                          <Upload size={16} color="var(--primary)" /> 
                          <span>Subir Evidencia (Imagen / PDF / Word)</span>
                        </label>
                        <input 
                          id={'file-upload-input-' + act.id}
                          type="file" 
                          accept="image/*,.pdf,.doc,.docx,video/*,.xls,.xlsx" 
                          onChange={(e) => handleFileChange(act.id, e)} 
                          style={{ display: 'none' }} 
                        />
                      </div>
                    ) : (
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        background: 'var(--surface)', border: '1px solid var(--surface-border-strong)', 
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                          {act.fileType === 'image' ? (
                            <ImageIcon size={20} color="var(--primary)" />
                          ) : (
                            <FileCheck size={20} color="var(--success)" />
                          )}
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {act.fileName}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeFileAttachment(act.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.2rem' }}
                          title="Eliminar archivo adjunto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    
                    {act.fileBase64 && act.fileType === 'image' && (
                      <div style={{ marginTop: '0.65rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem', background: 'var(--surface)', textAlign: 'center' }}>
                        <img 
                          src={act.fileBase64} 
                          alt={`Evidencia ${index + 1}`} 
                          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px' }} 
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* ENLACE EXTERNO */}
                  <div className="input-group">
                    <label><LinkIcon size={14} color="var(--primary)" /> Enlace de Respaldo (Canva, Drive, Figma)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--surface-border)', padding: '0 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                      <LinkIcon size={15} color="var(--text-muted)" />
                      <input 
                        type="url" 
                        placeholder="https://drive.google.com/..." 
                        value={act.link} 
                        onChange={e => handleActivityChange(act.id, 'link', e.target.value)} 
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }} 
                      />
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => { setCurrentStep(1); window.scrollTo({ top: 140, behavior: 'smooth' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowLeft size={16} /> Volver a Datos Generales
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleNextFromStep2}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}
            >
              Siguiente: Conclusión y Envío <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: CONCLUSIONES Y ENVÍO */}
      {currentStep === 3 && (
        <>
          <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.85rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', 
              background: 'var(--primary-light)', color: 'var(--primary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' 
            }}>
              03
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Conclusión Final & Resumen del Día</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Síntesis global de los logros y observaciones del día</p>
            </div>
          </div>

          <div className="input-group">
            <textarea 
              required 
              placeholder="Resume los resultados alcanzados, metas concluidas o pendientes para la siguiente jornada..." 
              value={formData.conclusion} 
              onChange={e => setFormData({...formData, conclusion: e.target.value})}
              style={{ minHeight: '105px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Mínimo 10 caracteres requeridos.</span>
              <span>{formData.conclusion.length} caracteres</span>
            </div>
          </div>
        </div>

        {/* BARRA DE ACCIÓN INFERIOR */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '1rem', 
          flexWrap: 'wrap', 
          background: 'var(--surface)', 
          padding: '1.25rem', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--surface-border)', 
          boxShadow: 'var(--shadow-sm)' 
        }}>

          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => { setCurrentStep(2); window.scrollTo({ top: 140, behavior: 'smooth' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ArrowLeft size={16} /> Volver a Tareas
            </button>
            {isEncargadoMode && onCancel && (
              <button type="button" onClick={onCancel} className="btn btn-secondary">
                Cancelar
              </button>
            )}
            <button 
              type="button" 
              onClick={exportPDF} 
              disabled={isGeneratingPDF} 
              className="btn btn-secondary"
              title="Descarga una copia preliminar en PDF"
            >
              {isGeneratingPDF ? <Loader className="animate-spin" size={17} /> : <FileDown size={17} />}
              Descargar Copia PDF
            </button>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader className="animate-spin" size={20} /> 
                {uploadStatus || 'Enviando...'}
              </>
            ) : (
              <>
                <Send size={18} /> 
                {isEncargadoMode ? 'Enviar al Administrador' : 'Enviar Reporte Oficial'}
              </>
            )}
          </button>
        </div>
      </>
    )}

  </form>

      {/* MODAL CORPORATIVO DE CONFIRMACIÓN DE ÉXITO */}
      {submittedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            padding: '2.5rem',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--accent-glow)',
            position: 'relative',
            background: 'var(--surface)'
          }}>
            <button
              onClick={handleCloseSuccessModal}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
              title="Cerrar"
            >
              <X size={20} />
            </button>

            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '2px solid var(--success-border)',
              boxShadow: '0 0 24px rgba(16, 185, 129, 0.25)'
            }}>
              <CheckCircle2 size={40} />
            </div>

            {submittedReport.isOffline ? (
              <span className="badge badge-warning" style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                📡 Resguardo Local (Modo Sin Conexión)
              </span>
            ) : (
              <span className="badge badge-success" style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                Registro Completado
              </span>
            )}

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.5rem 0' }}>
              {submittedReport.isOffline ? '¡Bitácora Resguardada en Modo Local!' : '¡Bitácora Enviada con Éxito!'}
            </h2>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {submittedReport.isOffline ? (
                <>Tu informe fue guardado de forma segura en tu dispositivo para <strong>{submittedReport.supervisorOriginal || submittedReport.supervisor}</strong> y se sincronizará automáticamente con el servidor en cuanto recuperes la conexión a internet.</>
              ) : (
                <>Tu informe fue remitido formalmente a <strong>{submittedReport.supervisorOriginal || submittedReport.supervisor}</strong> y archivado con trazabilidad en el sistema.</>
              )}
            </p>

            {/* TARJETA DE RESUMEN DEL FOLIO */}
            <div style={{
              background: 'var(--surface-secondary)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              textAlign: 'left',
              marginBottom: '1.75rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-border)', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Folio de Registro:</span>
                <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>
                  #AP-{submittedReport.id ? submittedReport.id.slice(0, 7).toUpperCase() : '2026'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remitente:</span>
                <strong>{submittedReport.student}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Turno Asignado:</span>
                <span>{submittedReport.turno}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tareas Reportadas:</span>
                <span>{submittedReport.activities?.length || 0} labores documentadas</span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={exportPDF}
                disabled={isGeneratingPDF}
                className="btn btn-primary"
                style={{ flex: '1 1 200px', padding: '0.85rem 1.25rem' }}
              >
                {isGeneratingPDF ? <Loader className="animate-spin" size={17} /> : <FileDown size={17} />}
                <span>Descargar Comprobante PDF</span>
              </button>

              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="btn btn-secondary"
                style={{ flex: '1 1 170px', padding: '0.85rem 1.25rem' }}
              >
                {isEncargadoMode ? 'Volver a la Bandeja' : 'Nuevo Reporte'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
