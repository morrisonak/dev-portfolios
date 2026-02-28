import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

const README_URL = 'https://raw.githubusercontent.com/emmabostian/developer-portfolios/master/README.md';
const OUTPUT = './data/portfolios.json';
const CONCURRENCY = 10;
const TIMEOUT_MS = 6000;

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

async function scrapeOne(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(item.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScraper/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return { ...item, status: 'error', error: `HTTP ${res.status}` };
    const html = await res.text();
    return { ...item, ...extract(html), status: 'ok' };
  } catch (err) {
    clearTimeout(timer);
    return { ...item, status: 'error', error: err.message?.slice(0, 80) || 'unknown' };
  }
}

async function main() {
  mkdirSync('./data', { recursive: true });
  console.log('Fetching portfolio list...');
  const portfolios = await getPortfolios();
  console.log(`Found ${portfolios.length} portfolios.`);

  const results = [];
  for (let i = 0; i < portfolios.length; i += CONCURRENCY) {
    const batch = portfolios.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(scrapeOne));
    results.push(...batchResults);
    const done = results.length;
    const ok = results.filter(r => r.status === 'ok').length;
    process.stdout.write(`\r[${done}/${portfolios.length}] ok=${ok} err=${done-ok}`);
    // Write progress every 200
    if (done % 200 === 0) writeFileSync(OUTPUT + '.partial', JSON.stringify(results));
  }

  const ok = results.filter(r => r.status === 'ok');
  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      total: results.length,
      successful: ok.length,
      failed: results.length - ok.length,
      withEmail: ok.filter(r => r.emails?.length).length,
      withGithub: ok.filter(r => r.github?.length).length,
      withStack: ok.filter(r => r.stack?.length).length,
      withLinkedin: ok.filter(r => r.linkedin).length,
      withTwitter: ok.filter(r => r.twitter).length,
    },
    portfolios: results,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n\nDone → ${OUTPUT}`);
  console.log(JSON.stringify(output.meta, null, 2));
}

main().catch(console.error);
