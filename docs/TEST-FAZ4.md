# Faz 4 — Manuel Test Yönergesi (Docker Paneli)

`npm run dev` → bağlanın → **Docker** sekmesi.

## 1. Docker yoksa / yetki yoksa
Sunucunuzda Docker varsa bu bölümü atlayın. Yoksa panel şunlardan **birini**
göstermeli — boş ekran ya da ham hata **değil**:
- "Bu sunucuda Docker kurulu değil."
- "Docker'a erişim yetkiniz yok" + `sudo usermod -aG docker $USER` komutu
- "Docker servisi çalışmıyor."

Yetki testini yapmak isterseniz: `sudo gpasswd -d $USER docker`, yeniden
bağlanın, mesajı görün, sonra `sudo gpasswd -a $USER docker` ile geri alın.

## 2. Konteyner listesi
1. Ad, görüntü, durum, portlar görünmeli.
2. `docker ps -a` çıktısıyla karşılaştırın — sayı ve adlar aynı olmalı.
3. Çalışanlar yeşil nokta, durmuşlar gri, **unhealthy olanlar kırmızı + ⚠**.
4. Compose ile açılmış konteynerlerde adın yanında proje etiketi görünür.
5. **CPU/Bellek sütunları ilk 1-2 saniye `—` gösterir**, sonra dolar —
   `docker stats` yavaş bir komut, arka planda geliyor.

## 3. İki farklı ölçüm ritmi (kabul kriteri)
1. **İzleme** sekmesine geçin. **Beklenen:** "Docker" kartı, "çalışan / toplam"
   ve sağlıksız konteyner varsa kırmızı uyarı.
2. Bu kart Docker paneli **kapalıyken de** güncellenir (ucuz `docker ps` her turda).
3. **Doğrulama:** sunucuda `top` açık bırakın. Docker panelindeyken 10 saniyede
   bir kısa bir `docker` süreci görünüp kaybolmalı. **İzleme sekmesine geçince
   bu durmalı** — pahalı `docker stats` yalnızca panel açıkken çalışır (ADR 0011).

## 4. Konteyner işlemleri
1. Bir konteynerde **Durdur** → onay diyaloğu → durur, liste güncellenir.
2. **Başlat** → tekrar çalışır.
3. **Yeniden başlat** → onay ister.
4. Yetkisiz bir işlemde Türkçe hata bandı çıkar, sessizce başarısız olmaz.

## 5. Loglar
1. Bir konteynerde **Log** → son 500 satır gelir.
2. Arama kutusuna bir kelime yazın → satırlar süzülür, altta "N / M satır eşleşti".
3. **Canlı takip** anahtarını açın. Konteyner log üretiyorsa yeni satırlar
   akmalı ve ekran otomatik aşağı kaymalı.
   - Test için: `docker exec <ad> sh -c 'for i in 1 2 3 4 5; do echo test-$i; sleep 1; done'`
4. **Kanal sızıntısı testi (kritik):** takibi açıp kapatın, farklı konteynerlere
   geçin, paneli kapatıp açın — bunu 5-6 kez yapın. Sonra sunucuda:
   `ps aux | grep "docker logs"`
   **Beklenen:** açık takip sayısı kadar süreç olmalı (hepsi kapalıysa **hiç**).
   Birikmiş `docker logs -f` süreçleri varsa bu bir sızıntıdır.
5. **Claude'a gönder** pasif, "Faz 6'da gelecek".

## 6. Konteyner içine girme
1. Çalışan bir konteynerde **Kabuk**.
2. **Beklenen:** Terminal sekmesinde konteyner adıyla yeni sekme açılır ve
   içeride kabuk prompt'u gelir.
3. `hostname` yazın → konteyner ID'sini vermeli (sunucunun adını değil).
4. `bash` olan bir görüntüde bash, alpine gibi olmayan bir görüntüde sh açılmalı
   — ikisi de çalışmalı, hata vermemeli.
5. `exit` → sekme kapanır.

## 7. Compose
1. **Compose** sekmesi → `docker compose ls` ile aynı projeler görünmeli.
2. Altta compose dosyasının yolu yazar.
3. **Dosyayı düzenleme akışı:** yolu kopyalayın → **Dosyalar** sekmesi →
   o klasöre gidin → dosyaya çift tık → Monaco'da düzenleyin → ⌘S.
4. Docker sekmesine dönüp **Değişikliği uygula** → onay → `down` + `up -d` çalışır.
   `docker compose ls` ile doğrulayın.
5. **Başlat / Durdur / Yeniden başlat** düğmeleri de onay ister.

## 8. Depolama ve temizlik
1. **Depolama** sekmesi → `docker system df` ile aynı tablo.
2. **Görüntüleri temizle** → kırmızı diyalog açılır.
   **Beklenen — kritik:** silmeden ÖNCE
   - "Geri kazanılacak alan: X GB"
   - silinecek öğelerin listesi
3. Silecek bir şey yoksa "Silinecek bir şey yok" der ve düğme pasif kalır.
4. **Volume'leri temizle** → diyalogda ek kırmızı uyarı:
   "Volume'ler veri tutar… bu işlem geri alınamaz" + volume adları listelenir.
   **Bu uyarıyı görmeden onaylamayın** — gerçekten veri silebilir.
5. Onaylayın → "X MB geri kazanıldı" bildirimi, tablo güncellenir.

## 9. Bağlantı kopunca
1. Canlı log takibi açıkken Wi-Fi'yi kapatın.
2. **Beklenen:** akış durur, uygulama çökmez.
3. Wi-Fi'yi açın, yeniden bağlanın, Docker sekmesine dönün → panel yeniden yüklenir
   (Docker algılaması bağlantı kopunca sıfırlanır, yeniden denenir).
