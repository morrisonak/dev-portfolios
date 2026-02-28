import { writeFileSync, readFileSync, mkdirSync } from 'fs';

const README_URL = 'https://raw.githubusercontent.com/emmabostian/developer-portfolios/master/README.md';
const PARTIAL = './data/portfolios.json.partial';
const OUTPUT = './data/portfolios.json';
const CONCURRENCY = 5;
const TIMEOUT_MS = 4000;

async function getPortfolios() {
  const res = await fetch(README_URL);
  const md = await res.text();
  const regex = /^- \[([^\]]+)\]\(([^)]+)\)\s*(?:\[([^\]]*)\])?/gm;
  const results = [];
  let m;
  while ((m = regex.exec(md)) !== null) {
    const url = m[2].trim();
    if (url.includes('github.com/emmabostian') || url.includes('twitter.com')) continue;
    results.push({ name: m[1].trim(), url, listedTitle: m[3]?.trim() || '' });
  }
  return results;
}

function extract(html) {
  const data = { emails: [], github: [], linkedin: null, twitter: null, stack: [], experience: null, title: null, location: null };
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emails = new Set();
  let em;
  while ((em = emailRe.exec(html)) !== null) {
    const e = em[0].toLowerCase();
    if (!e.includes('example.') && !e.includes('sentry') && !e.includes('webpack') && !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg') && !e.includes('wixpress') && !e.includes('cloudflare'))
      emails.add(e);
  }
  data.emails = [...emails];
  const ghRe = /https?:\/\/github\.com\/([a-zA-Z0-9\-_]+)/gi;
  const ghSet = new Set();
  while ((em = ghRe.exec(html)) !== null) {
    const user = em[1].toLowerCase();
    if (!['features','topics','explore','settings','sponsors','pricing','about','login','signup','join','orgs','marketplace','apps'].includes(user))
      ghSet.add(em[0].replace(/^http:/,'https:'));
  }
  data.github = [...ghSet];
  const liRe = /https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/i;
  const liM = html.match(liRe);
  if (liM) data.linkedin = liM[0].replace(/^http:/,'https:');
  const twRe = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i;
  const twM = html.match(twRe);
  if (twM && !['share','intent','home'].includes(twM[1].toLowerCase())) data.twitter = twM[0];
  const stackKw = ['React','Vue','Angular','Svelte','Next.js','Nuxt','Astro','Gatsby','TypeScript','JavaScript','Python','Rust','Go','Java','C#','Ruby','PHP','Swift','Kotlin','Node.js','Express','Django','Flask','Rails','Laravel','Spring','AWS','Azure','GCP','Docker','Kubernetes','PostgreSQL','MongoDB','MySQL','Redis','Firebase','Tailwind','GraphQL','Flutter','React Native','.NET','Figma','WordPress'];
  for (const kw of stackKw) {
    if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(html)) data.stack.push(kw);
  }
  data.stack = [...new Set(data.stack)].slice(0, 20);
  const expRe = /(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i;
  const expM = html.match(expRe);
  if (expM) data.experience = `${expM[1]}+ years`;
  const titleRe = /<title[^>]*>([^<]+)<\/title>/i;
  const titleM = html.match(titleRe);
  if (titleM) data.title = titleM[1].trim().slice(0, 200);
  const locRe = /(?:based in|located in|from)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|<|&|\n)/i;
  const locM = html.match(locRe);
  if (locM) data.location = locM[1].trim().slice(0, 100);
  return data;
}

function timeoutFetch(url, ms) {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScraper/1.0)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(ms - 500),
      });
      clearTimeout(timer);
      if (!res.ok) { resolve(null); return; }
      const html = await res.text();
      resolve(html);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function main() {
  const all = await getPortfolios();
  const partial = JSON.parse(readFileSync(PARTIAL, 'utf-8'));
  const done = partial.length;
  const remaining = all.slice(done);
  console.log(`Total: ${all.length}, Already done: ${done}, Remaining: ${remaining.length}`);

  const newResults = [];
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (item) => {
      const html = await timeoutFetch(item.url, TIMEOUT_MS);
      if (!html) return { ...item, status: 'error', error: 'timeout/failed' };
      return { ...item, ...extract(html), status: 'ok' };
    }));
    newResults.push(...results);
    process.stdout.write(`\r[${done + newResults.length}/${all.length}] remaining batch ${Math.floor(i/CONCURRENCY)+1}`);
  }

  const allResults = [...partial, ...newResults];
  const ok = allResults.filter(r => r.status === 'ok');
  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      total: allResults.length,
      successful: ok.length,
      failed: allResults.length - ok.length,
      withEmail: ok.filter(r => r.emails?.length).length,
      withGithub: ok.filter(r => r.github?.length).length,
      withStack: ok.filter(r => r.stack?.length).length,
      withLinkedin: ok.filter(r => r.linkedin).length,
      withTwitter: ok.filter(r => r.twitter).length,
    },
    portfolios: allResults,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n\nDone → ${OUTPUT}`);
  console.log(JSON.stringify(output.meta, null, 2));
}

main().catch(console.error);
