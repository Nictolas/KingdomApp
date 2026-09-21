import type { Razza } from "../types";

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

/** Genera un nome fantasy per un abitante non umano. */
export function generaNomeFantasy(razza: Razza): string {
  switch (razza) {
    case "Umano":
      return "";
    case "Elfo":
      return pick(["Aelwen", "Lethariel", "Eryn", "Sylvar", "Naevia"]);
    case "Nano":
      return pick(["Brom Pietra", "Dagna Ferro", "Thorin Runa", "Kelda Roccia"]);
    case "Orco":
      return pick(["Goruk", "Mazga", "Thrag", "Urgash", "Brakka"]);
    case "Goblin":
      return pick(["Nib", "Skrit", "Grinza", "Mog", "Tik-Tak"]);
    case "Golem":
      return pick(["Basalto", "Runa", "Granito", "Selce", "Dolmen"]);
    default:
      return `${razza}-${1000 + Math.floor(Math.random() * 9000)}`;
  }
}
