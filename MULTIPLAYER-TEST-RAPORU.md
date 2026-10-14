# Multiplayer test raporu — 14 Ekim 2026

Sonuçlar, gerçekten çalıştırılmış yerel testlere aittir. Render/CrazyGames/internet
sonucu, ayrıca gerçekleştirilmeden başarılı sayılmadı.

## Otomatik kontroller

| Kontrol | Yöntem ve sonuç |
|---|---|
| İki oyuncu aynı odada | Gerçek HTTP session + WebSocket, ayrıca iki bağımsız tarayıcı oyun penceresi; geçti |
| Eşzamanlı araç kullanımı | Gerçek harita ve NPC'lerle 25 socket/5 oda, normal 12.5 Hz hareket paketleri; geçti |
| Araçlar ve yolcu | Altı model, araçtan inince park halinde görünürlük, araç sahipliği ve yolcu izinleri; geçti |
| Multiplayer yarış | Sunucu sayım, başlangıç, sıralı kontrol noktaları, gerçek iki parkurun navigasyonu, bitiş/ödül/DNF; geçti |
| PvP | Sunucu can/mermi/şarjör/vuruş/ölüm/respawn/koruma, tercih veto, NPC ödül ve kaçış; geçti |
| Normal ayrılma | Oda slotunun serbest kalması, boş oda temizliği; geçti |
| Ani kesilme ve yeniden bağlanma | Gerçek socket terminate; aynı yaşayan süreçte kimlik/bakiye devamı; geçti |
| Sunucu yeniden başlatılması | Gerçek app kapanıp aynı portta yeni bellekle yeniden açıldı; istemci otomatik döndü, kimlik/para sıfırlaması dürüstçe bildirildi; geçti |
| Hatalı/hileli veri | Sahte para/HP/kimlik/skor, duvar/deniz/teleport/hız, stationary speed, eski life/shot, tekrar ödül; geçti |
| Giriş/paket güvenliği | Exact origin/TLS proxy, JSON type/shape, 1 KiB HTTP/8 KiB WS, rate flood ve eski protokol; geçti |
| Oda izolasyonu ve kapasite | Beş oda × beş, altıncıya full, oda 6 reddi, sohbet izolasyonu/slot tekrar kullanımı; geçti |
| Soğuk başlangıç | Geciken sunucu simülasyonu; health retries, iptal, timeout ve yasak origin terminal hatası; geçti |
| Paket tekrarları | Disconnect bekleyen işlemi reddeder; eski satın alma/ateş/yarış paketi tekrar gönderilmez; geçti |
| Solo/SDK | Networking yalnızca multiplayer girişinde yüklenir; SDK başarısızlığı oyunu durdurmaz; geçti |
| Ağ tasarrufu | Idle 2 Hz, uzak kare throttling, değişmeyen kare bastırma, sparse snapshot koruma; geçti |

Sunucu tam süiti 18/18 geçti. Mobil tam süit 449/449, masaüstü tam süit 433/433 geçti. Son loglar
work/render-mobile-tests-final.log ve work/render-desktop-tests-final.log altında. Son odaklı multiplayer/SDK
kontrolleri 31/31 geçti. Başarısız ilk denemeler düzeltildi; başarı satırları son
geçen çalıştırmaya aittir. Build'ler tamamlandı; Vite'ın büyük JS chunk uyarısı
sürmektedir, bir build hatası değildir.

## 25 oyunculu yerel yük ölçümü

- Ortam: real HTTP and WebSocket on localhost, shipped map and NPCs; Render donanımı değildir.
- Süre: 11.73 saniye; 25 oyuncu, 5 oda.
- Alınan snapshot: 3274; toplam payload: 11737813 bayt.
- İstemcilerin toplam aldığı trafik: yaklaşık 1001.1 kB/s
  (HTTP/TLS/WebSocket ek yükü hariç, bu kısa koşulun ölçümü).
- Aynı test sürecinin CPU süresi: 889 ms; RSS: 132.5 MB;
  event-loop p95: 17.61 ms.
- Tahmini sürekli trafik bu hız korunursa 3.60 GB/saat
  olur. Bu sayı bütün kullanım için sabit değildir; durma, mesafe ve aktif oyuncu
  sayısıyla değişir. Ücretsiz bant kotası sınırsız değildir.

Bu test kısa fonksiyonel yük kontrolüdür; uzun süreli soak, telefondaki FPS veya
Render Free 0.1 CPU kapasitesi garantisi değildir. JSON: server/load-test-report.json.

## Tarayıcıda gerçekten kontrol edilenler

Yerel son mobil build iki Chromium oyun penceresinde ayrı origin'lerle açıldı.
İki oyuncu Room 1'e girdi. Karakter ve isim etiketi görüldü; A'nın mesajı B'de
okundu. Menüde Players:2/5 ve iki tercih açık göründü. 844×390 boyutta bağlantı,
bekleme, iptal ve solo dönüş yapıldı. Sunucu yeniden açıldığında her iki istemci
otomatik katıldı, online session reset bildirildi ve açık menü korundu.

Kanıtlar: work/render-two-browser-player.png, render-two-browser-chat.png,
render-mobile-settings.png, render-mobile-waking.png, render-browser-reconnected.png.
Bu bir fiziksel Android/iPhone testi veya CrazyGames portal testi değildir.

149 aktif grafik/font/ses dosyasının hash'i önceki oyun paketiyle eşleşti.
Harita/model/grafik kalitesinde düşürme yapılmadı.

## Henüz başarılı olarak işaretlenmeyenler

- Render Free üzerinde gerçek internet iki oyuncu/yük testi ve gerçek 15 dakikalık uyku.
- Netlify'deki canlı oyun dosyalarının güncellenmesi ve iki ayrı fiziksel cihaz/ağ.
- CrazyGames gerçek oyun iframe origin'i/portal testi; oyun URL'si henüz yok.
- Kalıcı ücretsiz online depolama; bilinçli olarak sağlanmadı.
- Uzun süreli 25 oyunculu soak, geniş anti-cheat saldırı analizi ve gerçek telefon FPS.

Yayın sonunda gerçekten yapılan canlı kontroller bu listeye ayrı sonuçlarla eklenir.
