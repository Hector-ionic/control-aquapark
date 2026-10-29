import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { enableNetwork, addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * Sincroniza bitácoras resguardadas localmente cuando no había conexión
 */
export async function syncPendingOfflineReports() {
  try {
    const raw = localStorage.getItem('aquapark_offline_reports');
    if (!raw) return 0;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return 0;

    console.log(`Intentando sincronizar ${list.length} reporte(s) guardado(s) offline...`);
    const remaining = [];
    let syncedCount = 0;

    for (const item of list) {
      try {
        const { id, isOffline, ...cleanData } = item;
        await addDoc(collection(db, 'reports'), {
          ...cleanData,
          createdAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        });
        syncedCount++;
      } catch (err) {
        console.warn('Error al subir reporte offline a Firestore:', err);
        remaining.push(item);
      }
    }

    if (remaining.length === 0) {
      localStorage.removeItem('aquapark_offline_reports');
    } else {
      localStorage.setItem('aquapark_offline_reports', JSON.stringify(remaining));
    }

    if (syncedCount > 0) {
      toast.success(`✅ ${syncedCount} bitácora(s) local(es) sincronizada(s) con la nube.`, {
        id: 'sync-offline-success',
        duration: 5000
      });
    }
    return syncedCount;
  } catch (e) {
    console.warn('Error en syncPendingOfflineReports:', e);
    return 0;
  }
}

/**
 * Hook para supervisión de conectividad (Online / Offline) en tiempo real
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.dismiss('network-offline');

      if (wasOfflineRef.current) {
        toast.success('✅ Conexión restablecida. Sincronizando datos con la nube...', {
          id: 'network-online',
          duration: 4500,
          style: {
            background: 'var(--surface-secondary, #1e293b)',
            color: 'var(--text-main, #f8fafc)',
            border: '1px solid var(--success, #10b981)'
          }
        });
        wasOfflineRef.current = false;
      }

      // Despertar Firestore
      try {
        await enableNetwork(db);
      } catch (err) {
        console.warn('Aviso al reanudar red en Firestore:', err);
      }

      // Sincronizar reportes locales pendientes
      setTimeout(() => {
        syncPendingOfflineReports();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      toast.dismiss('network-online');

      toast.error(
        '⚠️ Sin conexión a internet. Los datos se guardan de forma segura localmente y se sincronizarán al reconectar.',
        {
          id: 'network-offline',
          duration: 7000,
          style: {
            background: 'var(--surface-secondary, #1e293b)',
            color: 'var(--text-main, #f8fafc)',
            border: '1px solid var(--error, #ef4444)'
          }
        }
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificación periódica activa por si cambia navigator.onLine
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined') {
        if (!navigator.onLine && isOnline) {
          handleOffline();
        } else if (navigator.onLine && !isOnline) {
          handleOnline();
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  return { isOnline };
}
