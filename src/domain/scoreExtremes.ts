export interface ScoreRange {
  best: number | null;
  worst: number | null;
  hasSpread: boolean;
}

export function scoreRange(scores: Array<number | null | undefined>): ScoreRange {
  const finiteScores = scores.filter(
    (score): score is number => typeof score === "number" && Number.isFinite(score)
  );

  if (finiteScores.length < 2) {
    return { best: null, worst: null, hasSpread: false };
  }

  const best = Math.max(...finiteScores);
  const worst = Math.min(...finiteScores);

  return { best, worst, hasSpread: best !== worst };
}

export function scoreClass(
  score: number | null | undefined,
  range: ScoreRange | undefined
): "score-best" | "score-worst" | undefined {
  if (!range?.hasSpread || typeof score !== "number" || !Number.isFinite(score)) {
    return undefined;
  }

  if (score === range.best) return "score-best";
  if (score === range.worst) return "score-worst";

  return undefined;
}
