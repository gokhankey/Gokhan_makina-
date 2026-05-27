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

## Kapalıyken Bildirim

Personel telefonuna uygulama kapalıyken bildirim gitmesi için Firebase Cloud Messaging kullanılır.

Firebase Console'da:

1. Project Settings > Cloud Messaging bölümünden Web Push certificate oluşturun.
2. Oluşan VAPID key değerini `app.js` içindeki `firebaseVapidKey` alanına yazın.
3. `firestore.rules` dosyasını yayınlayın.
4. Firebase Functions'ı deploy edin:

```powershell
firebase deploy --only functions,firestore:rules
```

Personel ilk giriş yaptığında tarayıcı bildirim izni ister. İzin verildikten sonra cihaz token'ı Firestore'a kaydedilir ve yeni görev atanırken bildirim gönderilir.

Not: iPhone'da kapalıyken web bildirimi için site ana ekrana eklenmiş PWA olarak açılmalıdır. Android Chrome'da bildirim izni yeterlidir.

## Dosyalar

- `index.html`: Ana sayfa.
- `styles.css`: Arayüz tasarımı.
- `app.js`: Uygulama mantığı ve Firebase yedekleme.
- `manifest.webmanifest`, `service-worker.js`, ikonlar: Mobilde uygulama gibi açılma desteği.
- `firestore.rules`: Firebase Firestore güvenlik kuralları.
