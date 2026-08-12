/**
 * English translations.
 *
 * Keys are the Turkish source strings exactly as they appear in the code —
 * including punctuation, curly quotes and the `…` character. A mismatched key
 * does not throw; it falls back to Turkish, so `npm run i18n:kontrol` is what
 * catches drift.
 *
 * Placeholders like `{n}` survive translation and may be reordered; English and
 * Turkish do not agree on word order.
 */
import { ekle } from './i18n.js'

ekle({
  // ── Genel ───────────────────────────────────────────────────────────
  'Yedek': 'Backup',
  'Yedek al': 'Take a backup',
  'Yedek alınıyor…': 'Backing up…',
  '{db} yedeğini al ve indir': 'Back up {db} and download it',
  'Kaydet': 'Save',
  'Kaydet (⌘S)': 'Save (⌘S)',
  'Kaydediliyor…': 'Saving…',
  'Ekle': 'Add',
  'Yeni ad': 'New name',
  'Ad': 'Name',
  'Yenile': 'Refresh',
  'Panoya kopyala': 'Copy to clipboard',
  'Temizle': 'Clear',
  'Boyut': 'Size',
  'Sayaçlar son istatistik sıfırlamasından beri geçerlidir. Yeni eklenmiş bir indeks de burada görünebilir — silmeden önce bunu göz önünde bulundurun.':
    'The counters are since the last statistics reset. A freshly added index can show up here too — bear that in mind before dropping one.',
  'Yükleniyor…': 'Loading…',
  'Hesaplanıyor…': 'Calculating…',
  'Çalışıyor…': 'Running…',
  'Başlatılıyor…': 'Starting…',
  'Kapat': 'Close',
  'Vazgeç': 'Cancel',
  'İptal': 'Cancelled',
  'Sil': 'Delete',
  'Düzenle': 'Edit',
  'Aç': 'Open',
  'Önizle': 'Preview',
  'Yeniden adlandır': 'Rename',
  'Yeniden başlat': 'Restart',
  'Başlat': 'Start',
  'Varsayılan': 'Default',
  'Ayarlar': 'Settings',
  'evet': 'yes',
  'hayır': 'no',
  'bilinmiyor': 'unknown',
  'en az': 'at least',
  'Tür': 'Type',
  'Tanım': 'Definition',
  'Süre': 'Duration',
  'Çağrı': 'Calls',
  'Değiştirilme': 'Modified',
  'Yukarı taşı': 'Move up',
  'Aşağı taşı': 'Move down',
  '‹ Önceki': '‹ Previous',
  'Boş olabilir': 'Nullable',
  'geri alınamaz': 'cannot be undone',

  // ── Kabuk / sunucu listesi ──────────────────────────────────────────
  'Köprü': 'Köprü',
  '+ Sunucu': '+ Server',
  'Yeni sunucu': 'New server',
  'Sunucuyu düzenle': 'Edit server',
  'Henüz sunucu eklenmedi.': 'No servers yet.',
  'Bağlan': 'Connect',
  'Kes': 'Disconnect',
  'Bağlı': 'Connected',
  'Bağlanıyor…': 'Connecting…',
  'Bağlı değil': 'Not connected',
  'Yeniden bağlanıyor…': 'Reconnecting…',
  'Hata': 'Error',
  '({n}. deneme)': '(attempt {n})',
  'Soldan bir sunucu seçip bağlanın.': 'Pick a server on the left and connect.',
  '“{ad}” profilini silmek istediğinize emin misiniz?':
    'Delete the profile “{ad}”? This cannot be undone.',
  'Güvenlik uyarısı:': 'Security warning:',
  '{sunucu} sunucusunun kimliği değişti; bağlantı reddedildi. Kayıtlı:':
    'The identity of {sunucu} changed; the connection was refused. Pinned:',

  // ── Sunucu formu ────────────────────────────────────────────────────
  'Üretim sunucusu': 'Production server',
  'Kullanıcı adı': 'Username',
  'Kullanıcı': 'User',
  'Kimlik doğrulama': 'Authentication',
  'Anahtar dosyası': 'Key file',
  'Anahtar dosyası yolu': 'Private key path',
  'Anahtar parolası': 'Key passphrase',
  '(kayıtlı — boş bırakırsanız korunur)': '(saved — leave blank to keep it)',
  'Uygulama açılınca otomatik bağlan': 'Connect automatically on launch',
  'Bu sunucuda PostgreSQL paneli açık': 'Enable the PostgreSQL panel for this server',
  'Adres sunucunun kendi bakışıyla girilir. Tünel SSH üzerinden kurulur; bilgisayarınızda hiçbir port açılmaz.':
    'The address is written from the server’s own point of view. The tunnel runs over SSH; no port is opened on your machine.',
  'Veritabanı': 'Database',
  'Sorgu zaman aşımı (saniye)': 'Statement timeout (seconds)',

  // ── Sekmeler ────────────────────────────────────────────────────────
  'Dosyalar': 'Files',
  'İzleme': 'Monitor',

  // ── İzleme ──────────────────────────────────────────────────────────
  'bağlantı yok — veri bekleniyor': 'no connection — waiting for data',
  '{cekirdek} çekirdek · {oturum} oturum': '{cekirdek} cores · {oturum} sessions',
  'yük {n}': 'load {n}',
  'Bellek': 'Memory',
  '{boyut} boş': '{boyut} free',
  'SSH oturumu': 'SSH sessions',
  'Tekil IP ({dk} dk)': 'Unique IPs ({dk} min)',
  'log penceresi yetmedi': 'log window too short',
  '{n} konteyner sağlıksız': '{n} containers unhealthy',
  'çalışan / toplam': 'running / total',
  '{n} yavaş sorgu': '{n} slow queries',
  'bağlantı': 'connections',
  'Bağlantı': 'Connection',
  'CPU kullanımı (son 15 dk)': 'CPU usage (last 15 min)',
  'Bellek kullanımı (son 15 dk)': 'Memory usage (last 15 min)',
  'Yük ortalaması (1 dk)': 'Load average (1 min)',
  'Yük': 'Load',
  'İzleme ayarları — {ad}': 'Monitor settings — {ad}',
  'Ölçüm aralığı (saniye)': 'Sample interval (seconds)',
  'Eşikler': 'Thresholds',
  'Çekirdek başı yük': 'Load per core',
  'İzlenecek servisler ({n} seçili)': 'Watched services ({n} selected)',
  'İzlenecek servis seçilmedi. Ayarlar’dan ekleyin.':
    'No services selected. Add them from Settings.',
  'Servis bulunamadı.': 'No services found.',
  '{unit} servisi yeniden başlatılacak.\n\nDevam edilsin mi?':
    'Service {unit} will be restarted.\n\nContinue?',
  'Erişim logu yolu — boş bırakılırsa ölçülmez':
    'Access log path — left blank, nothing is measured',
  'nginx (isteğe bağlı)': 'nginx (optional)',
  'PostgreSQL bağlantı sayısını ölç (sunucuda parolasız psql erişimi gerekir)':
    'Count PostgreSQL connections (requires password-less psql on the server)',
  'Değişiklikler bağlantı yeniden kurulduğunda ya da yeniden bağlandığınızda geçerli olur.':
    'Changes take effect when the metric chain restarts or you reconnect.',

  // ── Terminal ────────────────────────────────────────────────────────
  '+ Yeni terminal': '+ New terminal',
  'Sekmeyi kapat': 'Close tab',
  'Başlamak için “Yeni terminal” deyin.': 'Say “New terminal” to begin.',
  'Terminal açmak için önce bir sunucuya bağlanın.':
    'Connect to a server before opening a terminal.',
  'Oturum kapandı.': 'Session closed.',
  'Bağlantı yenilendi — bu sekmede yeni bir oturum açıldı.':
    'Connection restored — a fresh session was attached to this tab.',
  'Terminal seçimi': 'Terminal selection',
  'Seçili {n} karakter Claude bağlamına eklensin mi?\n\n{onizleme}…':
    'Add the selected {n} characters to the Claude context?\n\n{onizleme}…',

  // ── Dosyalar ────────────────────────────────────────────────────────
  '+ Klasör': '+ Folder',
  'Kısayollar': 'Shortcuts',
  'Kısayol adı': 'Shortcut name',
  'Kısayol olarak ekle': 'Add as shortcut',
  'Kısayolu kaldır': 'Remove shortcut',
  'Bu klasörü ekle: {yol}': 'Add this folder: {yol}',
  'Bu klasör zaten kısayollarda.': 'That folder is already a shortcut.',
  '“{ad}” kısayolu kaldırılacak.\n\nKlasörün kendisi silinmez.':
    'The shortcut “{ad}” will be removed.\n\nThe folder itself is not deleted.',
  'Son klasörler': 'Recent folders',
  'Bu klasör boş.': 'This folder is empty.',
  'Gizlileri göster': 'Show hidden',
  'Gizlileri sakla': 'Hide hidden',
  '{n} öğe': '{n} items',
  '{ad} kalıcı olarak silinecek. Emin misiniz?\n\nBu işlem geri alınamaz.':
    '{ad} will be permanently deleted. Are you sure?\n\nThis cannot be undone.',
  'Arşiv adı': 'Archive name',
  'Sıkıştır': 'Compress',
  'Sıkıştır…': 'Compress…',
  'Buraya çıkart': 'Extract here',
  'Terminalde aç': 'Open in terminal',
  'İzinler': 'Permissions',
  'İzinler…': 'Permissions…',
  'İzinler — {ad}': 'Permissions — {ad}',
  'Alt klasör ve dosyalara da uygula': 'Apply to sub-folders and files too',
  'Aktarımlar': 'Transfers',
  '({n} etkin)': '({n} active)',
  'Dosyanın son 256 KB’ı gösteriliyor.': 'Showing the last 256 KB of the file.',
  'Son {n} satır gösteriliyor.': 'Showing the last {n} lines.',
  'İkili dosya, önizlenemiyor ({boyut}).': 'Binary file, cannot preview ({boyut}).',
  'Önizleme için çok büyük ({boyut}).': 'Too large to preview ({boyut}).',
  'Klasör — {n} öğe.': 'Folder — {n} items.',
  'Kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?':
    'There are unsaved changes. Close anyway?',
  'Bu dosya siz açtıktan sonra sunucuda değişti ':
    'This file changed on the server after you opened it ',
  'Bu dosyaya yazma izniniz yok.\n\nYönetici (sudo) olarak kaydedilsin mi?':
    'You do not have write permission for this file.\n\nSave as administrator (sudo)?',
  'İndirme klasörünü seçin': 'Choose a download folder',

  // ── Docker ──────────────────────────────────────────────────────────
  'Docker kullanılamıyor': 'Docker is unavailable',
  'Canlı takip': 'Follow live',
  'Canlı satır': 'live lines',
  'Görünen satırlarda filtrele…': 'Filter visible lines…',
  '{n} satır': '{n} lines',
  '{a} / {b} satır eşleşti': '{a} of {b} lines matched',
  'Değişikliği uygula': 'Apply changes',
  'down + up: dosyadaki değişikliklerin tamamı uygulanır':
    'down + up: every change in the file is applied',
  'Compose dosyasını düzenlemek için Dosyalar sekmesinden yukarıdaki yolu açın, sonra “Değişikliği uygula” deyin.':
    'To edit the compose file, open the path above from the Files tab, then choose “Apply changes”.',
  'Görüntü': 'Image',
  'Görüntüleri temizle': 'Prune images',
  'Durmuş konteynerleri temizle': 'Prune stopped containers',
  'Ağları temizle': 'Prune networks',
  'Derleme önbelleğini temizle': 'Prune build cache',
  'Kullanılmayan görüntüler': 'Unused images',
  'Durmuş konteynerler': 'Stopped containers',
  'Bağlı olmayan volume’ler': 'Dangling volumes',
  'Kullanılmayan ağlar': 'Unused networks',
  'Derleme önbelleği': 'Build cache',
  '{tur} silinecek': '{tur} will be deleted',
  'Geri kazanılacak alan:': 'Space to reclaim:',
  'Silinecek bir şey yok.': 'Nothing to delete.',
  '{boyut} geri kazanıldı.': 'Reclaimed {boyut}.',
  'Geri kazanılabilir': 'Reclaimable',
  'başlatılacak': 'started',
  'durdurulacak': 'stopped',
  'yeniden başlatılacak': 'restarted',
  'durdurulup kaldırılacak': 'stopped and removed',
  'durdurulup yeniden oluşturulacak': 'stopped and recreated',

  // ── PostgreSQL ──────────────────────────────────────────────────────
  'Şema': 'Schema',
  'Şema bulunamadı.': 'No schemas found.',
  'Soldan bir tablo seçin.': 'Pick a table on the left.',
  'Sağlık': 'Health',
  'İndeks': 'Index',
  'İndeksler': 'Indexes',
  'Hiç kullanılmayan indeksler': 'Never-used indexes',
  'Şişkin tablolar': 'Bloated tables',
  'Kayda değer şişkinlik yok.': 'No meaningful bloat.',
  'Ölü satır': 'Dead rows',
  'En yavaş sorgular': 'Slowest queries',
  'kilit / G-Ç beklemesi': 'lock / I-O wait',
  'Başka oturum yok.': 'No other sessions.',
  'Veriyi göster': 'Show data',
  '~{n} satır (planlayıcı tahmini)': '~{n} rows (planner estimate)',
  '{n} satır (tahmini) · {boyut}': '{n} rows (estimated) · {boyut}',
  '{n} satır · {ms} ms': '{n} rows · {ms} ms',
  '— filtre yalnızca bu sayfadaki satırlara uygulanır':
    '— the filter applies only to the rows on this page',
  'Çalıştır (⌘⏎)': 'Run (⌘⏎)',
  'EXPLAIN ANALYZE çıktısı': 'EXPLAIN ANALYZE output',
  'Salt-okunur mod açık; PostgreSQL bu ifadeyi reddetti. Yazmak için üstteki anahtarı açın.':
    'Read-only mode is on and PostgreSQL refused this statement. Flip the switch above to write.',
  'Yazma modu açılacak. Bu modda sorgularınız veriyi kalıcı olarak değiştirebilir.\n\nDevam edilsin mi?':
    'Write mode will be enabled. In this mode your queries can change data permanently.\n\nContinue?',
  'Bu sorgu veri kaybettirebilir': 'This query can lose data',
  'Sorgu incelenemedi. Ne yapacağı doğrulanamadığı için onayınız isteniyor.':
    'The query could not be parsed. You are being asked to confirm because what it does cannot be verified.',
  'Etkilenecek satır:': 'Rows affected:',
  '(planlayıcı tahmini, kesin sayı değil)': '(planner estimate, not an exact count)',
  'Anladım, çalıştır': 'I understand, run it',
  'Nesne siliniyor — yapı ve içindeki tüm veri gider.':
    'An object is being dropped — the structure and all data in it go with it.',
  'Tablo boşaltılıyor — geri alınamaz, tetikleyiciler çalışmaz.':
    'A table is being truncated — irreversible, and triggers do not fire.',
  'Koşulsuz silme — tablodaki TÜM satırlar gider.':
    'Unfiltered delete — EVERY row in the table goes.',
  'Koşulsuz güncelleme — tablodaki TÜM satırlar değişir.':
    'Unfiltered update — EVERY row in the table changes.',
  'Yapı değişikliği — kolon türü veya kısıtlar değişebilir.':
    'Structural change — column types or constraints may change.',
  'Bu profil için veritabanı bağlantısı yapılandırılmamış.':
    'No database connection is configured for this profile.',
  'Sol taraftan profili Düzenle → PostgreSQL bölümünden açın.':
    'Open it from Edit on the left → the PostgreSQL section.',
  'PostgreSQL kapalı': 'PostgreSQL is off',
  '{db} veritabanının yedeği alınacak (pg_dump -Fc), ardından bilgisayarınıza indirilecek.\n\nBüyük veritabanlarında bu işlem sunucuyu bir süre meşgul eder. Devam edilsin mi?':
    'A backup of {db} will be taken (pg_dump -Fc) and then downloaded to your machine.\n\nOn large databases this keeps the server busy for a while. Continue?',
  'Yedeğin indirileceği klasörü seçin': 'Choose where to save the backup',
  'Geri yükleme bu sürümde': 'Restore is not in this version',
  '{pid} numaralı oturum tamamen sonlandırılacak. Çalışan işlem geri alınır.\n\nDevam edilsin mi?':
    'Session {pid} will be terminated outright. Its running work is rolled back.\n\nContinue?',
  '{pid} numaralı oturumun çalışan sorgusu durdurulacak. Oturum açık kalır.\n\nDevam edilsin mi?':
    'The running query in session {pid} will be cancelled. The session stays open.\n\nContinue?',

  // ── Bağlam köprüsü ──────────────────────────────────────────────────
  // Maskeleme türleri — `src/shared/redact.ts` içindeki `kind` alanları.
  // Ortak kodda TÜRKÇE bırakılıp gösterim yerinde çevriliyor: redact.ts hem
  // ana süreçte hem arayüzde çalışıyor ve dil bilgisi taşımamalı.
  'özel anahtar': 'private key',
  'kimlik bilgisi ataması': 'credential assignment',
  'bağlantı dizesindeki parola': 'password in connection string',
  'yetkilendirme başlığı': 'authorization header',
  'AWS anahtarı': 'AWS key',
  'Anthropic/OpenAI anahtarı': 'Anthropic/OpenAI key',
  'komut satırı parolası': 'command-line password',
  'gizli dosya': 'secret file',
  '{n} gizlendi': '{n} redacted',
  '{n} kr': '{n} chars',
  'Claude bağlamı ({n})': 'Claude context ({n})',
  'Claude’a gönder': 'Send to Claude',
  '“Claude’a gönder”': '“Send to Claude”',
  'Dosya, log, SQL veya terminal çıktısında': 'On a file, log, SQL or terminal output say',
  'deyin; buraya birikir. Hazır olunca kopyalayıp kendi Claude’unuza yapıştırın.':
    '— it collects here. When you are ready, copy it and paste it into your own Claude.',
  'Çıkarıldı:': 'Redacted:',
  'Sorunuz (isteğe bağlı) — örn. “disk neden doluyor?”':
    'Your question (optional) — e.g. “why is the disk filling up?”',
  'Sunucu özetini de ekle (sistem, çalışma süresi, ölçümler — kimlik bilgisi yok)':
    'Include the server summary (system, uptime, metrics — no credentials)',
  'Kopyalandı — {n} karakter. Claude’a yapıştırabilirsiniz.':
    'Copied — {n} characters. You can paste it into Claude.',
  'Panoya kopyalanamadı.': 'Could not copy to the clipboard.',

  // ── Ayarlar ─────────────────────────────────────────────────────────
  'Dil': 'Language',
  'Ana süreçteki pencereler de bu dili kullanır.':
    'Native dialogs use this language too.',
  'Görünüm': 'Appearance',
  'Sisteme uy': 'Match system',
  'Koyu': 'Dark',
  'Açık': 'Light',
  'Yazı boyutu': 'Font size',
  'Yeni açılan terminal sekmelerinde geçerli olur.': 'Applies to newly opened terminal tabs.',
  'Pencere': 'Window',
  'Yeni pencere aç': 'Open a new window',
  'Oturumlar ana süreçte yaşadığı için ikinci pencere aynı bağlantıları görür. Birini kapatmak oturumları sonlandırmaz.':
    'Sessions live in the main process, so a second window sees the same connections. Closing one does not end them.',
  'Sunucuya özel ayarlar': 'Per-server settings',
  'İzleme aralığı, eşikler ve izlenen servisler her sunucu için ayrıdır — İzleme sekmesindeki Ayarlar düğmesinden değiştirin. PostgreSQL bağlantısı ise profil düzenleme ekranındadır.':
    'Sample interval, thresholds and watched services are per server — change them from the Settings button in the Monitor tab. The PostgreSQL connection lives in the profile editor.',

  // ── Ana süreç: hatalar ve pencereler ────────────────────────────────
  'Profil bulunamadı.': 'Profile not found.',
  'Sunucuya bağlı değilsiniz.': 'Not connected to the server.',
  'Bu profilde PostgreSQL kapalı. Ayarlar’dan açın.':
    'PostgreSQL is disabled for this profile. Enable it in Settings.',
  'Bu profil için kayıtlı parola yok.': 'No password is saved for this profile.',
  'Anahtar dosyası yolu tanımlı değil.': 'No private key path is set.',
  'beklenmeyen dosya yapısı': 'unexpected file structure',
  'Bu sunucuda Docker kurulu değil.': 'Docker is not installed on this server.',
  'Bu sunucuda Docker Compose kurulu değil.': 'Docker Compose is not installed on this server.',
  'Docker servisi çalışmıyor.': 'The Docker service is not running.',
  'Sunucuda pg_dump kurulu değil (postgresql-client paketi gerekiyor).':
    'pg_dump is not installed on the server (the postgresql-client package is required).',
  'pg_stat_statements okunamadı; sürüm uyumsuz olabilir.':
    'pg_stat_statements could not be read; the version may not match.',
  'Bu bir metin dosyası değil; düzenleyicide açılamaz.':
    'This is not a text file; it cannot be opened in the editor.',
  'Sıkıştırılacak öğe seçilmedi.': 'No items selected to compress.',
  'Desteklenmeyen arşiv biçimi. .zip, .tar, .tar.gz, .tar.bz2, .tar.xz açılabilir.':
    'Unsupported archive format. .zip, .tar, .tar.gz, .tar.bz2 and .tar.xz can be extracted.',
  'Özyinelemeli izin değişikliği kabuk üzerinden yapılır.':
    'Recursive permission changes go through the shell.',
  'Klasör yüklemesi henüz desteklenmiyor; önce sıkıştırın.':
    'Folder upload is not supported yet; compress it first.',
  'Klasör indirmesi henüz desteklenmiyor; önce sunucuda sıkıştırın.':
    'Folder download is not supported yet; compress it on the server first.',
  'GÜVENLİK UYARISI — Sunucu kimliği değişti': 'SECURITY WARNING — server identity changed',
  'Yeni sunucu — kimliği doğrulayın': 'New server — verify its identity',
  'Bir proje klasörüne gidip': 'Go to a project folder and say',
  'deyin; bir daha aramanız gerekmez.': '— you will not have to look for it again.',
})
