let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function playRecordStartSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Note 1 (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Note 2 (E5) - slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
    
    // Trigger mobile vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  } catch (err) {
    console.warn('Synth playback failed:', err);
  }
}

export function playRecordStopSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Note 1 (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Note 2 (F4)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(349.23, now + 0.06); // F4
    gain2.gain.setValueAtTime(0, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.2);
    
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 30, 10]);
    }
  } catch (err) {
    console.warn('Synth playback failed:', err);
  }
}

export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Quick soft high tick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
    
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  } catch (err) {
    console.warn('Synth playback failed:', err);
  }
}

export function playDeleteSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Descending frequency sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.exponentialRampToValueAtTime(110.00, now + 0.35); // A2
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
    
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }
  } catch (err) {
    console.warn('Synth playback failed:', err);
  }
}

export function playUndoSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Fast ascending double-tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(261.63, now); // C4
    osc1.frequency.linearRampToValueAtTime(392.00, now + 0.08); // G4
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(392.00, now + 0.06); // G4
    osc2.frequency.linearRampToValueAtTime(523.25, now + 0.16); // C5
    gain2.gain.setValueAtTime(0, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.2);
    
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 20]);
    }
  } catch (err) {
    console.warn('Synth playback failed:', err);
  }
}

