import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

const NORMAL = '2026-10-29';
const EMPTY = '2026-10-28';
const BAD = '2026-10-27';
const MISSING = '2026-01-01';

const normalLines = [
  { at: '2026-10-29T02:00:00+01:00', job: 'sync-ledger', status: 'ok', owner: 'ana' },
  { at: '2026-10-29T03:00:00+01:00', job: 'sync-ledger', status: 'retry', owner: 'ana', error: 'timeout' },
  { at: '2026-10-29T03:05:00+01:00', job: 'sync-ledger', status: 'fail', owner: 'ana', error: 'timeout' },
  { at: '2026-10-29T04:00:00+01:00', job: 'backup-nightly', status: 'ok', owner: null },
];

let runsDir: string;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, `${NORMAL}.jsonl`), normalLines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [
      JSON.stringify({ at: '2026-10-27T02:00:00+01:00', job: 'backup-nightly', status: 'ok', owner: null }),
      '{"at":"2026-10-29T05:59:58+01:00","job":"lane/sy',
    ].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () => createApp({ ...base, runsDir });

describe('GET /digest/:night', () => {
  it('renders a night with a file, one row per job', async () => {
    const res = await app().request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`<h1>digest ${NORMAL}</h1>`);
    expect(html).toContain('sync-ledger');
    expect(html).toContain('backup-nightly');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line and counts it', async () => {
    const res = await app().request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup-nightly');
    expect(html).toContain('1 line didn&#39;t parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns rows, badLines and counts for a night with a file', async () => {
    const res = await app().request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.night).toBe(NORMAL);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['backup-nightly', 'sync-ledger']);
    expect(body.badLines).toBe(0);
    expect(body.counts).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('returns 404 with an error for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line instead of failing', async () => {
    const res = await app().request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['backup-nightly']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const pageHtml = await (await app().request(`/digest/${NORMAL}`)).text();
    const json = await (await app().request(`/api/digest/${NORMAL}`)).json();
    const jobs: string[] = json.rows.map((r: { job: string }) => r.job);
    const inPageOrder = [...jobs].sort((a, b) => pageHtml.indexOf(a) - pageHtml.indexOf(b));
    expect(inPageOrder).toEqual(jobs);
    for (const job of jobs) expect(pageHtml).toContain(job);
  });
});
