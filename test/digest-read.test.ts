import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'rig-digest-'));

describe('readNight', () => {
  it('reads the real night into one row per job', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
    const row = (job: string) => night.rows.find((r) => r.job === job)!;
    expect(row('digest/render').owner).toBeNull();
    expect(row('fixtures/refresh')).toMatchObject({ retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', fails: 1, lastError: 'quota exceeded' });
    expect(row('lane/sync').retries).toBe(1);
    expect(row('fixtures/refresh').first).toBe('2026-10-29T01:30:00+01:00');
    expect(row('fixtures/refresh').last).toBe('2026-10-29T01:37:00+01:00');
    expect(night.counts.fail).toBe(1);
  });

  it('returns null for a night not on disk', () => {
    expect(readNight(tmp(), '2026-01-01')).toBeNull();
  });

  it('reads an empty file as no rows', () => {
    const dir = tmp();
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts malformed and wrong-shaped lines, skips blank ones, orders by time', () => {
    const dir = tmp();
    const lines = [
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"fail","owner":"y","error":"boom"}',
      'not json',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"weird","owner":"x"}',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"ok","owner":1}',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"ok","owner":null,"error":5}',
      '   ',
      '',
    ];
    writeFileSync(join(dir, 'n.jsonl'), lines.join('\n'));
    const night = readNight(dir, 'n');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 2,
        retries: 0,
        fails: 1,
        lastStatus: 'ok',
        lastError: 'boom',
        first: '2026-01-01T01:00:00+01:00',
        last: '2026-01-01T02:00:00+01:00',
      },
    ]);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
  });
});
