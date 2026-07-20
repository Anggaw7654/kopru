# Faz 6 + 7 — Manuel Test Yönergesi

## Faz 6 — Claude bağlam köprüsü

### 1. Sepete ekleme
Dördü de çalışmalı; her biri ekledikten sonra alttaki **"Claude bağlamı"** çubuğu açılır:
1. **Dosyalar** → bir dosyaya sağ-tık → **Claude'a gönder**
2. **Docker** → bir konteynerde **Log** → **Claude'a gönder**
   (arama kutusuna bir şey yazdıysanız yalnızca süzülmüş satırlar gider — kasıtlı)
3. **PostgreSQL → SQL** → bir sorgu yazın → **Claude'a gönder**
   (EXPLAIN ANALYZE çalıştırdıysanız plan da eklenir; **satır verisi eklenmez**)
4. **Terminal** → biraz çıktı seçin → **sağ-tık** → onay → eklenir

### 2. Maskeleme (kabul kriteri)
1. Sunucuda test dosyası oluşturun:
   ```
   printf 'DB_PASSWORD=gercekparola\nAPI_TOKEN=sk-abc123456789012345678901\nNORMAL=deger\n' > ~/kopru-mask-test.txt
   ```
2. Dosyalar'dan bu dosyaya sağ-tık → Claude'a gönder.
3. Sepette öğeye tıklayıp önizleyin. **Beklenen:**
   - `DB_PASSWORD=«KÖPRÜ: gizlendi»` — **değişken adı duruyor, değeri gitti**
   - `API_TOKEN=«KÖPRÜ: gizlendi»`
   - `NORMAL=deger` — dokunulmamış
   - Öğenin altında sarı yazı: "Çıkarıldı: kimlik bilgisi ataması ×2"
4. Üst çubukta turuncu **"2 gizlendi"** rozeti.

### 3. Gizli dosyaların tamamı tutulur (kritik)
1. Sunucuda `.env` varsa (yoksa `printf 'FOO=bar\nBAZ=qux\n' > ~/.env`) onu gönderin.
2. **Beklenen:** içerik **hiç** gitmez —
   "(bu dosyanın tamamı gizli kabul edildi — N satır gönderilmedi)"
   Satır satır eşleştirseydik `FOO=bar` sızardı; adında PASSWORD geçmiyor.
3. Aynı şey `id_rsa`, `.pgpass`, `.netrc` için de geçerli.
4. Test dosyalarını silin: `rm ~/kopru-mask-test.txt ~/.env`

### 4. Kopyalama
1. Sepette soru kutusuna bir şey yazın (örn. "disk neden doluyor?").
2. **"Sunucu özetini de ekle"** işaretli bırakın.
3. **Panoya kopyala** → "Kopyalandı — N karakter".
4. Bir metin editörüne yapıştırıp **doğrulayın:**
   - Başta sorunuz
   - `## Sunucu` bölümü: profil adı, host, işletim sistemi, çalışma süresi, ölçümler
   - **Port, kullanıcı adı, anahtar dosyası yolu, DB parolası YOK**
   - Her öğe kod bloğu içinde, üstünde ne çıkarıldığı yazılı
   - En altta: *"Bir değerin görünmemesi, orada bir değer olmadığı anlamına gelmez."*
5. Bu metni kendi Claude'unuza yapıştırın.

### 5. Sepet yönetimi
- Öğeye tıklayınca içerik açılır/kapanır
- **✕** tek öğeyi kaldırır, **Temizle** hepsini
- Çok büyük bir log gönderin (>60.000 karakter) → başı kırpılır, **sonu korunur**
  (hata çıktının sonundadır)

---

## Faz 7 — Cilalama

### 6. Tema
1. Sol üstteki **⚙** → **Görünüm** → **Açık**.
2. **Beklenen:** tüm arayüz açık temaya geçer — **terminal ve Monaco dahil**.
   Terminal siyah kalıyorsa yeni bir sekme açın (mevcut sekmeler yeniden çizilmez).
3. **Koyu** → geri döner.
4. **Sisteme uy** seçin, macOS'ta Görünüm ayarını değiştirin → uygulama takip eder.
5. **Kritik:** **Koyu** seçiliyken macOS'u Açık'a alın → uygulama **koyu kalmalı**.
   Açık bir seçim, sistemin akşam değişmesiyle ezilmemeli.
6. Uygulamayı kapatıp açın → seçiminiz korunur.

### 7. Terminal yazı boyutu
⚙ → Terminal → boyutu değiştirin → **yeni** sekmede geçerli olur (altında yazıyor).

### 8. Sunucular arası geçiş
1. İkinci bir profil ekleyin ve bağlanın.
2. Dosyalar sekmesinde A sunucusunda bir klasöre girin.
3. Soldan B sunucusuna geçin.
4. **Beklenen:** dosya listesi **anında boşalır**, sonra B'nin ana dizini gelir.
   A'nın dosyaları B'nin adı altında bir an bile görünmemeli.
5. İzleme sekmesi B'nin ölçümlerini gösterir, A'nınkileri değil.
6. Terminal sekmeleri hangi sunucuya aitse orada kalır.

### 9. İkinci pencere
1. ⚙ → **Yeni pencere aç**.
2. **Beklenen:** aynı profiller, aynı bağlantı durumları görünür.
3. Bir pencerede bağlantıyı kesin → **diğerinde de** durum değişir (ana süreçten yayın).
4. Bir pencereyi kapatın → **oturumlar ölmez**, diğer pencere çalışmaya devam eder.
   > Sekmeyi sürükleyip koparma **yok**. Yeni pencere kendi sekmelerini açar;
   > mevcut bir sekmeyi pencereler arası taşımak uygulanmadı.

### 10. Paketleme
```
npm run dist
```
1. `release/` altında `.dmg` oluşur (arm64 ve x64).
2. dmg'yi açıp uygulamayı Applications'a sürükleyin, çalıştırın.
3. **Beklenen:** açılır ve çalışır.
4. **Bilinen durum:** uygulama **imzalı/noter onaylı değil**. Bu Mac'te sorunsuz
   çalışır; **başka bir Mac'te** Gatekeeper uyarısı verir (sağ-tık → Aç ile geçilir).
   İmzalamak için Apple Developer ID gerekiyor — ADR 0014'te yazılı.
