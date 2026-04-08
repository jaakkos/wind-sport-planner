import type { Sport, WindLog } from "@/generated/prisma/client";
import { gustPenalty, windFitScore } from "@/lib/heuristics/profiles";

export function scoreSession(args: {
  sport: Sport;
  weather: {
    windSpeedMs: number | null;
    gustMs: number | null;
    windDirDeg: number | null;
  } | null;
  windLog: WindLog | null;
}): { total: number; breakdown: Record<string, number | string | boolean> } {
  const breakdown: Record<string, number | string | boolean> = {};
  let total = 0;

  if (args.weather) {
    const fit = windFitScore(args.sport, args.weather.windSpeedMs);
    breakdown.windFit = fit.score;
    breakdown.windOk = fit.ok;
    total += fit.score;
    const gp = gustPenalty(args.weather.gustMs, args.weather.windSpeedMs);
    breakdown.gustPenalty = gp;
    total -= gp;
  } else {
    breakdown.windFit = 0;
    breakdown.windOk = false;
  }

  if (args.windLog) {
    const suit = args.windLog.sessionSuitability;
    const mult =
      suit === "ideal"
        ? 1.2
        : suit === "suitable"
          ? 1.1
          : suit === "marginal"
            ? 0.85
            : 0.5;
    breakdown.suitabilityMult = mult;
    total *= mult;

    const out = args.windLog.sessionOutcome;
    if (out === "would_not_repeat") total *= 0.3;
    if (out === "excellent") total *= 1.15;
    breakdown.sessionOutcome = out;
  }

  total = Math.max(0, Math.min(100, Math.round(total)));
  breakdown.total = total;
  return { total, breakdown };
}
