import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { enableNetwork, disableNetwork } from 'firebase/firestore';

/**
 * Hook personalizado para supervisar la conectividad de red del sistema (Online / Offline).
 * Maneja eventos nativos del navegador, dispara alertas visuales y asegura
 * la sincronización con Firebase Cloud Firestore.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.dismiss('network-offline');

      // Solo notificar si previamente se había caído la red
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

      // Asegurar reconexión y sincronización de mutaciones pendientes en Firestore
      try {
        await enableNetwork(db);
      } catch (err) {
        console.warn('Aviso al reanudar red en Firebase Firestore:', err);
      }
    };

    const handleOffline = async () => {
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

      // Poner Firestore en modo offline explícito
      try {
        await disableNetwork(db);
      } catch (err) {
        // En caso de que ya estuviese desconectado
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
