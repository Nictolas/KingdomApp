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
  const [startTimeRef, setStartTimeRef] = useState<number>(Date.now());
  const [initialTotalMinutesRef, setInitialTotalMinutesRef] = useState<number>(initialHours * 60 + initialMinutes);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef) / 1000);
      const totalMinutes = initialTotalMinutesRef + elapsedSeconds;
      
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      
      setGameTime({ hours, minutes });
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimeRef, initialTotalMinutesRef]);

  const setTime = (hours: number, minutes: number) => {
    setGameTime({ hours, minutes });
    setStartTimeRef(Date.now());
    setInitialTotalMinutesRef(hours * 60 + minutes);
  };

  return { gameTime, setTime };
}

/**
 * Formatta il tempo di gioco in formato HH:MM
 */
export function formatGameTime(time: GameTime): string {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}
