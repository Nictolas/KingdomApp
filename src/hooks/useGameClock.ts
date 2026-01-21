import { useEffect, useMemo, useRef, useState } from "react";

export function formatGameTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type UseGameClockReturn = {
  gameTime: { hours: number; minutes: number };
  gameTimeStartRef: React.MutableRefObject<number>;
  gameTimeBaseMinutes: number;
  setGameTimeBaseMinutes: (minutes: number) => void;
  isClockModalOpen: boolean;
  setIsClockModalOpen: (open: boolean) => void;
  clockDraftMinutes: number;
  setClockDraftMinutes: React.Dispatch<React.SetStateAction<number>>;
  isNight: boolean;
  formatGameTime: (h: number, m: number) => string;
};

export function useGameClock(initialMinutes: number = 6 * 60): UseGameClockReturn {
  const [gameTime, setGameTime] = useState({ hours: 6, minutes: 0 });
  const gameTimeStartRef = useRef<number>(Date.now());
  const [gameTimeBaseMinutes, setGameTimeBaseMinutes] = useState(initialMinutes);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [clockDraftMinutes, setClockDraftMinutes] = useState(initialMinutes);

  // Orologio: 1s reale = 1 min gioco
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - gameTimeStartRef.current) / 1000);
      const totalMinutes = gameTimeBaseMinutes + elapsedSeconds;
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      setGameTime({ hours, minutes });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameTimeBaseMinutes]);

  const isNight = useMemo(() => {
    const t = gameTime.hours * 60 + gameTime.minutes;
    return t >= 18 * 60 || t < 6 * 60;
  }, [gameTime]);

  return {
    gameTime,
    gameTimeStartRef,
    gameTimeBaseMinutes,
    setGameTimeBaseMinutes,
    isClockModalOpen,
    setIsClockModalOpen,
    clockDraftMinutes,
    setClockDraftMinutes,
    isNight,
    formatGameTime
  };
}
