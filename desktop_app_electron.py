# Gerekli Kütüphaneler: selenium, requests, mysql-connector-python, openpyxl, python-dotenv
import sys
import os
import time
import json
import atexit
import logging
import re
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED
from typing import Dict, Any, List
from pathlib import Path
from difflib import SequenceMatcher
import openpyxl
from dotenv import load_dotenv

# Bu kodlar sizin projenizden, o yüzden src importu çalışacaktır.
from src import sigma, netflex, tci


# --- PAKETLEME İÇİN DOSYA YOLU FONKSİYONU ---
def get_resource_path(relative_path: str) -> str:
    """ Geliştirme ve PyInstaller (.exe) ortamlarında doğru dosya yolunu döndürür. """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# --- Loglama Ayarları ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - (%(threadName)s) - %(message)s',
    stream=sys.stderr
)
logging.getLogger("urllib3.connectionpool").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("selenium").setLevel(logging.WARNING)

# --- MYSQL BAĞLANTI BİLGİLERİ ---
db_config = {
    'host': '192.168.19.130',
    'user': 'ezgi',
    'password': '13467928aT.',
    'database': 'interlab_data'
}


def send_to_frontend(message_type: str, data: Any):
    """
    Hazırlanan mesajı JSON formatında stdout'a yazdırır.
    Uygulama kapatıldığında oluşabilecek 'BrokenPipeError' veya 'OSError' gibi
    hataları yakalayarak programın çökmesini engeller.
    """
    try:
        message = json.dumps({"type": message_type, "data": data})
        print(message)
        sys.stdout.flush()
    except TypeError as e:
        logging.error(f"JSON serileştirme hatası: {e} - Veri: {data}")
    except (OSError, BrokenPipeError):
        pass


def export_to_excel(data: Dict[str, Any]):
    """ Excel'e ürün listesini aktarır. """
    customer_name = data.get("customerName", "Bilinmeyen_Musteri")
    products = data.get("products", [])
    safe_customer_name = re.sub(r'[\\/*?:"<>|]', "", customer_name)

    desktop_path = Path.home() / "Desktop"
    desktop_path.mkdir(exist_ok=True)
    filename = f"{safe_customer_name}_urun_listesi_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}.xlsx"
    filepath = desktop_path / filename

    try:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Ürün Listesi"

        headers = ["Ürün Adı", "Ürün Kodu", "Fiyat", "Stok Durumu (Netflex)"]
        sheet.append(headers)
        for cell in sheet["1:1"]:
            cell.font = openpyxl.styles.Font(bold=True)

        for product in products:
            row = [
                product.get("product_name", "N/A"),
                product.get("product_code", "N/A"),
                product.get("price_str", "N/A"),
                product.get("cheapest_netflex_stock", "N/A")
            ]
            sheet.append(row)

        for col in sheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = (max_length + 2)
            sheet.column_dimensions[column].width = adjusted_width

        workbook.save(filepath)
        logging.info(f"Excel dosyası başarıyla oluşturuldu: {filepath}")
        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel dosyası oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


def search_in_database(search_term: str) -> Dict[str, Any]:
    return None


def save_to_database(results_data: List[Dict[str, Any]]):
    pass


class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI,
                 tci_api: tci.TciScraper, max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.tci_api = tci_api
        self.max_workers = max_workers
        self.search_cancelled = threading.Event()

    def _clean_html(self, raw_html: str) -> str:
        if not raw_html: return ""
        return re.sub(re.compile('<.*?>'), '', raw_html)

    def _are_names_similar(self, name1: str, name2: str, threshold: float = 0.4) -> bool:
        if not name1 or not name2: return False
        similarity = SequenceMatcher(None, name1.lower(), name2.lower()).ratio()
        return similarity >= threshold

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any]:
        """ Sigma ürününü işler ve Netflex ile karşılaştırır. """
        if self.search_cancelled.is_set(): return None

        sigma_p_name = sigma_product.get('product_name_sigma')
        sigma_p_num = sigma_product.get('product_number')
        sigma_brand = sigma_product.get('brand')
        sigma_p_key = sigma_product.get('product_key')
        cas_number = sigma_product.get('cas_number', 'N/A')

        if not all([sigma_p_name, sigma_p_num, sigma_brand, sigma_p_key]): return None

        sigma_variations_by_country = self.sigma_api.get_all_product_prices(sigma_p_num, sigma_brand, sigma_p_key,
                                                                            self.search_cancelled)
        if self.search_cancelled.is_set(): return None

        cleaned_sigma_name = self._clean_html(sigma_p_name)
        netflex_matches_by_name = self.netflex_api.search_products(cleaned_sigma_name, self.search_cancelled)
        if self.search_cancelled.is_set(): return None
        netflex_matches_by_code = self.netflex_api.search_products(sigma_p_num, self.search_cancelled)
        if self.search_cancelled.is_set(): return None

        all_netflex_matches_dict = {p['product_code']: p for p in netflex_matches_by_name if p.get('product_code')}
        for p in netflex_matches_by_code:
            if p.get('product_code') and p['product_code'] not in all_netflex_matches_dict:
                all_netflex_matches_dict[p['product_code']] = p

        all_netflex_matches = list(all_netflex_matches_dict.values())
        filtered_netflex_matches = []
        for p in all_netflex_matches:
            netflex_name = p.get('product_name', '')
            netflex_code = p.get('product_code', '')
            name_similar = self._are_names_similar(cleaned_sigma_name, netflex_name)
            code_contains = sigma_p_num in netflex_code
            if name_similar and code_contains:
                if p.get('price_numeric') == float('inf'): p['price_numeric'] = None
                filtered_netflex_matches.append(p)

        cheapest_netflex_name = "Bulunamadı"
        cheapest_netflex_price_str = "N/A"
        cheapest_netflex_stock = "N/A"
        netflex_with_prices = [p for p in filtered_netflex_matches if p.get('price_numeric') is not None]
        if netflex_with_prices:
            cheapest_product = min(netflex_with_prices, key=lambda x: x['price_numeric'])
            cheapest_netflex_name = cheapest_product.get('product_name', 'İsimsiz')
            cheapest_netflex_price_str = cheapest_product.get('price_str', 'Fiyat Yok')
            cheapest_netflex_stock = cheapest_product.get('stock', 'N/A')

        return {
            "product_name": sigma_p_name, "product_number": sigma_p_num, "cas_number": cas_number,
            "brand": f"Sigma ({sigma_brand})", "sigma_variations": sigma_variations_by_country,
            "netflex_matches": filtered_netflex_matches, "cheapest_netflex_name": cheapest_netflex_name,
            "cheapest_netflex_price_str": cheapest_netflex_price_str, "cheapest_netflex_stock": cheapest_netflex_stock
        }

    def _process_tci_product(self, tci_product: tci.Product) -> Dict[str, Any]:
        """ TCI ürününü işler, en ucuz çarpılmış fiyatı bulur ve arayüze uygun formata getirir. """
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
            "product_name": tci_product.name, "product_number": tci_product.code,
            "cas_number": tci_product.cas_number, "brand": "TCI", "sigma_variations": {},
            "netflex_matches": [], "cheapest_netflex_price_str": cheapest_calculated_price_str,
            "cheapest_netflex_stock": "-", "tci_variations": processed_variations
        }

    def search_and_compare(self, search_term: str):
        """ Sigma/Netflex ve TCI aramalarını paralel olarak başlatır ve sonuçları arayüze gönderir. """
        self.search_cancelled.clear()
        start_time = time.monotonic()
        logging.info(f"===== YENİ BİRLEŞİK ARAMA BAŞLATILDI: '{search_term}' =====")

        def _search_sigma_and_netflex():
            """
            Sigma'dan ürünleri sayfa sayfa çeker, her sayfayı anında işler ve
            sonuçları arayüze gönderir. Bu, kullanıcı deneyimini iyileştirir.
            """
            if self.search_cancelled.is_set(): return 0
            if not self.sigma_api.drivers:
                logging.warning("Sigma Selenium Driver(lar) aktif değil. Sigma araması atlanıyor.")
                return 0

            found_count = 0
            product_pages_generator = self.sigma_api.search_products(search_term, self.search_cancelled)

            for product_page in product_pages_generator:
                if self.search_cancelled.is_set():
                    logging.info("Arama iptal edildi, Sigma sayfa işleme durduruluyor.")
                    break

                with ThreadPoolExecutor(max_workers=self.max_workers, thread_name_prefix="Sigma-Processor") as executor:
                    future_to_product = {executor.submit(self._process_sigma_product, p): p for p in product_page}

                    while future_to_product:
                        if self.search_cancelled.is_set():
                            for f in future_to_product: f.cancel()
                            break

                        done, not_done = wait(future_to_product, timeout=1.0, return_when=FIRST_COMPLETED)

                        for future in done:
                            try:
                                result = future.result()
                                if result:
                                    found_count += 1
                                    if not self.search_cancelled.is_set():
                                        send_to_frontend("product_found", result)
                            except Exception as exc:
                                if not self.search_cancelled.is_set():
                                    p_name = future_to_product[future].get('product_name_sigma', 'Bilinmeyen')
                                    logging.error(f"Sigma ürünü '{p_name}' işlenirken hata: {exc}", exc_info=True)
                            del future_to_product[future]
            return found_count

        def _search_tci():
            """
            TCI'dan ürünleri sayfa sayfa çeker ve sonuçları anında işleyip arayüze gönderir.
            """
            if self.search_cancelled.is_set(): return 0
            if not self.tci_api.driver:
                logging.warning("TCI Selenium Driver aktif değil. TCI araması atlanıyor.")
                return 0

            found_count = 0
            product_pages_generator = self.tci_api.get_products(search_term, self.search_cancelled)

            for product_page in product_pages_generator:
                if self.search_cancelled.is_set():
                    logging.info("Arama iptal edildi, TCI sayfa işleme durduruluyor.")
                    break

                for product in product_page:
                    if self.search_cancelled.is_set(): break
                    try:
                        processed_product = self._process_tci_product(product)
                        if not self.search_cancelled.is_set():
                            send_to_frontend("product_found", processed_product)
                        found_count += 1
                    except Exception as e:
                        if not self.search_cancelled.is_set():
                            logging.error(f"TCI ürünü '{product.name}' işlenirken hata: {e}", exc_info=True)
            return found_count

        total_found = 0
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Search-Source") as executor:
            future_tasks = {
                executor.submit(_search_sigma_and_netflex),
                executor.submit(_search_tci)
            }
            while future_tasks:
                if self.search_cancelled.is_set():
                    break

                done, future_tasks = wait(future_tasks, timeout=1.0, return_when=FIRST_COMPLETED)

                for future in done:
                    try:
                        total_found += future.result()
                    except Exception as e:
                        if not self.search_cancelled.is_set():
                            logging.error(f"Arama görevi çalıştırılırken hata oluştu: {e}", exc_info=True)

        elapsed_time = time.monotonic() - start_time
        status_message = "cancelled" if self.search_cancelled.is_set() else "complete"
        if not self.search_cancelled.is_set():
            send_to_frontend("complete", {"status": status_message, "total_found": total_found,
                                          "execution_time": round(elapsed_time, 2)})

    def force_cancel(self):
        """Arama iptal event'ini ayarlar ve tüm webdriver işlemlerini zorla sonlandırır."""
        if not self.search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. Tüm sürücüler sonlandırılıyor.")
            self.search_cancelled.set()
            # İptal durumunda 'complete' mesajı göndererek arayüzü bilgilendir
            send_to_frontend("complete", {"status": "cancelled", "total_found": 0, "execution_time": 0})
            try:
                self.sigma_api.kill_drivers()
            except Exception as e:
                logging.error(f"Sigma sürücülerini sonlandırırken hata: {e}")
            try:
                self.tci_api.kill_driver()
            except Exception as e:
                logging.error(f"TCI sürücüsünü sonlandırırken hata: {e}")
            logging.info("Tüm sürücü sonlandırma komutları gönderildi.")


def main():
    logging.info("========================================")
    logging.info("      Python Arka Plan Servisi Başlatıldı")
    logging.info("========================================")

    sigma_api = None
    netflex_api = None
    tci_api = None
    comparison_engine = None
    try:
        logging.info("Uygulama oturumları başlatılıyor...")
        env_path = get_resource_path("config/.env")
        load_dotenv(dotenv_path=env_path)
        netflex_user = os.getenv("KULLANICI")
        netflex_pass = os.getenv("SIFRE")
        netflex_api = netflex.NetflexAPI(username=netflex_user, password=netflex_pass)
        sigma_api = sigma.SigmaAldrichAPI()
        tci_api = tci.TciScraper()
        comparison_engine = ComparisonEngine(sigma_api, netflex_api, tci_api)
        netflex_token = netflex_api.get_token()
        if not netflex_token:
            logging.error("KRİTİK: Netflex oturumu başlatılamadı.")
        else:
            logging.info("Netflex oturumu başarıyla başlatıldı.")

        atexit.register(sigma_api.stop_drivers)
        atexit.register(tci_api.close_driver)

    except Exception as e:
        logging.critical(f"Oturumlar başlatılırken kritik hata: {e}", exc_info=True)
        if sigma_api: atexit.register(sigma_api.stop_drivers)
        if tci_api: atexit.register(tci_api.close_driver)

    send_to_frontend("services_ready", True)
    logging.info("Servis hazır. Arayüzden komutlar bekleniyor...")

    search_thread = None
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try:
            request = json.loads(line)
            action = request.get("action")
            data = request.get("data")

            if action == "search":
                search_term = data
                if not search_term: continue
                if not comparison_engine:
                    send_to_frontend("error", "Arama motoru başlatılamadı.")
                    continue

                # Önceki arama thread'i hala çalışıyorsa, yeni bir tane başlatma
                if search_thread and search_thread.is_alive():
                    logging.warning("Devam eden bir arama varken yeni arama isteği geldi. Önceki iptal ediliyor.")
                    comparison_engine.force_cancel()
                    search_thread.join(timeout=2.0)  # Eski thread'in bitmesini bekle

                if not sigma_api.drivers: sigma_api.start_drivers()
                if not tci_api.driver: tci_api.reinit_driver()

                search_thread = threading.Thread(target=comparison_engine.search_and_compare, args=(search_term,),
                                                 name="Search-Coordinator")
                search_thread.start()

            elif action == "cancel_search":
                if comparison_engine:
                    logging.info("Arayüzden arama iptal talebi alındı.")
                    comparison_engine.force_cancel()

            elif action == "export":
                result = export_to_excel(data)
                send_to_frontend("export_result", result)

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı alındı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası oluştu: {str(e)}")


if __name__ == '__main__':
    main()

