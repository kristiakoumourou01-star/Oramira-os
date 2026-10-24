import { NextResponse, type NextRequest } from 'next/server';
import { intakeInboundLead } from '@/lib/intake';

/**
 * Meta capture webhook — Lead Ads forms, Messenger, and Instagram DMs. Verifies
 * the Meta handshake (GET), then normalizes each inbound event into the intake
 * chokepoint so it becomes a CRM lead (deduped, auto-detected, automations
 * triggered). Lead Ads field data is fetched from the Graph API when a page
 * token is configured; otherwise the leadgen id is captured for later sync.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const object = body?.object; // 'page' | 'instagram'
    for (const entry of body?.entry ?? []) {
      // Lead Ads form submissions
      for (const change of entry?.changes ?? []) {
        if (change?.field === 'leadgen') await handleLeadgen(change.value);
      }
      // Messenger / Instagram DMs
      for (const m of entry?.messaging ?? []) {
        const text = m?.message?.text;
        const senderId = m?.sender?.id;
        if (text && senderId) {
          await intakeInboundLead({
            channel: object === 'instagram' ? 'instagram' : 'facebook',
            message: text,
            externalId: senderId,
            source: object === 'instagram' ? 'instagram' : 'facebook',
          });
        }
      }
    }
  } catch (err) {
    console.error('meta webhook error', err);
  }
  return NextResponse.json({ ok: true });
}

const BUDGET_KEYS = /budget|price|invest|spend|afford|finance/i;
const TIMELINE_KEYS = /timeline|timeframe|when|move|ready|purchase|buy.*when|how soon/i;

/** "€250,000", "300k", "1.2m" → 250000 / 300000 / 1200000. */
function parseAmount(token: string): number | null {
  const m = token.replace(/[, ]/g, '').match(/([\d.]+)\s*([km])?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2]?.toLowerCase() === 'k') n *= 1_000;
  if (m[2]?.toLowerCase() === 'm') n *= 1_000_000;
  return Number.isNaN(n) ? null : Math.round(n);
}

/** Parse a free-text budget answer into a min/max range. */
function parseBudget(s: string): { min?: number; max?: number } {
  const nums = (s.match(/[\d][\d.,]*\s*[km]?/gi) ?? [])
    .map(parseAmount)
    .filter((n): n is number => n != null && n >= 1000); // ignore "2" from "2-bed"
  if (nums.length >= 2) { const sorted = nums.sort((a, b) => a - b); return { min: sorted[0], max: sorted[sorted.length - 1] }; }
  if (nums.length === 1) return { max: nums[0] };
  return {};
}

async function handleLeadgen(value: any) {
  const leadgenId = value?.leadgen_id;
  let name: string | undefined, email: string | undefined, phone: string | undefined;
  let first: string | undefined, last: string | undefined;
  let budgetMin: number | undefined, budgetMax: number | undefined, timeline: string | undefined;
  const extras: string[] = []; // every other ad answer, preserved on the lead

  // Fetch the actual field values if a page access token is configured.
  if (leadgenId && process.env.META_PAGE_TOKEN) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${leadgenId}?access_token=${process.env.META_PAGE_TOKEN}`);
      const data = await res.json();
      for (const f of data?.field_data ?? []) {
        const key = String(f?.name ?? '').toLowerCase();
        const v = f?.values?.[0];
        if (!v) continue;
        if (key === 'full_name' || key === 'name') name = v;
        else if (key === 'first_name') first = v;
        else if (key === 'last_name') last = v;
        else if (key === 'email') email = v;
        else if (key === 'phone_number' || key === 'phone') phone = v;
        else if (BUDGET_KEYS.test(key)) { const b = parseBudget(String(v)); budgetMin = b.min; budgetMax = b.max; extras.push(`Budget: ${v}`); }
        else if (TIMELINE_KEYS.test(key)) { timeline = String(v); extras.push(`Timeline: ${v}`); }
        else extras.push(`${f.name}: ${v}`);
      }
    } catch (err) {
      console.error('leadgen fetch failed', err);
    }
  }

  await intakeInboundLead({
    channel: 'facebook', source: 'meta', externalId: leadgenId,
    name: name ?? ([first, last].filter(Boolean).join(' ') || undefined),
    email, phone, budgetMin, budgetMax, timeline,
    message: extras.length ? extras.join(' · ') : undefined,
  });
}
