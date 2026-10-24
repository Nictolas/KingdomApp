import type { Abitante } from "../types";
import type { DogmaReligioso } from "./dogmiReligiosi";
import type { VestitiPersonaggio } from "./personaggioAspetto";
import { abitoPrescrittoDaDogma } from "./dogmiReligiosi";
import { aspettoPerVisualizzazioneAbitante, generaAspettoDaSeed } from "./personaggioAspetto";
import { canRenderCharacter, compatibleCatalogOptions, firstCompatibleColorForField } from "../character-system/registry";
import { normalizeCharacterAppearance } from "../character-system/appearance";

/** I dogmi non possono cancellare una divisa tecnica obbligatoria. */
const DIVISE_DI_SICUREZZA = new Set(["Guardia", "Medico", "Giudice"]);
const MINISTRI_CULTO = new Set(["Sacerdote", "Capo Religioso", "Druido"]);

/** Il precetto clericale prevale su quello dei fedeli; in sua assenza vale quello generale. */
export function abitoPrescrittoPerAbitante(
  abitante: Pick<Abitante, "lavoro">,
  dogmi: readonly DogmaReligioso[]
): VestitiPersonaggio | null {
  return (MINISTRI_CULTO.has(abitante.lavoro)
    ? abitoPrescrittoDaDogma(dogmi, "sacerdoti") : null)
    ?? abitoPrescrittoDaDogma(dogmi, "fedeli");
}

type RisultatoCambioAbito =
  | { ok: true; abitante: Abitante }
  | { ok: false; motivo: string };

/** Corrispondenze possibili con gli ID semantici realmente installati nel manifest LPC.
 * Non aggiungere outfit non presenti: non si deve simulare un cambio di vestito con una sola etichetta.
 */
const STILI_LPC: Record<VestitiPersonaggio, readonly string[]> = {
  viandante: ["commoner", "tunic"],
  nobile: ["noble", "royal", "aristocrat"],
  ranger: ["ranger", "hunter", "leather"],
  mago: ["mage", "wizard", "robe"]
};

function trovaStileDisponibile(options: readonly string[], stile: VestitiPersonaggio): string | null {
  const aliases = STILI_LPC[stile];
  return options.find(id => aliases.includes(id.toLowerCase()))
    ?? options.find(id => aliases.some(alias => id.toLowerCase().includes(alias)))
    ?? null;
}

/** Azione su richiesta: modifica il dato persistito *e* il completo LPC.
 * Nessun cambio automatico dei fedeli, nessuna spesa/oggetto creato e nessuna
 * rimozione delle divise tecniche; dopo l'azione il malus viene ricalcolato dal motore.
 */
export function indossaAbitoDellaFede(
  abitante: Abitante,
  dogmi: readonly DogmaReligioso[]
): RisultatoCambioAbito {
  const richiesto = abitoPrescrittoPerAbitante(abitante, dogmi);
  if (!richiesto) return { ok: false, motivo: "Questa fede non prescrive un abito." };
  if (abitante.razza === "Golem" || abitante.salute <= 0)
    return { ok: false, motivo: "Questo personaggio non può cambiarsi." };
  if (DIVISE_DI_SICUREZZA.has(abitante.lavoro))
    return { ok: false, motivo: "La divisa obbligatoria di lavoro ha priorità. Serve una regola di compatibilità." };

  // La resa pubblica del Nano usa sempre l'outfit LPC child obbligatorio;
  // sarebbe scorretto dichiarare conforme un abito che la mappa poi nasconde.
  if (abitante.razza === "Nano" || abitante.eta < 13 || abitante.incinta === true)
    return { ok: false, motivo: "L'abito prescritto non ha ancora una variante LPC compatibile con questa corporatura." };

  const razze = ["Umano", "Elfo", "Nano", "Orco", "Goblin"] as const;
  const razza = razze.find(r => r === abitante.razza) ?? "Umano";
  const saved = abitante.aspetto ?? generaAspettoDaSeed(razza, abitante.id, { sesso: abitante.sesso });
  // Non persistere le varianti derivate solo dal rendering pubblico (es. cappello professionale).
  const current = saved.characterAppearance ??
    aspettoPerVisualizzazioneAbitante({ ...abitante, aspetto: saved })?.characterAppearance;
  if (!current) return { ok: false, motivo: "Non è disponibile un modello LPC per questo abitante." };
  const catalog = compatibleCatalogOptions(current);
  const upper = trovaStileDisponibile(catalog.upperOutfits, richiesto);
  if (!upper || upper.includes("chainmail"))
    return { ok: false, motivo: "Manca un abito LPC compatibile per questa fede e corporatura." };

  const lower = catalog.lowerOutfits.includes(upper)
    ? upper
    : catalog.lowerOutfits.includes(current.lowerOutfit)
      ? current.lowerOutfit : catalog.lowerOutfits[0] ?? "none";
  const next = normalizeCharacterAppearance({
    ...current,
    outfit: upper,
    upperOutfit: upper,
    lowerOutfit: lower,
    fullOutfit: "none",
    fullOutfitTrim: "none",
    outfitPrimaryColor: firstCompatibleColorForField(current, "outfitPrimaryColor", "outfit", upper),
    outfitSecondaryColor: firstCompatibleColorForField(current, "outfitSecondaryColor", "lowerBody", lower)
  });
  if (!canRenderCharacter(next, "idle") || !canRenderCharacter(next, "walk"))
    return { ok: false, motivo: "Lo sprite LPC dell'abito non è completo per idle e camminata." };

  const pubblicato = aspettoPerVisualizzazioneAbitante({
    ...abitante, aspetto: { ...saved, vestiti: richiesto, characterAppearance: next }
  })?.characterAppearance;
  if (!pubblicato || pubblicato.upperOutfit !== next.upperOutfit ||
      pubblicato.fullOutfit !== "none" || !canRenderCharacter(pubblicato, "walk")) {
    return { ok: false, motivo: "Le regole grafiche di questo personaggio nasconderebbero l'abito della fede." };
  }

  return {
    ok: true,
    abitante: {
      ...abitante,
      aspetto: { ...saved, vestiti: richiesto, characterAppearance: next }
    }
  };
}
