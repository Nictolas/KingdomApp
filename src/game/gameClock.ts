import { useEffect, useState } from "react";

export type GameTime = {
  hours: number;
  minutes: number;
};

/**
 * Hook per gestire l'orologio del gioco.
 * Ogni secondo reale corrisponde ad un minuto nel gioco.
 * 
 * @param initialHours - Ora iniziale (default: 6)
 * @param initialMinutes - Minuti iniziali (default: 0)
 * @returns Oggetto con il tempo di gioco corrente e funzione di formattazione
 */
export function useGameClock(initialHours: number = 6, initialMinutes: number = 0) {
  const [gameTime, setGameTime] = useState<GameTime>({
    hours: initialHours,
    minutes: initialMinutes
  });

  useEffect(() => {
    const startTime = Date.now();
    const initialTotalMinutes = initialHours * 60 + initialMinutes;

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const totalMinutes = initialTotalMinutes + elapsedSeconds;
      
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      
      setGameTime({ hours, minutes });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialHours, initialMinutes]);

  return { gameTime };
}

/**
 * Formatta il tempo di gioco in formato HH:MM
 */
export function formatGameTime(time: GameTime): string {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}
