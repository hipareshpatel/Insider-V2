# Handover — start of next chat (written 2026-11-02)

**Repo:** `hipareshpatel/Insider-V2`, branch **`ccr-eb822347-c3zp4b`** (only branch). All documents are in `docs/`.

## Read first, in this order
1. `docs/PLAN.md`: the consolidated design. Decisions D1–D120 are in Appendix A; live NSE evidence is in Appendix B.
2. `docs/discussion-log.md`: every owner statement (#1–#227), mapped to where it's recorded, plus open items.
3. `docs/field-catalogue.md`: query fields (v1).
4. `docs/setup-guide.md`: owner's Cloudflare/GoDaddy/GitHub setup steps.

## Working rules (owner's instructions)
- **Discussion phase:** no production code until the owner says "build" (milestones M0–M11 approved, §14).
- **Clean-slate rule:** never use or reference V1 code, data, outputs or designs. *Single exception below.*
- Log **every** owner statement in `docs/discussion-log.md` **in the same turn**; record decisions in `PLAN.md` Appendix A **and** the design sections.
- Run the consistency check after every update (procedure at the end of the discussion log) and report the result.
- Ask the owner wherever a decision is theirs; stress-test ideas before agreeing; never put secrets or personal emails in the public repo.

## State of setup
- Domain **`disclo.in`** on Cloudflare (Free plan, active; DNS cleaned). The public launch name may still change (D99).
- Email Routing: `info@`, `alerts@`, `paresh@disclo.in` → owner's Gmail. **Test email pending** (owner will verify later).
- Workers subdomain `financialengineer-in.workers.dev`. GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.
- `.github/workflows/probe.yml`: deploys, calls and deletes an NSE probe Worker. Runs manually + 3×/day. **Turn the schedule off after ~2 days** of consistent results.
- **Probe result:** all pipeline NSE sources reachable from Cloudflare; only `quote-equity` (sector classification) is 403 → D8 (owner's machine) stands; the D54 relay isn't needed.

## Open items for next chat
1. **[PARKED, #233] quote-equity from GitHub:** the owner says it worked in repo **`hipareshpatel/Insiders`** (V1). **Owner permits reading ONLY the code that fetches NSE `quote-equity`/sector classification, to learn the method (library/endpoint/headers). Do not read, use or reference anything else in that repo.** If it works, D8 can move to a GitHub scheduled job. **Done 2026-11-02 (#228):** method recorded in PLAN Appendix B; replicated from our runner (#230): **403**, homepage too (IP-range block). V1's own run was also 403 (#231). **Owner chose BSE `ComHeadernew` (D120, provisional)**; BSE also **403 from GitHub and Cloudflare** → owner's machine either way; owner to decide machine run, taxonomy, NSE-only fallback.
2. ~~Extend the probe to structured-filing endpoints~~ **Done (#234): all 200 from Cloudflare.** Rate limits at volume to measure in M0.
3. Review scheduled probe runs; then remove the schedule.
4. Owner: email test; field-catalogue review (sector packs); launch name.
5. ~~Provisional decisions D38, D39~~ **confirmed (#236)**; open: public pages for unlisted entities. Unresolved: licence funding (D88 option D chosen; vendor quotes recommended).
6. Card sections after real output (D25). Then, on the owner's "build", start **M0**.
