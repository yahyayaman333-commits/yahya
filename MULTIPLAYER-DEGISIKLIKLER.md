# Değişiklik raporu — 14 Ekim 2026

Kaynak yedeği alınmadan oyun dosyaları değiştirilmedi. Yedek manifesti ve kaynak
arşivi `backups/` altında; yayın paketleri özel hesap verisi içermez.

## Tamamlananlar

1. Son talebe göre native ve korunmuş PeerJS bağlantıları **5 oda / 5 oyuncu** oldu.
   Kabul sınırı istemciye ek olarak sunucuda uygulanır; eşzamanlı katılımda slotlar
   benzersizdir. Native protokol 7, PeerJS protokol 6; eski limitsiz sürümler ayrılır.
2. CrazyGames SDK v3 korundu. Oda davetleri 1–5; dolu oda katılabilir bildirilmez.
3. Mevcut yarış, PvP, görev/okul sınavı, araç sahipliği, boya/plaka, yolcu koltuğu ve
   para doğrulama kodları korunup bağımsız Render sunucusunda kullanılmaya devam eder.
4. Sunucu Node.js 22+ ve Render PORT/HOST düzeniyle çalışır. Paket/lock, render.yaml,
   env örneği, git/docker ignore, Dockerfile ve CI test iş akışı hazırdır.
5. /health boot kimliği, protokol, oda kapasitesi ve **persistent:false** bildirir.
   Render Free'de banka RAM'dedir. Ephemeral diske kalıcı kayıt yazma varsayılanı
   kaldırıldı; kalıcı depolama sağlanmadığı açıkça belirtildi. Anonim oturum 6 saat
   kullanılmadığında sona erer; aktif oturumlar yenilenir. Solo kayıt ayrıdır.
6. İlk girişte sunucunun uyanmasını bekleme, iptal/solo dönüş; bağlantı kesilince
   artan/rastgele gecikmeli tekrar deneme eklendi. Restart yeni boot kimliği ve yeni
   güvenli başlangıçla işlenir; online kayıt sıfırlaması oyuncuya bildirilir.
7. Yarım kalan alışveriş, ateş, yarış ve ödül istekleri tekrar oynatılmaz. Uzak
   oyuncu/yolcu/yarış kalıntıları temizlenir. Açık menü tekrar bağlantıda açık kalır.
8. PvP/yarış tercihleri yeniden bağlanırken ilk auth paketinde uygulanır; isimler
   her zaman açık kalır. Oda sohbeti geçmişi, oda arayüzü sıfırlandıktan sonra gelir.
9. Exact CORS ve WS origin, TLS/proxy kontrolü, IP/oyuncu limitleri, boyut sınırları,
   doğrulanmamış bağlantı süresi ve bounded socket sayısı tamamlandı. Kalp atışı,
   yavaş istemci temizliği ve SIGTERM'de 1012 ile güvenli kapanma vardır.
10. İstemcinin sürat iddiasıyla duran araca ödül verilmez; sürat doğrulanan yer
    değiştirmeden hesaplanır. Mevcut duvar/kıyı/teleport/hız bütçesi kontrolleri korunur.
11. Mevcut interpolation korundu. Yakın oyuncular öncelikli, uzaklar 4 Hz'e kadar;
    değişmeyen kareler tekrar edilmez. Duran/arka plan istemcisi 2 Hz ile sınırlanır.
    NPC hareket paketleri yakınlığa göre seçilir; ölüm ve oda olayları korunur.
12. Mobil bekleme ekranı, solo iptal ve 844×390 menü kontrolü yapıldı. Gerçek
    tarayıcıya fetch bağlanması düzeltildi; Node testlerinin yakalamadığı bu durum
    iki gerçek oyun penceresinde doğrulandı.
13. Server kaynakları oyun dosyalarından ayrı tutuldu. Mobil ve masaüstündeki yerel
    server kopyaları da aynı bağlantı/otorite koduyla güncellendi.

14. Online odadan ayrılınca solo NPC ödülünü engelleyen koşul düzeltildi. Native
    online ödül tekrar yerelde yazılmaz; yeniden bağlantıda sahte +$50 gösterilmez.

## Korunanlar

Harita ve yollar, araç sayısı/ID'leri, araç/human/landmark model dosyaları,
grafik çözünürlüğü/çizim mesafesi, görevler ve ödül miktarları, fizik ve sürüş,
oyun sesleri, tek oyunculu kayıt ve mevcut SDK entegrasyonu kaldırılmadı.
149 kalan grafik/font/ses dosyası önceki dağıtımla SHA256 açısından birebir aynı.
Paketlerdeki eski/yinelenen dosya temizliği önceki optimizasyon düzenini korur.

## Kalıcı depolama ve yayın

Ücretsiz güvenilir kalıcı online hesap deposu eklenmedi. Render Free uyku/restart/
deploy durumunda online ilerleme kaybolur; bunun aksi vaat edilmez. Paid disk/API/
veritabanı kullanılmaz. Render'ın kendi kullanım kotaları ve aşım davranışı kurulum
belgesinde açıklanır. Sınırsız uptime/oyuncu sayısı/ücretsiz trafik garantisi yoktur.

Gerçek yayın bilgisi MULTIPLAYER-KURULUM.md'de tutulur. Sahte URL config'e eklenmez.
GitHub kaynak deposu ve Render Free sunucusu gerçekten yayınlandı. İki oyun
paketinde gerçek sunucu URL'si dolduruldu. Netlify'de üretim yayınları kredi kotası
nedeniyle duraklatıldığı için canlı oyun yüklemesi yapılmadı.
CrazyGames oyun bağlantısı henüz olmadığı için onun gerçek iframe origin'i beklenir.
