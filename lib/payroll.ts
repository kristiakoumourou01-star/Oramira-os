/**
 * Oramira OS — Cyprus payroll engine (pure, deterministic, server + client safe).
 *
 * Computes the full gross→net→employer-cost breakdown from a monthly gross, and
 * grosses up a net-agreed salary. Rates below are INDICATIVE Cyprus 2025 values
 * and are centralised here — verify against current legislation before payroll
 * is used for real disbursement. Currency: EUR, monthly basis.
 */

export const PAYROLL_RATES = {
  socialInsurance: { employee: 0.088, employer: 0.088, monthlyCap: 5239 }, // insurable-earnings cap
  gesy: { employee: 0.0265, employer: 0.029 }, // National Health (high cap, treated uncapped monthly)
  employerOther: { socialCohesion: 0.02, redundancy: 0.012, training: 0.005 },
  // Annual income tax (PAYE) bands
  taxBands: [
    { upTo: 19500, rate: 0 },
    { upTo: 28000, rate: 0.2 },
    { upTo: 36300, rate: 0.25 },
    { upTo: 60000, rate: 0.3 },
    { upTo: Infinity, rate: 0.35 },
  ],
};

function annualTax(annualTaxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const band of PAYROLL_RATES.taxBands) {
    if (annualTaxable <= lower) break;
    const taxedInBand = Math.min(annualTaxable, band.upTo) - lower;
    tax += taxedInBand * band.rate;
    lower = band.upTo;
  }
  return tax;
}

function marginalRate(annualTaxable: number): number {
  for (const band of PAYROLL_RATES.taxBands) {
    if (annualTaxable <= band.upTo) return band.rate;
  }
  return PAYROLL_RATES.taxBands[PAYROLL_RATES.taxBands.length - 1].rate;
}

export interface PayrollExtras {
  bonus?: number;
  commission?: number;
  advances?: number;
  otherDeductions?: number;
}

export interface PayrollBreakdown {
  baseGross: number;
  bonus: number;
  commission: number;
  grossPay: number;
  // employee deductions
  socialInsuranceEmployee: number;
  gesyEmployee: number;
  paye: number;
  otherDeductions: number;
  statutoryDeductions: number; // SI + GESY + PAYE
  totalDeductions: number;     // statutory + other
  advances: number;
  netPayable: number;
  // employer side
  socialInsuranceEmployer: number;
  gesyEmployer: number;
  socialCohesion: number;
  redundancy: number;
  training: number;
  employerContributions: number;
  employerCost: number;        // grossPay + employer contributions
}

export function computePayroll(baseGross: number, extras: PayrollExtras = {}): PayrollBreakdown {
  const bonus = extras.bonus ?? 0;
  const commission = extras.commission ?? 0;
  const otherDeductions = extras.otherDeductions ?? 0;
  const advances = extras.advances ?? 0;
  const variable = bonus + commission;
  const grossPay = baseGross + variable;

  const siBase = Math.min(grossPay, PAYROLL_RATES.socialInsurance.monthlyCap);
  const socialInsuranceEmployee = siBase * PAYROLL_RATES.socialInsurance.employee;
  const socialInsuranceEmployer = siBase * PAYROLL_RATES.socialInsurance.employer;
  const gesyEmployee = grossPay * PAYROLL_RATES.gesy.employee;
  const gesyEmployer = grossPay * PAYROLL_RATES.gesy.employer;

  // PAYE: regular pay annualised through the bands; variable taxed at the margin.
  const annualBase = baseGross * 12;
  const payeBaseMonthly = annualTax(annualBase) / 12;
  const paye = payeBaseMonthly + variable * marginalRate(annualBase);

  const socialCohesion = grossPay * PAYROLL_RATES.employerOther.socialCohesion;
  const redundancy = siBase * PAYROLL_RATES.employerOther.redundancy;
  const training = siBase * PAYROLL_RATES.employerOther.training;

  const statutoryDeductions = socialInsuranceEmployee + gesyEmployee + paye;
  const totalDeductions = statutoryDeductions + otherDeductions;
  const netPayable = grossPay - totalDeductions - advances;
  const employerContributions = socialInsuranceEmployer + gesyEmployer + socialCohesion + redundancy + training;

  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    baseGross: r(baseGross), bonus: r(bonus), commission: r(commission), grossPay: r(grossPay),
    socialInsuranceEmployee: r(socialInsuranceEmployee), gesyEmployee: r(gesyEmployee), paye: r(paye),
    otherDeductions: r(otherDeductions), statutoryDeductions: r(statutoryDeductions), totalDeductions: r(totalDeductions),
    advances: r(advances), netPayable: r(netPayable),
    socialInsuranceEmployer: r(socialInsuranceEmployer), gesyEmployer: r(gesyEmployer),
    socialCohesion: r(socialCohesion), redundancy: r(redundancy), training: r(training),
    employerContributions: r(employerContributions), employerCost: r(grossPay + employerContributions),
  };
}

/** Gross up a net-agreed monthly salary (binary search over the statutory net). */
export function grossFromNet(targetNet: number): number {
  if (targetNet <= 0) return 0;
  let lo = targetNet;
  let hi = targetNet * 2.2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const net = computePayroll(mid).grossPay - computePayroll(mid).statutoryDeductions;
    if (net > targetNet) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/** Resolve the monthly gross given an agreed salary that may be net or gross. */
export function resolveGross(agreedSalary: number, basis: 'net' | 'gross'): number {
  return basis === 'net' ? grossFromNet(agreedSalary) : agreedSalary;
}
