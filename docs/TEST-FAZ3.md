# Faz 3 — Manuel Test Yönergesi (İzleme Paneli)

`npm run dev` → bağlanın → üstteki **İzleme** sekmesi.

## 1. İlk açılış ve CPU'nun iki örnek kuralı
1. Panel açıldığında kartlar dolmalı.
2. **İlk turda CPU kartı `—` gösterir**, ikinci turda (5 sn sonra) yüzdeye döner.
   Bu beklenen davranıştır: `/proc/stat` kümülatif sayaç, tek okumadan yüzde
   çıkmaz. `%0` gösterseydi boşta bir sunucu gibi görünürdü — yalan olurdu.
3. Sağ üstte "N çekirdek · M oturum" yazar.

## 2. Ölçümlerin doğruluğu (terminalle karşılaştırın)
Terminal sekmesinden çalıştırıp panelle karşılaştırın:
- `free -h` → Bellek kartı. **Not:** panel `available` üzerinden hesaplar,
  `used` üzerinden değil. `free`'nin "used" sütunu sayfa önbelleğini de sayar;
  bir haftadır açık sağlıklı bir sunucu %95 "dolu" görünür. Panel gerçek
  bellek baskısını gösterir, bu yüzden `free`'nin used değerinden **düşük**
  çıkması normaldir.
- `uptime` → yük değeri kartla aynı olmalı.
- `df -h` → Disk kartı (en büyük bölüm) ve birden fazla disk varsa alttaki liste.
- `who` → SSH oturumu sayısı.

## 3. Grafikler
1. 15 dakika boyunca üç grafik dolmalı (CPU, Bellek, Yük).
2. **Yapay yük:** terminalden `yes > /dev/null &` çalıştırın (bir çekirdeği doldurur).
   Birkaç tur içinde CPU grafiği yükselmeli. Durdurmak için `kill %1`.
3. **Geçmiş main'de tutuluyor testi:** Dosyalar sekmesine geçip İzleme'ye dönün.
   **Beklenen:** grafik sıfırlanmaz, geçmiş yerinde durur.

## 4. Servisler
1. **Ayarlar** → "İzlenecek servisler" listesi sunucudan gelir (systemd birimleri).
2. Arama kutusuna `ssh` yazıp `ssh` veya `sshd` seçin, birkaç servis daha ekleyin.
   **Kaydet**.
3. **Yeni ayarlar bağlantı yenilenince geçerli olur** — profili Kes + Bağlan yapın.
4. **Beklenen:** servis listesi görünür, çalışanlar yeşil nokta, durmuşlar kırmızı.
5. Bir servisin **Yeniden başlat** düğmesi → onay diyaloğu → onaylayın.
   - Yetkiniz yoksa: "yetki yok. Sunucuda sudo kuralı gerekiyor." (sessiz başarısızlık yok)
   - Yetkiniz varsa: servis yeniden başlar, `systemctl status <birim>` ile doğrulayın.

## 5. Eşik bildirimleri (kabul kriteri)
En kolay test disk eşiğini geçici olarak düşürmek:
1. **Ayarlar** → Disk eşiğini mevcut doluluk oranınızın **altına** çekin
   (örn. diskiniz %42 doluysa 40 yazın) → Kaydet → Kes + Bağlan.
2. **Beklenen:** birkaç saniye içinde **macOS bildirimi**:
   "<sunucu adı> — disk doluyor / <bölüm> %42 dolu."
3. **Tekrar etmeme testi (kritik):** 2–3 dakika bekleyin.
   **Beklenen:** bildirim **bir kez** geldi, 5 saniyede bir tekrarlamadı.
   (Histerezis: yeniden tetiklenmesi için değerin eşiğin 5 puan altına düşmesi
   ya da 15 dk geçmesi gerekir — ADR 0010.)
4. Eşiği eski değerine geri alın.

## 6. Bağlantı kopunca donmama (kabul kriteri)
1. Panel açıkken **Wi-Fi'yi kapatın**.
2. **Beklenen:** üstte sarı **"bağlantı yok — veri bekleniyor"** rozeti belirir.
   Panel donmaz, çökmez. Grafikler kopukluk gösterir — düz çizgiyle
   **doldurulmaz** (olmayan veri uydurulmaz).
3. Wi-Fi'yi açın. Yeniden bağlanınca rozet kaybolur, ölçüm kaldığı yerden sürer.

## 7. nginx tekil IP (sunucunuzda nginx varsa)
1. **Ayarlar** → Erişim logu yolu: `/var/log/nginx/access.log` → Kaydet → yeniden bağlanın.
2. **Beklenen:** "Tekil IP (5 dk)" kartı gelir.
3. Çok yoğun trafikte kart **"en az N"** ve altında "log penceresi yetmedi" yazabilir —
   bu, taranan 20.000 satırın 5 dakikayı kapsamadığı anlamına gelir. Uydurma
   sayı vermek yerine bunu açıkça söylüyor.
4. Log yolunu boşaltırsanız kart kaybolur (ölçüm yapılmaz).

## 8. PostgreSQL (sunucunuzda varsa)
1. **Ayarlar** → "PostgreSQL bağlantı sayısını ölç" işaretleyin → yeniden bağlanın.
2. Sunucuda parolasız `psql` erişiminiz varsa kart gelir; yoksa **kart hiç
   görünmez** — hata kusmaz. (Gerçek PostgreSQL paneli Faz 5'te tünelle geliyor.)

## 9. Eski profil uyumluluğu
`cat "$HOME/Library/Application Support/kopru/profiles.json"`
1. Faz 1'de oluşturduğunuz profilde `monitor` alanı **yoktu**.
2. **Beklenen:** profil sorunsuz açıldı ve çalıştı; varsayılanlarla dolduruldu.
3. Ayarları bir kez kaydettikten sonra dosyada `monitor` bloğu görünür.
