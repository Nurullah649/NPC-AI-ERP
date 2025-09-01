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
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED, as_completed
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


# --- Loglama Ayarları ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - (%(threadName)s) - %(message)s',
    stream=sys.stderr
)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("selenium").setLevel(logging.WARNING)


def send_to_frontend(message_type: str, data: Any):
    try:
        message = json.dumps({"type": message_type, "data": data})
        print(message, flush=True)
    except (TypeError, OSError, BrokenPipeError) as e:
        logging.error(f"Frontend'e mesaj gönderilemedi: {e}")


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
        headers = ["Ürün Adı", "Ürün Kodu", "Fiyat", "Stok Durumu (Netflex)"]
        sheet.append(headers)
        for cell in sheet["1:1"]: cell.font = openpyxl.styles.Font(bold=True)
        for product in products:
            row = [
                product.get("product_name", "N/A"), product.get("product_code", "N/A"),
                product.get("price_str", "N/A"), product.get("cheapest_netflex_stock", "N/A")
            ]
            sheet.append(row)
        for col in sheet.columns:
            max_length = max(len(str(cell.value)) for cell in col if cell.value)
            sheet.column_dimensions[col[0].column_letter].width = max_length + 2
        workbook.save(filepath)
        logging.info(f"Excel dosyası oluşturuldu: {filepath}")
        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel dosyası oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


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

        sigma_variations = self.sigma_api.get_all_product_prices(s_num, s_brand, s_key, self.search_cancelled)
        if self.search_cancelled.is_set(): return None

        cleaned_sigma_name = self._clean_html(s_name)

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_by_name = executor.submit(self.netflex_api.search_products, cleaned_sigma_name,
                                             self.search_cancelled)
            future_by_code = executor.submit(self.netflex_api.search_products, s_num, self.search_cancelled)
            netflex_by_name = future_by_name.result() or []
            netflex_by_code = future_by_code.result() or []

        if self.search_cancelled.is_set(): return None

        all_matches = {p['product_code']: p for p in netflex_by_name if p.get('product_code')}
        all_matches.update({p['product_code']: p for p in netflex_by_code if p.get('product_code')})

        filtered_matches = [
            p for p in all_matches.values()
            if self._are_names_similar(cleaned_sigma_name, p.get('product_name', '')) and s_num in p.get('product_code',
                                                                                                         '')
        ]

        for match in filtered_matches:
            if match.get('price_numeric') == float('inf'):
                match['price_numeric'] = None

        cheapest_name, cheapest_price, cheapest_stock = "Bulunamadı", "N/A", "N/A"
        if priced_matches := [p for p in filtered_matches if p.get('price_numeric') is not None]:
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
        processed_vars, min_price, cheapest_price_str = [], float('inf'), "N/A"
        for var in tci_product.variations:
            price_str, calc_price_str, calc_price_float = var.get('price', 'N/A'), "N/A", None
            try:
                price_cleaned = re.sub(r'[^\d,.]', '', price_str).replace('.', '').replace(',', '.')
                price_float = float(price_cleaned) * 1.4
                calc_price_float = price_float
                calc_price_str = f"€{price_float:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            except (ValueError, TypeError):
                pass
            processed_vars.append(
                {"unit": var.get('unit'), "original_price": price_str, "calculated_price": calc_price_str})
            if calc_price_float is not None and calc_price_float < min_price:
                min_price, cheapest_price_str = calc_price_float, calc_price_str
        return {
            "product_name": tci_product.name, "product_number": tci_product.code, "cas_number": tci_product.cas_number,
            "brand": "TCI", "sigma_variations": {}, "netflex_matches": [],
            "cheapest_netflex_price_str": cheapest_price_str, "cheapest_netflex_stock": "-",
            "tci_variations": processed_vars
        }

    def search_and_compare(self, search_term: str, driver_init_events: Dict[str, threading.Event]):
        self.search_cancelled.clear()
        start_time = time.monotonic()
        logging.info(f"===== YENİ BİRLEŞİK ARAMA BAŞLATILDI: '{search_term}' =====")

        for source, event in driver_init_events.items():
            if not event.is_set():
                logging.info(f"'{source}' tarayıcısının hazır olması bekleniyor...")
                event.wait()
                logging.info(f"'{source}' tarayıcısı hazır.")

        def _search_and_process(source_name: str, search_func, process_func):
            logging.info(f"'{source_name}' arama ve işleme görevi başladı.")
            if self.search_cancelled.is_set(): return 0
            found_count = 0
            pages_yielded = 0
            try:
                product_pages_gen = search_func(search_term, self.search_cancelled)
                for product_page in product_pages_gen:
                    pages_yielded += 1
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

            # HATA TESPİTİ: Eğer ürün bulunduğu loglandığı halde hiç ürün sayfası işlenmediyse, bir uyarı ver.
            if pages_yielded == 0 and not self.search_cancelled.is_set():
                logging.warning(
                    f"'{source_name}' arama fonksiyonu hiç ürün sayfası döndürmedi (yield). Bu durum, kaynak sitede ürün bulunamadığında normal olabilir, ancak loglarda ürün bulunduğu belirtiliyorsa scraper'da (örn: tci.py) bir sorun olabilir.")

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
            send_to_frontend("complete", {"status": "complete", "total_found": total_found,
                                          "execution_time": round(elapsed_time, 2)})

    def force_cancel(self):
        if not self.search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. Tüm sürücüler sonlandırılıyor.")
            self.search_cancelled.set()
            send_to_frontend("complete", {"status": "cancelled", "total_found": 0, "execution_time": 0})
            with ThreadPoolExecutor(max_workers=2) as killer:
                killer.submit(self.sigma_api.kill_drivers)
                killer.submit(self.tci_api.kill_driver)
            logging.info("Tüm sürücü sonlandırma komutları gönderildi.")


def main():
    logging.info("=" * 40 + "\n      Python Arka Plan Servisi Başlatıldı\n" + "=" * 40)
    try:
        env_path = get_resource_path("config/.env")
        load_dotenv(dotenv_path=env_path)
        netflex_user, netflex_pass = os.getenv("KULLANICI"), os.getenv("SIFRE")

        netflex_api = netflex.NetflexAPI(username=netflex_user, password=netflex_pass)
        sigma_api = sigma.SigmaAldrichAPI()
        tci_api = tci.TciScraper()
        engine = ComparisonEngine(sigma_api, netflex_api, tci_api)

        if not netflex_api.get_token():
            logging.error("KRİTİK: Netflex oturumu başlatılamadı.")
        else:
            logging.info("Netflex oturumu başarıyla başlatıldı.")

        atexit.register(sigma_api.stop_drivers)
        atexit.register(tci_api.close_driver)

        driver_init_events = {"Sigma": threading.Event(), "TCI": threading.Event()}

        def start_sigma():
            sigma_api.start_drivers()
            driver_init_events["Sigma"].set()

        def start_tci():
            tci_api.reinit_driver()
            driver_init_events["TCI"].set()

        threading.Thread(target=start_sigma, name="Sigma-Initializer", daemon=True).start()
        threading.Thread(target=start_tci, name="TCI-Initializer", daemon=True).start()

        def wait_for_services_and_signal():
            for event in driver_init_events.values():
                event.wait()
            while not netflex_api.token:
                time.sleep(0.1)
            logging.info("Tüm servisler (Sigma, TCI, Netflex) hazır. Arayüze sinyal gönderiliyor.")
            send_to_frontend("services_ready", True)

        threading.Thread(target=wait_for_services_and_signal, name="Service-Ready-Waiter", daemon=True).start()
        logging.info("Servis başlatma işlemleri tetiklendi. Hazır olmaları bekleniyor...")

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

                search_thread = threading.Thread(target=engine.search_and_compare, args=(data, driver_init_events),
                                                 name="Search-Coordinator")
                search_thread.start()

            elif action == "cancel_search":
                logging.info("Arayüzden arama iptal talebi alındı.")
                engine.force_cancel()

            elif action == "export":
                send_to_frontend("export_result", export_to_excel(data))

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası: {str(e)}")


if __name__ == '__main__':
    main()

