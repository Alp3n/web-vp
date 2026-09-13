/// <reference types="node" />
/**
 * Zrzut ekranu strony przez headless Chromium (playwright-core).
 * Używane do kontroli jakości (PLAN.md §6: „nie akceptuj sprite'a, którego nie widziałeś").
 *
 * Użycie:
 *   npm run screenshot -- --url=http://localhost:4173/ --out=/tmp/shot.png --viewport=844x390
 *
 * Kod wyjścia 1, jeśli w konsoli przeglądarki pojawiły się błędy (chyba że --allow-console-errors).
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';

interface Options {
  url: string;
  out: string;
  width: number;
  height: number;
  waitMs: number;
  selector: string | null;
  allowConsoleErrors: boolean;
}

function parseArgs(argv: string[]): Options {
  const map = new Map<string, string>();
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) map.set(m[1]!, m[2] ?? 'true');
  }
  const viewport = map.get('viewport') ?? '844x390';
  const [w, h] = viewport.split('x').map((n) => Number.parseInt(n, 10));
  return {
    url: map.get('url') ?? 'http://localhost:4173/',
    out: map.get('out') ?? 'screenshot.png',
    width: Number.isFinite(w) ? (w as number) : 844,
    height: Number.isFinite(h) ? (h as number) : 390,
    waitMs: Number.parseInt(map.get('wait') ?? '1500', 10),
    selector: map.get('selector') ?? null,
    allowConsoleErrors: map.get('allow-console-errors') === 'true',
  };
}

/** Chromium z obrazu (NIE uruchamiamy `playwright install`). */
function findChromium(): string | undefined {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const candidates = readdirSync(base)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((d) => join(base, d, 'chrome-linux', 'chrome'))
    .filter((p) => existsSync(p));
  return candidates[0];
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await mkdir(dirname(opts.out), { recursive: true });

  const executablePath = findChromium();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 2,
  });

  const logs: string[] = [];
  const errors: string[] = [];
  page.on('console', (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    logs.push(line);
    if (msg.type() === 'error') errors.push(line);
  });
  page.on('pageerror', (err) => {
    const line = `[pageerror] ${err.message}`;
    logs.push(line);
    errors.push(line);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const line = `[http ${res.status()}] ${res.url()}`;
      logs.push(line);
      errors.push(line);
    }
  });
  page.on('requestfailed', (req) => {
    const line = `[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`;
    logs.push(line);
    errors.push(line);
  });

  await page.goto(opts.url, { waitUntil: 'load', timeout: 30000 });
  if (opts.selector) await page.waitForSelector(opts.selector, { timeout: 15000 });
  await page.waitForTimeout(opts.waitMs);
  await page.screenshot({ path: opts.out });
  await browser.close();

  console.log(`screenshot: ${opts.out} (${opts.width}×${opts.height})`);
  console.log(`console (${logs.length} wpisów):`);
  for (const line of logs) console.log(`  ${line}`);
  if (errors.length > 0) {
    console.error(`BŁĘDY KONSOLI: ${errors.length}`);
    if (!opts.allowConsoleErrors) process.exitCode = 1;
  } else {
    console.log('brak błędów konsoli');
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
