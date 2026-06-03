import { Redirect } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";

/** Reindirizza al primo edificio Mensa Pubblica dell'elenco. */
export default function MensaIndexRedirect() {
  const { edifici } = useGameContext();
  const mensa = edifici.filter((e) => e.nome === "Mensa Pubblica").sort((a, b) => a.id - b.id)[0];
  if (!mensa) return <Redirect href="/edifici" />;
  return <Redirect href={`/mensa/${mensa.id}`} />;
}
