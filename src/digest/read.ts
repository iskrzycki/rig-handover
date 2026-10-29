import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

const isStatus = (v: unknown): v is RunStatus => STATUSES.some((s) => s === v);

// Parse at the edge: anything that isn't a well-formed RunLine is null.
const parseLine = (text: string): RunLine | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if ('error' in o && typeof error !== 'string') return null;
  return typeof error === 'string' ? { at, job, status, owner, error } : { at, job, status, owner };
};

const isMissing = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';

const toRow = (job: string, lines: RunLine[]): DigestRow => {
  const first = lines[0]!;
  const last = lines[lines.length - 1]!;
  const withError = lines.filter((l) => l.error !== undefined);
  return {
    job,
    owner: last.owner,
    runs: lines.length,
    retries: lines.filter((l) => l.status === 'retry').length,
    fails: lines.filter((l) => l.status === 'fail').length,
    lastStatus: last.status,
    lastError: withError.length > 0 ? withError[withError.length - 1]!.error ?? null : null,
    first: first.at,
    last: last.at,
  };
};

export const readNight: ReadNight = (runsDir: string, night: string): Night | null => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }

  const lines: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) lines.push(line);
    else badLines++;
  }

  // Array.prototype.sort is stable: ties keep file order.
  const ordered = [...lines].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  const byJob = new Map<string, RunLine[]>();
  for (const line of ordered) {
    counts[line.status]++;
    const group = byJob.get(line.job);
    if (group) group.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows = [...byJob.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([job, group]) => toRow(job, group));

  return { night, rows, badLines, counts };
};
