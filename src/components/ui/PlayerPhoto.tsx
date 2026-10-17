import React, { useEffect, useState } from 'react';

interface PlayerPhotoProps {
  src?: string | null;
  alt: string;
  firstName?: string;
  lastName?: string;
  imgClassName: string;
  fallbackClassName: string;
  preferSilhouette?: boolean;
}

/**
 * Foto del jugador con soporte para silueta transparente (.png sin fondo)
 * y con las iniciales como alternativa elegante si no hay foto o si falla.
 */
export const PlayerPhoto: React.FC<PlayerPhotoProps> = ({
  src,
  alt,
  firstName,
  lastName,
  imgClassName,
  fallbackClassName,
  preferSilhouette = false
}) => {
  const getInitialSrc = () => {
    if (!src) return null;
    if (preferSilhouette && /\.(jpe?g)$/i.test(src)) {
      return src.replace(/\.(jpe?g)$/i, '.png');
    }
    return src;
  };

  const [currentSrc, setCurrentSrc] = useState<string | null>(getInitialSrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(getInitialSrc());
    setTriedFallback(false);
    setFailed(false);
  }, [src, preferSilhouette]);

  const handleError = () => {
    if (preferSilhouette && !triedFallback && src && currentSrc !== src) {
      // Fallback de silueta .png a imagen .jpg original
      setTriedFallback(true);
      setCurrentSrc(src);
    } else {
      setFailed(true);
    }
  };

  if (!currentSrc || failed) {
    return (
      <div className={fallbackClassName}>
        {firstName?.[0] || 'J'}
        {lastName?.[0] || 'P'}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={imgClassName}
      onError={handleError}
      loading="lazy"
    />
  );
};
