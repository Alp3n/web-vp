/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SIM_DIR = join(ROOT, 'src', 'sim');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Usuwa komentarze i zawartość literałów tekstowych, żeby nie robiły fałszywych trafień. */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    const ch = src[i]!;
    if (ch === '"' || ch === "'" || ch === '`') {
      // zachowaj cudzysłowy (potrzebne do wykrywania importów), wytnij treść tylko dla `...`
      const quote = ch;
      let j = i + 1;
      let body = '';
      while (j < src.length) {
        if (src[j] === '\\') {
          body += src[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        body += src[j];
        j += 1;
      }
      out += quote + (quote === '`' ? '' : body) + quote;
      i = j + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bfrom\s*['"]phaser(\/[^'"]*)?['"]/, why: "import z 'phaser'" },
  { pattern: /\brequire\s*\(\s*['"]phaser/, why: "require('phaser')" },
  { pattern: /\bMath\s*\.\s*random\b/, why: 'Math.random (użyj src/sim/rng.ts)' },
  { pattern: /\bDate\s*\.\s*now\b/, why: 'Date.now (użyj licznika ticków)' },
  { pattern: /\bperformance\s*\.\s*now\b/, why: 'performance.now (użyj licznika ticków)' },
  { pattern: /\bdocument\s*\./, why: 'document.* (DOM)' },
  { pattern: /\bwindow\s*\./, why: 'window.* (DOM)' },
  { pattern: /\bfrom\s*['"][^'"]*assets\//, why: 'import z assets/' },
  { pattern: /\bfrom\s*['"][^'"]*(src\/)?render\//, why: 'import z src/render' },
  { pattern: /\bfrom\s*['"][^'"]*(src\/)?input\//, why: 'import z src/input' },
  { pattern: /\bfrom\s*['"][^'"]*(src\/)?pwa\//, why: 'import z src/pwa' },
];

describe('czystość src/sim', () => {
  const files = listTsFiles(SIM_DIR);

  it('znajduje pliki symulacji', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(ROOT, f), f] as const))(
    '%s nie łamie kontraktu czystej symulacji',
    (rel, full) => {
      const code = stripCommentsAndStrings(readFileSync(full, 'utf8'));
      const violations = FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map((v) => v.why);
      expect(violations, `${rel}: ${violations.join(', ')}`).toEqual([]);
    },
  );
});
