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

## Part E — Run the NSE probe (20 minutes, on your computer)

The probe is a tiny test that checks whether NSE answers requests from Cloudflare's network. **This decides whether our pipeline can run fully on Cloudflare.**

### E1. Install Node.js (once)
- Go to **nodejs.org** → download the **LTS** version for your computer (Windows or Mac) → install with default options.
- Check: open **Terminal** (Mac) or **Command Prompt / PowerShell** (Windows) and type `node -v` → it should print a version like `v22…`.

### E2. Get the project files
- Download this ZIP (our working branch):
  `https://github.com/hipareshpatel/Insider-V2/archive/refs/heads/ccr-eb822347-c3zp4b.zip`
- Unzip it. Inside you'll find a folder named `probe`.

### E3. Deploy the probe
In Terminal / Command Prompt:
```
cd <path to the unzipped folder>/probe
npm install
npx wrangler login
```
- `wrangler login` opens your browser → click **Allow**. Return to the terminal.
```
npx wrangler deploy
```
- At the end it prints a web address like `https://insider-probe.yourname.workers.dev`.

### E4. Run it and send the result to Claude
- Open that address in your browser. You'll see a block of text (JSON).
- **Select all → copy → paste it to Claude.**
- Do this **3–4 times at different times**, including **once after 10 PM IST**.

### E5. Remove the probe when done
```
npx wrangler delete
```
Confirm with `y`. (It's harmless, but it shouldn't keep running publicly.)

**Worked when:** you've pasted 3–4 results to Claude and deleted the probe.

---

## Troubleshooting
| Problem | What to do |
|---|---|
| Cloudflare still "Pending" after 48 h | Re-check the two nameservers in GoDaddy (exact spelling, no extra nameservers); check DNSSEC is off. |
| Verification email not received | Check spam; resend from Cloudflare Email Routing → Destination addresses. |
| `npm` / `node` "not recognised" | Close and reopen the terminal after installing Node.js; on Windows, restart the computer once. |
| `wrangler login` browser doesn't open | Copy the link the terminal prints and open it manually. |
| Anything else | Send Claude a screenshot or the exact error text. |
