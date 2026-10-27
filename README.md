# Bomba Ustası

Beş şantiye dünyasında geçen, piksel çizimli bir dinamit labirent oyunu. Tek başına 50 bölüm ve 5 patron boyunca ilerleyebilir ya da aynı ekranda 4 kişiye kadar kapışabilirsin. Telefonlar kumanda olarak kullanılabilir.

**▶ Oyna:** https://hamikumbasae.github.io/bomba-ustasi/

Bu, türün klasiklerinden esinlenen ama adı, karakterleri, çizimleri, sesleri ve bölümleri tamamen kendine ait bağımsız bir oyundur. Başka bir oyunun kodu, görseli ya da müziği kullanılmamıştır.

## Oyun

- **Tek oyuncu: 50 bölüm, 5 şantiye.** Engelleri dinamitle patlat, düşmanları temizle, engellerden birinin altındaki çıkış kapağını bul. Her dünyanın 10. bölümü bir patron dövüşüdür; patronu yenince +1 can. Ulaştığın en yüksek bölümden **Devam** ile sürdürebilirsin. Ölünce dinamit ve menzil kalır, hız ve kask gider.
- **Kapışma:** 2–4 oyuncu, haritası istediğin dünyadan ya da karışık. Boş yuvaları bilgisayar oyuncuları doldurabilir. 3 tur alan kazanır. 90 saniye sonra alan kenarlardan daralmaya başlar.

| Dünya | Ortam | Düşmanlar | Patron |
|---|---|---|---|
| 1. İnşaat | beton, tahta sandık, şantiye şeridi | böcek, toz bulutu, köstebek | Dev Kepçe (ani hücum) |
| 2. Liman | rıhtım, varil, konteyner, deniz | yengeç, martı, toz bulutu | Dev Yengeç (yardımcı çağırır) |
| 3. Maden | toprak, cevherli kaya, iksa | yarasa, köstebek, böcek | Dev Matkap (engelleri deler, kovalar) |
| 4. Fabrika | metal ızgara, koli, makine, boru | robot, kıvılcım, toz bulutu | Pres Makinesi (yer sarsıntısı) |
| 5. Gökdelen | gece çatısı, tuğla, çelik kiriş | martı, robot, kıvılcım | Yıkım Robotu (hepsi birden) |

Patronlara yalnız dinamit patlaması işler. Pres ve Yıkım Robotu'nun sarsıntısından önce zemin kırmızı yanıp söner: oradan çekil.

**Ekran:** Oyun keskin piksellerle, düz bir web oyunu olarak açılır. İstersen C tuşu ya da **Ekran** düğmesiyle **Tüplü TV** (tarama çizgileri) ya da **VCD** (soluk, taşan renkler, parazit bandı, bombeli tüp) görünümüne geçebilirsin; seçim hatırlanır.

**Ödüller:** +1 dinamit · +1 menzil · hız · kask (bir kez korur).

## Kontroller

| | Klavye | Telefon / dokunmatik |
|---|---|---|
| Yürü | Oklar (2. oyuncu WASD) | Yön haçı |
| Dinamit / seç | Boşluk veya Enter (2. oyuncu F) | DİNAMİT |
| Duraklat | P veya Esc | Duraklat |
| Ekran (temiz / tüplü TV / VCD) | C | Ekran düğmesi |
| Ses | M | Ses düğmesi |
| Telefonu kumanda yap | K | Telefonla oyna |

## Telefonu kumanda olarak kullan

1. Oyunda **Telefonla oyna**'ya bas (K).
2. Telefonun kamerasıyla QR kodu okut. Kamera yoksa telefonda `hamikumbasae.github.io/bomba-ustasi/kumanda.html` adresini açıp 6 karakterlik kodu yaz.
3. Kapışma odasındayken her telefon bir oyuncu yuvasına oturur; başka telefonlar da aynı kodu okutabilir.

Bağlantı WebRTC ile doğrudan kurulur; eşleştirmeyi [PeerJS](https://peerjs.com/)'in ücretsiz sunucusu yapar, bu yüzden cihazların internete bağlı olması gerekir. Bağlantısı kopan telefonun oyuncusunu bilgisayar devralır; telefon geri gelince yerini alır.

## Geliştirme

- `src/levels.js` — 50 bölümün haritaları; `tools/bolumler.py` ile üretilir (desenler ve ayarlar betikte): `python3 tools/bolumler.py`
- `src/core.js` — oyun kuralları (çizimden bağımsız): harita, hareket, dinamit ve alev, düşmanlar, patronlar, bilgisayar oyuncusu, bölüm ve tur akışı
- `src/sprites.js` — piksel çizimler (16×16, kodla çizilir)
- `src/main.js` — ekranlar, giriş, ses (Web Audio ile sentez), ekran çizimi ve isteğe bağlı tüplü TV / VCD efekti (iki geçişli WebGL)
- `src/remote.js`, `kumanda.html` — telefon kumandaları
- `src/vendor/` — PeerJS ve QR kod kütüphaneleri (MIT), `src/fonts/` — Press Start 2P (SIL OFL 1.1)
- `tests/core.test.js`, `tests/levels.test.js` — kural, harita ve patron testleri: `node tests/core.test.js && node tests/levels.test.js`

Yerelde denemek için depo kökünde `python3 -m http.server` çalıştırıp `http://localhost:8000` adresini aç. Ücretsiz sunucu yerine kendi PeerJS sunucunla denemek için adrese `?peer=127.0.0.1:9000` ekle (`npx peerjs --port 9000`).

## Lisans

Kod MIT lisansıyla sunulmuştur (bkz. [LICENSE](LICENSE)). Yazı tipi ve kütüphaneler kendi lisanslarıyla gelir.
