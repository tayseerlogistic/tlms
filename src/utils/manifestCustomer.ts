// Exact customer names used by dispatch and their Daily Follow-up labels.
const customerNames: Record<string, string[]> = {
  SWCC: ['Saudi Arabian Mining Co', 'Saudi Arabian Mining Company', 'Saudi Water Authority', 'Saudi Water Company'],
  NBC: ['National Battery Company', 'National Batteries Company', 'National Batteries', 'National Battery Co'],
  PRC: ['Petro Rabigh', 'Petro Rabigh Company', 'Petro Rabigh Co', 'Petro Rabigh Alky Plant', 'Petro Rabigh AP',
    'Petro Rabigh Utility', 'Petro Rabigh Utility Plant', 'Petro Rabigh Utitlity Plant', 'Petro Rabigh Cumene', 'Petro Rabigh LTP', 'Pertro Rabigh AP'],
  RPC: ['Rabigh Power Company'],
  SEC: ['Saudi Electricity Company'],
  DAM: ['Dam Al Kuwaitiya'],
  MWSPC: ['Saudi Arabian Mining Company - Maaden (WH)'],
  MPC: ['Saudi Arabian Mining Company - Maaden Phosphate'],
  SADARA: ['Sadara Chemical Company'],
  URSC: ['Universal Reliance for Specialized Chemicals'],
  CISCO: ['Cisco Trading Co'],
  'ATO&M': ['Jeddah Al Thaniya', 'Jeddah Al-Thaniyah Operation & Maintenance Co'],
  COSMOS: ['COSMOS PROJECTS TRADING Co.W.L.L'],
  BAYARIQ: ['Green Valley Fertilizer Company', 'Green Valley Fertilizer Company (Al-Bayarik)'],
  LEHAA: ['Lehaa Agricultural Production Company'],
  ENGIE: ['Engie for Yanbu O&M Company', 'ENGIE Operation & Maintenance Co'],
  MARAFIQ: ['Power and Water Utility', 'Power and Water Utility Company'],
  MEPCO: ['Middle East Paper Company'],
  WDC: ['Water Desalination Company'],
  WDEC: ['Water Desalination Expansion Company'],
  'WANG KANG': ['Wang Kang Ceramic Company', 'Wang Kang Saudi Ceramic Company'],
};

const key = (name: string) => name.toUpperCase().replace(/[.]/g, '').replace(/[-\s]+/g, ' ').trim();
const aliases = new Map(Object.entries(customerNames).flatMap(([short, names]) =>
  [short, ...names].map(name => [key(name), short] as const)));

export function manifestCustomer(name: string): string {
  return aliases.get(key(name)) ?? name;
}

export function abbreviateManifestCustomers(tag: string): string {
  return tag.replace(/(\bSupply for\s+)(.+?)(?=\s+-\s+(?:Under|On the way|Waiting|At|Coming Back|Offloading|Loading)\b|\s+\/\s+|$)/gi,
    (_, prefix: string, customer: string) => prefix + manifestCustomer(customer));
}
