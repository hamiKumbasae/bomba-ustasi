# Bomba Ustası

Şantiyede geçen, retro görünümlü bir dinamit labirent oyunu. Tek başına bölüm bölüm ilerleyebilir ya da aynı ekranda 4 kişiye kadar kapışabilirsin. Telefonlar kumanda olarak kullanılabilir.

**▶ Oyna:** https://hamikumbasae.github.io/bomba-ustasi/

Bu, türün klasiklerinden esinlenen ama adı, karakterleri, çizimleri, sesleri ve bölümleri tamamen kendine ait bağımsız bir oyundur. Başka bir oyunun kodu, görseli ya da müziği kullanılmamıştır.

## Oyun

- **Tek oyuncu:** Sandıkları dinamitle patlat, düşmanları temizle, sandıklardan birinin altındaki çıkış kapağını bul. Her bölüm biraz daha zor. Ulaştığın en yüksek bölümden **Devam** ile sürdürebilirsin.
- **Kapışma:** 2–4 oyuncu. Boş yuvaları bilgisayar oyuncuları doldurabilir. 3 tur alan kazanır. 90 saniye sonra alan kenarlardan daralmaya başlar.

**Düşmanlar:** Böcek (yavaş), Toz bulutu (hızlı, yön değiştirir), Köstebek (sandıkların içinden geçer, seni kovalar).

**Ödüller:** +1 dinamit · +1 menzil · hız · kask (bir kez korur).

## Kontroller

| | Klavye | Telefon / dokunmatik |
|---|---|---|
| Yürü | Oklar (2. oyuncu WASD) | Yön haçı |
| Dinamit / seç | Boşluk veya Enter (2. oyuncu F) | DİNAMİT |
| Duraklat | P veya Esc | Duraklat |
| Ekran (tüplü TV / temiz) | C | Ekran düğmesi |
| Ses | M | Ses düğmesi |
| Telefonu kumanda yap | K | Telefonla oyna |

## Telefonu kumanda olarak kullan

1. Oyunda **Telefonla oyna**'ya bas (K).
2. Telefonun kamerasıyla QR kodu okut. Kamera yoksa telefonda `hamikumbasae.github.io/bomba-ustasi/kumanda.html` adresini açıp 6 karakterlik kodu yaz.
3. Kapışma odasındayken her telefon bir oyuncu yuvasına oturur; başka telefonlar da aynı kodu okutabilir.

Bağlantı WebRTC ile doğrudan kurulur; eşleştirmeyi [PeerJS](https://peerjs.com/)'in ücretsiz sunucusu yapar, bu yüzden cihazların internete bağlı olması gerekir. Bağlantısı kopan telefonun oyuncusunu bilgisayar devralır; telefon geri gelince yerini alır.

## Geliştirme

- `src/core.js` — oyun kuralları (çizimden bağımsız): harita, hareket, dinamit ve alev, düşmanlar, bilgisayar oyuncusu, bölüm ve tur akışı
- `src/sprites.js` — piksel çizimler (16×16, kodla çizilir)
- `src/main.js` — ekranlar, giriş, ses (Web Audio ile sentez), retro ekran (WebGL)
- `src/remote.js`, `kumanda.html` — telefon kumandaları
- `src/vendor/` — PeerJS ve QR kod kütüphaneleri (MIT), `src/fonts/` — Press Start 2P (SIL OFL 1.1)
- `tests/core.test.js` — kural testleri: `node tests/core.test.js`

Yerelde denemek için depo kökünde `python3 -m http.server` çalıştırıp `http://localhost:8000` adresini aç. Ücretsiz sunucu yerine kendi PeerJS sunucunla denemek için adrese `?peer=127.0.0.1:9000` ekle (`npx peerjs --port 9000`).

## Lisans

Kod MIT lisansıyla sunulmuştur (bkz. [LICENSE](LICENSE)). Yazı tipi ve kütüphaneler kendi lisanslarıyla gelir.
