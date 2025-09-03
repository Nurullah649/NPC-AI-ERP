# Gerekli Kütüphaneler: selenium, requests, openpyxl, python-dotenv, thefuzz
import sys
import os
import time
import json
import atexit
import logging
import re
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List
from pathlib import Path
import openpyxl
from dotenv import load_dotenv
from thefuzz import fuzz
import io
import queue

# Optimize edilmiş modülleri import et
from src import sigma, netflex, tci

# --- BAŞLANGIÇTA KODLAMAYI AYARLA ---
if sys.platform == "win32":
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# --- PAKETLEME İÇİN DOSYA YOLU FONKSİYONU ---
def get_resource_path(relative_path: str) -> str:
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# --- Uygulama Veri Yolu Tanımı ---
def get_app_base_path() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(os.path.dirname(sys.executable))
    else:
        return Path(os.path.abspath("."))


APP_BASE_PATH = get_app_base_path()
LOGS_AND_SETTINGS_DIR = APP_BASE_PATH / "TalesJob_Veri"
SETTINGS_FILE_PATH = LOGS_AND_SETTINGS_DIR / "settings.json"


# --- Ayarları Yükleme Fonksiyonu ---
def load_settings() -> Dict[str, Any]:
    """Ayarları JSON dosyasından yükler. Dosya yoksa veya bozuksa varsayılanları döndürür."""
    default_settings = {
        "netflex_username": "", "netflex_password": "", "tci_coefficient": 1.4
    }
    if not SETTINGS_FILE_PATH.exists():
        return default_settings
    try:
        with open(SETTINGS_FILE_PATH, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            for key, value in default_settings.items():
                settings.setdefault(key, value)
            return settings
    except (json.JSONDecodeError, IOError) as e:
        logging.error(f"Ayarlar dosyası okunurken hata: {e}. Varsayılanlar kullanılıyor.")
        return default_settings


# --- Ayarları Kaydetme Fonksiyonu ---
def save_settings(new_settings: Dict[str, Any]):
    """Yeni ayarları JSON dosyasına kaydeder."""
    try:
        if 'tci_coefficient' in new_settings:
            new_settings['tci_coefficient'] = float(str(new_settings['tci_coefficient']).replace(',', '.'))
        LOGS_AND_SETTINGS_DIR.mkdir(exist_ok=True)
        with open(SETTINGS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, indent=4)
        logging.info(f"Ayarlar başarıyla kaydedildi: {SETTINGS_FILE_PATH}")
    except (IOError, TypeError, ValueError) as e:
        logging.error(f"Ayarlar dosyasına yazılırken hata: {e}")


# --- Loglama Yapılandırması ---
def setup_logging():
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - (%(threadName)s) - %(message)s')
    log_dir = LOGS_AND_SETTINGS_DIR
    log_dir.mkdir(exist_ok=True)
    dev_log_file = log_dir / "developer.log"
    dev_handler = logging.FileHandler(dev_log_file, encoding='utf-8')
    dev_handler.setFormatter(formatter)
    dev_handler.setLevel(logging.INFO)
    admin_log_file = log_dir / "admin_activity.log"
    admin_handler = logging.FileHandler(admin_log_file, encoding='utf-8')
    admin_formatter = logging.Formatter('%(asctime)s - %(message)s')
    admin_handler.setFormatter(admin_formatter)
    admin_logger = logging.getLogger("admin")
    admin_logger.addHandler(admin_handler)
    admin_logger.setLevel(logging.INFO)
    admin_logger.propagate = False
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    logging.basicConfig(level=logging.INFO, handlers=[dev_handler, console_handler])
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("selenium").setLevel(logging.WARNING)
    return admin_logger


admin_logger = setup_logging()


# --- JSON Mesajlaşma ---
def send_to_frontend(message_type: str, data: Any):
    try:
        message = json.dumps({"type": message_type, "data": data})
        print(message, flush=True)
    except (TypeError, OSError, BrokenPipeError) as e:
        logging.error(f"Frontend'e mesaj gönderilemedi: {e}")


# --- Excel'e Aktarma ---
def export_to_excel(data: Dict[str, Any]):
    customer_name = data.get("customerName", "Bilinmeyen_Musteri")
    products = data.get("products", [])
    safe_customer_name = re.sub(r'[\\/*?:"<>|]', "", customer_name)
    desktop_path = Path.home() / "Desktop"
    desktop_path.mkdir(exist_ok=True)
    filename = f"{safe_customer_name}_urun_listesi_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = desktop_path / filename
    try:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Ürün Listesi"
        headers = ["Kaynak", "Ürün Adı", "Ürün Kodu", "Fiyat", "Stok Durumu"]
        sheet.append(headers)
        for cell in sheet["1:1"]: cell.font = openpyxl.styles.Font(bold=True)
        for product in products:
            row = [
                product.get("source", "N/A"), product.get("product_name", "N/A"),
                product.get("product_code", "N/A"), product.get("price_str", "N/A"),
                product.get("cheapest_netflex_stock", "N/A")
            ]
            sheet.append(row)
        for col in sheet.columns:
            max_length = max(len(str(cell.value)) for cell in col if cell.value)
            sheet.column_dimensions[col[0].column_letter].width = max_length + 2
        workbook.save(filepath)
        logging.info(f"Excel dosyası oluşturuldu: {filepath}")

        admin_logger.info(f"Müşteri Ataması ve Rapor: Müşteri='{customer_name}', Atanan Ürün Sayısı={len(products)}")
        for product in products:
            p_name = re.sub(re.compile('<.*?>'), '', product.get("product_name", "N/A"))
            p_code = product.get("product_code", "N/A")
            p_price = product.get("price_str", "N/A")
            admin_logger.info(f"  -> Atanan Ürün: Ad='{p_name}', Kod='{p_code}', Fiyat='{p_price}'")

        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel dosyası oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# --- Karşılaştırma Motoru ---
class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, tci_api: tci.TciScraper,
                 initial_settings: Dict[str, Any], max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.tci_api = tci_api
        self.max_workers = max_workers
        self.search_cancelled = threading.Event()
        self.settings = initial_settings

    def initialize_drivers(self):
        logging.info("Ağır servisler (Selenium sürücüleri) başlatılıyor...")
        start_time = time.monotonic()
        try:
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Heavy-Driver-Starter") as executor:
                future_sigma = executor.submit(self.sigma_api.start_drivers)
                future_tci = executor.submit(self.tci_api.reinit_driver)
                future_sigma.result()
                future_tci.result()
            elapsed = time.monotonic() - start_time
            logging.info(f"Tüm Selenium sürücüleri {elapsed:.2f} saniyede başarıyla başlatıldı.")
        except Exception as e:
            logging.critical(f"Selenium sürücüleri başlatılırken kritik hata: {e}", exc_info=True)
            raise e

    def _clean_html(self, raw_html: str) -> str:
        return re.sub(re.compile('<.*?>'), '', raw_html) if raw_html else ""

    def _are_names_similar(self, name1: str, name2: str, avg_threshold: int = 50) -> bool:
        if not name1 or not name2: return False
        n1, n2 = name1.lower(), name2.lower()
        if fuzz.partial_ratio(n1, n2) == 100: return True
        scores = [fuzz.ratio(n1, n2), fuzz.token_sort_ratio(n1, n2), fuzz.token_set_ratio(n1, n2)]
        return (sum(scores) / len(scores)) > avg_threshold

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any] or None:
        if self.search_cancelled.is_set(): return None
        s_name, s_num, s_brand, s_key, cas = (
            sigma_product.get('product_name_sigma'), sigma_product.get('product_number'),
            sigma_product.get('brand'), sigma_product.get('product_key'), sigma_product.get('cas_number', 'N/A')
        )
        if not all([s_name, s_num, s_brand, s_key]): return None
        cleaned_sigma_name = self._clean_html(s_name)

        with ThreadPoolExecutor(max_workers=3, thread_name_prefix="Sigma-Sub-Fetcher") as executor:
            future_prices = executor.submit(self.sigma_api.get_all_product_prices, s_num, s_brand, s_key,
                                            self.search_cancelled)
            future_netflex_name = executor.submit(self.netflex_api.search_products, cleaned_sigma_name,
                                                  self.search_cancelled)
            future_netflex_code = executor.submit(self.netflex_api.search_products, s_num, self.search_cancelled)
            sigma_variations = future_prices.result()
            netflex_by_name = future_netflex_name.result() or []
            netflex_by_code = future_netflex_code.result() or []
        if self.search_cancelled.is_set(): return None

        all_netflex_products_map = {p['product_code']: p for p in netflex_by_name if p.get('product_code')}
        all_netflex_products_map.update({p['product_code']: p for p in netflex_by_code if p.get('product_code')})
        all_netflex_products = list(all_netflex_products_map.values())

        netflex_matches = []
        processed_codes = set()
        for p in all_netflex_products:
            if p.get('product_code') not in processed_codes:
                if self._are_names_similar(cleaned_sigma_name, p.get('product_name', '')):
                    netflex_matches.append(p)
                    processed_codes.add(p.get('product_code'))
        for p in all_netflex_products:
            if p.get('product_code') not in processed_codes:
                if s_num in p.get('product_code', '') and fuzz.partial_ratio(cleaned_sigma_name.lower(),
                                                                             p.get('product_name', '').lower()) > 80:
                    netflex_matches.append(p)
                    processed_codes.add(p.get('product_code'))

        cheapest_name, cheapest_price, cheapest_stock = "Bulunamadı", "N/A", "N/A"
        if priced_matches := [p for p in netflex_matches if p.get('price_numeric') is not None]:
            cheapest = min(priced_matches, key=lambda x: x['price_numeric'])
            cheapest_name, cheapest_price, cheapest_stock = (cheapest.get('product_name'), cheapest.get('price_str'),
                                                             cheapest.get('stock'))

        return {
            "source": "Sigma", "product_name": s_name, "product_number": s_num, "cas_number": cas,
            "brand": f"Sigma ({s_brand})", "sigma_variations": sigma_variations, "netflex_matches": netflex_matches,
            "cheapest_netflex_name": cheapest_name, "cheapest_netflex_price_str": cheapest_price,
            "cheapest_netflex_stock": cheapest_stock
        }

    def _process_tci_product(self, tci_product: tci.Product) -> Dict[str, Any]:
        processed_variations = []
        min_original_price = float('inf')

        for variation in tci_product.variations:
            original_price_str = variation.get('price', 'N/A')
            price_float = None
            try:
                price_str_cleaned = re.sub(r'[^\d,.]', '', original_price_str)
                price_standardized = ""
                last_comma, last_dot = price_str_cleaned.rfind(','), price_str_cleaned.rfind('.')
                if last_comma > last_dot:
                    price_standardized = price_str_cleaned.replace('.', '').replace(',', '.')
                elif last_dot > last_comma:
                    price_standardized = price_str_cleaned.replace(',', '')
                else:
                    price_standardized = price_str_cleaned.replace(',', '.')
                if price_standardized:
                    price_float = float(price_standardized)
            except (ValueError, TypeError):
                pass

            processed_variations.append({
                "unit": variation.get('unit'),
                "original_price": original_price_str,
                "original_price_numeric": price_float
            })

            if price_float is not None and price_float < min_original_price:
                min_original_price = price_float

        cheapest_price_to_show = None
        if min_original_price != float('inf'):
            tci_coefficient = self.settings.get('tci_coefficient', 1.4)
            calculated_cheapest = min_original_price * tci_coefficient
            cheapest_price_to_show = f"€{calculated_cheapest:,.2f}".replace(",", "X").replace(".", ",").replace("X",
                                                                                                                ".")
        else:
            cheapest_price_to_show = "N/A"

        return {
            "source": "TCI", "product_name": tci_product.name, "product_number": tci_product.code,
            "cas_number": tci_product.cas_number, "brand": "TCI",
            "cheapest_netflex_price_str": cheapest_price_to_show,
            "cheapest_netflex_stock": "",
            "tci_variations": processed_variations, "sigma_variations": {}, "netflex_matches": []
        }

    def search_and_compare(self, search_term: str):
        self.search_cancelled.clear()
        start_time = time.monotonic()
        logging.info(f"===== YENİ BİRLEŞİK ARAMA BAŞLATILDI: '{search_term}' =====")
        admin_logger.info(f"Arama Başlatıldı: Terim='{search_term}'")

        def _search_and_process_source(source_name, page_generator, product_processor):
            page_queue = queue.Queue(maxsize=2)
            found_count = 0

            def producer():
                try:
                    for product_page in page_generator(search_term, self.search_cancelled):
                        if self.search_cancelled.is_set(): break
                        page_queue.put(product_page)
                finally:
                    page_queue.put(None)

            def consumer():
                nonlocal found_count
                with ThreadPoolExecutor(max_workers=self.max_workers,
                                        thread_name_prefix=f"{source_name}-Page-Processor") as executor:
                    while not self.search_cancelled.is_set():
                        try:
                            product_page = page_queue.get(timeout=0.2)
                            if product_page is None: break

                            futures = {executor.submit(product_processor, p) for p in product_page}
                            for future in as_completed(futures):
                                if self.search_cancelled.is_set(): break
                                if result := future.result():
                                    send_to_frontend("product_found", result)
                                    found_count += 1
                        except queue.Empty:
                            continue

            producer_thread = threading.Thread(target=producer, name=f"{source_name}-Producer", daemon=True)
            consumer_thread = threading.Thread(target=consumer, name=f"{source_name}-Consumer", daemon=True)
            producer_thread.start()
            consumer_thread.start()
            producer_thread.join()
            consumer_thread.join()
            return found_count

        total_found = 0
        try:
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Search-Source") as executor:
                tasks = {
                    executor.submit(_search_and_process_source, "Sigma", self.sigma_api.search_products,
                                    self._process_sigma_product),
                    executor.submit(_search_and_process_source, "TCI", self.tci_api.get_products,
                                    self._process_tci_product)
                }
                for future in as_completed(tasks):
                    try:
                        total_found += future.result()
                    except Exception as exc:
                        logging.error(f"Arama kaynağı işlenirken hata oluştu: {exc}", exc_info=True)
        except netflex.AuthenticationError as e:
            logging.error(f"Netflex kimlik doğrulama hatası: {e}", exc_info=False)
            send_to_frontend("authentication_error", True)
        except Exception as e:
            if not self.search_cancelled.is_set():
                logging.error(f"Arama sırasında genel bir hata oluştu: {e}", exc_info=True)
                send_to_frontend("search_error", f"Arama sırasında hata: {e}")

        elapsed_time = time.monotonic() - start_time
        if not self.search_cancelled.is_set():
            logging.info(
                f"Arama Tamamlandı: Terim='{search_term}', Toplam Bulunan={total_found}, Süre={elapsed_time:.2f}s")
            send_to_frontend("search_complete", {"status": "complete", "total_found": total_found,
                                                 "execution_time": round(elapsed_time, 2)})
        else:
            logging.warning(f"Arama İptal Edildi: Terim='{search_term}'")

    def force_cancel(self):
        if not self.search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. Tüm görevler iptal ediliyor.")
            self.search_cancelled.set()
            send_to_frontend("search_complete", {"status": "cancelled"})


# --- Ana Fonksiyon ---
def main():
    logging.info("=" * 40 + "\n      Python Arka Plan Servisi Başlatıldı\n" + "=" * 40)
    services_initialized = threading.Event()
    sigma_api = sigma.SigmaAldrichAPI()
    tci_api = tci.TciScraper()
    # DEĞİŞİKLİK: Uygulama kapanırken Selenium sürücülerinin düzgün kapatılması için
    # atexit modülü ile fonksiyonlar kaydedildi. Bu, arkada kalan işlemleri önler.
    atexit.register(sigma_api.stop_drivers)
    atexit.register(tci_api.close_driver)
    netflex_api = None
    engine = None

    def initialize_services(settings_data: Dict[str, Any]):
        nonlocal netflex_api, engine
        log_safe_settings = {k: v for k, v in settings_data.items() if 'password' not in k}
        logging.info(f"Servisler şu ayarlarla başlatılıyor: {log_safe_settings}")
        netflex_api = netflex.NetflexAPI(username=settings_data.get("netflex_username"),
                                         password=settings_data.get("netflex_password"))
        engine = ComparisonEngine(sigma_api, netflex_api, tci_api, initial_settings=settings_data)

        def full_initialization_service():
            logging.info("Tam servis başlatma süreci başladı.")
            try:
                logging.info("1. Adım: Netflex token'ı alınıyor...")
                netflex_api.get_token()
                logging.info("Netflex servisi başarıyla doğrulandı.")
                logging.info("2. Adım: Selenium sürücüleri başlatılıyor...")
                engine.initialize_drivers()
                logging.info("Tüm arka plan servisleri başarıyla başlatıldı ve HAZIR.")
                send_to_frontend("python_services_ready", True)
                services_initialized.set()
            except netflex.AuthenticationError as e:
                logging.error(f"Netflex kimlik doğrulama hatası: {e}", exc_info=False)
                send_to_frontend("authentication_error", True)
            except Exception as e:
                logging.critical(f"Servis başlatma sırasında kritik hata: {e}", exc_info=True)
                send_to_frontend("python_services_ready", False)

        threading.Thread(target=full_initialization_service, name="Full-Initializer", daemon=True).start()

    if SETTINGS_FILE_PATH.exists():
        current_settings = load_settings()
        initialize_services(current_settings)
    else:
        logging.warning("Ayarlar dosyası bulunamadı. Arayüzden ilk kurulum bekleniyor.")
        send_to_frontend("initial_setup_required", True)

    search_thread = None
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            action, data = request.get("action"), request.get("data")
            logging.info(f"Arayüzden komut alındı: Eylem='{action}'")

            if action == "load_settings":
                send_to_frontend("settings_loaded", load_settings())
            elif action == "save_settings" and isinstance(data, dict):
                save_settings(data)
                if not services_initialized.is_set():
                    logging.info("İlk kurulum ayarları kaydedildi. Arka plan servisleri şimdi başlatılıyor.")
                    initialize_services(data)
                else:
                    engine.settings = data
                    engine.netflex_api.update_credentials(data.get("netflex_username"), data.get("netflex_password"))
                    logging.info("Çalışma zamanı ayarları güncellendi. Servisler yeniden başlatılıyor...")
                    services_initialized.clear()
                    initialize_services(data)
                    send_to_frontend("settings_saved", {"status": "success"})
            elif action == "search" and data:
                if not services_initialized.is_set():
                    send_to_frontend("search_error",
                                     "Servisler başlatılmadı. Lütfen önce ayarları kontrol edip kaydedin.")
                    continue
                if search_thread and search_thread.is_alive():
                    engine.force_cancel()
                    search_thread.join(5.0)
                search_thread = threading.Thread(target=engine.search_and_compare, args=(data,),
                                                 name="Search-Coordinator")
                search_thread.start()
            elif action == "cancel_search":
                if engine: engine.force_cancel()
            elif action == "export":
                send_to_frontend("export_result", export_to_excel(data))
            elif action == "shutdown":
                if engine: engine.force_cancel()
                if search_thread and search_thread.is_alive(): search_thread.join(5.0)
                break
        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası: {str(e)}")
    logging.info("Python ana döngüsü sonlandı.")


if __name__ == '__main__':
    main()

