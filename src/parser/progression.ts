import type { ParseIssue, ParsedBar, ProgressionParseResult, Slot } from '../types/music';
import { parseChordSymbol } from './chord';

const REST_TOKENS = new Set(['N.C.', '-']);
const BAR_DELIMITER_RE = /[|;]/;

function splitBars(text: string): string[] {
  return text
    .split(BAR_DELIMITER_RE)
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0);
}

function tokenizeBar(bar: string): string[] {
  return bar
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function parseAnticipation(token: string): { coreToken: string; anticipationBeats: number } {
  if (!token.startsWith("'")) {
    return { coreToken: token, anticipationBeats: 0 };
  }

  return {
    coreToken: token.slice(1),
    anticipationBeats: 0.5,
  };
}

export function parseProgression(text: string): ProgressionParseResult {
  const rawBars = splitBars(text);
  const bars: ParsedBar[] = [];
  const issues: ParseIssue[] = [];
  let previousChord = null as ReturnType<typeof parseChordSymbol> | null;

  rawBars.forEach((rawBar, barIndex) => {
    const tokens = tokenizeBar(rawBar);
    const slots: Slot[] = [];

    if (![1, 2, 4].includes(tokens.length)) {
      issues.push({
        barIndex,
        message: `小節 ${barIndex + 1} は 1, 2, 4 個のトークンのみ対応です`,
      });
      bars.push({
        index: barIndex,
        raw: rawBar,
        tokens,
        slots,
        slotCount: tokens.length,
      });
      return;
    }

    tokens.forEach((token, tokenIndex) => {
      const { coreToken, anticipationBeats } = parseAnticipation(token);

      if (anticipationBeats > 0 && (coreToken === '%' || REST_TOKENS.has(coreToken))) {
        issues.push({
          barIndex,
          tokenIndex,
          token,
          message: `小節 ${barIndex + 1} の ${token} は前ノリ指定できません`,
        });
        return;
      }

      if (coreToken === '%') {
        if (!previousChord) {
          issues.push({
            barIndex,
            tokenIndex,
            token,
            message: `小節 ${barIndex + 1} の % は直前のコードが必要です`,
          });
          return;
        }

        slots.push({
          token,
          kind: 'chord',
          chord: previousChord,
          sourceTokenIndex: tokenIndex,
          anticipationBeats,
        });
        return;
      }

      if (REST_TOKENS.has(coreToken)) {
        slots.push({
          token,
          kind: 'rest',
          chord: null,
          sourceTokenIndex: tokenIndex,
          anticipationBeats,
        });
        return;
      }

      try {
        const chord = parseChordSymbol(coreToken);
        previousChord = chord;
        slots.push({
          token,
          kind: 'chord',
          chord,
          sourceTokenIndex: tokenIndex,
          anticipationBeats,
        });
      } catch (error) {
        issues.push({
          barIndex,
          tokenIndex,
          token,
          message: error instanceof Error ? error.message : 'コード解釈に失敗しました',
        });
      }
    });

    if (slots.length !== tokens.length) {
      bars.push({
        index: barIndex,
        raw: rawBar,
        tokens,
        slots,
        slotCount: tokens.length,
      });
      return;
    }

    bars.push({
      index: barIndex,
      raw: rawBar,
      tokens,
      slots,
      slotCount: tokens.length,
    });
  });

  const validBars = bars.filter((bar) => !issues.some((issue) => issue.barIndex === bar.index));

  return { bars, issues, validBars };
}
