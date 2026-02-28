export interface Portfolio {
  name: string;
  url: string;
  title: string;
  letter: string;
}

const README_URL =
  'https://raw.githubusercontent.com/emmabostian/developer-portfolios/master/README.md';

export async function fetchPortfolios(): Promise<Portfolio[]> {
  const res = await fetch(README_URL);
  const md = await res.text();
  const portfolios: Portfolio[] = [];

  // Match lines like: - [Name](url) [Title] or - [Name](url)
  const regex = /^- \[([^\]]+)\]\(([^)]+)\)\s*(?:\[([^\]]*)\])?/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(md)) !== null) {
    const name = match[1].trim();
    const url = match[2].trim();
    const title = match[3]?.trim() || '';
    const letter = name.charAt(0).toUpperCase();

    // Skip non-portfolio links (contributing, etc.)
    if (url.includes('github.com/emmabostian') || url.includes('twitter.com')) continue;

    portfolios.push({ name, url, title, letter });
  }

  return portfolios;
}

export function groupByLetter(portfolios: Portfolio[]): Map<string, Portfolio[]> {
  const groups = new Map<string, Portfolio[]>();
  for (const p of portfolios) {
    const existing = groups.get(p.letter) || [];
    existing.push(p);
    groups.set(p.letter, existing);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
