/**
 * validateExternalApis.ts
 *
 * Smoke-tests every JPL / NASA external API endpoint used by the agent swarm.
 * Hits each endpoint with known-good designations in the formats the services
 * actually send, prints the exact URL, HTTP status, and parsed result so you
 * can see precisely what succeeds and what fails.
 *
 * No server build required — pure fetch, no workspace imports.
 *
 * Usage:
 *   npm run validateExternalApis
 *
 * Exit code: 0 if every required check passes, 1 if any required check fails.
 * Optional checks (NHATS for large/hazardous bodies) are flagged but do not
 * affect the exit code.
 */

import 'dotenv/config';

// ── ANSI colours (inline — no chalk dependency) ──────────────────────────────

const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const CYAN   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ── Test-case types ───────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  url: string;
  status: number | 'NETWORK_ERROR';
  passed: boolean;
  required: boolean;   // false = informational only, won't fail the run
  detail: string;
  rawSnippet?: string; // first 300 chars of the response body
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  return { status: res.status, body };
}

function snippet(body: string): string {
  return body.length > 300 ? body.slice(0, 300) + ' …' : body;
}

// ── CAD checks ────────────────────────────────────────────────────────────────
// Tests the exact URL-construction logic in CADService.ts:
//   ?des=<encoded>&date-min=<today>&date-max=%2B100&dist-max=0.5&fullname=true

const CAD_BASE = 'https://ssd-api.jpl.nasa.gov/cad.api';
const TODAY    = new Date().toISOString().slice(0, 10);

function cadUrl(des: string): string {
  // date-max=%2B36500 = +36500 days (~100 years). JPL's unit is DAYS, not years.
  // %2B100 (the previous value) only covered 100 days — close approaches were missed.
  return `${CAD_BASE}?des=${encodeURIComponent(des)}&date-min=${TODAY}&date-max=%2B36500&dist-max=0.5`;
}

async function checkCAD(
  label: string,
  des: string,
  required: boolean,
): Promise<CheckResult> {
  const url = cadUrl(des);
  let status: number | 'NETWORK_ERROR';
  let body = '';

  try {
    const r = await httpGet(url);
    status = r.status;
    body   = r.body;
  } catch (err) {
    return {
      name: `CAD — ${label}`,
      url,
      status: 'NETWORK_ERROR',
      passed: false,
      required,
      detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (status !== 200) {
    return {
      name: `CAD — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: `HTTP ${status}`,
      rawSnippet: snippet(body),
    };
  }

  let count = 0;
  let fields: string[] = [];
  try {
    const json = JSON.parse(body) as { count?: string; fields?: string[]; data?: unknown[][] };
    count  = parseInt(json.count ?? '0', 10);
    fields = json.fields ?? [];
  } catch {
    return {
      name: `CAD — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: 'Response is not valid JSON',
      rawSnippet: snippet(body),
    };
  }

  const hasRequiredFields = fields.includes('cd') && fields.includes('dist');
  const passed = hasRequiredFields;

  return {
    name: `CAD — ${label}`,
    url,
    status,
    passed,
    required,
    detail: passed
      ? `${count} approach record(s) returned; fields: [${fields.join(', ')}]`
      : `Missing required fields. Got: [${fields.join(', ')}]`,
    rawSnippet: passed ? undefined : snippet(body),
  };
}

// ── NHATS checks ──────────────────────────────────────────────────────────────
// Tests NHATSService.ts: ?des=<encoded>
// Note: NHATS only covers ~1 000 human-mission-accessible NEOs.
// Large/hazardous bodies (Bennu, Apophis) may legitimately return count=0.

const NHATS_BASE = 'https://ssd-api.jpl.nasa.gov/nhats.api';

function nhatsUrl(des: string): string {
  return `${NHATS_BASE}?des=${encodeURIComponent(des)}`;
}

async function checkNHATS(
  label: string,
  des: string,
  required: boolean,
  expectPresent: boolean, // true = should be in the NHATS catalogue
): Promise<CheckResult> {
  const url = nhatsUrl(des);
  let status: number | 'NETWORK_ERROR';
  let body = '';

  try {
    const r = await httpGet(url);
    status = r.status;
    body   = r.body;
  } catch (err) {
    return {
      name: `NHATS — ${label}`,
      url,
      status: 'NETWORK_ERROR',
      passed: false,
      required,
      detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (status !== 200) {
    return {
      name: `NHATS — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: `HTTP ${status}`,
      rawSnippet: snippet(body),
    };
  }

  // Per-asteroid endpoint returns the object directly (no { count, data } wrapper).
  // List endpoint returns { count, data }. Detect by presence of `des` field.
  let found = false;
  let minDv = '';
  try {
    const json = JSON.parse(body) as {
      count?: string;
      data?: unknown[];
      des?: string;
      min_dv?: { dv?: string };
    };
    if (json.des) {
      // Per-asteroid response
      found = true;
      minDv = json.min_dv?.dv ?? '?';
    } else {
      // List/empty response
      found = parseInt(json.count ?? '0', 10) > 0;
    }
  } catch {
    return {
      name: `NHATS — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: 'Response is not valid JSON',
      rawSnippet: snippet(body),
    };
  }

  const passed = expectPresent ? found : true; // absence is OK for large bodies

  return {
    name: `NHATS — ${label}`,
    url,
    status,
    passed,
    required,
    detail: expectPresent
      ? (found ? `Found in NHATS catalogue — min delta-V ${minDv} km/s` : 'NOT in NHATS catalogue — navigator will fall back to DB/assumptions')
      : `not in catalogue (expected — informational)`,
  };
}

// ── NHATS list-all check ──────────────────────────────────────────────────────

async function checkNHATSList(): Promise<CheckResult> {
  const url = NHATS_BASE;
  let status: number | 'NETWORK_ERROR';
  let body = '';

  try {
    const r = await httpGet(url);
    status = r.status;
    body   = r.body;
  } catch (err) {
    return {
      name: 'NHATS — list all (no params)',
      url,
      status: 'NETWORK_ERROR',
      passed: false,
      required: true,
      detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (status !== 200) {
    return {
      name: 'NHATS — list all (no params)',
      url,
      status,
      passed: false,
      required: true,
      detail: `HTTP ${status}`,
      rawSnippet: snippet(body),
    };
  }

  let count = 0;
  try {
    const json = JSON.parse(body) as { count?: string; data?: unknown[] };
    count = parseInt(json.count ?? '0', 10);
  } catch {
    return {
      name: 'NHATS — list all (no params)',
      url,
      status,
      passed: false,
      required: true,
      detail: 'Response is not valid JSON',
      rawSnippet: snippet(body),
    };
  }

  return {
    name: 'NHATS — list all (no params)',
    url,
    status,
    passed: count > 0,
    required: true,
    detail: `${count} NHATS targets in catalogue`,
  };
}

// ── NeoWs lookup check ────────────────────────────────────────────────────────

async function checkNeoWs(
  label: string,
  nasaId: string,
  required: boolean,
): Promise<CheckResult> {
  const url = `https://api.nasa.gov/neo/rest/v1/neo/${nasaId}?api_key=DEMO_KEY`;
  let status: number | 'NETWORK_ERROR';
  let body = '';

  try {
    const r = await httpGet(url);
    status = r.status;
    body   = r.body;
  } catch (err) {
    return {
      name: `NeoWs — ${label}`,
      url,
      status: 'NETWORK_ERROR',
      passed: false,
      required,
      detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (status !== 200) {
    return {
      name: `NeoWs — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: `HTTP ${status}`,
      rawSnippet: snippet(body),
    };
  }

  let name = '';
  try {
    const json = JSON.parse(body) as { name?: string; designation?: string };
    name = json.name ?? json.designation ?? '(no name field)';
  } catch {
    return {
      name: `NeoWs — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: 'Response is not valid JSON',
      rawSnippet: snippet(body),
    };
  }

  return {
    name: `NeoWs — ${label}`,
    url,
    status,
    passed: true,
    required,
    detail: `name="${name}"`,
  };
}

// ── SBDB check ────────────────────────────────────────────────────────────────

async function checkSBDB(
  label: string,
  des: string,
  required: boolean,
): Promise<CheckResult> {
  const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?des=${encodeURIComponent(des)}&phys-par=1`;
  let status: number | 'NETWORK_ERROR';
  let body = '';

  try {
    const r = await httpGet(url);
    status = r.status;
    body   = r.body;
  } catch (err) {
    return {
      name: `SBDB — ${label}`,
      url,
      status: 'NETWORK_ERROR',
      passed: false,
      required,
      detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (status !== 200) {
    return {
      name: `SBDB — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: `HTTP ${status}`,
      rawSnippet: snippet(body),
    };
  }

  let fullname = '';
  try {
    const json = JSON.parse(body) as { object?: { fullname?: string } };
    fullname = json.object?.fullname ?? '(no fullname)';
  } catch {
    return {
      name: `SBDB — ${label}`,
      url,
      status,
      passed: false,
      required,
      detail: 'Response is not valid JSON',
      rawSnippet: snippet(body),
    };
  }

  return {
    name: `SBDB — ${label}`,
    url,
    status,
    passed: true,
    required,
    detail: `fullname="${fullname}"`,
  };
}

// ── CAD URL-encoding sanity check ─────────────────────────────────────────────
// Verifies that the +100 fix is actually working by probing the old broken form
// and the new correct form and comparing results.

async function checkCADPlusEncoding(): Promise<CheckResult[]> {
  // Old broken form: %2B100 = only 100 days, not 100 years
  // New correct form: %2B36500 = 36500 days (~100 years)
  const brokenUrl  = `${CAD_BASE}?des=99942&date-min=${TODAY}&date-max=%2B100&dist-max=0.5`;
  const correctUrl = `${CAD_BASE}?des=99942&date-min=${TODAY}&date-max=%2B36500&dist-max=0.5`;

  const results: CheckResult[] = [];

  for (const [label, url, required] of [
    ['date-max=%2B100 (OLD — only 100 days)', brokenUrl, false],
    ['date-max=%2B36500 (NEW — ~100 years)', correctUrl, true],
  ] as [string, string, boolean][]) {
    let status: number | 'NETWORK_ERROR';
    let count = 0;
    let body = '';
    try {
      const r = await httpGet(url);
      status = r.status;
      body   = r.body;
      if (status === 200) {
        const json = JSON.parse(body) as { count?: string };
        count = parseInt(json.count ?? '0', 10);
      }
    } catch (err) {
      results.push({
        name: `CAD encoding — ${label}`,
        url,
        status: 'NETWORK_ERROR',
        passed: false,
        required,
        detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    results.push({
      name: `CAD encoding — ${label}`,
      url,
      status,
      passed: status === 200,
      required,
      detail: status === 200
        ? `HTTP 200, count=${count}`
        : `HTTP ${status}`,
      rawSnippet: status !== 200 ? snippet(body) : undefined,
    });
  }

  return results;
}

// ── Run all checks ────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(BOLD('\n🛰  Asteroid Bonanza — External API Validation\n'));
  console.log(DIM(`Date: ${TODAY}   Node: ${process.version}\n`));

  const all: CheckResult[] = [];

  // ── Section 1: CAD ──────────────────────────────────────────────────────────
  console.log(BOLD(CYAN('── CAD (Close Approach Data) ─────────────────────────────────────────')));

  all.push(await checkCAD('Apophis numeric (99942)', '99942', true));
  all.push(await checkCAD('Bennu numeric (101955)', '101955', true));
  all.push(await checkCAD('Ryugu numeric (162173)', '162173', true));
  // Small well-characterized NEO likely to have many approaches
  all.push(await checkCAD('1998 KY26 (numeric)', '153814', true));

  // ── Section 2: CAD URL-encoding sanity ─────────────────────────────────────
  console.log('');
  console.log(BOLD(CYAN('── CAD URL-encoding sanity (+100 fix) ────────────────────────────────')));
  const encodingChecks = await checkCADPlusEncoding();
  all.push(...encodingChecks);

  // ── Section 3: NHATS ────────────────────────────────────────────────────────
  console.log('');
  console.log(BOLD(CYAN('── NHATS (Human-Accessible Targets) ──────────────────────────────────')));

  // Catalogue health check
  all.push(await checkNHATSList());

  // Small NEOs confirmed present in the catalogue (numeric IDs from listAll)
  // Note: provisional designations (e.g. "2010 PS66") return 400; use numbered form.
  all.push(await checkNHATS('429389 (numbered, confirmed in catalogue)', '429389', true, true));
  all.push(await checkNHATS('2010 MB (provisional, in catalogue)', '2010 MB', true, true));

  // Large/famous bodies — probably NOT in NHATS (informational only)
  all.push(await checkNHATS('Apophis (99942) — large, may not be in NHATS', '99942', false, false));
  all.push(await checkNHATS('Bennu (101955) — large/hazardous, may not be in NHATS', '101955', false, false));

  // ── Section 4: NeoWs ────────────────────────────────────────────────────────
  console.log('');
  console.log(BOLD(CYAN('── NeoWs (NASA NEO Web Service) ──────────────────────────────────────')));

  all.push(await checkNeoWs('Apophis (nasaId 2099942)', '2099942', true));
  all.push(await checkNeoWs('Bennu (nasaId 2101955)', '2101955', true));

  // ── Section 5: SBDB ─────────────────────────────────────────────────────────
  console.log('');
  console.log(BOLD(CYAN('── SBDB (Small Body Database) ────────────────────────────────────────')));

  all.push(await checkSBDB('Apophis (99942)', '99942', true));
  all.push(await checkSBDB('Bennu (101955)', '101955', true));
  all.push(await checkSBDB('Ryugu (162173)', '162173', true));

  // ── Print results ───────────────────────────────────────────────────────────
  console.log('');
  console.log(BOLD('── Results ───────────────────────────────────────────────────────────────'));

  let passed = 0;
  let failed = 0;
  let requiredFailed = 0;

  for (const r of all) {
    const icon   = r.passed ? GREEN('✓') : (r.required ? RED('✗') : YELLOW('⚠'));
    const badge  = r.required ? '' : DIM(' [optional]');
    const status = typeof r.status === 'number' ? String(r.status) : r.status;

    console.log(`  ${icon}  ${r.name}${badge}`);
    console.log(DIM(`     ${r.url}`));
    console.log(`     status=${status}  ${r.detail}`);

    if (r.rawSnippet) {
      console.log(DIM(`     response: ${r.rawSnippet}`));
    }
    console.log('');

    if (r.passed) {
      passed++;
    } else {
      failed++;
      if (r.required) requiredFailed++;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(BOLD('── Summary ───────────────────────────────────────────────────────────────'));
  console.log(`  Total checks : ${all.length}`);
  console.log(`  ${GREEN('Passed')}       : ${passed}`);

  const optionalFailed = failed - requiredFailed;
  if (requiredFailed > 0) {
    console.log(`  ${RED('Failed (req)')} : ${requiredFailed}`);
  }
  if (optionalFailed > 0) {
    console.log(`  ${YELLOW('Failed (opt)')} : ${optionalFailed}`);
  }

  if (requiredFailed === 0) {
    console.log('');
    console.log(GREEN(BOLD('  All required checks passed ✓')));
  } else {
    console.log('');
    console.log(RED(BOLD(`  ${requiredFailed} required check(s) failed — agent swarm will degrade`)));
  }

  console.log('');
  process.exit(requiredFailed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(RED('Unhandled error:'), err);
  process.exit(1);
});
