/** Client-safe command-center types (no server imports). buildCommandCenter lives in lib/command-center.ts. */
export type PriorityModule = 'lead' | 'task' | 'approval' | 'maintenance' | 'finance';
export interface PriorityItem { id: string; module: PriorityModule; title: string; subtitle: string; score: number; href: string; due: string | null }
export interface RiskItem { label: string; detail: string; severity: 'high' | 'medium' }
export interface Bottleneck { name: string; overdueTasks: number; unresponded: number }
export interface CommandCenter {
  topPriorities: PriorityItem[];
  queueSize: number;
  risks: RiskItem[];
  cashflow: { net30: number; net60: number; net90: number; overdueReceivables: number; note: string };
  bottlenecks: Bottleneck[];
  urgentContracts: { label: string; days: number }[];
  urgentDeals: { id: string; name: string; reason: string }[];
  urgentMaintenance: { id: string; title: string; priority: string; ageDays: number }[];
  learning: { headline: string; items: string[] };
}
