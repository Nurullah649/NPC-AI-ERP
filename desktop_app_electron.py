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
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List
from pathlib import Path
from difflib import SequenceMatcher

import requests
from requests.adapters import HTTPAdapter
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import mysql.connector
from mysql.connector import Error
import openpyxl
from dotenv import load_dotenv

# Bu kodlar sizin projenizden, o yüzden src importu çalışacaktır.
from src import sigma, netflex


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
    """ ### GÜNCELLENDİ: Excel'e Stok Bilgisi Eklendi ### """
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

        # Başlıklara stok durumu eklendi
        headers = ["Ürün Adı", "Ürün Kodu", "Fiyat", "Stok Durumu (Netflex)"]  ### GÜNCELLENDİ ###
        sheet.append(headers)
        for cell in sheet["1:1"]:
            cell.font = openpyxl.styles.Font(bold=True)

        for product in products:
            # Her bir satıra stok bilgisi eklendi
            row = [
                product.get("product_name", "N/A"),
                product.get("product_code", "N/A"),
                product.get("price_str", "N/A"),
                product.get("cheapest_netflex_stock", "N/A")  ### GÜNCELLENDİ ###
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
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.max_workers = max_workers

    def _clean_html(self, raw_html: str) -> str:
        if not raw_html: return ""
        return re.sub(re.compile('<.*?>'), '', raw_html)

    def _are_names_similar(self, name1: str, name2: str, threshold: float = 0.4) -> bool:
        if not name1 or not name2: return False
        similarity = SequenceMatcher(None, name1.lower(), name2.lower()).ratio()
        return similarity >= threshold

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any]:
        """ ### GÜNCELLENDİ: En ucuz Netflex ürününün stok bilgisini de alacak şekilde güncellendi. ### """
        sigma_p_name = sigma_product.get('product_name_sigma')
        sigma_p_num = sigma_product.get('product_number')
        sigma_brand = sigma_product.get('brand')
        sigma_p_key = sigma_product.get('product_key')
        cas_number = sigma_product.get('cas_number', 'N/A')

        if not all([sigma_p_name, sigma_p_num, sigma_brand, sigma_p_key]): return None

        sigma_variations_by_country = self.sigma_api.get_all_product_prices(sigma_p_num, sigma_brand, sigma_p_key)
        cleaned_sigma_name = self._clean_html(sigma_p_name)

        # Netflex'ten gelen yanıtta artık 'stock' anahtarı da var.
        netflex_matches_by_name = self.netflex_api.search_products(cleaned_sigma_name)
        netflex_matches_by_code = self.netflex_api.search_products(sigma_p_num)

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
        cheapest_netflex_stock = "N/A"  ### YENİ ###

        netflex_with_prices = [p for p in filtered_netflex_matches if p.get('price_numeric') is not None]
        if netflex_with_prices:
            cheapest_product = min(netflex_with_prices, key=lambda x: x['price_numeric'])
            cheapest_netflex_name = cheapest_product.get('product_name', 'İsimsiz')
            cheapest_netflex_price_str = cheapest_product.get('price_str', 'Fiyat Yok')
            cheapest_netflex_stock = cheapest_product.get('stock',
                                                          'N/A')  ### YENİ: En ucuz ürünün stok bilgisi alınıyor.

        return {
            "product_name": sigma_p_name,
            "product_number": sigma_p_num,
            "cas_number": cas_number,
            "brand": f"Sigma ({sigma_brand})",
            "sigma_variations": sigma_variations_by_country,
            "netflex_matches": filtered_netflex_matches,
            "cheapest_netflex_name": cheapest_netflex_name,
            "cheapest_netflex_price_str": cheapest_netflex_price_str,
            "cheapest_netflex_stock": cheapest_netflex_stock  ### YENİ: Stok bilgisi sonuca ekleniyor.
        }

    def search_and_compare(self, search_term: str):
        start_time = time.monotonic()
        logging.info(f"===== YENİ WEB ARAMASI BAŞLATILDI: '{search_term}' =====")

        if not self.sigma_api.drivers:
            logging.critical("Kritik Hata: Selenium Driver(lar) aktif değil.")
            send_to_frontend("error", "Selenium Driver başlatılamadı.")
            return

        sigma_products = self.sigma_api.search_products(search_term)
        if not sigma_products:
            logging.info("Sigma'da hiç ürün bulunamadı. Web araması sonlandırıldı.")
            send_to_frontend("complete", {"status": "complete", "total_found": 0,
                                          "execution_time": round(time.monotonic() - start_time, 2)})
            return

        total_to_process = len(sigma_products)
        send_to_frontend("progress", {"status": "found_sigma", "total": total_to_process, "processed": 0})

        processed_count = 0
        found_and_matched_products = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_product = {executor.submit(self._process_sigma_product, p): p for p in sigma_products}
            for future in as_completed(future_to_product):
                try:
                    result = future.result()
                    processed_count += 1
                    if result:
                        found_and_matched_products.append(result)
                        send_to_frontend("product_found", result)
                    send_to_frontend("progress",
                                     {"status": "processing", "total": total_to_process, "processed": processed_count})
                except Exception as exc:
                    processed_count += 1
                    p_name = future_to_product[future].get('product_name_sigma', 'Bilinmeyen')
                    logging.error(f"'{p_name}' işlenirken hata: {exc}", exc_info=True)
                    send_to_frontend("progress",
                                     {"status": "processing", "total": total_to_process, "processed": processed_count})

        if found_and_matched_products:
            save_to_database(found_and_matched_products)

        elapsed_time = time.monotonic() - start_time
        send_to_frontend("complete", {"status": "complete", "total_found": len(found_and_matched_products),
                                      "execution_time": round(elapsed_time, 2)})


def main():
    logging.info("========================================")
    logging.info("      Python Arka Plan Servisi Başlatıldı")
    logging.info("========================================")

    sigma_api = None
    netflex_api = None
    comparison_engine = None
    try:
        logging.info("Uygulama oturumları başlatılıyor...")

        env_path = get_resource_path("config/.env")
        load_dotenv(dotenv_path=env_path)

        netflex_user = os.getenv("KULLANICI")
        netflex_pass = os.getenv("SIFRE")

        netflex_api = netflex.NetflexAPI(username=netflex_user, password=netflex_pass)
        sigma_api = sigma.SigmaAldrichAPI()
        comparison_engine = ComparisonEngine(sigma_api, netflex_api)

        netflex_token = netflex_api.get_token()
        if not netflex_token:
            logging.error("KRİTİK: Netflex oturumu başlatılamadı.")
        else:
            logging.info("Netflex oturumu başarıyla başlatıldı.")

        sigma_api.start_drivers()
        atexit.register(sigma_api.stop_drivers)

    except Exception as e:
        logging.critical(f"Oturumlar başlatılırken kritik hata: {e}", exc_info=True)
        if sigma_api:
            atexit.register(sigma_api.stop_drivers)

    send_to_frontend("services_ready", True)
    logging.info("Servis hazır. Arayüzden komutlar bekleniyor...")

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
                    logging.error("Arama motoru başlatılamadığı için arama yapılamıyor.")
                    send_to_frontend("error", "Arama motoru başlatılamadı. Lütfen uygulamayı yeniden başlatın.")
                    continue

                db_results = search_in_database(search_term)
                if db_results:
                    send_to_frontend("database_results", db_results)
                    continue

                comparison_engine.search_and_compare(search_term)

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
