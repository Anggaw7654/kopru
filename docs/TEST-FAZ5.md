# Faz 5 — Manuel Test Yönergesi (PostgreSQL Paneli)

Önce profili **Düzenle** → **PostgreSQL** bölümünü açın, veritabanı/kullanıcı/parola girin,
kaydedin. Sonra **PostgreSQL** sekmesi.

## 1. Tünel — hiçbir port açılmıyor (kabul kriteri)
1. Panel açık ve bir tablo listeleniyorken, Mac'te başka bir terminalde:
   `lsof -nP -iTCP -sTCP:LISTEN | grep -i electron`
2. **Beklenen: hiçbir satır yok.** Yerel dinleyen port **yoktur** — kanal doğrudan
   `pg` istemcisine veriliyor (ADR 0012).
3. Ek doğrulama: `netstat -an | grep 5432` → Mac'te 5432 dinleyen bir şey olmamalı.
4. Sunucuda `AllowTcpForwarding no` ise Türkçe bir hata çıkar ve nedenini söyler.

## 2. Şema gezgini
1. Üstteki açılır listede veritabanları ve boyutları görünür.
2. Sol ağaçta şemalar → tablolar. Tabloya tıklayın.
3. Kolonlar (birincil anahtar 🔑), türler, varsayılanlar, indeksler gelir.
4. Satır sayısı **"~N (planlayıcı tahmini)"** yazar — kesin sayı diye sunulmuyor,
   çünkü kesin sayı tam tarama gerektirir.
5. **Tablo değiştirme testi:** A tablosunda "Veriyi göster" deyip 2. sayfaya gidin,
   sonra B tablosuna tıklayın. **Beklenen:** B temiz açılır, A'nın satırları veya
   sayfa numarası kalmaz.

## 3. Veri ızgarası
1. **Veriyi göster** → 100 satır.
2. Kolon başlığına tıklayın → sıralanır, ok yönü değişir.
3. **Sonraki ›** / **‹ Önceki** sayfalama.
4. Filtre kutusu → altta *"filtre yalnızca bu sayfadaki satırlara uygulanır"* uyarısı
   var; bu kasıtlı, sunucu tarafı filtre değil.
5. **Hücreye çift tıklayın. Beklenen: hiçbir şey olmaz** — ızgara tasarım gereği
   salt okunur, veri değişikliği yalnızca SQL sekmesinden yapılır.

## 4. Salt-okunur mod — motor sınırı (kabul kriteri)
1. SQL sekmesi. Anahtar **"Salt okunur"** konumunda olmalı (her açılışta böyle).
2. Şunu çalıştırın: `select now();` → çalışır.
3. Şimdi bir yazma deneyin (mevcut bir tabloya, kendini kendine yazan zararsız bir ifade):
   `update <tablo> set <kolon> = <kolon>;`
4. **Beklenen:** "Salt-okunur mod açık; PostgreSQL bu ifadeyi reddetti."
   Bu mesaj **motordan** geliyor, metin denetiminden değil.
5. **Metin denetiminin yetmeyeceği durum — kritik test:**
   Bir CTE içine gizlenmiş, koşulu asla tutmayan bir silme ifadesi yazın
   (`with x as (... where false returning *) select * from x;` biçiminde).
   Anahtar kelime taraması bunu tehlikeli saymaz.
   **Beklenen: yine de reddedilir** — çünkü sınır işlemin kendisi (ADR 0013).

## 5. Yazma modu ve kırmızı onay
1. Anahtarı **YAZMA MODU**'na alın → önce bir onay diyaloğu çıkar.
2. Anahtar kırmızıya döner.
3. Koşulsuz bir güncelleme yazın (henüz çalıştırmayın):
   `update <tablo> set <kolon> = <kolon>;`
4. **Çalıştır** → **kırmızı diyalog** çıkmalı ve şunları göstermeli:
   - "Koşulsuz güncelleme — tablodaki TÜM satırlar değişir."
   - **"Etkilenecek satır: ~N"** (planlayıcı tahmini olduğu ayrıca yazar)
   - sorgunun kendisi
5. **Vazgeç** → hiçbir şey çalışmaz.
6. Paneli kapatıp açın → anahtar **tekrar salt okunur** olmalı. Yazma modu
   hiçbir zaman hatırlanmaz.

## 6. SQL editörü
1. Monaco SQL renklendirmesi çalışır.
2. **⌘⏎** çalıştırır.
3. Bir bölümü seçip ⌘⏎ → yalnızca seçili kısım çalışır.
4. **EXPLAIN ANALYZE** → plan metni gelir.
5. Salt-okunur modda bir yazma ifadesinde EXPLAIN ANALYZE deneyin →
   "EXPLAIN ANALYZE onu gerçekten çalıştıracağı için salt-okunur modda engellendi."
   (ANALYZE ifadeyi gerçekten çalıştırır — bu yüzden engelleniyor.)
6. **Sorgu geçmişi** açılır listesi dolar, uygulamayı kapatıp açınca kalıcıdır.
7. **Claude ile optimize et** pasif, "Faz 6'da gelecek".

## 7. Sağlık sekmesi
1. Bağlantı/aktif oturum/bekleyen kartları. 5 saniyede bir yenilenir.
2. **Sorgu durdurma testi:** başka bir terminalden sunucuda uzun bir bekleme
   sorgusu başlatın (`select pg_sleep(120);`).
   Sağlık sekmesinde bu oturum görünmeli, süresi artmalı.
3. **Sorguyu durdur** → onay → sorgu iptal olur, oturum açık kalır.
4. **Oturumu kes** → daha sert, ayrı onay metni.
   > Bunun çalışabilmesi havuzun birden fazla bağlantı tutmasına bağlı —
   > takılmış bir sorgu kendi bağlantısından öldürülemez.
5. **pg_stat_statements yoksa:** "En yavaş sorgular" bölümü kurulum talimatı
   gösterir, boş tablo değil.
6. Şişkin tablolar ve kullanılmayan indeksler listelenir; indeks listesinin altında
   "sayaçlar son istatistik sıfırlamasından beri geçerlidir" uyarısı vardır.

## 8. Yedek
1. **Yedek** sekmesi → onay → klasör seçici.
2. **Beklenen:** sunucuda `pg_dump -Fc` çalışır, dosya SFTP kuyruğuna düşer,
   ilerleme çubuğu görünür.
3. İndirilen dosyayı doğrulayın: `file ~/indirilen.dump` →
   "PostgreSQL custom database dump" demeli.
4. Sunucuda `/tmp` altında geçici dump dosyası kalmış olabilir; bu bilinçli
   (indirme bitmeden silinemez). İsterseniz elle temizleyin.
5. **Geri yükleme yok** — sekmede bu açıkça yazıyor.

## 9. Hata mesajları
Her biri Türkçe ve çözüm önerili olmalı:
- Yanlış parola → "PostgreSQL kimlik doğrulaması başarısız (kullanıcı: X)."
- pg_hba engeli → "...pg_hba.conf kuralı yok..."
- Servis kapalı → "...adresinde yanıt vermiyor. Servis çalışıyor mu?"
  (sunucuda postgresql servisini geçici durdurup geri başlatarak deneyebilirsiniz)

## 10. Bağlantı kopunca
1. Panel açıkken Wi-Fi'yi kapatın.
2. Yeniden bağlanın, PostgreSQL sekmesine dönün.
3. **Beklenen:** yeni tünel açılır, panel çalışır (eski istemciler bağlantıyla
   birlikte kapatılıp unutulur).
