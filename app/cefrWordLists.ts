import EFLLexCefr from "./EFLLex_cefr.json";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

const baseLists: Record<CefrLevel, string[]> = {
  A1: [],
  A2: [],
  B1: [],
  B2: [],
  C1: [],
};

const fileLists = EFLLexCefr as Partial<Record<CefrLevel, string[]>>;

function buildWordList(level: CefrLevel): string[] {
  const combined = [...(baseLists[level] || []), ...(fileLists[level] || [])];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of combined) {
    const word = (w || "").trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(word);
  }
  return result;
}

export function getWordsForLevel(level: CefrLevel): string[] {
  return buildWordList(level);
}
