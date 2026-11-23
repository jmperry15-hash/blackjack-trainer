# By the Book Blackjack

A blackjack trainer that teaches mathematically optimal basic strategy ("playing by the book") for
**6 decks, dealer stands on soft 17, blackjack pays 3:2, double after split, no surrender**.

- **Learn mode** shows the book play for every decision, explains why, and shows calculated odds:
  dealer bust chance, your bust chance if you hit, and the expected result of each move.
- **Test mode** hides all help, grades every decision, and ends with a score and a review of each mistake,
  including how much each mistake changed your chance of winning the hand.
- **Progress** tracks accuracy across sessions. Stats are saved on the device.

## Install it on your phone

Open the site link in your phone's browser, then:

- **iPhone (Safari):** tap the Share button → **Add to Home Screen** → Add.
- **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** (or **Install app**).

It opens full screen like an app and works offline after the first visit.

## How the math is checked

- `npm run verify` compares the strategy chart with the app's expected-value engine for every hand.
- `scripts/finite.ts` settles the two close calls with an exact 6-deck calculation.
- `scripts/simulate.ts` plays 400,000 rounds by the book (result: about −0.5% house edge, as expected for these rules).

## Development

```bash
npm install
npm run build:pages   # installable web app → site/
npm run build         # single-file Claude artifact → dist/
npm run icons         # re-render icons from web/icon.svg
```

Pushing to `main` deploys `site/` to GitHub Pages through `.github/workflows/pages.yml`.

Built with React, TypeScript and Tailwind CSS. No backend.
