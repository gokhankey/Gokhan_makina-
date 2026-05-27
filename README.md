# Gökhan Makina Saha Yönetimi

Saha personeli, servis görevleri, konum takibi ve ciro takvimi için hazırlanmış web uygulaması.

## Kullanım

1. Dosyaları aynı klasörde tutun.
2. `index.html` dosyasını tarayıcıda açın.
3. Admin girişi:
   - Kullanıcı adı: `mesut`
   - Şifre: `0852`

## Firebase Yedekleme

Uygulama önce yerel kayıtla açılır. Firebase bağlantısı kurulursa verileri Firestore üzerinde yedekler.

Firebase Console'da:

1. Authentication bölümünde Anonymous giriş yöntemini açın.
2. Firestore Database oluşturun.
3. `firestore.rules` dosyasındaki kuralları Firestore Rules bölümüne ekleyip yayınlayın.

Yedek doküman yolu:

```text
artifacts/gokhan-makina-v1/public/data/backups/main
```

## Dosyalar

- `index.html`: Ana sayfa.
- `styles.css`: Arayüz tasarımı.
- `app.js`: Uygulama mantığı ve Firebase yedekleme.
- `manifest.webmanifest`, `service-worker.js`, ikonlar: Mobilde uygulama gibi açılma desteği.
- `firestore.rules`: Firebase Firestore güvenlik kuralları.
