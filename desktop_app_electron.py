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


# --- İki Aşamalı Loglama Yapılandırması ---
def setup_logging():
    # Eski yapılandırmayı temizle
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)

    # Ana log formatı
    formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - (%(threadName)s) - %(message)s')

    log_dir = Path.home() / "Desktop" / "TalesJob_Logs"
    log_dir.mkdir(exist_ok=True)

    # --- 1. Developer Log ---
    # Teknik hataları, sistem çağrılarını ve HTTP yanıtlarını yakalar.
    dev_log_file = log_dir / "developer.log"
    dev_handler = logging.FileHandler(dev_log_file, encoding='utf-8')
    dev_handler.setFormatter(formatter)
    dev_handler.setLevel(logging.INFO)  # Tüm teknik loglar için INFO seviyesi

    # Sadece belirli modüllerin loglarını bu dosyaya yönlendirmek için filtre
    class DevLogFilter(logging.Filter):
        def filter(self, record):
            # Bu loglayıcılar developer.log'a yazacak
            developer_loggers = ['root', 'sigma', 'netflex', 'tci']
            return any(record.name.startswith(logger_name) for logger_name in developer_loggers)

    dev_handler.addFilter(DevLogFilter())

    # --- 2. Admin Log ---
    # Kullanıcı aktivitelerini (arama terimleri, export işlemleri vb.) yakalar.
    admin_log_file = log_dir / "admin_activity.log"
    admin_handler = logging.FileHandler(admin_log_file, encoding='utf-8')

    # Admin logları için daha basit bir format
    admin_formatter = logging.Formatter('%(asctime)s - %(message)s')
    admin_handler.setFormatter(admin_formatter)
    admin_handler.setLevel(logging.INFO)

    # Admin logları için ayrı bir loglayıcı oluştur
    admin_logger = logging.getLogger("admin")
    admin_logger.addHandler(admin_handler)
    admin_logger.setLevel(logging.INFO)
    admin_logger.propagate = False  # Logların root loglayıcıya gitmesini engelle

    # --- Konsol Loglama ---
    # Geliştirme sırasında konsolda logları görmek için.
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # Root loglayıcıyı yapılandır
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
                product.get("source", "N/A"),
                product.get("product_name", "N/A"),
                product.get("product_code", "N/A"),
                product.get("price_str", "N/A"),
                product.get("cheapest_netflex_stock", "N/A")
            ]
            sheet.append(row)
        for col in sheet.columns:
            max_length = max(len(str(cell.value)) for cell in col if cell.value)
            sheet.column_dimensions[col[0].column_letter].width = max_length + 2
        workbook.save(filepath)
        logging.info(f"Excel dosyası oluşturuldu: {filepath}")
        admin_logger.info(f"Excel Raporu Oluşturuldu: Müşteri='{customer_name}', Dosya='{filepath}'")
        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel dosyası oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# --- Karşılaştırma Motoru ---
class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, tci_api: tci.TciScraper,
                 max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.tci_api = tci_api
        self.max_workers = max_workers
        self.search_cancelled = threading.Event()

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

        all_matches = {p['product_code']: p for p in netflex_by_name if p.get('product_code')}
        all_matches.update({p['product_code']: p for p in netflex_by_code if p.get('product_code')})

        filtered_matches = [
            p for p in all_matches.values()
            if self._are_names_similar(cleaned_sigma_name, p.get('product_name', '')) and s_num in p.get('product_code',
                                                                                                         '')
        ]

        cheapest_name, cheapest_price, cheapest_stock = "Bulunamadı", "N/A", "N/A"
        if priced_matches := [p for p in filtered_matches if
                              p.get('price_numeric') is not None and p.get('price_numeric') != float('inf')]:
            cheapest = min(priced_matches, key=lambda x: x['price_numeric'])
            cheapest_name, cheapest_price, cheapest_stock = (
                cheapest.get('product_name'), cheapest.get('price_str'), cheapest.get('stock')
            )

        return {
            "product_name": s_name, "product_number": s_num, "cas_number": cas, "brand": f"Sigma ({s_brand})",
            "sigma_variations": sigma_variations, "netflex_matches": filtered_matches,
            "cheapest_netflex_name": cheapest_name, "cheapest_netflex_price_str": cheapest_price,
            "cheapest_netflex_stock": cheapest_stock
        }

    def _process_tci_product(self, tci_product: tci.Product) -> Dict[str, Any]:
        processed_variations = []
        min_calculated_price = float('inf')
        cheapest_calculated_price_str = "N/A"

        for variation in tci_product.variations:
            original_price_str = variation.get('price', 'N/A')
            calculated_price_str = "N/A"
            calculated_price_float = None
            try:
                price_str_cleaned = re.sub(r'[^\d,.]', '', original_price_str)
                price_standardized = ""
                last_comma = price_str_cleaned.rfind(',')
                last_dot = price_str_cleaned.rfind('.')

                if last_comma > last_dot:
                    price_standardized = price_str_cleaned.replace('.', '').replace(',', '.')
                elif last_dot > last_comma:
                    price_standardized = price_str_cleaned.replace(',', '')
                else:
                    price_standardized = price_str_cleaned.replace(',', '.')

                if price_standardized:
                    price_float = float(price_standardized)
                    calculated_price = price_float * 1.4
                    calculated_price_float = calculated_price
                    calculated_price_str = f"€{calculated_price:,.2f}".replace(",", "X").replace(".", ",").replace("X",
                                                                                                                   ".")
            except (ValueError, TypeError) as e:
                logging.warning(f"TCI fiyatı parse edilemedi: '{original_price_str}'. Hata: {e}")

            processed_variations.append({
                "unit": variation.get('unit'),
                "original_price": original_price_str,
                "calculated_price": calculated_price_str
            })

            if calculated_price_float is not None and calculated_price_float < min_calculated_price:
                min_calculated_price = calculated_price_float
                cheapest_calculated_price_str = calculated_price_str

        return {
            "product_name": tci_product.name, "product_number": tci_product.code, "cas_number": tci_product.cas_number,
            "brand": "TCI", "sigma_variations": {}, "netflex_matches": [],
            "cheapest_netflex_price_str": cheapest_calculated_price_str, "cheapest_netflex_stock": "-",
            "tci_variations": processed_variations
        }

    def search_and_compare(self, search_term: str):
        self.search_cancelled.clear()
        start_time = time.monotonic()

        logging.info(f"===== YENİ BİRLEŞİK ARAMA BAŞLATILDI: '{search_term}' =====")
        admin_logger.info(f"Arama Başlatıldı: Terim='{search_term}'")

        def _search_and_process(source_name: str, search_func, process_func):
            logging.info(f"'{source_name}' arama ve işleme görevi başladı.")
            if self.search_cancelled.is_set(): return 0
            found_count = 0
            try:
                product_pages_gen = search_func(search_term, self.search_cancelled)
                for product_page in product_pages_gen:
                    if self.search_cancelled.is_set(): break
                    with ThreadPoolExecutor(max_workers=self.max_workers,
                                            thread_name_prefix=f"{source_name}-Processor") as executor:
                        futures = {executor.submit(process_func, p) for p in product_page}
                        for future in as_completed(futures):
                            if self.search_cancelled.is_set(): break
                            if result := future.result():
                                send_to_frontend("product_found", result)
                                found_count += 1
            except Exception as e:
                if not self.search_cancelled.is_set():
                    logging.error(f"{source_name} araması sırasında hata: {e}", exc_info=True)
            logging.info(f"'{source_name}' arama ve işleme görevi bitti. Bulunan: {found_count}")
            return found_count

        total_found = 0
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Search-Source") as executor:
            tasks = {
                executor.submit(_search_and_process, "Sigma", self.sigma_api.search_products,
                                self._process_sigma_product),
                executor.submit(_search_and_process, "TCI", self.tci_api.get_products, self._process_tci_product)
            }
            for future in as_completed(tasks):
                total_found += future.result()

        elapsed_time = time.monotonic() - start_time
        if not self.search_cancelled.is_set():
            admin_logger.info(
                f"Arama Tamamlandı: Terim='{search_term}', Bulunan={total_found}, Süre={elapsed_time:.2f}s")
            send_to_frontend("search_complete", {"status": "complete", "total_found": total_found,
                                                 "execution_time": round(elapsed_time, 2)})
        else:
            admin_logger.warning(f"Arama İptal Edildi: Terim='{search_term}'")

    def force_cancel(self):
        if not self.search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. Tüm görevler iptal ediliyor.")
            self.search_cancelled.set()
            send_to_frontend("search_complete", {"status": "cancelled"})


# --- Ana Fonksiyon ---
def main():
    logging.info("=" * 40 + "\n      Python Arka Plan Servisi Başlatıldı\n" + "=" * 40)

    # --- YENİ: Servis durumu ve senkronizasyon için ---
    service_status_lock = threading.Lock()
    service_status = {"sigma": False, "tci": False, "netflex": False}
    initialization_failed = threading.Event()
    # --- YENİ: Bitiş ---

    try:
        env_path = get_resource_path("config/.env")
        load_dotenv(dotenv_path=env_path)
        netflex_user, netflex_pass = os.getenv("KULLANICI"), os.getenv("SIFRE")

        netflex_api = netflex.NetflexAPI(username=netflex_user, password=netflex_pass)
        sigma_api = sigma.SigmaAldrichAPI()
        tci_api = tci.TciScraper()
        engine = ComparisonEngine(sigma_api, netflex_api, tci_api)

        atexit.register(sigma_api.stop_drivers)
        atexit.register(tci_api.close_driver)

        # YENİ: Her servis için birleştirilmiş başlatma mantığı
        def start_service(service_name, start_function):
            if initialization_failed.is_set():
                return
            try:
                start_function()
                logging.info(f"{service_name} servisi başarıyla başlatıldı ve HAZIR.")
                with service_status_lock:
                    service_status[service_name] = True
                    # Başarıyla tamamlanan her servisten sonra kontrol et
                    if all(service_status.values()):
                        logging.info("TÜM PYTHON SERVİSLERİ BAŞARIYLA BAŞLATILDI VE HAZIR.")
                        send_to_frontend("python_services_ready", True)
            except Exception as e:
                if not initialization_failed.is_set():
                    initialization_failed.set()  # Diğer thread'lerin başlamasını engelle
                    logging.critical(f"{service_name} servisi başlatılamadı: {e}", exc_info=True)
                    send_to_frontend("python_services_ready", False)

        # Servisleri paralel olarak başlat
        threading.Thread(target=start_service, args=("sigma", sigma_api.start_drivers), name="Sigma-Initializer",
                         daemon=True).start()
        threading.Thread(target=start_service, args=("tci", tci_api.reinit_driver), name="TCI-Initializer",
                         daemon=True).start()
        threading.Thread(target=start_service, args=("netflex", netflex_api.get_token), name="Netflex-Initializer",
                         daemon=True).start()

        logging.info("Tüm servis başlatma işlemleri tetiklendi. Hazır olmaları bekleniyor...")

    except Exception as e:
        logging.critical(f"Oturumlar başlatılırken kritik hata: {e}", exc_info=True)
        send_to_frontend("error", "Kritik başlatma hatası, servisler aktif değil.")
        return

    search_thread = None
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            action, data = request.get("action"), request.get("data")

            if action == "search" and data:
                if search_thread and search_thread.is_alive():
                    logging.warning("Önceki arama iptal ediliyor...")
                    engine.force_cancel()
                    search_thread.join(5.0)

                search_thread = threading.Thread(target=engine.search_and_compare, args=(data,),
                                                 name="Search-Coordinator")
                search_thread.start()

            elif action == "cancel_search":
                logging.info("Arayüzden arama iptal talebi alındı.")
                engine.force_cancel()

            elif action == "export":
                send_to_frontend("export_result", export_to_excel(data))

            elif action == "shutdown":
                logging.info("Kapatma komutu alındı. Aktif görevler iptal ediliyor ve çıkılıyor...")
                engine.force_cancel()
                if search_thread and search_thread.is_alive():
                    search_thread.join(5.0)  # Arama thread'inin bitmesini bekle
                break  # Ana döngüden çık

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası: {str(e)}")

    logging.info("Python ana döngüsü sonlandı. Temizlik işlemleri yapılıyor ve çıkılıyor.")


if __name__ == '__main__':
    main()
