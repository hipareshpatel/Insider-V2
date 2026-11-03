// D115 legal pages (drafts until the legal consult, PLAN §12) and the credits page required by D105.
const Draft = () => <p className="note">Draft — to be reviewed in the legal consult before Disclo is announced.</p>;

export function Credits() {
  return (
    <div className="prose">
      <h1>Credits</h1>
      <h2>Data</h2>
      <p>Prices, index levels, corporate actions, filings and market-structure data come from public files and lists published by the National Stock Exchange of India (NSE) and from companies' own filings to NSE. Each figure on this site names its source and date. Disclo is not affiliated with or endorsed by NSE.</p>
      <h2>Charts</h2>
      <p>Charts use TradingView Lightweight Charts™, Copyright © 2025 TradingView, Inc. — <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">tradingview.com</a>. Licensed under the Apache License 2.0.</p>
      <h2>Software</h2>
      <p>Built with React, Vite and Hono, and runs on Cloudflare.</p>
    </div>
  );
}

export function Disclaimer() {
  return (
    <div className="prose">
      <h1>Disclaimer</h1><Draft />
      <p>Disclo shows facts from public exchange data and company filings. It is not investment advice, research, a recommendation or an offer to buy or sell any security. Disclo is not registered with SEBI as a research analyst or investment adviser.</p>
      <p>Figures are read automatically from filings and exchange files and are checked by rules, but they can be wrong, late or incomplete. Always check the linked filing before relying on a number. Prices are end-of-day and adjusted for splits and bonuses only where the adjustment is confirmed.</p>
    </div>
  );
}

export function Terms() {
  return (
    <div className="prose">
      <h1>Terms of use</h1><Draft />
      <ul>
        <li>The site is provided as is, without any warranty. Use of the information is at your own risk.</li>
        <li>Automated scraping or bulk downloading is not allowed; requests are rate limited.</li>
        <li>Exchange data remains the property of its owners; company filings belong to the companies that filed them.</li>
        <li>These terms may change; the date of the latest version will be shown here.</li>
      </ul>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="prose">
      <h1>Privacy</h1><Draft />
      <p>There are no accounts, forms or advertising cookies on this version of the site. Our hosting provider (Cloudflare) processes your IP address to deliver pages, protect the site and apply rate limits; we do not sell or share personal data.</p>
      <p>Questions: <a href="mailto:info@disclo.in">info@disclo.in</a>.</p>
    </div>
  );
}

export function Contact() {
  return (
    <div className="prose">
      <h1>Contact</h1>
      <p>Found a wrong number or a broken page? Write to <a href="mailto:info@disclo.in">info@disclo.in</a> with the page address and the figure, and we will check it against the filing.</p>
    </div>
  );
}
