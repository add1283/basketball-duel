# Contributing to Basketball Duel

Thanks for helping out! This is a small, dependency-light project: vanilla JS, no build step. Keeping it that way is part of the goal.

## Run locally

No database is needed: the dev server uses an in-memory fake DB.

```bash
git clone https://github.com/add1283/basketball-duel.git
cd basketball-duel
npm install
npm run dev        # http://localhost:3000 (open it in two browser windows)
```

## Tests

```bash
npm test           # rules unit tests (node:test)
npm run e2e        # Playwright smoke test: online duel, CPU game, i18n RTL
```

`npm run e2e` starts `test/dev-server.js` on a free port by itself. It needs Playwright, which is not a project dependency:

```bash
npm i --no-save playwright@1.49.1
npx playwright install --with-deps chromium
```

CI runs both suites on every push and pull request to `main`.

## Code style

- Vanilla JS, plain HTML and CSS. No framework, no bundler, no transpiler.
- Keep files small and focused; split a file before it becomes hard to scan.
- `lib/rules.js` stays pure: the same code runs on the server and in the offline CPU mode.
- Comments are written in English and explain why, not what.
- Every JS file must pass `node --check`.

## Internationalisation

Every UI string goes through `PotaI18n.t`. Never hard-code text in HTML or JS.

- Add each new key to **all 6 languages**: `lang/core.js` (en, tr) and `lang/extra.js` (es, fr, de, ar).
- In HTML use `data-i18n` / `data-i18n-ph`; in JS use `PotaI18n.t('key')`.
- Check your change in Arabic (RTL) as well as English.

## Naming policy

- **Teams:** a real city plus colours or a symbol. Never a real club name or nickname.
- **Players:** humorous soundalike parodies. Never a real person's full name.
- No real logos, photos or likenesses.
- No copied lyrics, sounds, fonts or other assets. Everything must be original or under a licence compatible with MIT (list it in `THIRD_PARTY_NOTICES.md`).

## Pull request checklist

- [ ] `npm test` and `npm run e2e` pass
- [ ] New UI strings use `PotaI18n.t` and exist in all 6 languages
- [ ] Naming policy respected
- [ ] Screenshots attached for UI changes
- [ ] No secrets committed (`DATABASE_URL` lives only in the environment)

---

## Türkçe özet

- **Yerelde çalıştırma:** `npm install`, sonra `npm run dev` ve `http://localhost:3000` adresini iki pencerede aç. Veritabanı gerekmez.
- **Testler:** `npm test` (kural testleri) ve `npm run e2e` (Playwright duman testi; önce `npm i --no-save playwright@1.49.1` ve `npx playwright install --with-deps chromium`).
- **Kod stili:** Saf JS, derleme adımı yok, dosyalar küçük, yorumlar İngilizce.
- **Çeviri kuralı:** Her arayüz metni `PotaI18n.t` üzerinden geçer; yeni anahtarı 6 dilin hepsine ekle (`lang/core.js`: en/tr, `lang/extra.js`: es/fr/de/ar).
- **İsimlendirme:** Takımlar gerçek şehir + renk/sembol olur, gerçek kulüp adı veya lakabı olmaz. Oyuncular esprili benzetme parodilerdir, gerçek tam isim olmaz. Gerçek logo, fotoğraf, benzerlik, şarkı sözü veya kopyalanmış içerik kullanılmaz.
- **PR:** Testler geçmeli, UI değişikliklerinde ekran görüntüsü eklenmeli.
