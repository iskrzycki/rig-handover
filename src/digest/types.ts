// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type Night = {
  night: string;
  // Sorted by job. The page and the JSON both render this order.
  rows: DigestRow[];
  // Lines that didn't parse: counted, never thrown.
  badLines: number;
  // Runs per status across the night.
  counts: Record<RunStatus, number>;
};

// null when runs/<night>.jsonl doesn't exist. Implemented in ./read.ts.
export type ReadNight = (runsDir: string, night: string) => Night | null;
