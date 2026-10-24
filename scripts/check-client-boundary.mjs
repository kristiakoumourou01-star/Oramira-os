#!/usr/bin/env node
/**
 * Client/server boundary guard.
 *
 * Fails the build if any Client Component ("use client") imports — directly or
 * transitively — a module that reaches server-only code (`next/headers`,
 * `next/server`, `server-only`, or `@/lib/supabase/*server`). Server Actions
 * (`@/app/actions/*`, marked `'use server'`) are a legitimate boundary and are
 * skipped. See ARCHITECTURE.md for the rules and the `*-shared.ts` split pattern.
 *
 * Zero dependencies — runs on plain Node during `prebuild`.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SERVER_APIS = ['next/headers', 'next/server', 'server-only', '@/lib/supabase/server', '@/lib/supabase/middleware'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'lib'))];
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const importsOf = (txt) => [...txt.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const isClient = (f) => /^\s*['"]use client['"]/.test(read(f).slice(0, 400));

// Resolve an `@/...` specifier to a file on disk.
function resolve(spec) {
  if (!spec.startsWith('@/')) return null;
  const base = join(ROOT, spec.slice(2));
  for (const cand of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) if (existsSync(cand)) return cand;
  return null;
}
const isServerApi = (s) => SERVER_APIS.includes(s) || s.startsWith('next/headers') || s.startsWith('next/server') || s === 'server-only';

// Compute the taint closure: a module is tainted if it (transitively) imports a
// server API. Server-action files are NOT propagated (they are the RPC boundary).
const tainted = new Set();
for (const f of FILES) if (importsOf(read(f)).some(isServerApi)) tainted.add(f);
let changed = true;
while (changed) {
  changed = false;
  for (const f of FILES) {
    if (tainted.has(f)) continue;
    for (const spec of importsOf(read(f))) {
      if (spec.startsWith('@/app/actions/')) continue; // server-action boundary
      const r = resolve(spec);
      if (r && tainted.has(r)) { tainted.add(f); changed = true; break; }
    }
  }
}

// Audit every client component.
const clients = FILES.filter((f) => f.endsWith('.tsx') && isClient(f));
const violations = [];
for (const c of clients) {
  const txt = read(c);
  for (const spec of importsOf(txt)) {
    if (isServerApi(spec)) { violations.push({ file: c, spec, kind: 'direct server API' }); continue; }
    if (spec.startsWith('@/app/actions/')) continue;
    const r = resolve(spec);
    if (r && tainted.has(r)) {
      const typeOnly = new RegExp(`import\\s+type\\s+\\{[^}]*\\}\\s+from\\s+['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(txt);
      violations.push({ file: c, spec, kind: typeOnly ? 'type-only import of server lib' : 'VALUE import of server lib' });
    }
  }
}

const rel = (f) => relative(ROOT, f);
if (violations.length === 0) {
  console.log(`✓ Client/server boundary clean — ${clients.length} client components, 0 violations.`);
  process.exit(0);
}
console.error(`\n✗ Client/server boundary violations (${violations.length}):\n`);
for (const v of violations) console.error(`  ${rel(v.file)}\n     imports "${v.spec}"  [${v.kind}]`);
console.error(`\nFix: move client-safe types/constants into a *-shared.ts module (no server imports)`);
console.error(`and import those from the client. See ARCHITECTURE.md.\n`);
process.exit(1);
