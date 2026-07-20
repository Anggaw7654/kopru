# Faz 1 — Manuel Test Yönergesi

Başlat: `cd ~/PycharmProjects/kopru && npm run dev`

## 1. Profil oluşturma ve gizli bilgi saklama
1. Sol üstten **+ Sunucu**.
2. Ad / adres / port / kullanıcı adı girin, **Anahtar dosyası** seçin, tam yol yazın
   (ör. `/Users/<siz>/.ssh/id_ed25519`). **Kaydet**.
3. Terminalde çalıştırın:
   `cat "$HOME/Library/Application Support/kopru/profiles.json"`
   **Beklenen:** parola/passphrase alanları ya yok ya da `encryptedPassphrase`
   adı altında okunamaz base64. Düz metin parola görürseniz bu bir hatadır.
4. Aynı profili **Düzenle**'yin. **Beklenen:** parola alanı boş ama yanında
   "(kayıtlı — boş bırakırsanız korunur)" yazıyor.

## 2. Host key sabitleme (ilk bağlantı)
1. **Bağlan**.
2. **Beklenen:** "Yeni sunucu — kimliği doğrulayın" native diyaloğu, `SHA256:...`
   parmak iziyle.
3. Doğrulamak için sunucuda: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
   Parmak izleri aynı olmalı.
4. **Güven ve bağlan** → nokta yeşile döner, "Bağlı" yazar.
5. Tekrar **Kes** + **Bağlan**. **Beklenen:** diyalog bir daha çıkmaz (sabitlendi).

## 3. Host key uyuşmazlığı (MITM koruması)
1. `~/Library/Application Support/kopru/hostkeys.json` dosyasını açın,
   parmak izindeki birkaç karakteri bozun, kaydedin.
2. **Bağlan**. **Beklenen:** kırmızı "GÜVENLİK UYARISI — Sunucu kimliği değişti"
   diyaloğu, bağlantı reddedilir, "devam et" seçeneği **yoktur**. Uygulama içinde
   de kırmızı bir uyarı bandı belirir.
3. Dosyayı silin, yeniden bağlanıp onaylayın.

## 4. Terminal
1. Bağlıyken **+ Yeni terminal**. **Beklenen:** shell prompt'u gelir.
2. `htop` veya `ls -la /usr/bin` çalıştırın — çizim bozulmamalı, kaydırma akıcı olmalı.
3. Pencereyi yeniden boyutlandırın. **Beklenen:** `htop` yeni boyuta uyar
   (pty'ye window-change gidiyor).
4. İkinci sekme açın, aralarında geçiş yapın. **Beklenen:** her sekmenin kendi
   içeriği korunur.
5. Bir sekmede `exit`. **Beklenen:** "[Köprü] Oturum kapandı." yazar, sekme durur.

## 5. Yeniden bağlanma (kabul kriteri)
1. Bir terminalde `top` çalıştırın.
2. **Wi-Fi'yi kapatın.**
3. **Beklenen (~15–45 sn içinde):** nokta sarıya döner, "Yeniden bağlanıyor…
   (N. deneme)" yazar. Uygulama donmaz.
4. **Wi-Fi'yi açın.**
5. **Beklenen:** birkaç saniye içinde yeşile döner ve terminalde
   "[Köprü] Bağlantı yenilendi — bu sekmede yeni bir oturum açıldı." satırı görünür.
   Eski çıktı (scrollback) yukarıda durur, prompt yeniden gelir.

   > Not: `top` süreci **geri gelmez** — bu beklenen davranıştır. Uzak pty, TCP
   > bağlantısıyla birlikte sunucu tarafında ölür; hiçbir istemci onu diriltemez
   > (ADR 0004). Gerçek oturum sürekliliği tmux/mosh gerektirir, Faz 7'ye bırakıldı.

## 6. Otomatik bağlanma
1. Profili düzenleyip **"Uygulama açılınca otomatik bağlan"** işaretleyin.
2. Uygulamayı kapatıp `npm run dev` ile yeniden açın.
3. **Beklenen:** elle bir şey yapmadan bağlanır, sunucu seçili gelir.

## 7. Hata mesajları
Her biri Türkçe ve anlaşılır olmalı, hiçbiri stack trace veya parola içermemeli:
- Yanlış kullanıcı adı → "Kimlik doğrulama başarısız…"
- Olmayan adres → "Sunucu adresi çözümlenemedi."
- Yanlış port → "Bağlantı reddedildi. SSH servisi çalışıyor mu?"
- Olmayan anahtar dosyası yolu → "Anahtar dosyası okunamadı: …"
