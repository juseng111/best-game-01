// Gloomreef — every tuning number and colour in one place.
// The playfield is a fixed 1280x800 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 18,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.24,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 6,
  /** Seconds of no harm after a hit lands. */
  invulnerable: 0.9,
  /** How far gems are pulled in from. */
  magnetRadius: 110,
};

export const ENEMIES = {
  gloomlet: {
    name: 'Gloomlet',
    radius: 13,
    hp: 18,
    speed: 105,
    damage: 8,
    score: 10,
    xp: 1,
    cost: 1,
    body: '#7a4fd0',
    dark: '#4c1d95',
    eye: '#ff5d8f',
  },
  spitter: {
    name: 'Spitter',
    radius: 15,
    hp: 30,
    speed: 62,
    damage: 10,
    score: 25,
    xp: 2,
    cost: 2,
    body: '#9333ea',
    dark: '#5b21b6',
    eye: '#fbbf24',
    /** Keeps roughly this far from the warden and shoots shadow orbs. */
    holdRange: 300,
    fireInterval: 2.3,
    orbSpeed: 210,
    orbRadius: 7,
  },
  splitter: {
    name: 'Splitter',
    radius: 20,
    hp: 46,
    speed: 58,
    damage: 12,
    score: 30,
    xp: 3,
    cost: 3,
    body: '#6d28d9',
    dark: '#3b0764',
    eye: '#67e8f9',
  },
  bulwark: {
    name: 'Bulwark',
    radius: 30,
    hp: 150,
    speed: 40,
    damage: 18,
    score: 60,
    xp: 5,
    cost: 5,
    body: '#4c1d95',
    dark: '#2e1065',
    eye: '#f43f5e',
  },
};

/** Which enemy kinds may appear, by wave. */
export const WAVE_UNLOCKS = [
  { wave: 1, kinds: ['gloomlet'] },
  { wave: 2, kinds: ['gloomlet', 'spitter'] },
  { wave: 3, kinds: ['gloomlet', 'spitter', 'splitter'] },
  { wave: 4, kinds: ['gloomlet', 'spitter', 'splitter', 'bulwark'] },
];

/** Spawn budget in enemy-cost points, and how fast the queue drains. */
export const WAVE = {
  budget: (wave) => 6 + 5 * wave,
  spawnInterval: (wave) => Math.max(0.55 - 0.03 * wave, 0.22),
  /** Seconds of quiet between waves. */
  breather: 3,
  /** Enemy health and speed growth per wave. */
  hpPerWave: 0.14,
  speedPerWave: 0.035,
  speedCap: 1.5,
  /** Most enemies alive at once. */
  maxAlive: 70,
};

/** XP needed to rise from `level` to `level + 1`. */
export const xpNeeded = (level) => 8 + level * 5;

export const UPGRADES = [
  { id: 'bright', name: 'Bright Bolts', text: '+25% bolt damage', max: 5 },
  { id: 'rapid', name: 'Rapid Lantern', text: '+18% fire rate', max: 5 },
  { id: 'swift', name: 'Swift Current', text: '+12% move speed', max: 5 },
  { id: 'heart', name: 'Deep Heart', text: '+25 max HP and heal 25', max: 5 },
  { id: 'aegis', name: 'Aegis Bloom', text: '+1 shield that blocks a hit', max: 3 },
  { id: 'nova', name: 'Nova Burst', text: 'A nova blast every 9 seconds', max: 5 },
];

export const NOVA = { interval: 9, radius: 150, radiusPerLevel: 35, damage: 25, damagePerLevel: 15 };

export const PALETTE = {
  backdropTop: '#150a2e',
  backdropBottom: '#0a0518',
  sand: '#241640',
  coral: '#ff7a6b',
  coralDark: '#c2415a',
  teal: '#2dd4bf',
  tealDark: '#0f766e',
  anemone: '#f472b6',
  rock: '#3b2d5e',
  player: '#7ef0d4',
  playerCore: '#f0fdfa',
  bolt: '#ffd166',
  gem: '#67e8f9',
  gemCore: '#ecfeff',
  orb: '#c084fc',
  text: '#f4f1ff',
  muted: '#a89cc9',
  panel: 'rgba(16, 8, 38, 0.88)',
  panelEdge: '#4c3a7d',
  danger: '#fb7185',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gloomreef.best';
