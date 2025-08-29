# Gerekli Kütüphaneler: selenium, requests, mysql-connector-python, openpyxl
import sys
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

from src import sigma, netflex

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
    """Hazırlanan mesajı JSON formatında stdout'a yazdırır."""
    message = json.dumps({"type": message_type, "data": data})
    print(message)
    sys.stdout.flush()


def export_to_excel(data: Dict[str, Any]):
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

        headers = ["Ürün Adı", "Ürün Kodu", "Fiyat"]
        sheet.append(headers)
        for cell in sheet["1:1"]:
            cell.font = openpyxl.styles.Font(bold=True)

        for product in products:
            row = [
                product.get("product_name", "N/A"),
                product.get("product_code", "N/A"),
                product.get("price_str", "N/A")
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
    # This function remains unchanged.
    return None


def save_to_database(results_data: List[Dict[str, Any]]):
    # This function remains unchanged.
    if not results_data: return
    connection = None
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        logging.info(f"Veritabanına {len(results_data)} ürün kaydediliyor/güncelleniyor...")
        for product in results_data:
            sql_product = """
                INSERT INTO products (product_number, product_name, cas_number, brand, cheapest_netflex_name, cheapest_netflex_price_str)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    product_name=VALUES(product_name), cas_number=VALUES(cas_number), brand=VALUES(brand), 
                    cheapest_netflex_name=VALUES(cheapest_netflex_name), cheapest_netflex_price_str=VALUES(cheapest_netflex_price_str);
            """
            product_data = (
                product.get('product_number'), product.get('product_name'), product.get('cas_number'),
                product.get('brand'), product.get('cheapest_netflex_name'), product.get('cheapest_netflex_price_str')
            )
            cursor.execute(sql_product, product_data)
            cursor.execute("SELECT id FROM products WHERE product_number = %s", (product.get('product_number'),))
            product_id = cursor.fetchone()[0]
            cursor.execute("DELETE FROM prices WHERE product_id = %s", (product_id,))
            for comp in product.get('comparison', []):
                sql_price = """
                    INSERT INTO prices (product_id, source, variant_product_name, variant_product_code, price_numeric, price_str)
                    VALUES (%s, %s, %s, %s, %s, %s);
                """
                price_data = (
                    product_id, comp.get('source'), comp.get('product_name'), comp.get('product_code'),
                    comp.get('price_numeric'), comp.get('price_str')
                )
                cursor.execute(sql_price, price_data)
        connection.commit()
    except Error as e:
        logging.error(f"Veritabanına kaydetme hatası: {e}")
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()


class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.max_workers = max_workers

    def _clean_html(self, raw_html: str) -> str:
        if not raw_html: return ""
        return re.sub(re.compile('<.*?>'), '', raw_html)

    def _are_names_similar(self, name1: str, name2: str, threshold: float = 0.6) -> bool:
        if not name1 or not name2: return False
        similarity = SequenceMatcher(None, name1.lower(), name2.lower()).ratio()
        logging.info(f"İsim Benzerlik Kontrolü: '{name1.lower()}' vs '{name2.lower()}' -> Oran: {similarity:.2f}")
        return similarity >= threshold

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any]:
        sigma_p_name = sigma_product.get('product_name_sigma')
        sigma_p_num = sigma_product.get('product_number')
        sigma_brand = sigma_product.get('brand')
        sigma_p_key = sigma_product.get('product_key')
        cas_number = sigma_product.get('cas_number', 'N/A')

        if not all([sigma_p_name, sigma_p_num, sigma_brand, sigma_p_key]): return None

        all_price_info = self.sigma_api.get_all_product_prices(sigma_p_num, sigma_brand, sigma_p_key)

        # Türkiye Fiyatını İşle
        sigma_price_info_tr = all_price_info.get('tr', {})
        sigma_price_tr = sigma_price_info_tr.get('price')
        sigma_price_numeric_tr = None
        sigma_price_str_tr = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price_tr, (int, float)) and sigma_price_tr > 0:
            sigma_price_numeric_tr = sigma_price_tr
            sigma_price_str_tr = f"{sigma_price_tr} {sigma_price_info_tr.get('currency', 'TRY')}".strip()

        # ABD Fiyatını İşle
        sigma_price_info_us = all_price_info.get('us', {})
        sigma_price_us = sigma_price_info_us.get('price')
        sigma_price_numeric_us = None
        sigma_price_str_us = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price_us, (int, float)) and sigma_price_us > 0:
            sigma_price_numeric_us = sigma_price_us
            sigma_price_str_us = f"{sigma_price_us} {sigma_price_info_us.get('currency', 'USD')}".strip()

        # Almanya Fiyatını İşle (YENİ)
        sigma_price_info_de = all_price_info.get('de', {})
        sigma_price_de = sigma_price_info_de.get('price')
        sigma_price_numeric_de = None
        sigma_price_str_de = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price_de, (int, float)) and sigma_price_de > 0:
            sigma_price_numeric_de = sigma_price_de
            sigma_price_str_de = f"{sigma_price_de} {sigma_price_info_de.get('currency', 'EUR')}".strip()

        # İngiltere Fiyatını İşle (YENİ)
        sigma_price_info_gb = all_price_info.get('gb', {})
        sigma_price_gb = sigma_price_info_gb.get('price')
        sigma_price_numeric_gb = None
        sigma_price_str_gb = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price_gb, (int, float)) and sigma_price_gb > 0:
            sigma_price_numeric_gb = sigma_price_gb
            sigma_price_str_gb = f"{sigma_price_gb} {sigma_price_info_gb.get('currency', 'GBP')}".strip()

        formatted_sigma_tr = {"source": "Sigma-Aldrich (TR)", "product_name": sigma_p_name, "product_code": sigma_p_num,
                              "price_numeric": sigma_price_numeric_tr, "price_str": sigma_price_str_tr}
        formatted_sigma_us = {"source": "Sigma-Aldrich (US)", "product_name": sigma_p_name, "product_code": sigma_p_num,
                              "price_numeric": sigma_price_numeric_us, "price_str": sigma_price_str_us}
        formatted_sigma_de = {"source": "Sigma-Aldrich (DE)", "product_name": sigma_p_name, "product_code": sigma_p_num,
                              "price_numeric": sigma_price_numeric_de, "price_str": sigma_price_str_de}
        formatted_sigma_gb = {"source": "Sigma-Aldrich (GB)", "product_name": sigma_p_name, "product_code": sigma_p_num,
                              "price_numeric": sigma_price_numeric_gb, "price_str": sigma_price_str_gb}

        cleaned_sigma_name = self._clean_html(sigma_p_name)

        logging.info(f"Netflex'te '{sigma_p_num}' (kod) ve '{cleaned_sigma_name}' (isim) ile arama yapılıyor.")
        netflex_matches_by_code = self.netflex_api.search_products(sigma_p_num)

        netflex_matches_by_name = []
        if sigma_p_num.lower() != cleaned_sigma_name.lower():
            netflex_matches_by_name = self.netflex_api.search_products(cleaned_sigma_name)

        all_netflex_matches_dict = {p['product_code']: p for p in netflex_matches_by_code if p.get('product_code')}
        for p in netflex_matches_by_name:
            if p.get('product_code') and p['product_code'] not in all_netflex_matches_dict:
                all_netflex_matches_dict[p['product_code']] = p

        all_netflex_matches = list(all_netflex_matches_dict.values())

        filtered_netflex_matches = []
        for p in all_netflex_matches:
            netflex_name = p.get('product_name', '')
            netflex_code = p.get('product_code', '')

            name_similar = self._are_names_similar(cleaned_sigma_name, netflex_name, threshold=0.4)
            code_contains = sigma_p_num in netflex_code

            if name_similar and code_contains:
                filtered_netflex_matches.append(p)
            else:
                logging.warning(
                    f"Eşleşme Atlandı (İsim/Kod Uyuşmazlığı): Sigma Adı='{cleaned_sigma_name}', Netflex Adı='{netflex_name}' | Sigma Kodu='{sigma_p_num}', Netflex Kodu='{netflex_code}'"
                )

        cheapest_netflex_name = "Bulunamadı"
        cheapest_netflex_price_str = "N/A"
        if filtered_netflex_matches:
            for p in filtered_netflex_matches:
                if p.get('price_numeric') == float('inf'):
                    p['price_numeric'] = None
            netflex_with_prices = [p for p in filtered_netflex_matches if p.get('price_numeric') is not None]
            if netflex_with_prices:
                cheapest_product = min(netflex_with_prices, key=lambda x: x['price_numeric'])
                cheapest_netflex_name = cheapest_product.get('product_name', 'İsimsiz')
                cheapest_netflex_price_str = cheapest_product.get('price_str', 'Fiyat Yok')

        comparison_list = [formatted_sigma_tr, formatted_sigma_us, formatted_sigma_de,
                           formatted_sigma_gb] + filtered_netflex_matches
        comparison_list.sort(
            key=lambda x: x.get('price_numeric') if x.get('price_numeric') is not None else float('inf'))

        for item in comparison_list:
            if item.get('price_numeric') == float('inf'):
                item['price_numeric'] = None

        return {"product_name": sigma_p_name, "product_number": sigma_p_num, "cas_number": cas_number,
                "brand": f"Sigma ({sigma_brand})",
                "sigma_price_str": sigma_price_str_tr,
                "sigma_price_str_us": sigma_price_str_us,
                "sigma_price_str_de": sigma_price_str_de,
                "sigma_price_str_gb": sigma_price_str_gb,
                "cheapest_netflex_name": cheapest_netflex_name,
                "cheapest_netflex_price_str": cheapest_netflex_price_str, "comparison": comparison_list}

    def search_and_compare(self, search_term: str):
        start_time = time.monotonic()
        logging.info(f"===== YENİ WEB ARAMASI BAŞLATILDI: '{search_term}' =====")

        if not self.sigma_api.drivers.get('tr'):
            logging.critical("Kritik Hata: Selenium TR Driver aktif değil.")
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


sigma_api = sigma.SigmaAldrichAPI()
netflex_api = netflex.NetflexAPI()
comparison_engine = ComparisonEngine(sigma_api, netflex_api)


def main():
    logging.info("========================================")
    logging.info("      Python Arka Plan Servisi Başlatıldı")
    logging.info("========================================")

    logging.info("Uygulama oturumları başlatılıyor...")
    try:
        netflex_token = netflex_api.get_token()
        if not netflex_token:
            logging.error("KRİTİK: Netflex oturumu başlatılamadı.")
        else:
            logging.info("Netflex oturumu başarıyla başlatıldı.")

        sigma_api.start_drivers()

        if not sigma_api.drivers.get('tr'):
            logging.error("KRİTİK: Sigma (TR) oturumu başlatılamadı.")
        if not sigma_api.drivers.get('us'):
            logging.error("KRİTİK: Sigma (US) oturumu proxy ile başlatılamadı.")
        if not sigma_api.drivers.get('de'):
            logging.error("KRİTİK: Sigma (DE) oturumu başlatılamadı.")
        if not sigma_api.drivers.get('gb'):
            logging.error("KRİTİK: Sigma (GB) oturumu başlatılamadı.")

    except Exception as e:
        logging.critical(f"Oturumlar başlatılırken hata: {e}", exc_info=True)

    atexit.register(sigma_api.stop_drivers)
    logging.info("Servis hazır. Komutlar bekleniyor...")

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
                db_results = search_in_database(search_term)
                if db_results:
                    logging.info(f"'{search_term}' için sonuçlar veritabanından anında bulundu.")
                    print(json.dumps(db_results))
                    sys.stdout.flush()
                    continue
                comparison_engine.search_and_compare(search_term)
            elif action == "export":
                logging.info("Excel dışa aktarma talebi alındı.")
                result = export_to_excel(data)
                send_to_frontend("export_result", result)
            else:
                logging.warning(f"Bilinmeyen eylem alındı: {action}")
        except json.JSONDecodeError as e:
            logging.error(f"Geçersiz JSON formatı alındı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası oluştu: {e}")


if __name__ == '__main__':
    main()

