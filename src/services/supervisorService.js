// Servicio de gestión de encargados con persistencia local y eventos en vivo
const STORAGE_KEY = 'aquapark_supervisors';

export const INITIAL_SUPERVISORS = [
  { id: 'hector-calle', name: 'Héctor Calle', area: 'Mantenimiento / Operaciones', active: true, deleted: false },
  { id: 'lizeth-de-la-cruz', name: 'Lizeth de la Cruz', area: 'Recursos Humanos', active: true, deleted: false },
  { id: 'alvaro-mendoza', name: 'Álvaro Mendoza', area: 'Sistemas e Informática', active: true, deleted: false },
  { id: 'limbert-tito', name: 'Limbert Tito', area: 'Supervisión General', active: true, deleted: false },
  { id: 'camila-alejo', name: 'Camila Alejo', area: 'Atención al Cliente', active: true, deleted: false },
  { id: 'yven-cardozo', name: 'Yven Cardozo', area: 'Seguridad y Logística', active: true, deleted: false },
  { id: 'moises-ramos', name: 'Moisés Ramos', area: 'Finanzas y Caja', active: true, deleted: false }
];

// Obtener todos los supervisores
export const getSupervisors = (includeDeleted = false) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(list) || list.length === 0) {
      list = INITIAL_SUPERVISORS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SUPERVISORS));
    }
    list = list.map(s => {
      if (typeof s === 'string') {
        return { id: s.toLowerCase().replace(/\s+/g, '-'), name: s, area: 'Área General', active: true, deleted: false };
      }
      return {
        id: s.id || ('sup-' + Math.random().toString(36).substr(2, 9)),
        name: s.name || 'Sin nombre',
        area: s.area || 'Área General',
        active: s.active !== false,
        deleted: Boolean(s.deleted)
      };
    });
    if (includeDeleted) return list;
    return list.filter(s => !s.deleted && s.active);
  } catch (err) {
    console.error("Error leyendo supervisores:", err);
    return INITIAL_SUPERVISORS.filter(s => !s.deleted && s.active);
  }
};

const notifyChange = () => {
  window.dispatchEvent(new Event('supervisors_changed'));
};

// Eliminar un encargado (Desaparece del formulario, pero sus reportes históricos se conservan)
export const deleteSupervisor = (id) => {
  const current = getSupervisors(true);
  const updated = current.map(s => 
    s.id === id ? { ...s, deleted: true, active: false, deletedAt: new Date().toISOString() } : s
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return updated;
};

// Restaurar un encargado eliminado
export const restoreSupervisor = (id) => {
  const current = getSupervisors(true);
  const updated = current.map(s => 
    s.id === id ? { ...s, deleted: false, active: true, restoredAt: new Date().toISOString() } : s
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return updated;
};

// Alternar estado activo / inactivo
export const toggleSupervisorActive = (id) => {
  const current = getSupervisors(true);
  const updated = current.map(s => 
    s.id === id ? { ...s, active: !s.active } : s
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return updated;
};

// Agregar un nuevo encargado
export const addSupervisor = ({ name, area }) => {
  if (!name.trim()) return;
  const current = getSupervisors(true);
  const newSupervisor = {
    id: `sup-${Date.now()}`,
    name: name.trim(),
    area: area ? area.trim() : 'Área General',
    active: true,
    deleted: false,
    createdAt: new Date().toISOString()
  };
  const updated = [...current, newSupervisor];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyChange();
  return newSupervisor;
};
