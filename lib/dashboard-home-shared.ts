/** Τύποι του Dashboard (client-safe). */
export interface Attention { text: string; href: string; tone: 'warn' | 'info' }
/** parts: κομμάτια κειμένου· όσα έχουν data=true είναι ονόματα/ποσά (δεν μεταφράζονται). */
export interface ActivityItem { text: string; parts?: { t: string; data?: boolean }[]; at: string; kind: 'payment' | 'lead' | 'reservation' | 'contract' | 'viewing'; href?: string }
export interface HomeData {
  todayIn: number; avgDailyIn: number;
  activeLeads: number; newLeadsWeek: number;
  pipelineValue: number; wonThisMonth: number;
  conversion: number; conversionPrev: number;
  available: number; reservedUnits: number; soldUnits: number; totalUnits: number;
  attention: Attention[];
  monthly: { label: string; thisYear: number; lastYear: number }[];
  yoy: number | null;
  activity: ActivityItem[];
  today: { id: string; title: string; at: string; href?: string; link?: string | null }[];
  sources: { key: string; label: string; n: number; won: number }[];
  countries: { name: string; n: number; share: number }[];
  schedule: { id: string; buyer: string; unit: string; due: string; amount: number; status: 'upcoming' | 'overdue' | 'paid' }[];
  projects: { name: string; available: number; reserved: number; sold: number; total: number }[];
  atRisk: { id: string; name: string; stage: string; days: number; value: number; risk: number; reason: string }[];
  funnel: { label: string; n: number }[];
  agents: { name: string; won: number; open: number }[];
}

