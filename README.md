# Ectoplasm — Landing page (Casper DEX)

This folder contains a production-ready landing page scaffold for Ectoplasm, a DEX built on the Casper Network.

Contents:
- index.html — landing page markup and demo swap UI
- styles.css — responsive, accessible styles, dark-mode-ready
- script.js — live CSPR price ticker, theme toggle, Casper wallet connect scaffolding

Why this design is superior to friendly.market:
- Clear hierarchy and onboarding for new users, with an immediate demo swap and wallet connect CTA.
- Emphasis on security, audits, and transparency (audit artifacts and on-chain verifiability).
- Advanced product messaging: limit orders, LP protections, fee customization.
- Performance-minded: small, static assets, and no heavy client frameworks for the landing page itself.
- Accessibility and SEO built-in (semantic HTML, ARIA where needed, meta/OG tags).

How to use:
1. Copy files into your repository (suggested location: `web/landing` or `docs/` if using GitHub Pages).
2. Replace placeholder images in `/assets/` with your real graphics (logo, OG image, audit badges).
3. Hook up wallet connect:
   - Integrate CasperSigner or your preferred Casper wallet according to their docs.
   - Implement on-chain swap interactions in a secured backend or client-side contract calls.
4. Replace the CoinGecko call if you prefer your own price oracle.
5. Deploy: GitHub Pages, Vercel, Netlify, or static hosting of your choice.

Want me to:
- open a PR into `EcosystemNetwork/Ectoplasm` with these files added to a new branch?
- add a production-ready CasperSigner integration and example contract calls?
- create more pages: docs, tokenomics, governance, blog templates?

I can proceed to create a branch and open a pull request if you'd like — tell me whether to target the default branch (e.g., main) or a specific branch name and I will open the PR with these files included.