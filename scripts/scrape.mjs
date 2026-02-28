import { writeFileSync, readFileSync, existsSync } from 'fs';

const README_URL = 'https://raw.githubusercontent.com/emmabostian/developer-portfolios/master/README.md';
const OUTPUT = './data/portfolios.json';
const PROGRESS_FILE = './data/.progress.json';
const CONCURRENCY = 20;
const TIMEOUT_MS = 8000;

// Parse README
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

// Extract data from HTML
function extract(html, url) {
  const data = {
    emails: [],
    github: [],
    linkedin: null,
    twitter: null,
    stack: [],
    experience: null,
    title: null,
    location: null,
  };

  // Emails - mailto and text patterns
  const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const mailtos = new Set();
  let em;
  while ((em = mailtoRe.exec(html)) !== null) mailtos.add(em[1].toLowerCase());
  // Also scan text but filter noise
  const allEmails = new Set(mailtos);
  while ((em = emailRe.exec(html)) !== null) {
    const e = em[0].toLowerCase();
    if (!e.includes('example.') && !e.includes('sentry') && !e.includes('webpack') && !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg') && !e.includes('wixpress') && !e.includes('cloudflare'))
      allEmails.add(e);
  }
  data.emails = [...allEmails];

  // GitHub
  const ghRe = /https?:\/\/github\.com\/([a-zA-Z0-9\-_]+)/gi;
  const ghSet = new Set();
  while ((em = ghRe.exec(html)) !== null) {
    const user = em[1].toLowerCase();
    if (!['features', 'topics', 'explore', 'settings', 'sponsors', 'pricing', 'about', 'login', 'signup', 'join', 'orgs', 'marketplace', 'apps'].includes(user))
      ghSet.add(em[0].replace(/^http:/, 'https:'));
  }
  data.github = [...ghSet];

  // LinkedIn
  const liRe = /https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/i;
  const liMatch = html.match(liRe);
  if (liMatch) data.linkedin = liMatch[0].replace(/^http:/, 'https:');

  // Twitter/X
  const twRe = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i;
  const twMatch = html.match(twRe);
  if (twMatch && !['share', 'intent', 'home'].includes(twMatch[1].toLowerCase())) data.twitter = twMatch[0];

  // Tech stack keywords
  const stackKeywords = [
    'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Astro', 'Gatsby',
    'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C#', 'C\\+\\+', 'Ruby', 'PHP', 'Swift', 'Kotlin',
    'Node.js', 'Express', 'Django', 'Flask', 'Rails', 'Laravel', 'Spring',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
    'PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Firebase',
    'TailwindCSS', 'Tailwind', 'SASS', 'CSS', 'GraphQL', 'REST',
    'Flutter', 'React Native', 'iOS', 'Android',
    'Machine Learning', 'AI', 'Data Science', 'Blockchain', 'Web3',
    '.NET', 'Figma', 'Wordpress'
  ];
  const lower = html.toLowerCase();
  for (const kw of stackKeywords) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(html)) data.stack.push(kw.replace('\\+\\+', '++'));
  }
  // Dedupe and limit
  data.stack = [...new Set(data.stack)].slice(0, 20);

  // Experience (years)
  const expRe = /(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i;
  const expMatch = html.match(expRe);
  if (expMatch) data.experience = `${expMatch[1]}+ years`;

  // Title from meta or h1
  const titleRe = /<title[^>]*>([^<]+)<\/title>/i;
  const titleMatch = html.match(titleRe);
  if (titleMatch) data.title = titleMatch[1].trim().slice(0, 200);

  // Location hints
  const locRe = /(?:based in|located in|from)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|<|&|\n)/i;
  const locMatch = html.match(locRe);
  if (locMatch) data.location = locMatch[1].trim().slice(0, 100);

  return data;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScraper/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Process in batches with concurrency
async function processBatch(items, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const html = await fetchWithTimeout(item.url, TIMEOUT_MS);
          const extracted = extract(html, item.url);
          return {
            name: item.name,
            url: item.url,
            listedTitle: item.listedTitle,
            ...extracted,
            status: 'ok',
          };
        } catch (err) {
          return {
            name: item.name,
            url: item.url,
            listedTitle: item.listedTitle,
            status: 'error',
            error: err.message?.slice(0, 100) || 'unknown',
          };
        }
      })
    );

    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { status: 'error', error: 'promise rejected' });
    }

    const done = Math.min(i + concurrency, items.length);
    const okCount = results.filter(r => r.status === 'ok').length;
    const errCount = results.filter(r => r.status === 'error').length;
    process.stdout.write(`\r[${done}/${items.length}] ok=${okCount} err=${errCount}`);

    // Save progress every 100
    if (done % 100 === 0 || done === items.length) {
      writeFileSync(PROGRESS_FILE, JSON.stringify({ done, total: items.length }));
    }

    // Small delay between batches
    if (i + concurrency < items.length) await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

async function main() {
  console.log('Fetching portfolio list...');
  const portfolios = await getPortfolios();
  console.log(`Found ${portfolios.length} portfolios. Starting scrape...`);

  // Create data dir
  const { mkdirSync } = await import('fs');
  mkdirSync('./data', { recursive: true });

  const results = await processBatch(portfolios, CONCURRENCY);

  console.log('\n\nScrape complete. Writing results...');

  // Stats
  const ok = results.filter(r => r.status === 'ok');
  const withEmail = ok.filter(r => r.emails?.length > 0);
  const withGithub = ok.filter(r => r.github?.length > 0);
  const withStack = ok.filter(r => r.stack?.length > 0);

  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      total: results.length,
      successful: ok.length,
      failed: results.length - ok.length,
      withEmail: withEmail.length,
      withGithub: withGithub.length,
      withStack: withStack.length,
    },
    portfolios: results,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${OUTPUT}`);
  console.log(`Stats: ${ok.length} ok, ${results.length - ok.length} failed`);
  console.log(`  ${withEmail.length} with email, ${withGithub.length} with GitHub, ${withStack.length} with stack`);
}

main().catch(console.error);
