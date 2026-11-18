// A small seeded random source (mulberry32) so a screenshot scene staged with a
// fixed seed always plays out the same way.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [a, b). */
    range: (a, b) => a + (b - a) * next(),
    /** An integer in [a, b]. */
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    /** One element of a non-empty array. */
    pick: (array) => array[Math.floor(next() * array.length)],
    /** True with probability p. */
    chance: (p) => next() < p,
  };
}
