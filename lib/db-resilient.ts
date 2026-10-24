/**
 * selectResilient — the one engine behind Oramira's "never show a false empty"
 * guarantee. A live DB may be missing columns from partially-applied migrations
 * (0020/0027); a single missing column makes PostgREST reject the WHOLE select,
 * which used to silently blank a page (empty pipeline, false "all clear"). This
 * runs the ideal (full-column) query and, only if it errors, falls back to a
 * base query of guaranteed columns — so the data is still true, just leaner.
 *
 * Returns a Promise so it composes inside Promise.all and keeps the happy path
 * parallel (the fallback only fires on error). Typed loosely on purpose: the two
 * selects have different row shapes.
 */
type QueryResult = { data: any[] | null; error: any };

export async function selectResilient(
  primary: PromiseLike<QueryResult>,
  fallback: () => PromiseLike<QueryResult>,
  label?: string,
): Promise<any[] | null> {
  const res = await primary;
  if (!res.error) return res.data;
  if (label) console.warn(`[selectResilient] ${label}: full select failed (${res.error.message}) — degrading to base columns`);
  const fb = await fallback();
  if (fb.error && label) console.error(`[selectResilient] ${label}: base select also failed:`, fb.error.message);
  return fb.data;
}
