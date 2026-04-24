export interface LeadScoringWeights {
  source: {
    paid: number;
    referral: number;
    social: number;
    organic: number;
    direct: number;
  };
  status: {
    qualified: number;
    contacted: number;
    new: number;
    converted: number;
    lost: number;
  };
  valueTier: {
    over1000: number;
    over500: number;
    over100: number;
    over0: number;
  };
  recencyBonus: number;
}

export const DEFAULT_SCORING_WEIGHTS: LeadScoringWeights = {
  source: { paid: 30, referral: 25, social: 20, organic: 15, direct: 10 },
  status: { qualified: 30, contacted: 20, new: 10, converted: 0, lost: 0 },
  valueTier: { over1000: 20, over500: 15, over100: 10, over0: 5 },
  recencyBonus: 10,
};

export interface ScoreBreakdown {
  sourcePoints: number;
  statusPoints: number;
  valuePoints: number;
  recencyPoints: number;
  total: number;
}

export interface LeadForScoring {
  source: string;
  status: string;
  value?: string | number | null;
  createdAt?: Date | string | null;
}

export function calculateLeadScore(
  lead: LeadForScoring,
  weights: LeadScoringWeights = DEFAULT_SCORING_WEIGHTS
): { score: number; breakdown: ScoreBreakdown } {
  const sourcePoints =
    (weights.source as Record<string, number>)[lead.source] ?? 0;

  const statusPoints =
    (weights.status as Record<string, number>)[lead.status] ?? 0;

  const numericValue = lead.value != null ? parseFloat(String(lead.value)) : 0;
  let valuePoints = 0;
  if (numericValue > 1000) valuePoints = weights.valueTier.over1000;
  else if (numericValue > 500) valuePoints = weights.valueTier.over500;
  else if (numericValue > 100) valuePoints = weights.valueTier.over100;
  else if (numericValue > 0) valuePoints = weights.valueTier.over0;

  let recencyPoints = 0;
  if (lead.createdAt) {
    const created = new Date(lead.createdAt).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (created >= sevenDaysAgo) {
      recencyPoints = weights.recencyBonus;
    }
  }

  const raw = sourcePoints + statusPoints + valuePoints + recencyPoints;
  const total = Math.min(100, Math.max(0, raw));

  return {
    score: total,
    breakdown: { sourcePoints, statusPoints, valuePoints, recencyPoints, total },
  };
}

export function mergeWeights(base: LeadScoringWeights, patch: Partial<Record<string, unknown>>): LeadScoringWeights {
  return {
    source: typeof patch.source === "object" && patch.source !== null
      ? { ...base.source, ...(patch.source as object) }
      : base.source,
    status: typeof patch.status === "object" && patch.status !== null
      ? { ...base.status, ...(patch.status as object) }
      : base.status,
    valueTier: typeof patch.valueTier === "object" && patch.valueTier !== null
      ? { ...base.valueTier, ...(patch.valueTier as object) }
      : base.valueTier,
    recencyBonus: typeof patch.recencyBonus === "number"
      ? patch.recencyBonus
      : base.recencyBonus,
  };
}
