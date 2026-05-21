/**
 * Smoke test: verify ComicVine issue API returns `associated_images` and
 * `aliases` when requested via extended field_list.
 *
 * Probes issue 183397 (Pluto Vol 1) and a discovered Monster issue.
 *
 * Usage:
 *   bun run scripts/tests/smoke-comicvine-associated-images.ts --api-key=XXX
 *
 * @quality-check-skip
 */

import * as fs from 'fs';

import axios from 'axios';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

const BASE_URL = 'https://comicvine.gamespot.com/api';
const UA = 'Mugiwara-Kaizoku-Smoke/1.0';

function getFlag(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
}

function resolveApiKey(): string | null {
  const fromFlag = getFlag('api-key');
  if (fromFlag) return fromFlag;
  const fromEnv = process.env['COMICVINE_API_KEY'];
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync('/tmp/cv_apikey', 'utf-8').trim();
    if (raw.length > 10) return raw;
  } catch { /* ignore */ }
  return null;
}

const FIELD_LIST = [
  'id', 'name', 'image', 'description', 'issue_number', 'volume',
  'cover_date', 'store_date', 'person_credits', 'character_credits',
  'deck', 'site_detail_url', 'associated_images', 'aliases',
].join(',');

async function probe(issueId: number, apiKey: string): Promise<void> {
  print(`\n── Probing issue ${issueId} ──`);
  const res = await axios.get(`${BASE_URL}/issue/4000-${issueId}/`, {
    params: { api_key: apiKey, format: 'json', field_list: FIELD_LIST },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });
  const data = res.data as { status_code?: number; error?: string; results?: Record<string, unknown> };
  if (data.status_code !== 1) {
    print(`  ✗ status_code=${data.status_code} error=${data.error}`);
    return;
  }
  const r = data.results ?? {};
  const name = (r['name'] as string | null) ?? '(null)';
  const assoc = r['associated_images'];
  const aliases = r['aliases'];

  print(`  name: "${name}"`);
  const assocArr = Array.isArray(assoc) ? assoc : [];
  print(`  associated_images: ${assocArr.length} entries`);
  for (const img of assocArr.slice(0, 3)) {
    const url = (img as Record<string, unknown>)['original_url'];
    print(`      - ${String(url).slice(0, 80)}`);
  }
  print(`  aliases: ${typeof aliases === 'string' ? `"${aliases.slice(0, 100)}"` : '(null)'}`);
}

async function discoverIssueId(apiKey: string, query: string): Promise<number | null> {
  const s = await axios.get(`${BASE_URL}/search/`, {
    params: { api_key: apiKey, format: 'json', query, resources: 'volume', limit: 3 },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });
  const sd = s.data as { results?: Array<{ id: number; count_of_issues?: number }> };
  const match = sd.results?.find(v => (v.count_of_issues ?? 0) >= 1);
  if (!match) return null;
  const v = await axios.get(`${BASE_URL}/volume/4050-${match.id}/`, {
    params: { api_key: apiKey, format: 'json', field_list: 'issues' },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });
  const vd = v.data as { results?: { issues?: Array<{ id: number }> } };
  return vd.results?.issues?.[0]?.id ?? null;
}

async function main(): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    print(`✗ No API key (pass --api-key=X or set COMICVINE_API_KEY or /tmp/cv_apikey)`);
    process.exit(1);
  }
  print(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);

  await probe(183397, apiKey);

  const monsterId = await discoverIssueId(apiKey, 'Monster Urasawa');
  if (monsterId && monsterId !== 183397) await probe(monsterId, apiKey);

  print(`\nDone.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
