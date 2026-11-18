// Every sound is synthesised with WebAudio: oscillators and a noise buffer, no
// audio files and no network. The context is created on the first user gesture
// (a click or key press), so browsers never block it.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.35;
    master.connect(context.destination);
    const length = Math.floor(context.sampleRate * 0.25);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /** A short oscillator blip: frequency slides from `from` to `to` over `seconds`. */
  function blip({ type = 'sine', from = 440, to = 440, seconds = 0.12, volume = 0.5, delay = 0 }) {
    if (muted || !ensure()) return;
    const t0 = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, t0);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(t0);
    oscillator.stop(t0 + seconds + 0.02);
  }

  /** A burst of filtered noise, for hits and explosions. */
  function noise({ seconds = 0.15, volume = 0.4, frequency = 1200, delay = 0 }) {
    if (muted || !ensure()) return;
    const t0 = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
    source.stop(t0 + seconds + 0.02);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      blip({ type: 'square', from: 720, to: 420, seconds: 0.07, volume: 0.16 });
    },
    hit() {
      noise({ seconds: 0.06, volume: 0.2, frequency: 2400 });
    },
    kill() {
      blip({ type: 'triangle', from: 320, to: 60, seconds: 0.22, volume: 0.4 });
      noise({ seconds: 0.18, volume: 0.25, frequency: 900 });
    },
    gem() {
      blip({ type: 'sine', from: 880, to: 1320, seconds: 0.09, volume: 0.22 });
    },
    levelup() {
      [523, 659, 784, 1047].forEach((frequency, i) => {
        blip({ type: 'triangle', from: frequency, to: frequency, seconds: 0.16, volume: 0.3, delay: i * 0.07 });
      });
    },
    hurt() {
      blip({ type: 'sawtooth', from: 180, to: 70, seconds: 0.25, volume: 0.45 });
      noise({ seconds: 0.2, volume: 0.3, frequency: 500 });
    },
    nova() {
      blip({ type: 'sine', from: 220, to: 880, seconds: 0.35, volume: 0.35 });
      noise({ seconds: 0.3, volume: 0.2, frequency: 1600 });
    },
    wave() {
      blip({ type: 'triangle', from: 392, to: 523, seconds: 0.25, volume: 0.3 });
      blip({ type: 'triangle', from: 523, to: 659, seconds: 0.25, volume: 0.3, delay: 0.12 });
    },
    over() {
      [392, 330, 262, 196].forEach((frequency, i) => {
        blip({ type: 'triangle', from: frequency, to: frequency * 0.94, seconds: 0.3, volume: 0.32, delay: i * 0.16 });
      });
    },
    click() {
      blip({ type: 'sine', from: 660, to: 660, seconds: 0.05, volume: 0.25 });
    },
  };
}
