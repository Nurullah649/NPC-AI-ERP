🚀 NPC-AI ERP: Genişletilmiş Geliştirme ve Modernizasyon Yol Haritası

Bu belge, uygulamanın monolitik yapısını kırmak, performansı artırmak ve modern özellikleri entegre etmek için kapsamlı bir yol haritasıdır.

🏗️ Faz 1: Mimari Temizlik ve Modülerleşme (Refactoring)

Öncelik: Kodun yönetilebilirliğini sağlamak ve "God Object" (her şeyi yapan dosya) yapısını kırmak.

1. Adım: Frontend Temel Yapı Taşları (Tamamlandı/Hazır)

Hedef: types.ts ile veri tiplerini ayırmak ve components/ui.tsx ile atomik bileşenler oluşturmak.

Durum: Kodlar hazır, entegrasyon bekleniyor.

2. Adım: Bileşen Bazlı Mimari

Hedef: page.tsx içindeki devasa yapıyı parçalamak.

Eylem:

Karmaşık satır mantığını components/ProductResultItem.tsx'e taşı.

Sayfa mantıklarını components/views/ (örn: SearchPage.tsx) altına taşı.

Sidebar, Header gibi ortak alanları components/layout/ altına al.

3. Adım: Backend (Python) Modülerliği

Hedef: desktop_app_electron.py dosyasının yükünü hafifletmek.

Yapı:

ipc_handlers.py: Sadece Electron'dan gelen istekleri dinleyen katman.

services/: İş mantığının olduğu klasör (örn: scraping_service.py, export_service.py).

utils/: Yardımcı fonksiyonlar (Loglama, formatlama).

4. Adım: State Yönetimi Reformu

Hedef: "Prop Drilling" (veriyi en tepeden en alta elle taşıma) sorununu çözmek.

Çözüm: React Context API veya Zustand kütüphanesi ile global state (oturum, sepet, arama sonuçları) yönetimi.

💾 Faz 2: Altyapı, Veri ve Performans

Öncelik: Veri güvenliğini sağlamak ve uygulama hızını artırmak.

5. Adım: Veri Tabanı Dönüşümü (JSON -> SQLite)

Sorun: JSON dosyalarının büyümesiyle oluşan performans kaybı ve bozulma riski.

Çözüm: Python tarafında SQLite ve SQLAlchemy (ORM) kullanımı.

Tablolar: Products (Cache için), Customers, Assignments (Teklifler), CalendarEvents.

6. Adım: Fiyat Teklifi Modülü (PDF Generation)

Hedef: Müşteriye atanan ürünlerden profesyonel PDF çıktısı almak.

Teknoloji: Electron printToPDF + HTML Şablonları (assets/templates/).

İçerik: Dinamik veri yerleştirme ({{MUSTERI_ADI}}), kurumsal logolar ve kaşe imza alanları.

7. Adım: Scraping Optimizasyonu ve Caching

TCI Stratejisi: Selenium kaynak tüketimini düşürmek için playwright veya direkt API/Request analizi ile veri çekme.

Akıllı Caching: Aranan terimleri (örn: "Methanol") SQLite'a kaydetmek. Aynı arama tekrar yapıldığında siteye gitmek yerine veritabanından (Cache) getirmek (TTL: 1 hafta).

🤖 Faz 3: İnovasyon, UX ve Güvenlik (Gelecek Vizyonu)

Öncelik: Kullanıcı deneyimini en üst seviyeye çıkarmak ve AI gücünü kullanmak.

8. Adım: Dashboard ve UX İyileştirmeleri

Dashboard: Uygulama açılışında boş ekran yerine; Günlük TCMB Döviz Kurları, Bekleyen Hatırlatmalar ve Hızlı İşlemler menüsü.

Canlı Döviz: MockConverter yerine TCMB XML servisinden gerçek zamanlı kur çekimi.


Özellikler:

Ürün açıklamalarını özetleme.

Otomatik teklif e-postası taslağı hazırlama.

Semantik Arama (Embedding): "Tuz" arandığında "Sodyum Klorür"ü bulabilme.

10. Adım: Güvenlik ve Dağıtım

Veri Güvenliği: Electron safeStorage API ile şifreleri (Netflex, OpenAI Key) işletim sistemi anahtar zincirinde saklama.

Loglama: RotatingFileHandler ile log dosyalarının boyutunu kontrol altında tutma (örn: max 5MB).

Offline Mod: İnternet yokken uygulamanın çökmemesi, geçmiş verilerle (SQLite) çalışabilmesi.

📂 Sizin Projeniz İçin Hedeflenen Dosya Ağacı

Mevcut yapınıza (medical-chemical-sales ve src karışımı) göre düzenlenmiş hedef yapı:

NPC-AI-ERP/
│
├── 📂 assets/                         # (DÜZENLENECEK)
│   ├── 📂 img/                        # Resimleri buraya taşıyın
│   │   ├── Tales_logo.png
│   │   ├── tales_logo2.jpg
│   │   ├── TSE-HYB.jpg
│   │   ├── UNICERT-ISO-9001.png
│   │   └── icon.png
│   └── 📂 templates/                  # HTML şablonunu buraya taşıyın
│       └── invoice_template.html
│
├── 📂 electron/                       # (YENİ) Electron dosyaları
│   ├── main.js                        # `src/main.js` dosyasını buraya taşıyın
│   └── preload.js                     # `src/preload.js` dosyasını buraya taşıyın
│
├── 📂 python_backend/                 # (YENİ) Python servisleri
│   ├── main.py                        # `src/desktop_app_electron.py` -> Adını main.py yapıp buraya taşıyın
│   ├── requirements.txt               # `src/requirements.txt` dosyasını buraya taşıyın
│   ├── .env                           # Varsa buraya taşıyın
│   │
│   ├── 📂 services/                   # Scraperları (itk.py, sigma.py vb.) buraya taşıyın
│   │   ├── sigma.py
│   │   ├── netflex.py
│   │   ├── orkim.py
│   │   ├── itk.py
│   │   ├── tci.py
│   │   └── currency_converter.py
│   │
│   └── 📂 database/                   # SQLite veritabanı burada oluşacak
│       └── npc_erp.db
│
├── 📂 medical-chemical-sales/         # (MEVCUT FRONTEND)
│   ├── types.ts                       # `types.ts` dosyasını buraya (köküne) koyun
│   │
│   ├── 📂 app/
│   │   ├── page.tsx                   # Sadeleştirilecek ana dosya
│   │   └── layout.tsx
│   │
│   └── 📂 components/                 # (YENİDEN DÜZENLE)
│       ├── 📂 ui/                     # `ui.tsx` buraya
│       │   └── ui.tsx
│       │
│       ├── 📂 views/                  # Sayfa mantıkları buraya
│       │   ├── SearchPage.tsx
│       │   ├── CalendarPage.tsx
│       │   └── SettingsPage.tsx
│       │
│       ├── ProductResultItem.tsx      # Satır bileşeni
│       └── Sidebar.tsx                # Sidebar bileşeni
│
├── 📄 package.json                    # (KÖK) Electron için start scriptleri burada kalabilir
└── 📄 build.bat                       # (KÖK)


⚠️ Kritik Not: Bu dosya taşıma işlemlerini yaptıktan sonra electron/main.js içindeki Python başlatma yolunu (scriptPath) güncellemeniz gerekecektir.