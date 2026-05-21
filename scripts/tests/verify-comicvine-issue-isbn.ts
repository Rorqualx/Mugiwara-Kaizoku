/**
 * Phase 0 verification: does ComicVine's /issue/ endpoint return ISBN?
 *
 * Fires three probes against a single ComicVine issue:
 *  1. /issue/{id}/?field_list=*
 *  2. /issue/{id}/?(no field_list, API default)
 *  3. GET site_detail_url as HTML, search for "ISBN" markers
 *
 * Reads API key from --api-key=X, COMICVINE_API_KEY env, or /tmp/cv_apikey file.
 * If no --issue-id provided, auto-discovers one by searching for "Monster Urasawa"
 * and picking the first issue of the best-matching manga volume.
 *
 * Usage:
 *   bun run scripts/tests/verify-comicvine-issue-isbn.ts --api-key=XXX
 *   bun run scripts/tests/verify-comicvine-issue-isbn.ts --api-key=XXX --issue-id=12345
 *   bun run scripts/tests/verify-comicvine-issue-isbn.ts --api-key=XXX --search="Berserk Deluxe"
 *
 * @quality-check-skip
 */

import * as fs from 'fs';

import axios from 'axios';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

const BASE_URL = 'https://comicvine.gamespot.com/api';
const UA = 'Mugiwara-Kaizoku-Verify/1.0';

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

function isbnLikeKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => /isbn|upc|barcode|ean/i.test(k));
}

async function probeApi(issueId: number, apiKey: string, withWildcard: boolean): Promise<{ siteDetailUrl: string | null; foundIsbn: boolean }> {
  const url = `${BASE_URL}/issue/4000-${issueId}/`;
  const params: Record<string, string> = { api_key: apiKey, format: 'json' };
  if (withWildcard) params['field_list'] = '*';
  const label = withWildcard ? 'field_list=*' : 'no field_list (API default)';
  print(`\n── API probe [${label}] ──`);
  try {
    const res = await axios.get(url, {
      params,
      headers: { 'User-Agent': UA },
      timeout: 20000,
    });
    const data = res.data as { status_code?: number; error?: string; results?: Record<string, unknown> };
    if (data.status_code !== 1) {
      print(`  ✗ API status_code=${data.status_code} error=${data.error}`);
      return { siteDetailUrl: null, foundIsbn: false };
    }
    const results = data.results ?? {};
    const keys = Object.keys(results).sort();
    print(`  Fields (${keys.length}): ${keys.join(', ')}`);
    const isbnKeys = isbnLikeKeys(results);
    if (isbnKeys.length > 0) {
      print(`  ★ ISBN-like keys FOUND: ${isbnKeys.join(', ')}`);
      for (const k of isbnKeys) print(`      ${k} = ${JSON.stringify(results[k])}`);
    } else {
      print(`  ✗ No ISBN-like keys.`);
    }
    const siteDetailUrl = (results['site_detail_url'] as string | undefined) ?? null;
    if (siteDetailUrl) print(`  site_detail_url = ${siteDetailUrl}`);
    return { siteDetailUrl, foundIsbn: isbnKeys.length > 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    print(`  ✗ API request failed: ${msg}`);
    return { siteDetailUrl: null, foundIsbn: false };
  }
}

async function probeHtml(detailUrl: string): Promise<void> {
  print(`\n── HTML probe ──`);
  print(`  GET ${detailUrl}`);
  try {
    const res = await axios.get(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    print(`  HTTP ${res.status} — HTML length ${String(res.data).length}`);
    const html = String(res.data);
    if (res.status !== 200) {
      if (html.includes('cf-') || html.includes('Cloudflare')) print(`  ⚠ Cloudflare challenge detected.`);
      return;
    }
    const isbnDt = /<dt[^>]*>\s*ISBN[^<]*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i.exec(html);
    const isbnH4 = /<h4[^>]*>\s*ISBN[^<]*<\/h4>\s*(?:<p[^>]*>)?([^<]+)/i.exec(html);
    const genericIsbn = /\bISBN[-\s:]*((?:97[89][-\s]?)?\d[-\s]?\d{3,4}[-\s]?\d{4,5}[-\s]?[\dXx])\b/i.exec(html);

    if (isbnDt) print(`  ★ Matched <dt>ISBN</dt>: "${isbnDt[1]?.trim()}"`);
    else if (isbnH4) print(`  ★ Matched <h4>ISBN</h4>: "${isbnH4[1]?.trim()}"`);
    else if (genericIsbn) print(`  ★ Matched inline "ISBN …": "${genericIsbn[1]?.trim()}"`);
    else {
      print(`  ✗ No ISBN marker in HTML.`);
      const lower = html.toLowerCase();
      const isbnIdx = lower.indexOf('isbn');
      if (isbnIdx >= 0) {
        const ctx = html.slice(Math.max(0, isbnIdx - 50), isbnIdx + 200).replace(/\s+/g, ' ');
        print(`    (raw "isbn" substring context: …${ctx}…)`);
      } else {
        print(`    (string "isbn" not present in HTML at all)`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    print(`  ✗ HTML fetch failed: ${msg}`);
  }
}

async function discoverIssueId(apiKey: string, query: string): Promise<number | null> {
  print(`\n── Discovery: searching CV for "${query}" ──`);
  const searchRes = await axios.get(`${BASE_URL}/search/`, {
    params: { api_key: apiKey, format: 'json', query, resources: 'volume', limit: 5 },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });
  const searchData = searchRes.data as { status_code?: number; results?: Array<{ id: number; name?: string; count_of_issues?: number }> };
  if (searchData.status_code !== 1 || !searchData.results?.length) {
    print(`  ✗ Search returned no volumes.`);
    return null;
  }
  const match = searchData.results.find(v => (v.count_of_issues ?? 0) >= 1);
  if (!match) {
    print(`  ✗ No volume with issues.`);
    return null;
  }
  print(`  Matched volume: "${match.name}" (id=${match.id}, issues=${match.count_of_issues})`);

  const volRes = await axios.get(`${BASE_URL}/volume/4050-${match.id}/`, {
    params: { api_key: apiKey, format: 'json', field_list: 'issues' },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });
  const volData = volRes.data as { results?: { issues?: Array<{ id: number; issue_number?: string }> } };
  const issues = volData.results?.issues ?? [];
  const first = issues[0];
  if (!first) {
    print(`  ✗ Volume has no issues in API response.`);
    return null;
  }
  print(`  First issue: id=${first.id} issue_number=${first.issue_number}`);
  return first.id;
}

async function main(): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    print(`✗ No API key. Pass --api-key=X or set COMICVINE_API_KEY or write to /tmp/cv_apikey`);
    process.exit(1);
  }
  print(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (len ${apiKey.length})`);

  const issueIdFlag = getFlag('issue-id');
  let issueId = issueIdFlag ? parseInt(issueIdFlag, 10) : NaN;
  if (!Number.isFinite(issueId)) {
    const query = getFlag('search') ?? 'Monster Urasawa';
    const discovered = await discoverIssueId(apiKey, query);
    if (!discovered) {
      print(`✗ Could not discover an issue ID. Pass --issue-id=N.`);
      process.exit(1);
    }
    issueId = discovered;
  }
  print(`Probing issue id = ${issueId}`);

  const wild = await probeApi(issueId, apiKey, true);
  const plain = await probeApi(issueId, apiKey, false);

  const detailUrl = wild.siteDetailUrl ?? plain.siteDetailUrl;
  if (detailUrl) await probeHtml(detailUrl);
  else print(`\n  (Skipping HTML probe: no site_detail_url resolved.)`);

  print(`\nVerdict:`);
  if (wild.foundIsbn) print(`  → Phase A (API) is viable.`);
  else print(`  → API does not return ISBN. Check HTML probe output for Phase B viability.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
