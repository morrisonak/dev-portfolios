export interface Portfolio {
  name: string;
  url: string;
  listedTitle: string;
  emails: string[];
  github: string[];
  linkedin: string | null;
  twitter: string | null;
  stack: string[];
  experience: string | null;
  title: string;
  location: string | null;
  status: string;
  letter?: string;
}

interface PortfolioData {
  meta: {
    scrapedAt: string;
    total: number;
    successful: number;
    failed: number;
    withEmail: number;
    withGithub: number;
    withStack: number;
    withLinkedin: number;
    withTwitter: number;
  };
  portfolios: Portfolio[];
}

export async function fetchPortfolios(): Promise<Portfolio[]> {
  // Import the JSON data
  const data = (await import('../../data/portfolios.json')) as PortfolioData;
  
  // Add letter property for grouping
  const portfolios = data.portfolios
    .filter(p => p.status === 'ok')
    .map(p => ({
      ...p,
      letter: p.name.charAt(0).toUpperCase()
    }));
  
  return portfolios;
}

export function groupByLetter(portfolios: Portfolio[]): Map<string, Portfolio[]> {
  const groups = new Map<string, Portfolio[]>();
  for (const p of portfolios) {
    const letter = p.letter || p.name.charAt(0).toUpperCase();
    const existing = groups.get(letter) || [];
    existing.push(p);
    groups.set(letter, existing);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function getTopStacks(portfolios: Portfolio[], limit: number = 15): { stack: string; count: number }[] {
  const stackCounts = new Map<string, number>();
  
  portfolios.forEach(p => {
    if (p.stack && Array.isArray(p.stack)) {
      p.stack.forEach(tech => {
        if (tech) {
          stackCounts.set(tech, (stackCounts.get(tech) || 0) + 1);
        }
      });
    }
  });
  
  return Array.from(stackCounts.entries())
    .map(([stack, count]) => ({ stack, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getPortfoliosByStack(portfolios: Portfolio[], stack: string): Portfolio[] {
  return portfolios.filter(p => 
    p.stack && p.stack.some(s => s.toLowerCase() === stack.toLowerCase())
  );
}

// Generate a deterministic color for a stack name
export function getStackColor(stack: string): string {
  const colors = [
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'bg-pink-500/10 text-pink-400 border-pink-500/20',
    'bg-lime-500/10 text-lime-400 border-lime-500/20',
    'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'bg-teal-500/10 text-teal-400 border-teal-500/20',
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < stack.length; i++) {
    hash = stack.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
