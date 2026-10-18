import React from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Fondale leggero, disegnato con SVG: nessuna immagine raster caricata durante
 * l'apertura del creatore e nessun componente interattivo sopra i controlli.
 * L'inquadratura centrale resta scura per rendere leggibile la UI.
 */
function RoyalBanner({ x, mirrored = false }: { x: number; mirrored?: boolean }) {
  return (
    <G transform={`translate(${x} 0)${mirrored ? " scale(-1 1)" : ""}`}>
      <Path d="M 0 107 H 59 V 329 L 29.5 360 L 0 329 Z" fill="#061c48" stroke="#8b642e" strokeWidth="5" />
      <Path d="M 6 111 H 53 V 323 L 29.5 348 L 6 323 Z" fill="url(#royalBanner)" />
      <Path d="M 17 233 L 22 205 L 30 215 L 38 199 L 46 217 L 51 209 L 46 242 L 17 242 Z" fill="#b18438" opacity={0.9} />
      <Rect x={17} y={245} width={29} height={5} rx={1} fill="#b18438" opacity={0.85} />
      <Path d="M 6 117 V 319 L 29.5 341 L 53 319" fill="none" stroke="#b88e45" strokeWidth="1.2" opacity={0.55} />
    </G>
  );
}

function ThroneTorch({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Circle cy={-18} r={62} fill="url(#torchHalo)" opacity={0.72} />
      <Path d="M-10 6 L-15 15 L-6 25 L-6 70 L7 70 L7 25 L16 15 L11 6 Z" fill="#101f3a" stroke="#243b5b" strokeWidth={2} />
      <Rect x={-16} y={0} width={32} height={8} rx={2} fill="#263a54" />
      <Path d="M-9 1 C-22-9-13-17-11-33 C-8-26-4-27-6-45 C8-31 17-21 11-6 L7 4 Z" fill="#f58a21" />
      <Path d="M-5 1 C-12-6-7-18-4-28 C1-21 8-15 6-6 L4 3 Z" fill="#ffe071" />
      <Rect x={-17} y={6} width={34} height={5} fill="#5d5d60" />
    </G>
  );
}

export function RoyalThroneBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 430 860" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="royalHall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#020817" />
          <Stop offset="0.42" stopColor="#0a285b" />
          <Stop offset="1" stopColor="#010817" />
        </LinearGradient>
        <LinearGradient id="royalBanner" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#061c49" />
          <Stop offset="0.5" stopColor="#123775" />
          <Stop offset="1" stopColor="#051633" />
        </LinearGradient>
        <LinearGradient id="royalStone" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0b1e3d" />
          <Stop offset="0.4" stopColor="#193b6d" />
          <Stop offset="1" stopColor="#07162f" />
        </LinearGradient>
        <LinearGradient id="royalFloor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0c3569" />
          <Stop offset="1" stopColor="#020c23" />
        </LinearGradient>
        <LinearGradient id="royalBottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#020819" stopOpacity={0} />
          <Stop offset="0.65" stopColor="#01071b" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#010817" stopOpacity={0.97} />
        </LinearGradient>
        <RadialGradient id="royalCenterGlow">
          <Stop offset="0" stopColor="#164887" stopOpacity={0.62} />
          <Stop offset="1" stopColor="#00102c" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="torchHalo">
          <Stop offset="0" stopColor="#ffab3c" stopOpacity={0.66} />
          <Stop offset="0.5" stopColor="#c26a1c" stopOpacity={0.17} />
          <Stop offset="1" stopColor="#ff8b15" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect width={430} height={860} fill="url(#royalHall)" />
      <Circle cx={215} cy={310} r={260} fill="url(#royalCenterGlow)" />

      {/* Arcate profonde e soffitto a conci, inquadrati come nel mockup. */}
      <Path d="M-86 401 V176 C-86 10 35-92 215-92 C395-92 516 10 516 176 V401 H448 V189 C448 51 356-26 215-26 C74-26-18 51-18 189 V401 Z" fill="#061634" />
      <Path d="M-56 332 V158 C-56 13 58-62 215-62 C372-62 486 13 486 158 V332" fill="none" stroke="#153967" strokeWidth={31} opacity={0.8} />
      <Path d="M-31 323 V173 C-31 35 68-35 215-35 C362-35 461 35 461 173 V323" fill="none" stroke="#061b3e" strokeWidth={17} />
      <Path d="M15 330 V194 C15 71 95 3 215 3 C335 3 415 71 415 194 V330" fill="none" stroke="#154276" strokeWidth={8} opacity={0.4} />
      <Path d="M111 325 V218 C111 145 150 104 215 104 C280 104 319 145 319 218 V325" fill="#04142e" opacity={0.35} />
      {Array.from({ length: 7 }, (_, i) => (
        <G key={`roof-${i}`} opacity={0.29}>
          <Path d={`M${-15 + i * 12} ${156 - i * 22} l24 -7`} stroke="#4472a5" strokeWidth={2.5} />
          <Path d={`M${445 - i * 12} ${156 - i * 22} l-24 -7`} stroke="#4472a5" strokeWidth={2.5} />
        </G>
      ))}

      {/* Pilastri esterni e muratura blu. */}
      <Rect x={0} y={90} width={75} height={480} fill="#091c3d" />
      <Rect x={355} y={90} width={75} height={480} fill="#091c3d" />
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <G key={`bricks-${r}`} opacity={0.22}>
          <Path d={`M0 ${185 + r * 61} H77 M353 ${185 + r * 61} H430`} stroke="#396399" strokeWidth={2} />
          <Path d={`M${r % 2 ? 38 : 21} ${185 + r * 61} v61 M${r % 2 ? 395 : 409} ${185 + r * 61} v61`} stroke="#325682" strokeWidth={2} />
        </G>
      ))}
      <Rect x={8} y={90} width={22} height={465} fill="url(#royalStone)" />
      <Rect x={400} y={90} width={22} height={465} fill="url(#royalStone)" />
      <Rect x={64} y={139} width={13} height={405} fill="#123462" />
      <Rect x={353} y={139} width={13} height={405} fill="#123462" />
      <Rect x={0} y={96} width={84} height={26} rx={3} fill="#153861" />
      <Rect x={346} y={96} width={84} height={26} rx={3} fill="#153861" />
      <Rect x={0} y={532} width={88} height={26} fill="#17365c" />
      <Rect x={342} y={532} width={88} height={26} fill="#17365c" />
      <RoyalBanner x={17} />
      <RoyalBanner x={413} mirrored />

      {/* Pedana sul fondo e pavimento a prospettiva. */}
      <Path d="M0 545 L430 545 L430 860 L0 860 Z" fill="url(#royalFloor)" />
      <Path d="M147 526 H283 L320 554 H110 Z" fill="#102b51" />
      <Path d="M133 552 H297 L330 576 H100 Z" fill="#1c4678" opacity={0.74} />
      <Path d="M109 576 H321 L345 591 H85 Z" fill="#0c2347" opacity={0.93} />
      <Path d="M215 553 L-135 860 H-18 L215 558 Z" fill="#1d538e" opacity={0.44} />
      <Path d="M215 553 L565 860 H448 L215 558 Z" fill="#1d538e" opacity={0.44} />
      <Path d="M215 554 L77 860 H137 L215 554 Z" fill="#103061" opacity={0.8} />
      <Path d="M215 554 L353 860 H293 L215 554 Z" fill="#103061" opacity={0.8} />
      {[586, 618, 658, 708, 769, 838].map((y, i) => (
        <Path key={`paving-${i}`} d={`M0 ${y} H430`} stroke="#4180bb" strokeOpacity={0.22 - i * 0.021} strokeWidth={2} />
      ))}
      {[-1, -0.65, -0.3, 0.3, 0.65, 1].map((offset, i) => (
        <Path key={`grout-${i}`} d={`M215 550 L${215 + offset * 270} 860`} stroke="#010b24" strokeOpacity={0.64} strokeWidth={3} />
      ))}

      {/* Fiaccole: luce calda, ripetuta simmetricamente ai lati. */}
      <ThroneTorch x={21} y={478} scale={0.82} />
      <ThroneTorch x={93} y={433} scale={0.78} />
      <ThroneTorch x={337} y={433} scale={0.78} />
      <ThroneTorch x={409} y={478} scale={0.82} />

      {/* Una velatura lascia leggibili testo e tasti e dà profondità al fondo. */}
      <Rect x={0} y={0} width={430} height={860} fill="url(#royalBottomFade)" />
    </Svg>
  );
}
