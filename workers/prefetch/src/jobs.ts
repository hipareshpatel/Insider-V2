// D128: which NSE API URLs to fetch raw for every listed company (parsing comes in M2).
export const API = "https://www.nseindia.com/api/";

export const PER_COMPANY: Record<string, (s: string) => string> = {
  results_quarterly: (s) => `corporates-financial-results?index=equities&symbol=${s}&period=Quarterly`,
  results_annual: (s) => `corporates-financial-results?index=equities&symbol=${s}&period=Annual`,
  integrated_financials: (s) => `integrated-filing-results?index=equities&symbol=${s}&type=Integrated%20Filing-%20Financials`,
  integrated_governance: (s) => `integrated-filing-results?index=equities&symbol=${s}&type=Integrated%20Filing-%20Governance`,
  shareholding: (s) => `corporate-share-holdings-master?index=equities&symbol=${s}`,
  pit: (s) => `corporates-pit?index=equities&symbol=${s}`,
  sast29: (s) => `corporate-sast-reg29?index=equities&symbol=${s}`,
  board_meetings: (s) => `corporate-board-meetings?index=equities&symbol=${s}`,
  corp_actions: (s) => `corporates-corporateActions?index=equities&symbol=${s}`,
  annual_reports: (s) => `annual-reports?index=equities&symbol=${s}`,
  brsr: (s) => `corporate-bussiness-sustainabilitiy?index=equities&symbol=${s}`,
  governance: (s) => `corporate-governance-master?index=equities&symbol=${s}`,
};

/** Bulk jobs: credit ratings (ignores symbol, all companies) + announcements month by month from 2024-01. */
export function bulkJobs(today: string): { kind: string; url: string; key: string }[] {
  const out = [{ kind: "credit_rating", url: `${API}corporate-credit-rating?index=equities`, key: `api/credit_rating/all/${today}.json` }];
  for (let y = 2024, m = 1; `${y}-${String(m).padStart(2, "0")}` <= today.slice(0, 7); m === 12 ? (y++, (m = 1)) : m++) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, "0");
    out.push({ kind: "announcements", url: `${API}corporate-announcements?index=equities&from_date=01-${mm}-${y}&to_date=${last}-${mm}-${y}`, key: `api/announcements/${y}-${mm}/${today}.json` });
  }
  return out;
}

export function companyJobs(symbols: readonly string[], today: string): { kind: string; symbol: string; url: string; key: string }[] {
  return symbols.flatMap((s) => Object.entries(PER_COMPANY).map(([kind, f]) => ({
    kind, symbol: s, url: API + f(encodeURIComponent(s)), key: `api/${kind}/${s}/${today}.json`,
  })));
}
