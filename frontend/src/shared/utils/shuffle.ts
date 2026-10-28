export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffleOptions(
  options: { key: "A" | "B" | "C" | "D"; text: string }[],
  seed: number,
  questionIndex: number
): { key: "A" | "B" | "C" | "D"; text: string }[] {
  const combined = seed * 1000 + questionIndex;
  return seededShuffle(options, combined);
}

/**
 * The questions one attempt shows, in the order it shows them.
 *
 * Every question id is shuffled with the attempt seed and the first `count` are
 * kept, so two employees (different seeds) get a different first question and a
 * different subset. Passing a non-positive `count` keeps every question.
 */
export function pickQuestionIds(
  allQuestionIds: string[],
  seed: number,
  count: number
): string[] {
  const shuffled = seededShuffle(allQuestionIds, seed);
  const size = count > 0 ? Math.min(count, shuffled.length) : shuffled.length;
  return shuffled.slice(0, size);
}
