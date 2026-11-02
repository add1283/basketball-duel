# Third-party notices

Basketball Duel itself is released under the [MIT License](LICENSE). It bundles or depends on the following third-party components, each under its own license:

| Component | Used for | License | Copyright |
|---|---|---|---|
| [`@neondatabase/serverless`](https://github.com/neondatabase/serverless) 1.x | Postgres driver in the Vercel function (`api/game.js`) | MIT | © Neon, Inc. |
| [Bungee](https://github.com/djrrb/Bungee) font (`fonts/bungee-*.woff2`) | display typeface | SIL Open Font License 1.1 — [`fonts/OFL-Bungee.txt`](fonts/OFL-Bungee.txt) | © 2023 The Bungee Project Authors |
| [Rubik](https://github.com/googlefonts/rubik) font (`fonts/rubik-*.woff2`) | UI typeface (Latin + Arabic) | SIL Open Font License 1.1 — [`fonts/OFL-Rubik.txt`](fonts/OFL-Rubik.txt) | © 2015 The Rubik Project Authors |

The fonts are self-hosted subsets of the unmodified upstream fonts; the OFL permits bundling and redistribution with the license text, and the font names are not used to promote this project.

Everything else — code, graphics (canvas drawings, logos, icon), sound effects (synthesized at runtime with the Web Audio API), team/player data and texts — is original work of this project. No images, audio or text are copied from other games, leagues or artists.

Development-only tools (not shipped): Node.js test runner; screenshots in `docs/` were produced from this project.
