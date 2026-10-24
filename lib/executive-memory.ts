import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Executive Memory — read/write helpers for the institutional-memory store
 * (migration 0045). Auto-capture is idempotent via source_key; search spans
 * title, body and tags. The narrative layer that keeps context across years,
 * people, and deals.
 */

type Client = SupabaseClient<Database>;

export type MemoryKind = 'decision' | 'negotiation' | 'owner' | 'project' | 'employee' | 'risk';
export interface MemoryEntry {
  id: string; kind: string; title: string; body: string; entity_type: string | null; entity_id: string | null;
  tags: string[]; importance: string; created_at: string;
}

export const MEMORY_KINDS: MemoryKind[] = ['decision', 'negotiation', 'owner', 'project', 'employee', 'risk'];

/** Idempotent capture — inserts only if source_key is new (or absent). */
export async function captureMemory(client: Client, m: {
  kind: MemoryKind; title: string; body?: string; entityType?: string; entityId?: string;
  tags?: string[]; importance?: 'low' | 'normal' | 'high'; sourceKey?: string; createdBy?: string | null;
}): Promise<boolean> {
  if (m.sourceKey) {
    const { data: existing } = await client.from('institutional_memory').select('id').eq('source_key', m.sourceKey).maybeSingle();
    if (existing) return false;
  }
  await client.from('institutional_memory').insert({
    kind: m.kind, title: m.title, body: m.body ?? '', entity_type: m.entityType ?? null, entity_id: m.entityId ?? null,
    tags: m.tags ?? [], importance: m.importance ?? 'normal', source_key: m.sourceKey ?? null, created_by: m.createdBy ?? null,
  });
  return true;
}

/** Search + filter the memory. Empty query returns the most recent entries. */
export async function searchMemory(client: Client, opts: { query?: string; kind?: string; limit?: number } = {}): Promise<MemoryEntry[]> {
  let q = client.from('institutional_memory')
    .select('id, kind, title, body, entity_type, entity_id, tags, importance, created_at')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.query && opts.query.trim()) {
    const term = opts.query.trim().replace(/[%,]/g, '');
    q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }
  const { data } = await q;
  return (data ?? []) as MemoryEntry[];
}
