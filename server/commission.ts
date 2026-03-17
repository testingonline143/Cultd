import type { Club } from "@shared/schema";

const DEFAULT_COMMISSION_RATE_BP = 700;
const DEFAULT_MAX_FEE_PAISE = 5000;

export interface CommissionBreakdown {
  baseAmount: number;
  platformFee: number;
  totalAmount: number;
}

export function calculateCommission(
  baseAmountPaise: number,
  club: Pick<Club, "commissionType" | "commissionValue" | "commissionSetByAdmin">
): CommissionBreakdown {
  let platformFee: number;

  if (club.commissionSetByAdmin) {
    const type = club.commissionType ?? "percentage";
    const value = club.commissionValue ?? DEFAULT_COMMISSION_RATE_BP;

    if (type === "fixed") {
      platformFee = value;
    } else {
      platformFee = Math.round((baseAmountPaise * value) / 10000);
    }
  } else {
    platformFee = Math.min(
      Math.round((baseAmountPaise * DEFAULT_COMMISSION_RATE_BP) / 10000),
      DEFAULT_MAX_FEE_PAISE
    );
  }

  return {
    baseAmount: baseAmountPaise,
    platformFee,
    totalAmount: baseAmountPaise + platformFee,
  };
}

export function suggestCommissionForCity(city: string): { type: string; value: number; label: string } {
  const lower = city.toLowerCase();

  if (["tirupati", "nellore", "guntur", "warangal"].some((c) => lower.includes(c))) {
    return { type: "fixed", value: 1000, label: `Suggested for ${city}: ₹10 fixed` };
  }
  if (["vijayawada", "vizag", "coimbatore"].some((c) => lower.includes(c))) {
    return { type: "percentage", value: 700, label: `Suggested for ${city}: 7%` };
  }
  if (["kochi", "bengaluru"].some((c) => lower.includes(c))) {
    return { type: "percentage", value: 1000, label: `Suggested for ${city}: 10%` };
  }
  if (["chennai", "hyderabad"].some((c) => lower.includes(c))) {
    return { type: "percentage", value: 1500, label: `Suggested for ${city}: 15%` };
  }

  return { type: "percentage", value: 700, label: `Default rate: 7%` };
}
