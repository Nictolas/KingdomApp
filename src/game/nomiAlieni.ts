import type { Razza } from "../types";

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const maybe = (p: number) => Math.random() < p;

/** Genera un nome casuale per un abitante della razza aliena. Umano non supportato (restituisce stringa vuota). */
export function generaNomeAlieno(razza: Razza): string {
  switch (razza) {
    case "Umano":
      return "";
    case "Grigi":
      return generaNomeGrigi();
    case "Nordici":
      return generaNomeNordici();
    case "Marini":
      return generaNomeMarini();
    case "Insettoidi":
      return generaNomeInsettoidi();
    case "Rettiliani":
      return generaNomeRettiliani();
    case "Ferini":
      return generaNomeFerini();
    case "Robot":
      return generaNomeRobot();
    default:
      return `${razza}-${1000 + Math.floor(Math.random() * 9000)}`;
  }
}

/** Robot: stile unità/sigla (es. Unit-7342, AX-12). */
function generaNomeRobot(): string {
  const prefissi = ["Unit-", "AX-", "RX-", "Bot-", "Syn-"];
  const num = 1000 + Math.floor(Math.random() * 9000);
  return maybe(0.3) ? `${pick(prefissi).replace("-", "")}${num}` : pick(prefissi) + num;
}

/** Grigi: brevi, asettici, stile codice. Glottal stop (') e numeri finali opzionali. */
function generaNomeGrigi(): string {
  const prefissi = ["K-", "N'", "Z-", "X'", "L-", "V'"];
  const sillabe = ["Zol", "Rax", "Vor", "Lek", "Nyx", "Kor", "Vex", "Zyn"];
  const nome = pick(prefissi) + pick(sillabe);
  return maybe(0.4) ? `${nome}-${Math.floor(Math.random() * 99) + 1}` : nome;
}

/** Nordici: eleganti, melodici, molte vocali e L/R. */
function generaNomeNordici(): string {
  const parti1 = ["Ae", "Val", "Thor", "El", "Van", "Eir", "Sol"];
  const parti2 = ["theris", "on", "anis", "ion", "dor", "wyn", "mir"];
  return pick(parti1) + pick(parti2);
}

/** Marini: profondi, onomatopeici, vocali lunghe, evoca bolle/acqua. */
function generaNomeMarini(): string {
  const parti1 = ["Oo", "Baa", "Loo", "Uu", "Glu", "Blo"];
  const parti2 = ["luum", "loop", "bloop", "glub", "burb", "plash"];
  return pick(parti1) + pick(parti2);
}

/** Insettoidi: click, consonanti dure, X/Z/K. */
function generaNomeInsettoidi(): string {
  const prefissi = ["Tchk-", "Kx-", "Zz-", "K'"];
  const suffissi = ["Zit", "Vzz", "Krik", "Xk", "Zzzk", "K'vx"];
  return pick(prefissi) + pick(suffissi);
}

/** Rettiliani: sibilanti e gutturali, molte S e H. */
function generaNomeRettiliani(): string {
  const parti1 = ["Ssh", "G'", "Th", "Sss", "H'"];
  const parti2 = ["azar", "rath", "esss", "issk", "hiss", "kth"];
  const nome = pick(parti1) + pick(parti2);
  return maybe(0.3) ? `${nome}-sss` : nome;
}

/** Ferini: ringhi, vibrante R, suoni di gola. */
function generaNomeFerini(): string {
  const parti1 = ["Rrr-", "Huar", "Grr", "Khar", "Ragh"];
  const parti2 = ["Khan", "gh", "aar", "kor", "grakh", "rron"];
  return pick(parti1) + pick(parti2);
}
