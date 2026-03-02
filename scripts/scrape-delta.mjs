import { writeFileSync, readFileSync } from 'fs';

const README_URL = 'https://raw.githubusercontent.com/emmabostian/developer-portfolios/master/README.md';
const DATA_FILE = './data/portfolios.json';
const TIMEOUT_MS = 6000;

function parseReadme(md) {
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
  const liM = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/i);
  if (liM) data.linkedin = liM[0].replace(/^http:/,'https:');
  const twM = html.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
  if (twM && !['share','intent','home'].includes(twM[1].toLowerCase())) data.twitter = twM[0];
  const stackKw = ['React','Vue','Angular','Svelte','Next.js','Nuxt','Astro','Gatsby','TypeScript','JavaScript','Python','Rust','Go','Java','C#','Ruby','PHP','Swift','Kotlin','Node.js','Express','Django','Flask','Rails','Laravel','Spring','AWS','Azure','GCP','Docker','Kubernetes','PostgreSQL','MongoDB','MySQL','Redis','Firebase','Tailwind','GraphQL','Flutter','React Native','.NET','Figma','WordPress'];
  for (const kw of stackKw) {
    if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(html)) data.stack.push(kw);
  }
  data.stack = [...new Set(data.stack)].slice(0, 20);
  const expM = html.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
  if (expM) data.experience = `${expM[1]}+ years`;
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) data.title = titleM[1].trim().slice(0, 200);
  const locM = html.match(/(?:based in|located in|from)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|<|&|\n)/i);
  if (locM) data.location = locM[1].trim().slice(0, 100);
  return data;
}

async function scrapeOne(item) {
  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScraper/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ...item, status: 'error', error: `HTTP ${res.status}` };
    const html = await res.text();
    return { ...item, ...extract(html), status: 'ok' };
  } catch (err) {
    return { ...item, status: 'error', error: err.message?.slice(0, 80) || 'timeout' };
  }
}

async function main() {
  // Load existing data
  const existing = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const existingUrls = new Set(existing.portfolios.map(p => p.url));

  // Fetch current README
  const res = await fetch(README_URL);
  const md = await res.text();
  const current = parseReadme(md);
  const currentUrls = new Set(current.map(p => p.url));

  // Find new sites (in README but not in our JSON)
  const newSites = current.filter(p => !existingUrls.has(p.url));
  // Find removed sites (in our JSON but not in README)
  const removedUrls = new Set([...existingUrls].filter(u => !currentUrls.has(u)));

  console.log(`Existing: ${existing.portfolios.length} | Upstream: ${current.length}`);
  console.log(`New: ${newSites.length} | Removed: ${removedUrls.size}`);

  if (newSites.length === 0 && removedUrls.size === 0) {
    console.log('No changes. Exiting.');
    process.exit(0);
  }

  // Scrape new sites
  let scraped = [];
  if (newSites.length > 0) {
    console.log(`Scraping ${newSites.length} new sites...`);
    scraped = await Promise.all(newSites.map(scrapeOne));
    const ok = scraped.filter(s => s.status === 'ok').length;
    console.log(`Scraped: ${ok} ok, ${scraped.length - ok} failed`);
  }

  // Remove deleted, add new
  const updated = existing.portfolios.filter(p => !removedUrls.has(p.url));
  updated.push(...scraped);

  // Rebuild meta
  const ok = updated.filter(r => r.status === 'ok');
  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      total: updated.length,
      successful: ok.length,
      failed: updated.length - ok.length,
      withEmail: ok.filter(r => r.emails?.length).length,
      withGithub: ok.filter(r => r.github?.length).length,
      withStack: ok.filter(r => r.stack?.length).length,
      withLinkedin: ok.filter(r => r.linkedin).length,
      withTwitter: ok.filter(r => r.twitter).length,
    },
    portfolios: updated,
  };

  writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  console.log(`Updated ${DATA_FILE}`);
  console.log(JSON.stringify(output.meta, null, 2));

  // Signal to CI that data changed
  process.exit(newSites.length > 0 || removedUrls.size > 0 ? 0 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
