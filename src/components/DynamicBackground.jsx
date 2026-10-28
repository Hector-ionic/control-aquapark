import React, { useState, useEffect, useMemo } from 'react';

const DAY_IMAGES = [
  '/bg-day-1.jpg',
  '/bg-day-2.jpg',
  '/bg-day-3.jpg'
];

const NIGHT_IMAGES = [
  '/bg-night-1.jpg',
  '/bg-night-2.jpg',
  '/bg-night-3.jpg'
];

/**
 * Componente de Fondo Dinámico Contextual (Día / Noche)
 * - Detecta el tema activo (Claro / Oscuro / Sistema).
 * - Realiza transiciones suaves con fundido cruzado (cross-fade de 1.2s).
 * - Pre-carga todas las imágenes para evitar parpadeos o pantallas blancas.
 * - Incluye capa de oscurecimiento adaptativo para proteger la legibilidad y contraste WCAG.
 */
export default function DynamicBackground({ theme }) {
  const [isDark, setIsDark] = useState(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [dayIndex, setDayIndex] = useState(0);
  const [nightIndex, setNightIndex] = useState(0);

  // Pre-cargar todas las imágenes en segundo plano al montar
  useEffect(() => {
    const allImages = [...DAY_IMAGES, ...NIGHT_IMAGES];
    allImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Escuchar cambios de tema manual o de sistema
  useEffect(() => {
    if (theme === 'dark') {
      setIsDark(true);
    } else if (theme === 'light') {
      setIsDark(false);
    } else {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mediaQuery.matches);

      const handleChange = (e) => setIsDark(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Rotación suave opcional cada 90 segundos entre la galería del modo activo
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDark) {
        setNightIndex((prev) => (prev + 1) % NIGHT_IMAGES.length);
      } else {
        setDayIndex((prev) => (prev + 1) % DAY_IMAGES.length);
      }
    }, 90000);
    return () => clearInterval(interval);
  }, [isDark]);

  // Exponer evento personalizado para rotar fondo manualmente si el usuario lo desea
  useEffect(() => {
    const handleNextBg = () => {
      if (isDark) {
        setNightIndex((prev) => (prev + 1) % NIGHT_IMAGES.length);
      } else {
        setDayIndex((prev) => (prev + 1) % DAY_IMAGES.length);
      }
    };
    window.addEventListener('aquapark:next-bg', handleNextBg);
    return () => window.removeEventListener('aquapark:next-bg', handleNextBg);
  }, [isDark]);

  const activeDayImage = DAY_IMAGES[dayIndex];
  const activeNightImage = NIGHT_IMAGES[nightIndex];

  return (
    <div 
      className="dynamic-bg-container hide-on-pdf" 
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        zIndex: -1,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      {/* Capa de Día */}
      <div
        className="dynamic-bg-layer"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('${activeDayImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: isDark ? 0 : 1,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1), transform 1.2s ease-out',
          transform: isDark ? 'scale(1.02)' : 'scale(1)',
          willChange: 'opacity, transform'
        }}
      />

      {/* Capa de Noche */}
      <div
        className="dynamic-bg-layer"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('${activeNightImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: isDark ? 1 : 0,
          transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1), transform 1.2s ease-out',
          transform: isDark ? 'scale(1)' : 'scale(1.02)',
          willChange: 'opacity, transform'
        }}
      />

      {/* Capa de superposición para legibilidad y contraste WCAG */}
      <div
        className="dynamic-bg-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: isDark
            ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.88) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.20) 0%, rgba(240, 249, 255, 0.40) 100%)',
          backdropFilter: isDark ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: isDark ? 'blur(2px)' : 'none',
          transition: 'background 0.8s ease, backdrop-filter 0.8s ease'
        }}
      />
    </div>
  );
}
