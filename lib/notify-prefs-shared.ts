/**
 * Ήχοι / ειδοποιήσεις υπολογιστή: ρύθμιση ανά συσκευή (μένει σε αυτό τον browser),
 * όπως στο FitnessCRM. Client-safe.
 */
export const NOTIF_PREFS_KEY = 'oramira_notif_prefs';
export const NOTIF_PREFS_EVENT = 'oramira:notif-prefs';
export interface NotifPrefs { sound: boolean; desktop: boolean; volume: number }
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { sound: false, desktop: false, volume: 75 };

export function readNotifPrefs(): NotifPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) ?? '{}');
    const vol = Number(p.volume);
    return { sound: p.sound === true, desktop: p.desktop === true, volume: Number.isFinite(vol) ? Math.min(100, Math.max(0, vol)) : 75 };
  } catch { return { ...DEFAULT_NOTIF_PREFS }; }
}

export function writeNotifPrefs(p: NotifPrefs) {
  try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent(NOTIF_PREFS_EVENT)); } catch { /* ignore */ }
}

/** Σύντομο διπλό «ding» (χωρίς αρχείο ήχου), στην ένταση που επιλέχθηκε. */
export function playChime(volume = 75) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx || volume <= 0) return;
    const ctx = new Ctx();
    const peak = 0.25 * (volume / 100);
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
    });
    setTimeout(() => ctx.close?.(), 800);
  } catch { /* audio blocked */ }
}
