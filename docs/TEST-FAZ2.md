# Faz 2 — Manuel Test Yönergesi (Dosya Yöneticisi)

`npm run dev` → bağlanın → üstteki **Dosyalar** sekmesi.

## 1. Gezinme
1. Açılışta ana dizininizde (`/home/<kullanıcı>`) olmalısınız.
2. Breadcrumb'da bir segmente tıklayın → oraya gider.
3. **↑** üst klasöre çıkar. Klasöre çift tık içine girer.
4. **Gizlileri göster** → `.bashrc`, `.ssh` görünür.
5. Sağdaki **☆** ile bir klasörü favorilere ekleyin → sol panelde belirir.
   Uygulamayı kapatıp açın, favori duruyor olmalı.

## 2. Önizleme (boşluk tuşu)
1. Bir metin dosyası seçip **boşluk** tuşuna basın → içerik açılır.
2. Bir `.png`/`.jpg` seçip boşluk → resim ölçeklenmiş görünür.
3. **Büyük bir log deneyin:** `/var/log/nginx/access.log` veya `/var/log/syslog`.
   **Beklenen:** anında açılır, üstte "Son N satır gösteriliyor" ya da
   "Dosyanın son 256 KB'ı gösteriliyor" yazar. Dosya kaç GB olursa olsun
   bekleme olmamalı — tüm dosya indirilmiyor, sondan okunuyor.
4. Bir ikili dosya (`/bin/ls`) → "İkili dosya, önizlenemiyor".

## 3. Düzenleme + çakışma kontrolü (kabul kriteri)
1. Yazma izniniz olan bir dosyaya çift tık → Monaco açılır (ilk açılış ~1 sn,
   sonrakiler anında).
2. Bir şey yazın, başlıkta **•** belirir. **⌘S** → "Kaydedildi — GG.AA.YYYY SS:DD:SS".
3. **Çakışma testi:** dosya açıkken, Terminal sekmesinden aynı dosyaya
   `echo "dışarıdan" >> dosya` yazın. Monaco'ya dönüp **⌘S**.
   **Beklenen:** "Bu dosya siz açtıktan sonra sunucuda değişti (tarih)…
   Devam edilsin mi?" uyarısı. **İptal** derseniz kaydedilmez.

## 4. Sudo ile kaydetme
1. `/etc/hosts` gibi root'a ait bir dosyayı çift tık ile açın.
   **Beklenen:** başlıkta sarı **"yazma izni yok — sudo gerekir"** rozeti.
2. Bir satır ekleyip **⌘S**. **Beklenen:** "Yazma izniniz yok. Yönetici (sudo)
   olarak kaydedilsin mi?" → Evet → **macOS parola diyaloğu** çıkar.
3. Parolayı girin. **Beklenen:** kaydedilir.
4. **Kritik doğrulama** — terminalden: `ls -l /etc/hosts`
   **Beklenen:** sahibi hâlâ `root root`, izinleri hâlâ `-rw-r--r--`.
   Sahip sizin kullanıcınıza dönmüşse bu bir hatadır (ADR 0008).
5. `ls -la /tmp | grep kopru` → **hiçbir şey çıkmamalı** (geçici dosya silindi).
6. Tekrar kaydedin → parola **yeniden** sorulmalı (bellekte tutulmuyor).

## 5. Transferler
1. **Yükleme:** Finder'dan bir dosyayı sürükleyip dosya listesine bırakın.
   **Beklenen:** altta ilerleme çubuğu, bitince liste kendiliğinden yenilenir.
2. **İndirme:** sağ-tık → **Mac'e indir** → klasör seçici → kuyruğa düşer.
3. **İptal:** büyük bir dosya indirirken **İptal**. Durum "İptal edildi" olur.
4. **Bitenleri temizle** kuyruğu boşaltır.
5. Bir klasörü sürüklemeyi deneyin → "Klasör yüklemesi henüz desteklenmiyor;
   önce sıkıştırın." (bilinen sınır, sessizce atlamıyor).

## 6. Sağ-tık işlemleri
Bir test klasöründe (`mkdir ~/kopru-test`) sırayla:
1. **Yeniden adlandır** → ad değişir.
2. **İzinler…** → onay kutusu matrisi, altta sekizlik değer canlı güncellenir.
   Bir klasörde "Alt klasör ve dosyalara da uygula" seçeneği çıkar.
   Uygula → listede izin sütunu değişir.
3. **Sıkıştır…** → `ad.tar.gz` oluşur. Terminalden `tar -tzf ad.tar.gz`
   **Beklenen:** içeride mutlak yol (`home/kullanici/...`) **yok**, sadece göreli adlar.
4. Arşive sağ-tık → **Buraya çıkart**.
5. **Terminalde aç** → Terminal sekmesinde o klasörde yeni sekme açılır.
6. **Sil** → onay diyaloğu → siler. Birden fazla seçiliyse "N öğe" der.
7. **Claude'a sor** pasif ve "Faz 6'da gelecek" ipucu veriyor.

## 7. Tuhaf dosya adları (güvenlik)
Terminalden oluşturun:
```
touch ~/kopru-test/'tuhaf; echo SIZINTI > /tmp/kanit.txt'
touch ~/kopru-test/"boşluklu ad.txt"
```
Dosya yöneticisinden birincisini **silin**, ikincisini **yeniden adlandırın**.
Sonra: `ls /tmp/kanit.txt`
**Beklenen:** "No such file" — dosya adındaki komut çalışmadı (shellQuote).

## 8. Bağlantı kopunca
1. Dosya listesi açıkken Wi-Fi'yi kapatın, bir klasöre girmeye çalışın.
   **Beklenen:** Türkçe hata bandı çıkar, **liste ekranda kalır** (yerinizi kaybetmezsiniz).
2. Wi-Fi'yi açın, yeniden bağlanınca **Yenile** → liste gelir (SFTP kanalları
   otomatik yeniden açılır).
