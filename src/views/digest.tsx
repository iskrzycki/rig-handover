import type { DigestRow, Night } from '../digest/types.js';

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);
const isWarn = (r: DigestRow) => r.retries >= 3 || r.fails > 0 || r.lastStatus === 'fail';

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} didn't parse
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>fails</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr class={isWarn(r) ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.fails}</td>
                <td>{r.lastStatus}</td>
                <td>{dash(r.lastError)}</td>
                <td>{r.first}</td>
                <td>{r.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
