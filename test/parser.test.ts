import { describe, expect, it } from 'vitest';
import { parseProgression } from '../src/parser/progression';

describe('parseProgression', () => {
  it('supports | and ; with optional outer separators', () => {
    const result = parseProgression('| C | Am ; F | G |');
    expect(result.validBars).toHaveLength(4);
    expect(result.issues).toHaveLength(0);
  });

  it('validates 1/2/4 slot bars only', () => {
    const result = parseProgression('C D E');
    expect(result.bars).toHaveLength(1);
    expect(result.validBars).toHaveLength(0);
    expect(result.issues[0]?.message).toContain('1, 2, 4');
  });

  it('expands % using the previous effective chord', () => {
    const result = parseProgression('Cm % | F %');
    expect(result.issues).toHaveLength(0);
    expect(result.validBars[0]?.slots[1]?.chord?.label).toBe('Cm');
    expect(result.validBars[1]?.slots[1]?.chord?.label).toBe('F');
  });

  it('supports N.C. and - as rests', () => {
    const result = parseProgression('C N.C. | - G7');
    expect(result.issues).toHaveLength(0);
    expect(result.validBars[0]?.slots[1]?.kind).toBe('rest');
    expect(result.validBars[1]?.slots[0]?.kind).toBe('rest');
  });

  it('parses slash chords and tensions', () => {
    const result = parseProgression('C/E | G7(b9) | Dm7(11) | Gm7-5');
    expect(result.issues).toHaveLength(0);
    expect(result.validBars[0]?.slots[0]?.chord?.bass).toBe('E');
    expect(result.validBars[1]?.slots[0]?.chord?.intervals).toContain(13);
    expect(result.validBars[2]?.slots[0]?.chord?.intervals).toContain(17);
    expect(result.validBars[3]?.slots[0]?.chord?.intervals).toEqual([0, 3, 6, 10]);
  });

  it('parses anticipation with a leading apostrophe', () => {
    const result = parseProgression("C 'F | 'B E");
    expect(result.issues).toHaveLength(0);
    expect(result.validBars[0]?.slots[1]?.anticipationBeats).toBe(0.5);
    expect(result.validBars[1]?.slots[0]?.anticipationBeats).toBe(0.5);
  });

  it('rejects anticipation on rests and repeats', () => {
    const result = parseProgression("'N.C. | '%");
    expect(result.validBars).toHaveLength(0);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]?.message).toContain('前ノリ');
  });

  it('reports invalid syntax', () => {
    const result = parseProgression('Czzz');
    expect(result.bars).toHaveLength(1);
    expect(result.validBars).toHaveLength(0);
    expect(result.issues[0]?.message).toContain('未対応');
  });
});
