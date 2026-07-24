import { describe, it, expect } from 'vitest';
import { shouldCreateChapter } from './chapterSummary.js';

describe('shouldCreateChapter', () => {
  it('no toca capítulo por debajo del umbral (15)', () => {
    expect(shouldCreateChapter(14)).toBe(false);
  });
  it('toca capítulo justo en el umbral', () => {
    expect(shouldCreateChapter(15)).toBe(true);
  });
  it('toca capítulo también por encima del umbral', () => {
    expect(shouldCreateChapter(30)).toBe(true);
  });
});
