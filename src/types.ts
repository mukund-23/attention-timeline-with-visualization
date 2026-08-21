export interface Entry {
  id: string; num: number; name: string; date: string;
  adopted: string | null; dateUnverified: boolean; adoptedUnverified: boolean;
  tier: number; viz: string; threads: string[];
  evidence: 'independent' | 'author-reported' | 'preliminary';
  note: string | null; callout: string | null;
  problem: string; mechanism: string;
  buys: string[]; costs: string[];
  pickWhen: string; avoidWhen: string; lineage: string;
}
export type Mode = 'short' | 'full';
