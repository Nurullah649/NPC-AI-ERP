# Obscura + Playwright Geçiş Uygulama Planı

## Arka Plan

Benchmark sonuçlarına göre:
- **RAM**: Obscura **%85 daha az** RAM kullanıyor (4.1GB → 632MB)
- **Hız**: Bağlantı kurma 2x hızlı, sayfa yükleme benzer. Toplam süre farkının sebebi cookie banner timeout'u (çözülebilir)
- **Sonuç**: Obscura'ya geçiş **RAM açısından çok avantajlı**, hız farkı da cookie timeout fix'i ile kapanacak

---

## Genel Mimari Değişikliği

```
ÖNCE (Selenium):
┌──────────────┐     ┌──────────────┐
│ main.py      │     │ Chrome (×4)  │
│   sigma_api ─┼────>│  US, DE, GB  │  ~4.1GB RAM
│   tci_api   ─┼────>│  TCI         │  48 süreç
└──────────────┘     └──────────────┘
     Her servis kendi Chrome instance'ını yönetiyor

SONRA (Obscura + Playwright):
┌──────────────┐     ┌──────────────────┐     ┌───────────┐
│ main.py      │     │ Playwright       │     │ Obscura   │
│   manager   ─┼────>│   sigma_api ────>├────>│ CDP       │  ~632MB RAM
│   sigma_api ─┼────>│   tci_api ──────>│     │ Server    │  8 süreç
│   tci_api   ─┼────>│                  │     │ port:9222 │
└──────────────┘     └──────────────────┘     └───────────┘
     Obscura tek bir CDP sunucusu, Playwright bağlanıyor
```

---

## User Review Required

> [!IMPORTANT]
> **Geri dönüş stratejisi**: Orijinal `sigma.py` ve `tci.py` dosyaları **silinmeyecek**, yeni dosyalar `sigma_playwright.py` ve `tci_playwright.py` olarak oluşturulacak. `main.py`'deki import satırı değiştirilerek geçiş yapılacak. Sorun olursa tek satır değişikliğiyle eski sisteme dönülebilir.

> [!WARNING]
> **Cookie sayısı sorunu**: Obscura, Sigma'dan 14 cookie topluyor (Selenium 30 cookie). GraphQL API'nin 14 cookie ile çalışıp çalışmadığı Faz 2'de test edilecek. Çalışmazsa cookie banner fix'i uygulanacak.

## Open Questions

> [!IMPORTANT]
> 1. **Obscura binary konumu**: Binary'yi `/home/nurullah/NPC-AI-ERP/obscura-src/target/release/obscura` konumunda mı bırakalım, yoksa proje kök dizinine mi kopyalayalım?

> [!IMPORTANT]
> 2. **Obscura'yı systemd servisi olarak mı çalıştıralım?** Şu anda `main.py` başlarken subprocess olarak başlatılacak. Alternatif olarak ayrı bir systemd servisi de olabilir.

---

## Faz 1: Obscura Manager (Süreç Yönetimi)

#### [NEW] [obscura_manager.py](file:///home/nurullah/NPC-AI-ERP/python_backend/services/obscura_manager.py)

Bu dosya zaten oluşturuldu. `ObscuraManager` sınıfı:

| Metot | İşlev |
|-------|-------|
| `start()` | Obscura'yı subprocess olarak başlatır, port dinlemeye başlayana kadar bekler |
| `stop()` | SIGTERM → SIGKILL ile düzgünce kapatır |
| `is_running()` | Port kontrolü ile sağlık durumu |
| `get_cdp_endpoint()` | `http://127.0.0.1:9222` döndürür |
| `restart()` | stop + start |

**Bağımlılık**: Sadece `subprocess`, `socket`, `signal` — harici paket yok.

---

## Faz 2: Sigma Servisi Geçişi

#### [NEW] [sigma_playwright.py](file:///home/nurullah/NPC-AI-ERP/python_backend/services/sigma_playwright.py)

Mevcut [sigma.py](file:///home/nurullah/NPC-AI-ERP/python_backend/services/sigma.py) dosyasının Playwright versiyonu.

### Değişen Metotlar

| Metot | Selenium (Eski) | Playwright (Yeni) |
|-------|-----------------|-------------------|
| `__init__()` | `self.drivers = {}` | `self.cdp_endpoint = "http://..."` |
| `start_drivers()` | `ThreadPoolExecutor` → `_start_single_driver` | `ThreadPoolExecutor` → `_get_cookies_for_country` |
| `_start_single_driver()` | `webdriver.Chrome(service, options)` | `playwright.chromium.connect_over_cdp()` |
| Cookie alma | `driver.get_cookies()` → session | `context.cookies()` → session |
| `stop_drivers()` | `driver.quit()` + session.close | Playwright context/browser close + session.close |
| `kill_drivers()` | `os.kill(driver.service.process.pid)` | `self.stop_drivers()` (Obscura manager handles process) |

### Değişmeyen Metotlar (Aynen korunacak)

Bu metotlar sadece `requests.Session` kullanıyor, Selenium ile ilişkisi yok:

- `search_products()` — GraphQL API ile ürün arama (generator)
- `_search_page()` — Tek sayfa API isteği
- `get_all_product_prices()` — Çoklu ülke fiyat sorgulama
- `_get_price_for_country()` — Tek ülke fiyat isteği

### Cookie Yeterliliği Testi (Kritik)

Faz 2'de ilk olarak şu test yapılacak:
```python
# Obscura'dan alınan 14 cookie ile GraphQL API'ye test isteği
# Eğer 200 OK + geçerli data dönerse → cookie yeterli
# Eğer 401/403 dönerse → cookie banner fix gerekli
```

Eğer cookie yeterliyse → cookie banner tıklama kodu tamamen kaldırılabilir (daha hızlı).

### Cookie Banner Fix (Gerekirse)

Obscura'nın OneTrust render sorunu için alternatif çözüm:
```python
# JavaScript ile doğrudan cookie consent verilir
page.evaluate("""
    // OneTrust API'si varsa doğrudan consent ver
    if (window.OneTrust) {
        OneTrust.AllowAll();
    }
    // Veya doğrudan cookie set et
    document.cookie = "OptanonAlertBoxClosed=" + new Date().toISOString() + "; path=/; domain=.sigmaaldrich.com";
""")
```

---

## Faz 3: TCI Servisi Geçişi

#### [NEW] [tci_playwright.py](file:///home/nurullah/NPC-AI-ERP/python_backend/services/tci_playwright.py)

Mevcut [tci.py](file:///home/nurullah/NPC-AI-ERP/python_backend/services/tci.py) dosyasının Playwright versiyonu.

### Selenium → Playwright API Eşleştirme Tablosu

| Selenium API | Playwright API | Kullanıldığı Yer |
|---|---|---|
| `driver.get(url)` | `page.goto(url)` | Sayfa açma |
| `driver.find_elements(By.CSS_SELECTOR, sel)` | `page.query_selector_all(sel)` | Ürün kartlarını bulma |
| `driver.find_element(By.CSS_SELECTOR, sel)` | `page.query_selector(sel)` | Tek element bulma |
| `card.find_element(By.ID, "PricingTable")` | `card.query_selector("#PricingTable")` | Fiyat tablosu |
| `element.text` | `element.inner_text()` | Metin okuma |
| `element.get_attribute("data-attr")` | `element.get_attribute("data-attr")` | Attribute okuma |
| `WebDriverWait(driver, 60).until(EC.presence_of(..))` | `page.wait_for_selector(sel, timeout=60000)` | Element bekleme |
| `driver.current_url` | `page.url` | URL okuma |
| `driver.page_source` | `page.content()` | Sayfa HTML'i |
| `WebDriverWait.until(EC.any_of(...))` | `page.wait_for_selector("sel1, sel2")` | Birden fazla element bekleme |
| `NoSuchElementException` handling | `query_selector` → `None` kontrolü | Element yoksa |
| `driver.execute_script(...)` | `page.evaluate(...)` | JavaScript çalıştırma |

### Değişen Metotlar

| Metot | Değişiklik |
|-------|-----------|
| `__init__()` | `self.driver = None` → Playwright bağlantı alanları + `cdp_endpoint` |
| `reinit_driver()` | Chrome başlatma → `connect_over_cdp()` + context + page |
| `kill_driver()` | `os.kill(pid)` → `_cleanup_playwright()` |
| `get_products()` | Tüm `find_element`/`find_elements` → `query_selector`/`query_selector_all` |
| `close_driver()` | `driver.quit()` → Playwright cleanup |

### Değişmeyen Mantık

- `_get_subsequent_page_url()` — URL manipülasyonu, tarayıcıya bağımlı değil
- `Product` sınıfı — Veri modeli, aynen korunacak
- Sayfalama mantığı — Aynı döngü yapısı
- DOM parsing mantığı — Aynı selektörler, sadece API farklı

### Görsel Engelleme (Bonus Optimizasyon)

Playwright, route interception ile görselleri engelleyebilir:
```python
context.route("**/*.{png,jpg,jpeg,gif,svg,ico,webp,woff,woff2}", lambda route: route.abort())
```
Bu, Selenium'da `"profile.managed_default_content_settings.images": 2` ayarının karşılığıdır. Ek RAM tasarrufu sağlar.

---

## Faz 4: main.py Entegrasyonu

#### [MODIFY] [main.py](file:///home/nurullah/NPC-AI-ERP/python_backend/main.py)

### Değişiklik 1: Import satırları (satır 25-29)

```diff
 try:
-    from services import sigma, netflex, tci, currency_converter, orkim, itk
+    from services import sigma_playwright as sigma, netflex, tci_playwright as tci, currency_converter, orkim, itk
+    from services.obscura_manager import ObscuraManager
 except ImportError:
     sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
-    from python_backend.services import sigma, netflex, tci, currency_converter, orkim, itk
+    from python_backend.services import sigma_playwright as sigma, netflex, tci_playwright as tci, currency_converter, orkim, itk
+    from python_backend.services.obscura_manager import ObscuraManager
```

> [!TIP]
> `sigma_playwright as sigma` ile import edildiği için `main.py`'nin geri kalanında hiçbir `sigma.` referansı değişmez. Aynı şekilde TCI.

### Değişiklik 2: main() fonksiyonu — Obscura başlatma (satır 1038-1049)

```diff
 def main():
     logging.info("=" * 40 + "\nPython Arka Plan Servisi Başlatıldı\n" + "=" * 40)
     start_notification_scheduler()
+    # Obscura CDP sunucusunu başlat
+    obscura_mgr = ObscuraManager(
+        binary_path="/home/nurullah/NPC-AI-ERP/obscura-src/target/release/obscura",
+        port=9222,
+        workers=4,
+        stealth=True
+    )
+    if not obscura_mgr.start():
+        logging.critical("Obscura CDP sunucusu başlatılamadı! Uygulama kapatılıyor.")
+        send_to_frontend("error", {"message": "Tarayıcı motoru başlatılamadı."})
+        return
+    cdp_endpoint = obscura_mgr.get_cdp_endpoint()
+
     services_initialized = threading.Event()
-    sigma_api = sigma.SigmaAldrichAPI()
-    tci_api = tci.TciScraper()
+    sigma_api = sigma.SigmaAldrichAPI(cdp_endpoint=cdp_endpoint)
+    tci_api = tci.TciScraper(cdp_endpoint=cdp_endpoint)
     currency_api = currency_converter.CurrencyConverter()
```

### Değişiklik 3: initialize_drivers() — Log mesajı güncelleme (satır 560-574)

```diff
     def initialize_drivers(self):
-        logging.info("Ağır servisler (Selenium sürücüleri) başlatılıyor...")
+        logging.info("Ağır servisler (Playwright+Obscura) başlatılıyor...")
         start_time = time.monotonic()
         try:
-            logging.info("initialize_drivers BAŞLADI (Sıralı)")
-            logging.info("Sigma sürücüleri başlatılıyor...")
+            logging.info("initialize_drivers BAŞLADI (Playwright+Obscura)")
+            logging.info("Sigma session'ları başlatılıyor...")
             self.sigma_api.start_drivers()
-            logging.info("Sigma sürücüleri tamamlandı.")
-            logging.info("TCI sürücüsü başlatılıyor...")
+            logging.info("Sigma session'ları tamamlandı.")
+            logging.info("TCI bağlantısı başlatılıyor...")
             self.tci_api.reinit_driver()
-            logging.info("TCI sürücüsü tamamlandı.")
-            logging.info(f"Tüm Selenium sürücüleri {time.monotonic() - start_time:.2f}s içinde başlatıldı (Sıralı).")
+            logging.info("TCI bağlantısı tamamlandı.")
+            logging.info(f"Tüm Playwright+Obscura bağlantıları {time.monotonic() - start_time:.2f}s içinde başlatıldı.")
         except Exception as e:
-            logging.critical(f"Selenium sürücüleri başlatılamadı: {e}", exc_info=True)
+            logging.critical(f"Playwright+Obscura bağlantıları kurulamadı: {e}", exc_info=True)
             raise e
```

### Değişiklik 4: shutdown handler — Obscura kapatma (satır 1184-1207)

```diff
             elif action == "shutdown":
                 logging.info("Kapatma komutu alındı. Kaynaklar serbest bırakılıyor...")
                 stop_notification_scheduler()
                 ...
                 try:
                     if sigma_api: sigma_api.stop_drivers()
                 except Exception as e: ...
                 try:
                     if tci_api: tci_api.close_driver()
                 except Exception as e: ...
                 try:
                     if orkim_api: orkim_api.close_driver()
                 except Exception as e: ...
+                # Obscura CDP sunucusunu durdur
+                try:
+                    obscura_mgr.stop()
+                    logging.info("Obscura CDP sunucusu kapatıldı.")
+                except Exception as e:
+                    logging.error(f"Obscura kapatılırken hata: {e}")
                 ...
```

---

## Faz 5: Temizlik ve Doğrulama

### 5.1 API Uyumluluk Kontrolü

`main.py`'nin her iki servisten beklediği public API:

| API | sigma.py (eski) | sigma_playwright.py (yeni) | Uyumlu? |
|-----|----------------|---------------------------|---------|
| `SigmaAldrichAPI()` | ✅ | `SigmaAldrichAPI(cdp_endpoint=)` | ✅ (ek parametre) |
| `.start_drivers()` | ✅ | ✅ | ✅ |
| `.stop_drivers()` | ✅ | ✅ | ✅ |
| `.kill_drivers()` | ✅ | ✅ | ✅ |
| `.search_products(term, token)` → Generator | ✅ | ✅ | ✅ |
| `.get_all_product_prices(...)` → Dict | ✅ | ✅ | ✅ |

| API | tci.py (eski) | tci_playwright.py (yeni) | Uyumlu? |
|-----|-------------|-------------------------|---------|
| `TciScraper()` | ✅ | `TciScraper(cdp_endpoint=)` | ✅ (ek parametre) |
| `.reinit_driver()` | ✅ | ✅ | ✅ |
| `.close_driver()` | ✅ | ✅ | ✅ |
| `.kill_driver()` | ✅ | ✅ | ✅ |
| `.get_products(query, token)` → Generator | ✅ | ✅ | ✅ |
| `tci.Product` sınıfı | ✅ | ✅ | ✅ |

### 5.2 Bağımlılık Değişiklikleri

```diff
 # requirements.txt - eklenenler
+playwright==1.58.0

 # requirements.txt - kaldırılabilir (opsiyonel, geri dönüş için tutulabilir)
-selenium
-webdriver-manager
```

> [!WARNING]
> `orkim.py` Selenium kullanmıyor (sadece `requests` + `BeautifulSoup`). Bu servis değişmeyecek.

### 5.3 Benchmark Dosyaları (Temizlik)

Geçiş sonrası kaldırılacak dosyalar:
- `benchmark_selenium.py` — Artık gerekli değil
- `benchmark_obscura.py` — Artık gerekli değil
- `benchmark_results/` — Sonuçlar kaydedildi, silinebilir

---

## Verification Plan

### Otomatik Testler

1. **Cookie yeterliliği testi**: Obscura'dan alınan cookie'lerle Sigma GraphQL API'ye istek at
2. **Sigma arama testi**: "ethanol" araması yapıp sonuç geldiğini doğrula
3. **Sigma fiyat testi**: Bulunan ürün için US/DE/GB fiyatlarını çek
4. **TCI arama testi**: "ethanol" araması yapıp ürün kartlarının parse edildiğini doğrula
5. **TCI sayfalama testi**: Birden fazla sayfası olan bir arama yap
6. **Bellek testi**: 4 eş zamanlı bağlantı sonrası RAM ölçümü

### Manuel Doğrulama

1. Uygulamayı başlatıp `python_services_ready` sinyalinin geldiğini kontrol et
2. Arayüzden arama yapıp sonuçların geldiğini doğrula
3. Toplu arama (batch search) testi
4. Uygulamayı kapatıp Obscura sürecinin de temizlendiğini kontrol et

### Geri Dönüş Planı

Sorun olursa `main.py` satır 26'daki import'u değiştirmek yeterli:
```python
# Obscura versiyonu (yeni)
from services import sigma_playwright as sigma, netflex, tci_playwright as tci, ...

# Selenium versiyonu (eski — geri dönüş)
from services import sigma, netflex, tci, ...
```

---

## Zaman Tahmini

| Faz | Süre | Durum |
|-----|------|-------|
| Faz 1: Obscura Manager | ~5 dk | ✅ Tamamlandı |
| Faz 2: Sigma Geçişi + Cookie Testi | ~15 dk | 🔜 Kod hazır, test gerekli |
| Faz 3: TCI Geçişi | ~15 dk | 🔜 Kod hazır, test gerekli |
| Faz 4: main.py Entegrasyonu | ~10 dk | 🔜 |
| Faz 5: Doğrulama + Temizlik | ~15 dk | 🔜 |
| **Toplam** | **~60 dk** | |
