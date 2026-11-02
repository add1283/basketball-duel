<div align="center">

<img src="icon.svg" width="96" alt="Basketball Duel icon">

# 🏀 Basketball Duel

**A street 1-on-1 basketball duel for two phones.**<br>
Swipe to shoot, read your rival, block, steal, dunk — online with a friend or offline against the CPU.

[![Live demo](https://img.shields.io/badge/▶_PLAY_NOW-basketball--duel.vercel.app-ff6b1a?style=for-the-badge)](https://basketball-duel.vercel.app)

![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?logo=javascript&logoColor=black)
![No build step](https://img.shields.io/badge/build-none-c6ff3d)
![Vercel](https://img.shields.io/badge/hosted_on-Vercel-000?logo=vercel)
![Neon](https://img.shields.io/badge/db-Neon_Postgres-00e599?logo=postgresql&logoColor=white)
![Languages](https://img.shields.io/badge/i18n-EN_·_ES_·_FR_·_DE_·_TR_·_AR-2de2c5)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
[![CI](https://github.com/add1283/basketball-duel/actions/workflows/ci.yml/badge.svg)](https://github.com/add1283/basketball-duel/actions/workflows/ci.yml)

**English** · [Türkçe](README.tr.md)

<br>

<img src="docs/screenshots/home.jpg" width="200" alt="Home screen">&nbsp;
<img src="docs/screenshots/pick.jpg" width="200" alt="Team and player picker">&nbsp;
<img src="docs/screenshots/shoot.jpg" width="200" alt="Aiming a shot">&nbsp;
<img src="docs/screenshots/dunk.jpg" width="200" alt="Poster dunk">

<img src="docs/screenshots/defense.jpg" width="200" alt="Reading the play on defense">&nbsp;
<img src="docs/screenshots/halftime.jpg" width="200" alt="Quarter-break cheer show">&nbsp;
<img src="docs/screenshots/arabic.jpg" width="200" alt="Arabic (RTL) interface">

</div>

---

## ✨ Features

| | |
|---|---|
| 📱 **Two phones, one link** | Create a room, share the link, your friend joins — no accounts, no app store. |
| 🤖 **Offline vs CPU** | The rules engine also runs in the browser; the CPU picks a random team & player and plays with its own skills. Installable PWA, works without internet. |
| 👆 **Swipe controls** | Pick a move and a side, swipe up — the swipe length is the power. Hit the moving green zone. |
| 🧠 **Mind game** | Every possession is a hidden simultaneous choice: shot side vs. closed side, drive vs. rim protection, gamble on a steal. |
| 🏃 **Real-feeling players** | 50 fictional teams × 3 players with height, weight, 3PT, 2PT, layup, dunk and defense ratings that change the odds. |
| ⏱️ **Full game flow** | 4 quarters, halftime, substitutions, overtime, make-it-take-it, streaks 🔥, rematches and a series score. |
| 🎉 **Arena vibes** | Animated crowd, jumbotron, camera zoom on drives, poster dunks with screen shake, slogans, sound & haptics, and the MANYAFEST cheer squad. |
| 📸 **Share your win** | One tap creates a result card (score, teams, highlights) to share on WhatsApp/Instagram or save. |
| 📊 **Personal stats** | Games, win %, points, shooting by move, blocks, steals, poster dunks, best streak — stored only on your device. |
| 🌍 **6 languages** | English (default), Español, Français, Deutsch, Türkçe, العربية (full RTL). |

## 🎮 How to play

**On offense** (10 s per move)

| Move | How | Points |
|---|---|---|
| **1PT shot** | pick LEFT / CENTER / RIGHT, swipe up — length = power | 1 |
| **2PT shot** (beyond the arc) | same, but the green zone is tighter | 2 |
| **Layup** | tap, swipe up | 1 |
| **Dunk** | tap, swipe up | 1 |

**On defense** (10 s) — guess what's coming:

| Choice | Beats | Weak against |
|---|---|---|
| **LEFT / CENTER / RIGHT** | a shot from that side (block chance depends on height & defense) | drives — they blow right past you |
| **RIM** | layups and dunks (block… or get posterized) | shots — the shooter gets more room |
| **STEAL** | layups (often), dunks (sometimes) | shots — wide-open look |

**Make it, take it:** score and you keep the ball; miss, get blocked or stripped and it changes hands.
**Winning:** first to **15** with a **3-point lead**; otherwise play continues into overtime. After 4 quarters (8 possessions each) a 3+ lead wins, a closer game goes to 4-possession overtime periods.

## 🧱 Tech

- **Frontend:** plain HTML + CSS + vanilla JS, 2D canvas, no framework, no build step.
- **Backend:** one Vercel serverless function (`api/game.js`) + **Neon** serverless Postgres (one table, auto-created).
- **Game rules:** `lib/rules.js` — pure functions shared by the server and the offline CPU mode. Moves stay hidden until both players commit; outcomes are deterministic per room/possession.
- **Realtime:** lightweight polling (~650 ms) — perfect for a turn-based duel and free-tier friendly.

```mermaid
flowchart LR
  A["📱 Player 1"] -->|"POST /api/game"| F["Vercel Function<br/>api/game.js"]
  B["📱 Player 2"] -->|"POST /api/game"| F
  F <-->|"rooms & moves"| D[("Neon Postgres<br/>pota_rooms")]
  F -->|"uses"| R["lib/rules.js<br/>shared game rules"]
  C["📱 Offline vs CPU"] -->|"runs in the browser"| R
```

```
├── index.html          # screens, styles
├── game.js             # client: canvas scene, input, animations, CPU mode
├── i18n.js, lang/      # tiny i18n helper + dictionaries (en, es, fr, de, tr, ar)
├── select.js/.css      # team & player picker
├── cheer.js            # MANYAFEST cheer squad (canvas)
├── lib/rules.js        # game rules (server + offline)
├── lib/teams.js        # 50 fictional teams × 3 players
├── api/game.js         # Vercel function: rooms, moves, state
├── fonts/              # self-hosted fonts (SIL OFL 1.1)
├── sw.js, manifest     # offline cache / installable PWA
└── test/               # rule tests, e2e smoke test, local dev server with in-memory DB
```

## 🚀 Run locally

No database needed — the dev server uses an in-memory fake DB.

```bash
git clone https://github.com/add1283/basketball-duel.git
cd basketball-duel
npm install
npm run dev        # → http://localhost:3000  (open it in two browser windows)
npm test           # rule tests
npm run e2e        # browser smoke test (Playwright: online, CPU and RTL flows)
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). CI runs the rule tests and the browser smoke test on every push.

## ☁️ Deploy your own (Vercel + Neon)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fadd1283%2Fbasketball-duel&env=DATABASE_URL&envDescription=Neon%20Postgres%20pooled%20connection%20string&envLink=https%3A%2F%2Fneon.tech%2Fdocs%2Fconnect%2Fconnect-from-any-app&project-name=basketball-duel)

**1. Create a Neon database** (free tier is plenty)
1. Sign up at [neon.tech](https://neon.tech) and create a project (pick a region close to your players).
2. Open **Connect**, choose the **pooled** connection, and copy the connection string. It looks like
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`

   > 💡 Alternative: in Vercel go to **Storage → Create → Neon** (Marketplace). It creates the database and adds `DATABASE_URL` to your project automatically — then skip step 2.3.

**2. Deploy on Vercel**
1. Fork this repo (or click **Deploy with Vercel** above).
2. In Vercel: **Add New → Project**, import the repo. Framework preset: **Other**. No build command needed.
3. Under **Settings → Environment Variables** add `DATABASE_URL` = your Neon connection string (Production + Preview).
4. Deploy. The `pota_rooms` table is created automatically on the first request.

**3. (Optional) Tune the region** — `vercel.json` pins the function to `fra1` (Frankfurt). Change it to the [Vercel region](https://vercel.com/docs/edge-network/regions) nearest to your Neon region for the lowest latency.

**CLI version**

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production   # paste your Neon string when prompted
vercel deploy --prod
```

> 🔒 **Never commit secrets.** Keep your connection string only in Vercel's environment variables (or a local `.env`, which is git-ignored — see `.env.example`). Rooms are deleted after 1 hour of inactivity.

## 🌍 Translations

All UI text lives in `lang/core.js` (English + Turkish) and `lang/extra.js` (Spanish, French, German, Arabic); the picker registers its own `ps.*` keys in `select.js`. To add a language: add it to `LANGS` in `i18n.js` and provide the same keys via `PotaI18n.add({ xx: { ... } })`. Missing keys fall back to English.

The cheer squad name **MANYAFEST** and its song lines are intentionally left untranslated.

## ⚖️ Legal & privacy

- **License:** the code is [MIT](LICENSE). Third-party parts (one MIT npm package, two SIL OFL fonts) are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with their license texts — all are compatible with MIT and with commercial use.
- **Original content:** code, drawings, logos, icon, sounds (synthesized) and texts are original to this project.
- **Fictional & parody content:** teams, logos and the MANYAFEST cheer squad are fictional; leagues are just labelled "USA" and "EU". Player names are humorous soundalike parodies — no real person's name, photo, image or likeness is used, and player ratings are game-balance values, not official data. This project is not affiliated with, endorsed by or connected to any sports league, club, player or artist.
- **Trademarks:** "Vercel" and "Neon" are trademarks of their owners and are mentioned only to describe hosting options.
- **Privacy:** no accounts, no analytics, no cookies and no third-party requests (fonts are self-hosted). Online rooms store only the nickname you type, the chosen team/player and the game state; rooms are deleted after 1 hour of inactivity. Offline mode sends nothing over the network.
- **No warranty:** provided "as is" under the MIT License.

## 📄 License

[MIT](LICENSE) © 2026 Ahmet Deniz Dündar
