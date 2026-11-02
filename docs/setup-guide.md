# Owner Setup Guide (step by step)

Written for the owner. Do the parts in order. Each part says **how you know it worked**.
If anything looks different from what's described (screens change over time), stop and send Claude a screenshot or the exact text you see.

Working domain: `disclo.in` (bought at GoDaddy). If the launch name changes later, repeat Part A–B for the new domain.

---

## Part A — Add the domain to Cloudflare (10 minutes)

1. Sign in at **dash.cloudflare.com**.
2. On the account home page, click **"Add a domain"** (may be labelled "Onboard a domain" or "+ Add").
3. Type `disclo.in` and continue. Leave the default option to scan for existing DNS records.
4. Choose the **Free** plan and continue.
5. Cloudflare shows the DNS records it found (GoDaddy usually has "parking" records). **Leave them for now**, then continue.
6. Cloudflare now shows **two nameservers**, e.g. `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. **Keep this page open**, because you'll copy both into GoDaddy in Part B.

**Worked when:** the domain appears in your Cloudflare account with status **"Pending"** (it becomes "Active" after Part B).

---

## Part B — Point GoDaddy to Cloudflare (10 minutes + waiting)

1. Sign in at **godaddy.com** → profile/menu → **My Products**.
2. Find `disclo.in` → click **DNS** (or **Manage DNS**).
3. **Check DNSSEC first:** on the domain's settings page look for **DNSSEC**. If it is **On**, turn it **Off** and save. (If left on, the site and email may stop resolving after the switch.)
4. Find **Nameservers** → **Change Nameservers**.
5. Choose **"I'll use my own nameservers"** (wording may be "Enter my own nameservers (advanced)").
6. Delete GoDaddy's nameservers and paste **the two Cloudflare nameservers** from Part A step 6, exactly as shown.
7. Save. GoDaddy may warn that its DNS settings will no longer apply. That's expected; confirm.
8. Back in Cloudflare (the page from Part A), click **"Check nameservers"** / **"Done, check nameservers"**.

**Waiting:** usually 15 minutes to a few hours; for `.in` it can take up to 24–48 hours. Cloudflare emails you when it's done.

**Worked when:** Cloudflare shows `disclo.in` as **Active**.

---

## Part C — Free email forwarding: `info@disclo.in` → your inbox (10 minutes, after Part B is Active)

1. Cloudflare dashboard → click `disclo.in` → left menu **Email** → **Email Routing** → **Get started** / **Enable**.
2. Create a custom address: `info` → destination: **your personal email** (e.g. your Gmail).
3. Cloudflare sends a **verification email** to that inbox → open it → click **Verify**.
4. Cloudflare asks to add the needed DNS records (MX, TXT) → click **Add records automatically**.
5. Repeat step 2 for `alerts` (pipeline alerts will go here later) and optionally `support`.
6. **Test:** from a different email account, send a message to `info@disclo.in`. It should arrive in your inbox within a minute.

**Worked when:** the test email arrives. *Note:* this is **receive-only**; replying *as* `info@disclo.in` needs a mail provider later (D116).

---

## Part D — Set up Workers (2 minutes)

1. Cloudflare dashboard → left menu **Workers & Pages**.
2. If asked, choose your **workers.dev subdomain** (any short name, e.g. your name). This gives addresses like `something.yourname.workers.dev`.
3. Stay on the **Free** plan for now (Workers Paid comes before backfill/go-live).

**Worked when:** the Workers & Pages page opens without asking for anything else.

---

## Part E — Run the NSE probe from the cloud (10 minutes, no computer setup)

The probe is a tiny test that checks whether NSE answers requests from Cloudflare's network. **This decides whether our pipeline can run fully on Cloudflare.** It runs from **GitHub**: GitHub deploys it to your Cloudflare account, calls it, prints the result, and deletes it again. **Claude reads the results directly from GitHub**, so you don't need to copy anything.

You only give GitHub permission once, by adding two secrets.

### E1. Create a Cloudflare API token
1. Cloudflare dashboard → top-right **profile icon** → **My Profile** → **API Tokens** → **Create Token**.
2. Find the template **"Edit Cloudflare Workers"** → **Use template**.
3. **Account Resources:** Include → *your account*. **Zone Resources:** Include → *All zones* (the template asks for it).
4. **Continue to summary** → **Create Token**.
5. **Copy the token now**; Cloudflare shows it only once. Don't paste it into chat or anywhere else except step E3.

### E2. Copy your Cloudflare Account ID
Cloudflare dashboard → **Workers & Pages** → on the right side under account details, **Account ID** → copy.

### E3. Add both as GitHub secrets
1. Open **github.com/hipareshpatel/Insider-V2** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `CLOUDFLARE_API_TOKEN` → paste the token from E1 → **Add secret**.
3. **New repository secret** again → Name: `CLOUDFLARE_ACCOUNT_ID` → paste the ID from E2 → **Add secret**.

Secrets are encrypted; they never appear in logs or in the public repo.

### E4. Start the first run
1. Repo → **Actions** tab → workflow **probe** → **Run workflow** → keep the branch shown → **Run workflow**.
2. Tell Claude "probe started". Claude reads the result.

After that it also runs automatically **3 times a day** (10:00, 15:00 and 22:30 IST), and each run cleans up after itself. Claude switches the schedule off once there are enough results (about 2 days).

**Worked when:** the run shows a green tick and Claude confirms it has the results.

*(Alternative if ever needed: run the probe from your own computer with Node.js + `npx wrangler deploy`, see `docs/probe-usage.md`.)*

---

## Troubleshooting
| Problem | What to do |
|---|---|
| Cloudflare still "Pending" after 48 h | Re-check the two nameservers in GoDaddy (exact spelling, no extra nameservers); check DNSSEC is off. |
| Verification email not received | Check spam; resend from Cloudflare Email Routing → Destination addresses. |
| Probe run fails with an authentication error | Recreate the API token with the "Edit Cloudflare Workers" template and update the `CLOUDFLARE_API_TOKEN` secret. |
| Probe run says "Secrets … not set yet" | Check the two secret names are exactly `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. |
| Probe deploy says no workers.dev subdomain | Do Part D first. |
| Anything else | Send Claude a screenshot or the exact error text. |
