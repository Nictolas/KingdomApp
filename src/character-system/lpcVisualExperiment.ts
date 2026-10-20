/** Compare the unchanged LPC art against experimental refined artwork. */
export type LpcLook = "classic" | "refined";

export function lpcLookFromSearch(search: string): LpcLook {
  return new URLSearchParams(search).get("lpcLook") === "classic" ? "classic" : "refined";
}
