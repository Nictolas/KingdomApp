import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "./orologioGiocoSession";

let mareAnimFrame = 0;
let mareAnimInterval: ReturnType<typeof setInterval> | null = null;
const mareAnimListeners = new Set<() => void>();
let pausaHookInstalled = false;

function notifyMareAnimListeners(): void {
  mareAnimListeners.forEach((l) => l());
}

function avviaMareAnimInterval(): void {
  if (mareAnimInterval != null) return;
  mareAnimInterval = setInterval(() => {
    if (getOrologioGiocoInPausaSnapshot()) return;
    mareAnimFrame = (mareAnimFrame + 1) % 4;
    notifyMareAnimListeners();
  }, 180);
}

function fermaMareAnimInterval(): void {
  if (mareAnimInterval == null) return;
  clearInterval(mareAnimInterval);
  mareAnimInterval = null;
}

function sincronizzaMareAnimConPausa(): void {
  if (getOrologioGiocoInPausaSnapshot()) {
    fermaMareAnimInterval();
  } else if (mareAnimListeners.size > 0) {
    avviaMareAnimInterval();
  }
}

function installaHookPausaMare(): void {
  if (pausaHookInstalled) return;
  pausaHookInstalled = true;
  subscribeOrologioGiocoInPausa(sincronizzaMareAnimConPausa);
}

export function subscribeMareAnimazione(listener: () => void): () => void {
  installaHookPausaMare();
  mareAnimListeners.add(listener);
  sincronizzaMareAnimConPausa();
  return () => {
    mareAnimListeners.delete(listener);
    sincronizzaMareAnimConPausa();
  };
}

export function getMareAnimazioneFrameSnapshot(): number {
  return mareAnimFrame;
}
