import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

// Saves one rig page as one self-contained HTML file, for a reviewer who reads a copy, not the
// lane (ADR 0003). Never commit the output: var/ is git-ignored.
//   pnpm preview [page] [out]
const [page = '/digest/2026-10-28', out = 'var/preview/index.html'] = process.argv.slice(2);

const res = await createApp(loadConfig()).request(page);
if (res.status !== 200) {
  console.error(`rig preview: ${page} answered ${res.status}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`rig preview: ${page} → ${out}`);
