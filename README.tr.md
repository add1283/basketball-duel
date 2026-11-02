<div align="center">

<img src="icon.svg" width="96" alt="Basketball Duel simgesi">

# 🏀 Basketball Duel

**İki telefonla oynanan sokak basketbolu 1'e 1 düellosu.**<br>
Kaydırarak at, rakibini oku, blokla, top çal, smaç bas — arkadaşınla online ya da CPU'ya karşı offline.

[![Canlı demo](https://img.shields.io/badge/▶_HEMEN_OYNA-basketball--duel.vercel.app-ff6b1a?style=for-the-badge)](https://basketball-duel.vercel.app)

![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?logo=javascript&logoColor=black)
![Derleme yok](https://img.shields.io/badge/build-yok-c6ff3d)
![Vercel](https://img.shields.io/badge/barındırma-Vercel-000?logo=vercel)
![Neon](https://img.shields.io/badge/veritabanı-Neon_Postgres-00e599?logo=postgresql&logoColor=white)
![Diller](https://img.shields.io/badge/diller-EN_·_ES_·_FR_·_DE_·_TR_·_AR-2de2c5)
![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue)
[![CI](https://github.com/add1283/basketball-duel/actions/workflows/ci.yml/badge.svg)](https://github.com/add1283/basketball-duel/actions/workflows/ci.yml)

[English](README.md) · **Türkçe**

<br>

<img src="docs/screenshots/home.jpg" width="200" alt="Ana ekran">&nbsp;
<img src="docs/screenshots/pick.jpg" width="200" alt="Takım ve oyuncu seçimi">&nbsp;
<img src="docs/screenshots/shoot.jpg" width="200" alt="Şut nişanı">&nbsp;
<img src="docs/screenshots/dunk.jpg" width="200" alt="Poster smaç">

<img src="docs/screenshots/defense.jpg" width="200" alt="Savunmada tahmin">&nbsp;
<img src="docs/screenshots/halftime.jpg" width="200" alt="Çeyrek arası ponpon şovu">&nbsp;
<img src="docs/screenshots/arabic.jpg" width="200" alt="Arapça (sağdan sola) arayüz">

</div>

---

## ✨ Özellikler

| | |
|---|---|
| 📱 **İki telefon, tek link** | Oda kur, linki paylaş, arkadaşın katılsın — hesap yok, uygulama mağazası yok. |
| 🤖 **CPU'ya karşı offline** | Kural motoru tarayıcıda da çalışır; CPU rastgele takım ve oyuncu seçer, kendi yetenekleriyle oynar. Telefona uygulama olarak eklenebilir (PWA), internetsiz çalışır. |
| 👆 **Kaydırma kontrolleri** | Hamleni ve tarafı seç, yukarı kaydır — kaydırma uzunluğu güçtür. Hareket eden yeşil banda denk getir. |
| 🧠 **Akıl oyunu** | Her hücum gizli ve eşzamanlı bir seçim: şut tarafı mı kapalı taraf mı, potaya giriş mi pota koruması mı, top çalma kumarı mı? |
| 🏃 **Gerçekçi hissettiren oyuncular** | 50 hayali takım × 3 oyuncu; boy, kilo, 3'lük, 2'lik, turnike, smaç ve savunma puanları olasılıkları değiştirir. |
| ⏱️ **Tam maç akışı** | 4 çeyrek, devre arası, oyuncu değişikliği, uzatma, "atan tekrar atar", seriler 🔥, rövanş ve seri skoru. |
| 🎉 **Arena havası** | Coşan seyirci, skorbord, turnike/smaçta kamera yakınlaşması, ekranı sarsan poster smaçlar, sloganlar, ses ve titreşim, MANYAFEST ponpon ekibi. |
| 📸 **Galibiyetini paylaş** | Tek dokunuşla skor, takımlar ve öne çıkanlarla bir sonuç kartı oluşur; WhatsApp/Instagram'da paylaş ya da kaydet. |
| 📊 **Kişisel istatistikler** | Maç, kazanma yüzdesi, sayı, hamle bazında isabet, blok, top çalma, poster smaç, en uzun seri — sadece cihazında saklanır. |
| 🌍 **6 dil** | English (varsayılan), Español, Français, Deutsch, Türkçe, العربية (tam sağdan sola). |

## 🎮 Nasıl oynanır

**Hücumda** (hamle başına 10 sn)

| Hamle | Nasıl | Sayı |
|---|---|---|
| **1'lik şut** | SOL / ORTA / SAĞ seç, yukarı kaydır — uzunluk = güç | 1 |
| **2'lik şut** (üçlük çizgisinin dışı) | aynısı, ama yeşil bant daha dar | 2 |
| **Turnike** | dokun, yukarı kaydır | 1 |
| **Smaç** | dokun, yukarı kaydır | 1 |

**Savunmada** (10 sn) — ne geleceğini tahmin et:

| Seçim | İşe yaradığı | Zayıf kaldığı |
|---|---|---|
| **SOL / ORTA / SAĞ** | o taraftan gelen şut (blok şansı boy ve savunmaya bağlı) | potaya giriş — yanından geçip gider |
| **POTA** | turnike ve smaç (blok… ya da poster olursun) | şut — şutçu rahatlar |
| **ÇAL** | turnike (sık), smaç (bazen) | şut — bomboş şut |

**Atan tekrar atar:** sayı yaparsan top sende kalır; kaçırır, blok yer ya da topu kaptırırsan hücum geçer.
**Kazanmak:** **15'e** ulaşan ve **3 sayı fark** açan kazanır; aksi halde oyun uzatmaya gider. 4 çeyrek (8'er hücum) sonunda 3+ fark kazanır, daha yakın maçlar 4 hücumluk uzatma periyotlarına gider.

## 🧱 Teknik

- **Ön yüz:** düz HTML + CSS + vanilla JS, 2D canvas; framework yok, derleme adımı yok.
- **Arka uç:** tek bir Vercel sunucusuz fonksiyonu (`api/game.js`) + **Neon** sunucusuz Postgres (tek tablo, otomatik oluşturulur).
- **Oyun kuralları:** `lib/rules.js` — sunucu ve offline CPU modu tarafından paylaşılan saf fonksiyonlar. Hamleler iki oyuncu da seçene kadar gizli kalır; sonuçlar oda/hücum başına belirlenimlidir.
- **Gerçek zamanlılık:** hafif yoklama (~650 ms) — sıra tabanlı bir düello için ideal ve ücretsiz katmanlara uygun.

```mermaid
flowchart LR
  A["📱 Oyuncu 1"] -->|"POST /api/game"| F["Vercel Fonksiyonu<br/>api/game.js"]
  B["📱 Oyuncu 2"] -->|"POST /api/game"| F
  F <-->|"odalar ve hamleler"| D[("Neon Postgres<br/>pota_rooms")]
  F -->|"kullanır"| R["lib/rules.js<br/>ortak oyun kuralları"]
  C["📱 CPU'ya karşı offline"] -->|"tarayıcıda çalışır"| R
```

```
├── index.html          # ekranlar, stiller
├── game.js             # istemci: canvas sahnesi, girdi, animasyonlar, CPU modu
├── i18n.js, lang/      # küçük çeviri yardımcısı + sözlükler (en, es, fr, de, tr, ar)
├── select.js/.css      # takım ve oyuncu seçimi
├── cheer.js            # MANYAFEST ponpon ekibi (canvas)
├── lib/rules.js        # oyun kuralları (sunucu + offline)
├── lib/teams.js        # 50 hayali takım × 3 oyuncu
├── api/game.js         # Vercel fonksiyonu: odalar, hamleler, durum
├── fonts/              # projeyle gelen fontlar (SIL OFL 1.1)
├── sw.js, manifest     # offline önbellek / yüklenebilir PWA
└── test/               # kural testleri, uçtan uca test, bellek içi sahte DB'li yerel sunucu
```

## 🚀 Yerelde çalıştırma

Veritabanı gerekmez — geliştirme sunucusu bellek içi sahte bir DB kullanır.

```bash
git clone https://github.com/add1283/basketball-duel.git
cd basketball-duel
npm install
npm run dev        # → http://localhost:3000  (iki tarayıcı penceresinde aç)
npm test           # kural testleri
npm run e2e        # tarayıcı testi (Playwright: online, CPU ve sağdan sola akışlar)
```

Katkılarınızı bekliyoruz — bkz. [CONTRIBUTING.md](CONTRIBUTING.md). CI her push'ta kural testlerini ve tarayıcı testini çalıştırır.

## ☁️ Kendi kopyanı yayınla (Vercel + Neon)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fadd1283%2Fbasketball-duel&env=DATABASE_URL&envDescription=Neon%20Postgres%20pooled%20connection%20string&envLink=https%3A%2F%2Fneon.tech%2Fdocs%2Fconnect%2Fconnect-from-any-app&project-name=basketball-duel)

**1. Neon veritabanı oluştur** (ücretsiz katman fazlasıyla yeter)
1. [neon.tech](https://neon.tech) adresinde hesap aç ve bir proje oluştur (oyuncularına yakın bir bölge seç).
2. **Connect**'i aç, **pooled** (havuzlu) bağlantıyı seç ve bağlantı adresini kopyala. Şuna benzer:
   `postgresql://KULLANICI:SIFRE@ep-xxxx-pooler.BOLGE.aws.neon.tech/neondb?sslmode=require`

   > 💡 Alternatif: Vercel'de **Storage → Create → Neon** (Marketplace). Veritabanını oluşturur ve `DATABASE_URL`'yi projene otomatik ekler — bu durumda 2.3. adımı atla.

**2. Vercel'de yayınla**
1. Bu repoyu fork'la (ya da yukarıdaki **Deploy with Vercel** butonuna tıkla).
2. Vercel'de: **Add New → Project**, repoyu içe aktar. Framework preset: **Other**. Build komutu gerekmez.
3. **Settings → Environment Variables** altında `DATABASE_URL` = Neon bağlantı adresin (Production + Preview) ekle.
4. Deploy et. `pota_rooms` tablosu ilk istekte otomatik oluşturulur.

**3. (İsteğe bağlı) Bölgeyi ayarla** — `vercel.json` fonksiyonu `fra1` (Frankfurt) bölgesine sabitler. En düşük gecikme için Neon bölgene en yakın [Vercel bölgesine](https://vercel.com/docs/edge-network/regions) değiştir.

**Komut satırıyla**

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production   # sorulunca Neon adresini yapıştır
vercel deploy --prod
```

> 🔒 **Gizli bilgileri asla commit'leme.** Bağlantı adresini yalnızca Vercel ortam değişkenlerinde (ya da git'e girmeyen yerel `.env` dosyasında — bkz. `.env.example`) tut. 1 saat hareketsiz kalan odalar otomatik silinir.

## 🌍 Çeviriler

Tüm arayüz metinleri `lang/core.js` (İngilizce + Türkçe) ve `lang/extra.js` (İspanyolca, Fransızca, Almanca, Arapça) içindedir; seçim ekranı kendi `ps.*` anahtarlarını `select.js` içinde kaydeder. Dil eklemek için: `i18n.js` içindeki `LANGS` listesine ekle ve aynı anahtarları `PotaI18n.add({ xx: { ... } })` ile ver. Eksik anahtarlar İngilizceye düşer.

Ponpon ekibinin adı **MANYAFEST** ve şarkı sözleri bilerek çevrilmez.

## ⚖️ Hukuki bilgiler ve gizlilik

- **Lisans:** kod [MIT](LICENSE) lisanslıdır. Üçüncü taraf parçalar (bir MIT npm paketi, iki SIL OFL fontu) lisans metinleriyle birlikte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında listelenmiştir — hepsi MIT ve ticari kullanımla uyumludur.
- **Özgün içerik:** kod, çizimler, logolar, simge, sesler (çalışırken sentezlenir) ve metinler bu projeye aittir.
- **Hayali ve parodi içerik:** takımlar, logolar ve MANYAFEST ponpon ekibi hayalidir; ligler yalnızca "USA" ve "EU" diye etiketlenmiştir. Oyuncu isimleri esprili, ses benzeri parodilerdir — hiçbir gerçek kişinin adı, fotoğrafı, görüntüsü ya da benzerliği kullanılmaz; oyuncu puanları oyun dengesi değerleridir, resmî veri değildir. Bu proje hiçbir spor ligi, kulüp, oyuncu ya da sanatçıyla bağlantılı değildir, onlar tarafından desteklenmemektedir.
- **Markalar:** "Vercel" ve "Neon" sahiplerinin markalarıdır ve yalnızca barındırma seçeneklerini anlatmak için anılmıştır.
- **Gizlilik:** hesap yok, analitik yok, çerez yok ve üçüncü taraf istek yok (fontlar projeyle birlikte gelir). Online odalar yalnızca yazdığın takma adı, seçilen takım/oyuncuyu ve maç durumunu saklar; 1 saat hareketsiz kalan odalar silinir. Offline mod ağ üzerinden hiçbir şey göndermez.
- **Garanti yok:** MIT lisansı gereği "olduğu gibi" sunulur.

## 📄 Lisans

[MIT](LICENSE) © 2026 Ahmet Deniz Dündar
