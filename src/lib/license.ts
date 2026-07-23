// Aviso comercial de período de teste / licença — apenas informativo (não bloqueia o uso).
// A contagem começa na data de criação da organização (organization.created_at).

export const TRIAL_DAYS = 14;
export const LICENSE_PRICE_LABEL = 'R$ 997,00';

export interface TrialInfo {
  daysUsed: number;
  daysRemaining: number;
  expired: boolean;
}

export function getTrialInfo(organizationCreatedAt: string): TrialInfo {
  const created = new Date(organizationCreatedAt).getTime();
  const now = Date.now();
  const daysUsed = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysUsed);
  return { daysUsed, daysRemaining, expired: daysUsed >= TRIAL_DAYS };
}
