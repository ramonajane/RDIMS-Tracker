// Audio + haptic feedback helpers for the scanner.

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};

const tone = (freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.08) => {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime;
  osc.start(t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.stop(t0 + durationMs / 1000);
};

const KEY = "rdims-feedback";
type Prefs = { sound: boolean; vibrate: boolean };
const DEFAULTS: Prefs = { sound: true, vibrate: true };

export const getFeedbackPrefs = (): Prefs => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
};

export const setFeedbackPrefs = (p: Prefs) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

export const beepSuccess = () => {
  const p = getFeedbackPrefs();
  if (p.sound) tone(880, 120, "sine", 0.1);
  if (p.vibrate && navigator.vibrate) navigator.vibrate(40);
};

export const beepError = () => {
  const p = getFeedbackPrefs();
  if (p.sound) {
    tone(220, 180, "square", 0.08);
    setTimeout(() => tone(180, 220, "square", 0.08), 160);
  }
  if (p.vibrate && navigator.vibrate) navigator.vibrate([60, 50, 60]);
};
