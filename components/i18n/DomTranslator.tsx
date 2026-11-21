'use client';

import { useLayoutEffect } from 'react';
import type { Lang } from '@/lib/locale-shared';

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const LATIN = /[A-Za-z]{2}/;
const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

type Pattern = { re: RegExp; to: string };
function compile(dict: Record<string, string>) {
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!v) continue;
    if (k.includes('{}')) {
      // Σύντομα μοτίβα (π.χ. «{} μέρες») δέχονται στη θέση του {} μόνο αριθμούς /
      // λατινικά — αλλιώς «πιάνουν» και ελληνικές λέξεις και βγαίνουν μισομεταφρασμένα.
      const words = k.split('{}').join(' ').trim().split(/\s+/).filter(Boolean).length;
      // Το {} δεν «περνάει» πάνω από διαχωριστικό « · » (εκεί μεταφράζεται κάθε κομμάτι χωριστά).
      const hole = words >= 3 ? '((?:(?! · ).)+?)' : '((?:(?! · )[^\u0370-\u03FF\u1F00-\u1FFF])+?)';
      const src = k.split('{}').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(hole);
      patterns.push({ re: new RegExp(`^${src}$`, 's'), to: v });
    } else exact.set(k, v);
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  // Τιμές μέσα σε μοτίβο (π.χ. όνομα σταδίου «Νέο») μεταφράζονται κι αυτές αν είναι γνωστές λέξεις.
  const hole = (s: string) => exact.get(s.trim()) ?? s;
  const run = (text: string, depth: number): string | null => {
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    const hit = exact.get(key);
    if (hit !== undefined) return hit;
    for (const p of patterns) {
      const m = key.match(p.re);
      if (m) { let i = 1; return p.to.replace(/\{\}/g, () => hole(m[i++] ?? '')); }
    }
    // Ενωμένα κομμάτια «α · β · γ.» — μεταφράζεται το καθένα χωριστά.
    if (depth === 0 && key.includes(' · ')) {
      const dot = key.endsWith('.') && !key.endsWith('..') ? '.' : '';
      const parts = (dot ? key.slice(0, -1) : key).split(' · ');
      let changed = false;
      const out = parts.map((s) => { const t = run(s, 1); if (t !== null) { changed = true; return t; } return s; });
      if (changed) return out.join(' · ') + dot;
    }
    return null;
  };
  return (text: string): string | null => run(text, 0);
}

/**
 * Μεταφράζει τα κείμενα της οθόνης όταν η γλώσσα δεν είναι ελληνικά: ψάχνει
 * κάθε ελληνικό κείμενο (και placeholder / title / aria-label) στο λεξικό και
 * το αντικαθιστά. Δεν αγγίζει ό,τι γράφετε σε πεδία, ούτε στοιχεία με
 * data-no-tr. Ό,τι αλλάζει αργότερα στην οθόνη μεταφράζεται αμέσως.
 */
export function DomTranslator({ lang }: { lang: Lang }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let obs: MutationObserver | null = null;
    let cancelled = false;
    // Περιμένουμε να «ζωντανέψει» πρώτα η σελίδα (hydration): αν αλλάξει το κείμενο
    // νωρίτερα, το React το βλέπει διαφορετικό από του server και ξαναχτίζει τη σελίδα.
    const hydrated = new Promise<void>((res) => {
      const idle = () => { const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined; if (ric) ric(() => res(), { timeout: 700 }); else setTimeout(res, 120); };
      if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
    });
    // Ελληνικά κείμενα → λεξικό της γλώσσας· αγγλικά κείμενα (όπου έμειναν) → ελληνικά / ρωσικά.
    const greekDict = lang === 'ru' ? import('@/lib/i18n-dict/ru').then((m) => m.RU) : lang === 'en' ? import('@/lib/i18n-dict/en').then((m) => m.EN) : Promise.resolve(null);
    const latinDict = lang === 'el' ? import('@/lib/i18n-dict/from-en').then((m) => m.EN_EL) : lang === 'ru' ? import('@/lib/i18n-dict/from-en').then((m) => m.EN_RU) : Promise.resolve(null);
    Promise.all([greekDict, latinDict, hydrated]).then(([gd, ld]) => {
      if (cancelled) return;
      const trG = gd ? compile(gd) : () => null;
      const trL = ld ? compile(ld) : () => null;
      const tr = (v: string) => (GREEK.test(v) ? trG(v) : LATIN.test(v) ? trL(v) : null);
      const wants = (v: string) => (gd && GREEK.test(v)) || (ld && !GREEK.test(v) && LATIN.test(v));
      const skip = (el: Element | null) => !el || SKIP.has(el.tagName) || !!el.closest('[data-no-tr],[contenteditable="true"]');
      const textNode = (n: Text) => {
        const v = n.nodeValue ?? '';
        if (!wants(v) || skip(n.parentElement)) return;
        const t = tr(v);
        if (t !== null) {
          const lead = v.match(/^\s*/)?.[0] ?? '', trail = v.match(/\s*$/)?.[0] ?? '';
          const nv = lead + t + trail;
          if (nv !== v) n.nodeValue = nv;
        }
      };
      const attrs = (el: Element) => {
        for (const a of ATTRS) {
          const v = el.getAttribute(a);
          if (v && wants(v)) { const t = tr(v); if (t !== null && t !== v) el.setAttribute(a, t); }
        }
      };
      const walk = (node: Node) => {
        if (node.nodeType === 3) { textNode(node as Text); return; }
        if (node.nodeType !== 1) return;
        const el = node as Element;
        if (SKIP.has(el.tagName) || el.closest('[data-no-tr]')) return;
        attrs(el);
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let c: Node | null = w.nextNode();
        while (c) { if (c.nodeType === 3) textNode(c as Text); else attrs(c as Element); c = w.nextNode(); }
      };
      walk(document.body);
      const title = document.title; if (GREEK.test(title)) { const t = tr(title); if (t) document.title = t; }
      obs = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'characterData') textNode(m.target as Text);
          else if (m.type === 'attributes') attrs(m.target as Element);
          else m.addedNodes.forEach(walk);
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      root.dataset.tr = '1';
    }).catch(() => { root.dataset.tr = '1'; });
    return () => { cancelled = true; obs?.disconnect(); };
  }, [lang]);
  return null;
}
