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


# YENİ: Arayüze standart formatta mesaj göndermek için yardımcı fonksiyon
def send_to_frontend(message_type: str, data: Any):
    """Hazırlanan mesajı JSON formatında stdout'a yazdırır."""
    message = json.dumps({"type": message_type, "data": data})
    print(message)
    sys.stdout.flush()


# ==============================================================================
# EXCEL OLUŞTURMA FONKSİYONU
# ==============================================================================
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


# ==============================================================================
# VERİTABANI VE API SINIFLARI (Değişiklik yok)
# ==============================================================================

def search_in_database(search_term: str) -> Dict[str, Any]:
    start_time = time.monotonic()
    logging.info(f"Yerel veritabanında '{search_term}' için arama yapılıyor...")
    results_list = []
    connection = None
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)
        if re.match(r'^\d{2,7}-\d{2}-\d$', search_term):
            query = "SELECT * FROM products WHERE cas_number = %s"
            params = (search_term,)
        elif search_term.isdigit():
            query = "SELECT * FROM products WHERE product_number = %s"
            params = (search_term,)
        else:
            query = "SELECT * FROM products WHERE product_name LIKE %s OR product_number LIKE %s"
            params = (f"%{search_term}%", f"%{search_term}%")
        cursor.execute(query, params)
        products_found = cursor.fetchall()
        if not products_found:
            logging.info("Veritabanında sonuç bulunamadı.")
            return None
        logging.info(f"Veritabanında {len(products_found)} adet eşleşen ana ürün bulundu.")
        for product in products_found:
            cursor.execute("SELECT * FROM prices WHERE product_id = %s ORDER BY price_numeric ASC", (product['id'],))
            prices_found = cursor.fetchall()
            comparison_list = []
            for price in prices_found:
                comparison_list.append({
                    "source": price['source'],
                    "product_name": price['variant_product_name'],
                    "product_code": price['variant_product_code'],
                    "price_numeric": float(price['price_numeric']) if price['price_numeric'] is not None else None,
                    "price_str": price['price_str']
                })
            results_list.append({
                "product_name": product['product_name'],
                "product_number": product['product_number'],
                "cas_number": product['cas_number'],
                "brand": product['brand'],
                "sigma_price_str": next((p['price_str'] for p in comparison_list if p['source'] == 'Sigma-Aldrich'),
                                        "N/A"),
                "cheapest_netflex_name": product['cheapest_netflex_name'],
                "cheapest_netflex_price_str": product['cheapest_netflex_price_str'],
                "comparison": comparison_list
            })
        elapsed_time = time.monotonic() - start_time
        # GÜNCELLEME: Veritabanı sonucu da artık standart formatta gönderiliyor.
        return {"type": "database_results", "data": {"results": results_list, "execution_time": round(elapsed_time, 2)}}
    except Error as e:
        logging.error(f"Veritabanı arama hatası: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()


def save_to_database(results_data: List[Dict[str, Any]]):
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


class NetflexAPI:
    def __init__(self, max_workers=10):
        self.credentials = {"adi": "Siparis@tales.com.tr", "sifre": "951038aa--"}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()

    def get_token(self):
        with self.token_lock:
            if self.token and (time.time() - self.token_last_updated < 3540): return self.token
            logging.info("Netflex: Yeni token alınıyor...")
            login_url = "https://netflex-api.interlab.com.tr/Users/authenticate/"
            headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            try:
                response = self.session.post(login_url, headers=headers, json=self.credentials, timeout=60)
                response.raise_for_status()
                token_data = response.json()
                if token_data and 'accessToken' in token_data:
                    self.token = token_data['accessToken']
                    self.token_last_updated = time.time()
                    logging.info("Netflex: Giriş başarılı, yeni token alındı.")
                    return self.token
            except requests.exceptions.RequestException as e:
                logging.error(f"Netflex HATA: Giriş sırasında bir ağ hatası oluştu: {e}")
            return None

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        token = self.get_token()
        if not token: return []
        logging.info(f"Netflex: '{search_term}' için ürün aranıyor...")
        timestamp = int(time.time() * 1000)
        search_url = f"https://netflex-api.interlab.com.tr/common/urun_sorgula?filter={search_term}&userId=285&nOfItems=250&_={timestamp}"
        headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0'}
        try:
            response = self.session.get(search_url, headers=headers, timeout=60)
            response.raise_for_status()
            products = response.json()
            found_products = []
            if isinstance(products, list):
                for product in products:
                    price_value = product.get('urn_Fiyat')
                    currency = product.get('urn_FiyatDovizi', '')
                    price_numeric = float('inf')
                    price_str = "Fiyat Bilgisi Yok"
                    if isinstance(price_value, (int, float)) and price_value > 0:
                        price_numeric = float(price_value)
                        price_str = f"{price_value} {currency}".strip()
                    found_products.append({
                        "source": "Netflex", "product_name": product.get('urn_Adi'),
                        "product_code": product.get('urn_Kodu'), "price_numeric": price_numeric,
                        "price_str": price_str
                    })
            return found_products
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logging.error(f"Netflex Arama HATA ('{search_term}'): {e}")
        return []


class SigmaAldrichAPI:
    def __init__(self):
        self.driver = None
        self.driver_lock = threading.Lock()

    def start_driver(self):
        with self.driver_lock:
            if self.driver: return self.driver
            logging.info("Selenium WebDriver başlatılıyor...")
            options = webdriver.ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument(
                "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument("--disable-blink-features=AutomationControlled")
            try:
                self.driver = webdriver.Chrome(options=options)
                self.driver.set_script_timeout(120)
                logging.info("Selenium WebDriver başarıyla başlatıldı.")
                self.driver.get("https://www.sigmaaldrich.com/TR/en")
                try:
                    cookie_wait = WebDriverWait(self.driver, 10)
                    accept_button = cookie_wait.until(
                        EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
                    self.driver.execute_script("arguments[0].click();", accept_button)
                    logging.info("Çerez onayı tıklandı (JS ile).")
                except TimeoutException:
                    logging.debug("Çerez onayı butonu bulunamadı.")
                return self.driver
            except Exception as e:
                logging.critical(f"WebDriver başlatılamadı: {e}", exc_info=True)
                self.driver = None
                return None

    def stop_driver(self):
        with self.driver_lock:
            if self.driver:
                logging.info("Selenium WebDriver kapatılıyor.")
                self.driver.quit()
                self.driver = None

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        if not self.driver: return []
        logging.info(f"Sigma (Tarayıcı Konsolu): '{search_term}' için arama yapılıyor...")
        query = "query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) { getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) { items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } } } }"
        all_products = []
        current_page = 1
        while True:
            variables = {"searchTerm": search_term, "page": current_page, "group": "substance", "selectedFacets": [],
                         "sort": "relevance", "type": "PRODUCT"}
            variables_json = json.dumps(variables)
            js_script = f'const cb=arguments[arguments.length-1];fetch("https://www.sigmaaldrich.com/api/graphql",{{headers:{{"accept":"*/*","content-type":"application/json","x-gql-country":"TR","x-gql-language":"en"}},body:JSON.stringify({{"operationName":"ProductSearch","variables":{variables_json},"query":`{query}`}}),method:"POST"}}).then(r=>r.json()).then(d=>cb(d)).catch(e=>cb({{"error":e.toString()}}));'
            try:
                result = self.driver.execute_async_script(js_script)
                if "error" in result or "errors" in result or not result.get('data'): break
                items = result['data'].get('getProductSearchResults', {}).get('items', [])
                if not items: break
                for item in items:
                    cas = item.get('casNumber', 'N/A')
                    for p in item.get('products', []):
                        if p.get('productNumber'):
                            all_products.append(
                                {"product_name_sigma": p.get('name'), "product_number": p.get('productNumber'),
                                 "product_key": p.get('productKey'), "brand": p.get('brand', {}).get('key', 'N-A'),
                                 "cas_number": cas})
                current_page += 1
            except Exception as e:
                logging.error(f"Tarayıcı konsolu (JS) çalıştırma hatası: {e}")
                break
        logging.info(f"Sigma'da (Tarayıcı Konsolu) toplam {len(all_products)} ürün bulundu.")
        return all_products

    def get_product_price(self, product_number: str, brand: str, product_key: str) -> Dict[str, Any]:
        if not self.driver: return {"price": None, "currency": None}
        variables = {"productNumber": product_key, "materialIds": [product_number], "brand": brand.upper(),
                     "productKey": product_key, "quantity": 1}
        variables_json = json.dumps(variables)
        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $materialIds: [String!], $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, materialIds: $materialIds, productKey: $productKey}) { materialPricing { listPrice currency materialNumber } } }"
        js_script = f'const cb=arguments[arguments.length-1];fetch("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability",{{headers:{{"accept":"*/*","content-type":"application/json","x-gql-country":"TR","x-gql-language":"en"}},body:JSON.stringify({{"operationName":"PricingAndAvailability","variables":{variables_json},"query":`{query}`}}),method:"POST"}}).then(r=>r.json()).then(d=>cb(d)).catch(e=>cb({{"error":e.toString()}}));'
        try:
            result = self.driver.execute_async_script(js_script)
            if "error" in result or "errors" in result or not result.get('data'):
                logging.warning(f"Sigma Fiyat (Tarayıcı) '{product_number}' için sonuç alınamadı: {result}")
                return {"price": None, "currency": None}
            material_pricing = result.get('data', {}).get('getPricingForProduct', {}).get('materialPricing', [])
            if material_pricing:
                for price_info in material_pricing:
                    if price_info.get('materialNumber') == product_number: return {"price": price_info.get('listPrice'),
                                                                                   "currency": price_info.get(
                                                                                       'currency')}
                return {"price": material_pricing[0].get('listPrice'), "currency": material_pricing[0].get('currency')}
        except Exception as e:
            logging.error(f"Sigma Fiyat (Tarayıcı) BEKLENMEDİK HATA ({product_number}): {e}")
        return {"price": None, "currency": None}


class ComparisonEngine:
    def __init__(self, sigma_api: SigmaAldrichAPI, netflex_api: NetflexAPI, max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.max_workers = max_workers

    def _clean_html(self, raw_html: str) -> str:
        if not raw_html: return ""
        return re.sub(re.compile('<.*?>'), '', raw_html)

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any]:
        sigma_p_name = sigma_product.get('product_name_sigma')
        sigma_p_num = sigma_product.get('product_number')
        sigma_brand = sigma_product.get('brand')
        sigma_p_key = sigma_product.get('product_key')
        cas_number = sigma_product.get('cas_number', 'N/A')

        if not all([sigma_p_name, sigma_p_num, sigma_brand, sigma_p_key]) or not isinstance(sigma_p_name, str):
            return None

        sigma_price_info = self.sigma_api.get_product_price(sigma_p_num, sigma_brand, sigma_p_key)
        sigma_price = sigma_price_info.get('price')
        sigma_price_numeric = None
        sigma_price_str = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price, (int, float)) and sigma_price > 0:
            sigma_price_numeric = sigma_price
            sigma_price_str = f"{sigma_price} {sigma_price_info.get('currency', '')}".strip()

        formatted_sigma_product = {"source": "Sigma-Aldrich", "product_name": sigma_p_name, "product_code": sigma_p_num,
                                   "price_numeric": sigma_price_numeric, "price_str": sigma_price_str}
        cleaned_sigma_name = self._clean_html(sigma_p_name)
        netflex_matches = self.netflex_api.search_products(cleaned_sigma_name)
        filtered_netflex_matches = [p for p in netflex_matches if
                                    p.get('product_code') and sigma_p_num in p.get('product_code')]

        if not filtered_netflex_matches: return None

        cheapest_netflex_name = "Bulunamadı"
        cheapest_netflex_price_str = "N/A"
        netflex_with_prices = [p for p in filtered_netflex_matches if
                               p.get('price_numeric') is not None and p.get('price_numeric') != float('inf')]

        if netflex_with_prices:
            cheapest_netflex_product = min(netflex_with_prices, key=lambda x: x['price_numeric'])
            cheapest_netflex_name = cheapest_netflex_product.get('product_name', 'İsimsiz')
            cheapest_netflex_price_str = cheapest_netflex_product.get('price_str', 'Fiyat Yok')

        comparison_list = [formatted_sigma_product] + filtered_netflex_matches
        comparison_list.sort(
            key=lambda x: x.get('price_numeric') if x.get('price_numeric') is not None else float('inf'))
        for item in comparison_list:
            if item.get('price_numeric') == float('inf'): item['price_numeric'] = None

        return {"product_name": sigma_p_name, "product_number": sigma_p_num, "cas_number": cas_number,
                "brand": f"Sigma ({sigma_brand})", "sigma_price_str": sigma_price_str,
                "cheapest_netflex_name": cheapest_netflex_name,
                "cheapest_netflex_price_str": cheapest_netflex_price_str, "comparison": comparison_list}

    # GÜNCELLEME: Bu fonksiyon artık sonuçları biriktirmek yerine anlık olarak gönderiyor.
    def search_and_compare(self, search_term: str):
        start_time = time.monotonic()
        logging.info(f"===== YENİ WEB ARAMASI BAŞLATILDI: '{search_term}' =====")

        if not self.sigma_api.driver:
            logging.critical("Kritik Hata: Selenium Driver aktif değil.")
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
                        # Her bir eşleşen ürün bulunduğunda arayüze gönder
                        send_to_frontend("product_found", result)

                    # Her bir ürün işlendiğinde ilerleme durumu gönder
                    send_to_frontend("progress",
                                     {"status": "processing", "total": total_to_process, "processed": processed_count})

                except Exception as exc:
                    processed_count += 1
                    p_name = future_to_product[future].get('product_name_sigma', 'Bilinmeyen')
                    logging.error(f"'{p_name}' işlenirken hata: {exc}", exc_info=True)
                    send_to_frontend("progress",
                                     {"status": "processing", "total": total_to_process, "processed": processed_count})

        # Tüm işlemler bittiğinde, bulunanları veritabanına kaydet
        if found_and_matched_products:
            save_to_database(found_and_matched_products)

        # Arama tamamlama mesajını gönder
        elapsed_time = time.monotonic() - start_time
        send_to_frontend("complete", {"status": "complete", "total_found": len(found_and_matched_products),
                                      "execution_time": round(elapsed_time, 2)})


# ==============================================================================
# UYGULAMAYI ÇALIŞTIRMA
# ==============================================================================

sigma_api = SigmaAldrichAPI()
netflex_api = NetflexAPI()
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

        driver_instance = sigma_api.start_driver()
        if not driver_instance:
            logging.error("KRİTİK: Sigma (Selenium) oturumu başlatılamadı.")
        else:
            logging.info("Sigma (Selenium) oturumu başarıyla başlatıldı.")

    except Exception as e:
        logging.critical(f"Oturumlar başlatılırken hata: {e}", exc_info=True)

    atexit.register(sigma_api.stop_driver)
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

                # GÜNCELLEME: Bu fonksiyon artık kendisi print ettiği için bir değişkene atanmıyor.
                comparison_engine.search_and_compare(search_term)

            elif action == "export":
                logging.info("Excel dışa aktarma talebi alındı.")
                result = export_to_excel(data)
                # GÜNCELLEME: Excel sonucu da standart formatta gönderiliyor.
                send_to_frontend("export_result", result)

            else:
                logging.warning(f"Bilinmeyen eylem alındı: {action}")

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı alındı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası oluştu: {e}")


if __name__ == '__main__':
    main()
