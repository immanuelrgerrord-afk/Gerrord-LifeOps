export interface BudgetProgress {
  limit: number;
  spent: number;
  remaining: number;
  overBy: number;
  percent: number;
  progressPercent: number;
  isOver: boolean;
}

export function getBudgetProgress(spent: number, limit: number): BudgetProgress {
  const safeSpent = Number.isFinite(spent) ? Math.max(0, spent) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(0, limit) : 0;
  const percent = safeLimit > 0 ? (safeSpent / safeLimit) * 100 : 0;
  return {
    limit: safeLimit,
    spent: safeSpent,
    remaining: Math.max(0, safeLimit - safeSpent),
    overBy: Math.max(0, safeSpent - safeLimit),
    percent,
    progressPercent: Math.min(100, percent),
    isOver: safeLimit > 0 && safeSpent > safeLimit,
  };
}
