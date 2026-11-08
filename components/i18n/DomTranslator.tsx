'use client';

import { useLayoutEffect } from 'react';
import type { Lang } from '@/lib/locale-shared';

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

type Pattern = { re: RegExp; to: string };
function compile(dict: Record<string, string>) {
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!v) continue;
    if (k.includes('{}')) {
      const src = k.split('{}').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
      patterns.push({ re: new RegExp(`^${src}$`, 's'), to: v });
    } else exact.set(k, v);
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return (text: string): string | null => {
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    const hit = exact.get(key);
    if (hit !== undefined) return hit;
    for (const p of patterns) {
      const m = key.match(p.re);
      if (m) { let i = 1; return p.to.replace(/\{\}/g, () => m[i++] ?? ''); }
    }
    return null;
  };
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
    if (lang === 'el') { root.dataset.tr = '1'; return; }
    let obs: MutationObserver | null = null;
    let cancelled = false;
    (lang === 'ru' ? import('@/lib/i18n-dict/ru').then((m) => m.RU) : import('@/lib/i18n-dict/en').then((m) => m.EN)).then((dict) => {
      if (cancelled) return;
      const tr = compile(dict);
      const skip = (el: Element | null) => !el || SKIP.has(el.tagName) || !!el.closest('[data-no-tr],[contenteditable="true"]');
      const textNode = (n: Text) => {
        const v = n.nodeValue ?? '';
        if (!GREEK.test(v) || skip(n.parentElement)) return;
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
          if (v && GREEK.test(v)) { const t = tr(v); if (t !== null && t !== v) el.setAttribute(a, t); }
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
