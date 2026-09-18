import { Redirect } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

/** La Miniera usa la scheda Impresa (come il Bosco). */
export default function MinieraRedirect() {
  const { edifici } = useGameContext();
  const miniera = edifici.find((e) => e.nome === "Miniera");
  if (!miniera) return null;
  return <Redirect href={`/impresa/${miniera.id}`} />;
}
