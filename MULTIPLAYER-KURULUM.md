# Sultanahmet — ücretsiz multiplayer kurulumu

14 Ekim 2026. Yeni düzen: **5 oda, oda başına en fazla 5 oyuncu**.
Oyun her yeni açılışta İngilizce başlar. Mevcut harita, altı araç modeli, görevler,
karakter modelleri, grafik profilleri, sesler ve tek oyunculu kayıt korunur.

## Hazır dosyalar

- Sunucu kaynak klasörü: `sultanahmet-multiplayer-server/`.
- Mobil oyun kaynak/derleme klasörü: `sultanahmet-mobile/`, yayın dosyaları `dist/`.
- Masaüstü oyun kaynak/derleme klasörü: `sultanahmet-preserved/`, yayın dosyaları `dist/`.
- Sunucu: Node.js 22+, sabitlenmiş `ws 8.22.0`, HTTP sağlık kontrolü ve WebSocket.
- `package.json`, lock, `render.yaml`, `.env.example`, `.gitignore`, Dockerfile ve
  GitHub Actions test iş akışı sunucu paketindedir. Gizli anahtar gerekmez.
- İşlem öncesi kaynak yedeği: `backups/2026-10-14-pre-render-free.zip`;
  SHA256 `4a4789fc91d2397c431a575837cfcb49767ba33ef2c93e037b19dec49466a107`.
  1056 dosya/524427679 bayt; CRC doğrulandı. Yeniden kurulabilen node_modules,
  dist, özel hesap klasörleri ve özel .env dosyaları yayın/yedek paketine alınmadı.

## Gerçek yayın durumu

Yayınlama en son yapılacak. Şu an gerçek bir sunucu URL'si bu belgeye veya oyun
config'ine yazılmadı. GitHub hesabı ve Render oturumu doğrulandı; GitHub bağlantısı
contents yazma işleminde 403 döndü. Chrome dosya yüklemesi de uzantının dosya
erişimi kapalı olduğu için durdu. Yerel kaynak, testler ve dağıtım ayarları hazır.
Yayın gerçekleşirse bu bölüm gerçek URL, commit ve canlı testlerle güncellenir.

## Render Free — GitHub üzerinden

1. Sunucu ZIP'ini ayrı klasöre çıkar. Bu klasörün **içeriğini** GitHub deposunun
   köküne koy; oyunun 3D modellerini, node_modules veya private-data'yı yükleme.
   `server/`, `src/`, `licenses/` yollarını koru. Kökünde package.json bulunmalı.
2. Render → New → **Blueprint** ile depoyu bağlarsan `render.yaml` ayarlarını
   kullanır. Depo sunucuya aitse root directory boş bırakılır.
3. Alternatif: New → **Web Service** → Public Git Repository → gerçek depo URL'si.
   Runtime: Node; branch: main; build: `npm ci --omit=dev --ignore-scripts`;
   start: `npm start`; instance: **Free**; health check: `/health`.
4. Ortam değişkenleri:

   | Anahtar | Değer |
   |---|---|
   | NODE_VERSION | 22.22.0 |
   | NODE_ENV | production |
   | HOST | 0.0.0.0 |
   | TRUST_PROXY | 1 |
   | STORAGE_MODE | memory |
   | PVP_ALLOWED | 1 |
   | ALLOWED_ORIGINS | https://istanbuloyun.netlify.app,https://istanbulgame.netlify.app |

   PORT'u Render sağlar. DATA_DIR, kalıcı disk, ücretli veritabanı veya ücretli
   eklenti ekleme. TRUST_PROXY=1 yalnızca Render gibi güvenilir TLS proxy arkasında
   kullanılır; doğrudan internete açılan düz HTTP sunucusu için uygun değildir.
5. Deploy tamamlanınca Render'ın verdiği gerçek HTTPS adresini aç: `/health`.
   Beklenen: ok:true, protocol:7, roomCount:5, roomCapacity:5, storage:"memory",
   persistent:false. Yayınlanmadan örnek bir onrender.com adresini kullanma.
6. Oyun ZIP'inin kökündeki `multiplayer-config.json` dosyasının **serverUrl** alanına
   yalnızca doğrulanmış gerçek HTTPS sunucu ana adresini yaz. `/room` ekleme.
   İstemci HTTPS `/health` ve `/session`, ardından WSS `/room` kullanır.
7. Mobil/masaüstü statik paketi Netlify Deploys'ten yeniden yükle. index.html,
   multiplayer-config.json ve bütün assets/models klasörleri birlikte yüklenir.
   Eski oyun sürümü native protokol 7 ile uyumlu değildir; arkadaşlar aynı güncel
   paketi kullanmalıdır. Sunucu tek başına Netlify oyun dosyalarını güncellemez.

## CrazyGames ve iframe

Mevcut SDK v3; loading/gameplay, ayarlar, mute/chat tercihleri ve oda davetleri
korunur. Dolu oda isJoinable=false bildirir; davet parametresi 1–5 ile sınırlıdır.
SDK indirilemezse solo başlangıç buna bağımlı değildir.

Kendi Netlify adresinden iframe içine gömülürse ağ Origin'i yine Netlify oyun
adresidir. CrazyGames'e dosyalar yüklenirse iframe'in **kendi gerçek HTTPS origin**
adresini ALLOWED_ORIGINS'e virgülle ekle. Parent portal URL'si ile oyun Origin'ini
karıştırma; portalda henüz oyun bağlantısı olmadığı için bir adres uydurulmadı.
DevTools → Network → /session → Request Headers → Origin ile doğrula. `null`, `*`
ve tüm Netlify kullanıcılarına izin veren joker adresler kabul edilmez.

Oyunu iframe'de engelleyen X-Frame-Options/CSP eklenmedi. Mobil formda kaydırma ve
safe-area korundu; fiziksel telefon/CrazyGames portalı testi yayın öncesi ayrıca
yapılmalıdır. [CrazyGames origin açıklaması](https://docs.crazygames.com/resources/html5/sitelock/)
ve [multiplayer gereksinimleri](https://docs.crazygames.com/requirements/multiplayer/).

## Oyunda kullanım

Start Multiplayer → Room 1–5 → isim → Join. İki arkadaş aynı sunucu ve aynı oda
numarasını seçer. Beş kişi doluysa altıncıya anlaşılır hata gösterilir.
ESC/Menu → Multiplayer Settings altında PvP ve yarış davetleri varsayılan açık;
oyuncu isimleri her zaman görünür. Oda sohbeti C tuşuyla veya mobil dokunuşla yazılır.
Arkadaşın yalnızca kendi aracını sürer; başka aracın yan koltuğuna seyirci olabilir.

Yarışta parkur/oyuncuları seç, davet gönder, kabul edin ve başlangıca gidin. Duran
kendi araçlarınızla 25 m içinde olun. Davet sahibi Start race der; 3 saniyelik sayım,
sıralı kontrol noktaları ve sonuçlar sunucu tarafından doğrulanır. İlk üç ödül
500/250/100 dolar olarak korunur; ayrılan oyuncu DNF olur ve kalanlar devam eder.

PvP için sunucu izni ve her iki oyuncunun açık tercihi gerekir. Can, mermi, doldurma,
vuruş, ölüm ve yeniden doğma sunucuda kontrol edilir. NPC öldürme ödülü 50 dolar;
hayatta kalan NPC'ler kaçar. Ayasofya yanında 3 saniyede yeniden doğma ve 5 saniye
koruma korunur. Oda değişimi/restart sırasında eski ateş/alışveriş/ödül paketleri
yeniden gönderilmez.

## Bağlantı ve kayıt davranışı

İlk bağlantıda /health ile ücretsiz sunucu uyandırılır. 10 saniyelik HTTP denemeleri,
12 saniyelik WebSocket el sıkışma sınırı, 1–8 saniyelik artan ve rastgele gecikmeli
tekrar deneme vardır. İlk girişte toplam 150 saniye sonra timeout gösterilir.
Bekleme sırasında Cancel · Continue solo kullanılabilir. Bağlıyken kesinti olursa
otomatik tekrar bağlanır; oyuncu güvenli başlangıca alınır, geçersiz yolcu koltuğu,
yarış ve uzak oyuncu kayıtları temizlenir. Menü açıksa yeniden bağlanma menüyü kapatmaz.

Online banka **RAM'de geçicidir**: aynı çalışan süreçte kısa kesinti sırasında
oturum anahtarıyla devam edilir; 6 saat kullanılmayan anonim oturum sona erer.
Sunucu kapanması, uyku, redeploy veya restart bütün online para/araç/boya/plaka/ev/
görev kayıtlarını sıfırlar. İlk bakiye 100 dolardır. Gerçek kalıcı, ücretsiz ve
güvenilir depolama bu kurulumda sağlanmadı; kalıcıymış gibi gösterilmez.

Solo kayıt tarayıcıda ayrı tutulur, online para içeri aktarılmaz ve solo dosyalar
üzerine yazılmaz. Sunucu URL'si boşsa korunmuş PeerJS birlikte keşif bağlantısı
kullanılabilir; güvenli yarış ve PvP için bu bağımsız sunucu gerekir. URL verilmiş
ama sunucu ulaşılamıyorsa sessizce PeerJS'e düşülmez. Solo, oyun dosyaları yüklüyken
multiplayer veya SDK bağlantısı gerektirmez; ilk indirmeden önce internetten dosya
yükleme zorunluluğunu kaldıran bir offline PWA kurulmadı.

## Güvenlik ve ağ yükü

- Exact CORS/WS Origin ve Render HTTPS/WSS; güvenli rastgele anonim token, sunucuda hash.
- 1 KiB HTTP, 8 KiB WebSocket gelen paket sınırı; JSON tür/alan/sayı doğrulaması.
- IP başına 120 session ve upgrade/dakika; oyuncu başına 60 burst / saniyede 35
  komut token'ı; 50 eşzamanlı socket üst sınırı, 5 saniyelik doğrulanmamış giriş süresi.
- 10 saniyelik ping/pong, bağlantısı kopanların temizliği; boş odalar silinir.
- Oda izolasyonu; kimlik bağlantıdan alınır, sahte para/can/hasar/sonuç alanları reddedilir.
- Hareket bütçesi, hız sınırı, harita/kıyı/duvar/konum ve araç sahipliği kontrolü.
  Raporlanan sürat yerine doğrulanan yer değiştirme sürati ödüllere girer.
- Tam fizik simülasyonu veya profesyonel anti-cheat değildir. Anonim kimlikler kullanıcı
  hesabı/kurtarma sistemi değildir. Tarayıcı token'ı silinirse online kimlik kaybolur.
- Yakın oyuncular 12.5 Hz'e kadar; uzaktakiler en fazla 4 Hz. Değişmeyen uzak oyuncu
  paketleri bir saniye boyunca tekrar edilmez. Duran istemci hareketi 2 Hz;
  arka plandaki istemci en fazla 2 Hz. Mevcut interpolation korunur.
- NPC konumları yakında önceliklidir; ölüm/oda olayları korunur. Model dosyaları veya
  ses ağ paketlerinde gönderilmez; grafik/çizim mesafesi bu işlemde düşürülmedi.

## Ücretsiz plan sınırları

Render Free kesintisiz üretim hizmeti garantisi vermez. 15 dakika gelen trafik
olmazsa uyur; yeniden açılış yaklaşık bir dakika sürer. Free Web Service 0.1 CPU /
512 MB'dır; yatay ölçekleme ve kalıcı disk yoktur. Çalışma alanı ayda 750 ücretsiz
instance saati paylaşır. Bant genişliği ve build kullanımına ayrıca kota uygulanır.
Kota aşılırsa ödeme yöntemi olmayan hesapta servis/build durabilir; ödeme yöntemi
olan hesapta ek kullanım ücretlenebilir. Harcama sınırlarını kontrol et; ücretli
plana geçiş, kart ekleme veya ücretsiz sunucuyu yapay olarak açık tutma yapılmadı.
Free Postgres'in 30 günlük süresi gerçek kalıcı çözüm diye sunulmadı.
[Render Free](https://render.com/docs/free), [plan kaynakları](https://render.com/docs/blueprint-spec),
[WebSocket ve tekrar bağlanma](https://render.com/docs/websocket).

25 oyuncunun sürekli hareketi aylık trafik kotasını hızlı tüketebilir. Yerel kısa
yük testinin geçmesi Render'da bütün gün 25 kişi sorunsuz/limitsiz oynar anlamına
gelmez. Ölçümler ve gerçekten yapılan/yapılmayan kontroller TEST-RAPORU dosyasındadır.

## Yerel çalıştırma ve güncelleme

Node 22+ ile sunucu kökünde `npm ci --ignore-scripts`, `npm test`, `npm start`.
Yerelde HTTP/WS yalnızca loopback origin'lerine izin verir. .env.example'ı .env
olarak kopyalayıp `node --env-file=.env server/index.mjs` kullanabilirsin.
Sunucu /health verir; varsayılan port 8787. Frontend ayrı statik sunucuda çalışır;
oyunun Multiplayer URL alanına `http://127.0.0.1:8787` yerel test adresi yazılabilir.

Kaynak değişikliklerini GitHub'a gönder ve Render'da Deploy latest commit çalıştır.
Protokol güncellemelerinde frontend ve backend birlikte yayınlanmalıdır. Bu sürüm
native 7 / PeerJS 6 kullanır. ZIP paketlerinde özel .env, token dosyası, hesap verisi,
node_modules veya yedek yoktur. Kaynak yedeği yalnızca bilgisayarda ayrı tutulur.
