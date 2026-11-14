/**
 * Controlador de Baliza Acústica Morse (880 Hz) y Háptica para Rescate USAR.
 * Emite la secuencia internacional SOS (··· ——— ···) a 880 Hz audible a través de estratos de escombros
 * y detectable por geófonos acústicos de bomberos y brigadas de búsqueda.
 */

let audioCtx: AudioContext | null = null;
let beaconTimer: ReturnType<typeof setInterval> | null = null;
let isBeaconPlaying = false;
const listeners = new Set<(active: boolean) => void>();

export function isAcousticBeaconActive(): boolean {
  return isBeaconPlaying;
}

export function subscribeAcousticBeacon(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  listener(isBeaconPlaying);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(active: boolean): void {
  isBeaconPlaying = active;
  listeners.forEach((l) => l(active));
}

/**
 * Emite una ráfaga de código Morse SOS a 880 Hz.
 */
export function playMorseSosBeep(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);

    let t = now + 0.05;
    const dot = 0.12;
    const dash = 0.36;
    const gap = 0.08;
    const letterGap = 0.22;

    // S: · · ·
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.35, t);
      t += dot;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }
    t += letterGap;

    // O: — — —
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.35, t);
      t += dash;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }
    t += letterGap;

    // S: · · ·
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.35, t);
      t += dot;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(t + 0.2);

    // Patrón de vibración táctica en celulares que lo soporten
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 80, 120, 80, 120, 220, 360, 80, 360, 80, 360, 220, 120, 80, 120, 80, 120]);
      } catch {}
    }
  } catch (err) {
    console.error('Error emitiendo pulso Morse 880Hz:', err);
  }
}

export function startAcousticBeacon(): void {
  if (isBeaconPlaying) return;

  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    notifyListeners(true);
    playMorseSosBeep(audioCtx);

    // Repetir el patrón Morse cada 4.5 segundos
    beaconTimer = setInterval(() => {
      if (audioCtx && isBeaconPlaying) {
        playMorseSosBeep(audioCtx);
      }
    }, 4500);
  } catch (err) {
    console.error('No se pudo iniciar la baliza acústica:', err);
    notifyListeners(false);
  }
}

export function stopAcousticBeacon(): void {
  if (beaconTimer) {
    clearInterval(beaconTimer);
    beaconTimer = null;
  }
  notifyListeners(false);
}

export function toggleAcousticBeacon(): boolean {
  if (isBeaconPlaying) {
    stopAcousticBeacon();
    return false;
  } else {
    startAcousticBeacon();
    return true;
  }
}
