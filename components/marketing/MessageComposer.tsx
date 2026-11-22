'use client';

import { Bell, Mail, MessageSquare } from 'lucide-react';
import { LangTabs } from '@/components/marketing/LangTabs';
import { CHANNEL_NAME, smsParts, senderDefaultFor, type CampaignChannel, type SenderDefaults } from '@/lib/campaigns-shared';
import { previewFooter, textWithSignature, type MsgLang, type SignatureInfo } from '@/lib/message-format-shared';

export interface MessageValue { senderName: string; subject: string; subjectEn: string; body: string; bodyEn: string; preview?: string }

const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`;

/**
 * «Τι λέει»: κανάλι, όνομα αποστολέα, θέμα και κείμενο σε Ελληνικά / English,
 * μεταβλητές και ζωντανή προεπισκόπηση (αποστολέας, θέμα, κείμενο, υπογραφή).
 * Κοινό για τις καμπάνιες και τους αυτοματισμούς.
 */
export function MessageComposer({ channel, onChannel, value, onChange, lang, onLang, vars, defaults, signature, render, marketing = true, emailPreviewLine = false }: {
  channel: CampaignChannel; onChannel?: (c: CampaignChannel) => void;
  value: MessageValue; onChange: (v: MessageValue) => void;
  lang: MsgLang; onLang: (l: MsgLang) => void;
  vars: { key: string; label: string }[]; defaults: SenderDefaults; signature: SignatureInfo | null;
  render: (text: string, lang: MsgLang) => string; marketing?: boolean; emailPreviewLine?: boolean;
}) {
  const en = lang === 'en';
  const subject = en ? value.subjectEn : value.subject;
  const body = en ? value.bodyEn : value.body;
  const set = (p: Partial<MessageValue>) => onChange({ ...value, ...p });
  const setSubject = (t: string) => set(en ? { subjectEn: t } : { subject: t });
  const setBody = (t: string) => set(en ? { bodyEn: t } : { body: t });
  const sender = value.senderName.trim() || senderDefaultFor(channel, defaults) || (signature?.signature ?? '');
  const shown = render(body, lang);
  const smsText = channel === 'push' ? shown : textWithSignature(shown, signature?.signature ?? '');
  const footer = previewFooter(channel, signature, lang, marketing);
  const isText = channel === 'sms' || channel === 'whatsapp';
  const badSender = isText && value.senderName.trim() && (!/^[A-Za-z0-9 ]{1,11}$/.test(value.senderName.trim()) || !/[A-Za-z]/.test(value.senderName));
  const changeChannel = (c: CampaignChannel) => {
    // Αν το όνομα αποστολέα είναι η προεπιλογή του προηγούμενου καναλιού, παίρνει την προεπιλογή του νέου.
    if (!value.senderName.trim() || value.senderName === senderDefaultFor(channel, defaults)) onChange({ ...value, senderName: senderDefaultFor(c, defaults) });
    onChannel?.(c);
  };

  return (
    <div className="space-y-3">
      {onChannel && <div className="flex flex-wrap gap-1.5">{(['email', 'sms', 'whatsapp', 'push'] as const).map((c) => <button key={c} type="button" onClick={() => changeChannel(c)} className={chip(channel === c)}><span data-no-tr>{CHANNEL_NAME[c]}</span></button>)}</div>}
      {channel !== 'push' && (
        <label className="block">
          <span className={lbl}>Όνομα αποστολέα</span>
          <input className="input" value={value.senderName} maxLength={isText ? 11 : 80} placeholder={senderDefaultFor(channel, defaults) || 'Oramira'} onChange={(e) => set({ senderName: e.target.value })} data-no-tr />
          <span className={`mt-1 block text-[12px] ${badSender ? 'text-signal-danger' : 'text-charcoal-600'}`}>{isText ? 'Έως 11 λατινικά γράμματα ή αριθμοί (π.χ. Oramira). Κενό = η προεπιλογή από Ρυθμίσεις → Επικοινωνία.' : 'Το όνομα που βλέπει ο πελάτης στα εισερχόμενα. Κενό = η προεπιλογή από Ρυθμίσεις → Επικοινωνία.'}</span>
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LangTabs lang={lang} onChange={onLang} filled={{ el: !!value.body.trim(), en: !!value.bodyEn.trim() }} />
        <span className="text-[12px] text-charcoal-600">Οι πελάτες με γλώσσα Ελληνικά παίρνουν την ελληνική εκδοχή· όλοι οι άλλοι την αγγλική.</span>
      </div>
      {(channel === 'email' || channel === 'push') && <label className="block"><span className={lbl}>{channel === 'email' ? 'Θέμα *' : 'Τίτλος ειδοποίησης'}</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}
      {channel === 'email' && emailPreviewLine && value.preview !== undefined && <label className="block"><span className={lbl}>Κείμενο προεπισκόπησης</span><input className="input" value={value.preview} onChange={(e) => set({ preview: e.target.value })} /></label>}
      <div>
        <span className={lbl}>Μήνυμα *</span>
        <div className="mb-1.5 flex flex-wrap gap-1 text-[12px]">{vars.map((v) => <button key={v.key} type="button" onClick={() => setBody(`${body}{{${v.key}}}`)} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ {v.label}</button>)}</div>
        <textarea className={`input ${isText ? 'min-h-[100px]' : 'min-h-[150px]'}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={en ? 'Dear {{first_name}},\n\n…' : 'Αγαπητέ/ή {{first_name}},\n\n…'} />
        {channel === 'sms' && (() => { const sp = smsParts(smsText); return <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-charcoal-600"><span>{`${sp.chars} χαρακτήρες`}</span><span>{`${sp.parts} SMS ανά παραλήπτη`}</span>{sp.unicode && <span>Ελληνικά: 70 χαρακτήρες ανά SMS</span>}<span>(μαζί με την υπογραφή)</span></p>; })()}
      </div>
      {body.trim() && (
        <div>
          <span className={lbl}>Προεπισκόπηση</span>
          <div className="overflow-hidden rounded-xl border border-stone-line bg-white">
            <div className="flex items-center gap-2 border-b border-stone-line bg-stone-50 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white">{channel === 'email' ? <Mail size={14} /> : channel === 'push' ? <Bell size={14} /> : <MessageSquare size={14} />}</span>
              <span className="min-w-0 flex-1" data-no-tr>
                <span className="block truncate text-[13px] font-semibold text-charcoal">{channel === 'push' ? (render(subject, lang) || sender) : sender}</span>
                <span className="block truncate text-[12px] text-charcoal-600">{channel === 'email' ? render(subject, lang) : shown.split('\n')[0]}</span>
              </span>
            </div>
            <div className="whitespace-pre-wrap p-3 text-[14px] text-charcoal" data-no-tr>
              {isText ? smsText : shown}
              {channel === 'email' && footer.length > 0 && <div className="mt-4 border-t border-stone-line pt-2 text-[11px] text-charcoal-600">{footer.map((l, i) => <p key={i} className={i === 0 ? 'font-semibold' : ''}>{l}</p>)}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
