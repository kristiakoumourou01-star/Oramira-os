'use server';

import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Global search for the ⌘K command palette. Queries the entities a staff member
 * can act on (leads, land parcels, projects, open tasks), RLS-scoped through the
 * session client. Each query is isolated so one failing table never blanks the
 * whole result set. Returns a flat, ranked list the palette renders by group.
 */

export interface SearchHit { id: string; type: 'lead' | 'parcel' | 'project' | 'task'; label: string; sublabel: string; href: string }

export async function globalSearch(query: string): Promise<SearchHit[]> {
  await requireProfile();
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createSupabaseServerClient();
  const like = `%${q.replace(/[%,]/g, '')}%`;
  const out: SearchHit[] = [];

  const ok = (r: any) => r?.data ?? [];
  const err = () => [] as any[];
  const [leads, parcels, projects, tasks] = await Promise.all([
    supabase.from('leads').select('id, status, contacts!inner(full_name, email)').ilike('contacts.full_name', like).limit(6).then(ok, err),
    supabase.from('land_parcels').select('id, reference, location').ilike('reference', like).limit(5).then(ok, err),
    supabase.from('projects').select('id, name, location').ilike('name', like).limit(4).then(ok, err),
    supabase.from('tasks').select('id, title, related_entity_type, related_entity_id').eq('is_done', false).ilike('title', like).limit(4).then(ok, err),
  ]);

  for (const l of leads as any[]) out.push({ id: l.id, type: 'lead', label: l.contacts?.full_name ?? 'Lead', sublabel: `Lead · ${l.status}`, href: `/crm/leads/${l.id}` });
  for (const p of parcels as any[]) out.push({ id: p.id, type: 'parcel', label: p.reference, sublabel: `Parcel${p.location ? ` · ${p.location}` : ''}`, href: `/acquisitions/${p.id}` });
  for (const pr of projects as any[]) out.push({ id: pr.id, type: 'project', label: pr.name, sublabel: `Project${pr.location ? ` · ${pr.location}` : ''}`, href: `/projects/${pr.id}` });
  for (const t of tasks as any[]) out.push({ id: t.id, type: 'task', label: t.title, sublabel: 'Task', href: t.related_entity_type === 'lead' && t.related_entity_id ? `/crm/leads/${t.related_entity_id}` : '/dashboard' });

  return out;
}
