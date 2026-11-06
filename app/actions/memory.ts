'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { captureMemory, searchMemory, type MemoryEntry, type MemoryKind } from '@/lib/executive-memory';

/** Add an institutional-memory entry (staff, session-scoped by RLS). */
export async function addMemoryEntry(input: { kind: MemoryKind; title: string; body?: string; tags?: string[]; importance?: 'low' | 'normal' | 'high' }): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  if (!input.title?.trim()) return { ok: false, error: 'A title is required.' };
  const supabase = await createSupabaseServerClient();
  await captureMemory(supabase, {
    kind: input.kind, title: input.title.trim(), body: input.body?.trim() || '',
    tags: (input.tags ?? []).filter(Boolean), importance: input.importance ?? 'normal', createdBy: profile.id,
  });
  revalidatePath('/reports');
  return { ok: true };
}

/** Search the memory — used by the client search box on the Memory tab. */
export async function searchMemoryEntries(query: string, kind?: string): Promise<MemoryEntry[]> {
  await requireProfile();
  const supabase = await createSupabaseServerClient();
  return searchMemory(supabase, { query, kind: kind || undefined });
}
