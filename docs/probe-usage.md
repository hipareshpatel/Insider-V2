# NSE reachability probe

**Normal way to run it:** from GitHub Actions (`.github/workflows/probe.yml`), see `docs/setup-guide.md` Part E. The steps below are the manual alternative from a computer.

One-off Worker that checks which NSE endpoints answer requests coming from
Cloudflare's network. It decides whether the Phase 1/2 pipeline can poll NSE
directly from Workers (see docs/PLAN.md §3 and §16).

```
cd probe
npm install
npx wrangler login
npx wrangler deploy
curl https://insider-probe.<your-subdomain>.workers.dev        # JSON report
```

Run it 3–4 times at different times of day (incl. once after 22:00 IST) and
paste the output back. Then remove it: `npx wrangler delete`.

Works on the Workers Free plan: ~12 subrequests (limit 50), bodies are not
fully read, so CPU stays within the 10 ms budget.
