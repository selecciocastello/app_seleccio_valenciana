import React, { useEffect, useState } from 'react';

interface PlayerPhotoProps {
  src?: string | null;
  alt: string;
  firstName?: string;
  lastName?: string;
  imgClassName: string;
  fallbackClassName: string;
}

/**
 * Foto del jugador con las iniciales como alternativa, tanto si no hay foto como
 * si la imagen no carga (p. ej. una foto nueva que aún no está desplegada).
 */
export const PlayerPhoto: React.FC<PlayerPhotoProps> = ({
  src,
  alt,
  firstName,
  lastName,
  imgClassName,
  fallbackClassName
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={fallbackClassName}>
        {firstName?.[0] || 'J'}
        {lastName?.[0] || 'P'}
      </div>
    );
  }

  return <img src={src} alt={alt} className={imgClassName} onError={() => setFailed(true)} />;
};
