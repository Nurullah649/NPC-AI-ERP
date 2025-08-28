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
import openpyxl  # YENİ: Excel işlemleri için eklendi

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


# ==============================================================================
# YENİ: EXCEL OLUŞTURMA FONKSİYONU
# ==============================================================================
def export_to_excel(data: Dict[str, Any]):
    """
    Gelen müşteri ve ürün verileriyle bir Excel dosyası oluşturur ve masaüstüne kaydeder.
    """
    customer_name = data.get("customerName", "Bilinmeyen_Musteri")
    products = data.get("products", [])
    # Dosya adındaki geçersiz karakterleri temizle
    safe_customer_name = re.sub(r'[\\/*?:"<>|]', "", customer_name)

    # Dosyayı kullanıcının masaüstüne kaydet
    desktop_path = Path.home() / "Desktop"
    desktop_path.mkdir(exist_ok=True)  # Masaüstü yoksa oluştur
    filename = f"{safe_customer_name}_urun_listesi_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = desktop_path / filename

    try:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Ürün Listesi"

        # Başlıklar
        headers = ["Ürün Adı", "Ürün Kodu", "Fiyat"]
        sheet.append(headers)
        # Başlıkları kalın yap
        for cell in sheet["1:1"]:
            cell.font = openpyxl.styles.Font(bold=True)

        # Veriler
        for product in products:
            row = [
                product.get("product_name", "N/A"),
                product.get("product_code", "N/A"),
                product.get("price_str", "N/A")
            ]
            sheet.append(row)

        # Sütun genişliklerini ayarla
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
# VERİTABANI VE API SINIFLARI (Değişiklik yok, olduğu gibi bırakıldı)
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
        return {"results": results_list, "execution_time": round(elapsed_time, 2)}
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
        logging.info(f"Yeni bulunan {len(results_data)} ürün veritabanına kaydediliyor/güncelleniyor...")
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
        logging.info("Yeni veriler veritabanına başarıyla kaydedildi.")
    except Error as e:
        logging.error(f"Veritabanına kaydetme hatası: {e}")
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()


class NetflexAPI:
    def __init__(self, max_workers=10):
        logging.debug("NetflexAPI sınıfı başlatılıyor...")
        self.credentials = {"adi": "Siparis@tales.com.tr", "sifre": "951038aa--"}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()
        self.get_token()

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
                        "source": "Netflex",
                        "product_name": product.get('urn_Adi'),
                        "product_code": product.get('urn_Kodu'),
                        "price_numeric": price_numeric,
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
            if self.driver:
                return self.driver

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

                logging.info("Oturum ve çerezleri başlatmak için Sigma-Aldrich ziyaret ediliyor...")
                self.driver.get("https://www.sigmaaldrich.com/TR/en")
                try:
                    cookie_wait = WebDriverWait(self.driver, 10)
                    accept_button = cookie_wait.until(
                        EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
                    self.driver.execute_script("arguments[0].click();", accept_button)
                    logging.info("Çerez onayı tıklandı (JS ile).")
                except TimeoutException:
                    logging.debug("Çerez onayı butonu bulunamadı, devam ediliyor.")

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
        if not self.driver:
            logging.error("Arama için Selenium Driver başlatılmamış.")
            return []

        logging.info(f"Sigma (Tarayıcı Konsolu): '{search_term}' için arama yapılıyor...")

        query = """
        query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) {
          getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) {
            items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } }
          }
        }"""

        all_products = []
        current_page = 1

        while True:
            logging.info(f"Sigma (Tarayıcı Konsolu): Sayfa {current_page} işleniyor...")
            variables = {
                "searchTerm": search_term, "page": current_page, "group": "substance",
                "selectedFacets": [], "sort": "relevance", "type": "PRODUCT"
            }

            variables_json = json.dumps(variables)

            js_script = f"""
            const callback = arguments[arguments.length - 1];
            const variables = {variables_json};
            const query = `{query}`;

            fetch("https://www.sigmaaldrich.com/api/graphql", {{
                "headers": {{ 
                    "accept": "*/*", 
                    "content-type": "application/json",
                    "x-gql-country": "TR",
                    "x-gql-language": "en"
                }},
                "body": JSON.stringify({{ "operationName": "ProductSearch", "variables": variables, "query": query }}),
                "method": "POST"
            }})
            .then(response => response.json())
            .then(data => callback(data))
            .catch(error => callback({{ "error": error.toString() }}));
            """

            try:
                result = self.driver.execute_async_script(js_script)

                if "error" in result or "errors" in result or not result.get('data'):
                    logging.error(f"Sigma GraphQL API hatası (Tarayıcı): {result}")
                    break

                search_results = result['data'].get('getProductSearchResults', {})
                items = search_results.get('items', [])

                if not items:
                    if current_page == 1:
                        logging.info("Tarayıcı sorgusunda hiç ürün bulunamadı.")
                    else:
                        logging.info(f"Daha fazla ürün bulunamadı. Sayfa {current_page - 1}'de arama tamamlandı.")
                    break

                for item in items:
                    cas_number = item.get('casNumber', 'N/A')
                    for product in item.get('products', []):
                        if not product.get('productNumber'): continue
                        all_products.append({
                            "product_name_sigma": product.get('name'), "product_number": product.get('productNumber'),
                            "product_key": product.get('productKey'),
                            "brand": product.get('brand', {}).get('key', 'N-A'),
                            "cas_number": cas_number
                        })
                current_page += 1

            except Exception as e:
                logging.error(f"Tarayıcı konsolu (JS) çalıştırma hatası: {e}")
                break

        logging.info(f"Sigma'da (Tarayıcı Konsolu) toplam {len(all_products)} ürün bulundu.")
        return all_products

    def get_product_price(self, product_number: str, brand: str, product_key: str) -> Dict[str, Any]:
        if not self.driver:
            logging.warning(f"Fiyat alınamıyor, driver mevcut değil: {product_number}")
            return {"price": None, "currency": None}

        logging.info(f"Sigma Fiyat (Tarayıcı Konsolu): '{product_number}' ({brand}) için fiyat alınıyor...")

        variables = {
            "productNumber": product_key, "materialIds": [product_number], "brand": brand.upper(),
            "productKey": product_key, "quantity": 1
        }
        variables_json = json.dumps(variables)

        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $materialIds: [String!], $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, materialIds: $materialIds, productKey: $productKey}) { materialPricing { listPrice currency materialNumber } } }"

        js_script = f"""
        const callback = arguments[arguments.length - 1];
        const variables = {variables_json};
        const query = `{query}`;
        fetch("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability", {{
            "headers": {{ 
                "accept": "*/*", 
                "content-type": "application/json",
                "x-gql-country": "TR",
                "x-gql-language": "en"
            }},
            "body": JSON.stringify({{ "operationName": "PricingAndAvailability", "variables": variables, "query": query }}),
            "method": "POST"
        }})
        .then(response => response.json())
        .then(data => callback(data))
        .catch(error => callback({{ "error": error.toString() }}));
        """
        try:
            result = self.driver.execute_async_script(js_script)

            if "error" in result or "errors" in result or not result.get('data'):
                logging.warning(f"Sigma Fiyat (Tarayıcı) '{product_number}' için sonuç alınamadı: {result}")
                return {"price": None, "currency": None}

            material_pricing = result.get('data', {}).get('getPricingForProduct', {}).get('materialPricing', [])
            if material_pricing:
                for price_info in material_pricing:
                    if price_info.get('materialNumber') == product_number:
                        return {"price": price_info.get('listPrice'), "currency": price_info.get('currency')}
                first_price = material_pricing[0]
                return {"price": first_price.get('listPrice'), "currency": first_price.get('currency')}

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
        cleanr = re.compile('<.*?>')
        cleantext = re.sub(cleanr, '', raw_html)
        return cleantext

    def _process_sigma_product(self, sigma_product: Dict[str, Any]) -> Dict[str, Any]:
        sigma_p_name = sigma_product.get('product_name_sigma')
        sigma_p_num = sigma_product.get('product_number')
        sigma_brand = sigma_product.get('brand')
        sigma_p_key = sigma_product.get('product_key')
        cas_number = sigma_product.get('cas_number', 'N/A')

        if not all([sigma_p_name, sigma_p_num, sigma_brand, sigma_p_key]) or not isinstance(sigma_p_name, str):
            logging.warning(
                f"Sigma ürünü ({sigma_p_num or 'Bilinmeyen Kod'}) için eksik bilgi (özellikle isim), atlanıyor.")
            return None

        sigma_price_info = self.sigma_api.get_product_price(sigma_p_num, sigma_brand, sigma_p_key)
        sigma_price = sigma_price_info.get('price')
        sigma_price_numeric = None
        sigma_price_str = "Fiyat Bilgisi Yok"
        if isinstance(sigma_price, (int, float)) and sigma_price > 0:
            sigma_price_numeric = sigma_price
            sigma_price_str = f"{sigma_price} {sigma_price_info.get('currency', '')}".strip()

        formatted_sigma_product = {
            "source": "Sigma-Aldrich",
            "product_name": sigma_p_name,
            "product_code": sigma_p_num,
            "price_numeric": sigma_price_numeric,
            "price_str": sigma_price_str
        }

        cleaned_sigma_name = self._clean_html(sigma_p_name)
        netflex_matches = self.netflex_api.search_products(cleaned_sigma_name)

        filtered_netflex_matches = [p for p in netflex_matches if
                                    p.get('product_code') and sigma_p_num in p.get('product_code')]

        if not filtered_netflex_matches:
            return None

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
            if item.get('price_numeric') == float('inf'):
                item['price_numeric'] = None

        return {
            "product_name": sigma_p_name,
            "product_number": sigma_p_num,
            "cas_number": cas_number,
            "brand": f"Sigma ({sigma_brand})",
            "sigma_price_str": sigma_price_str,
            "cheapest_netflex_name": cheapest_netflex_name,
            "cheapest_netflex_price_str": cheapest_netflex_price_str,
            "comparison": comparison_list
        }

    def search_and_compare(self, search_term: str) -> Dict[str, Any]:
        start_time = time.monotonic()
        logging.info(f"===== YENİ WEB ARAMASI BAŞLATILDI: '{search_term}' =====")

        if not self.sigma_api.start_driver():
            logging.critical("Kritik Hata: Selenium Driver başlatılamadı.")
            return {"results": [], "execution_time": 0}

        sigma_products = self.sigma_api.search_products(search_term)

        if not sigma_products:
            logging.info("Sigma'da hiç ürün bulunamadı. Web araması sonlandırıldı.")
            return {"results": [], "execution_time": round(time.monotonic() - start_time, 2)}

        logging.info(
            f"Sigma'da {len(sigma_products)} ürün bulundu. Şimdi fiyatlar ve Netflex karşılaştırmaları yapılacak.")
        comparison_results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_product = {executor.submit(self._process_sigma_product, p): p for p in sigma_products}
            for future in as_completed(future_to_product):
                try:
                    result = future.result()
                    if result:
                        comparison_results.append(result)
                except Exception as exc:
                    p_name = future_to_product[future].get('product_name_sigma', 'Bilinmeyen')
                    logging.error(f"'{p_name}' işlenirken hata: {exc}", exc_info=True)
        logging.info(
            f"Karşılaştırma Analizi: Sigma'dan gelen {len(sigma_products)} üründen {len(comparison_results)} tanesi için Netflex'te ürün kodu eşleşmesi bulundu.")
        elapsed_time = time.monotonic() - start_time
        return {"results": comparison_results, "execution_time": round(elapsed_time, 2)}


# ==============================================================================
# UYGULAMAYI ÇALIŞTIRMA
# ==============================================================================

sigma_api = SigmaAldrichAPI()
netflex_api = NetflexAPI()
comparison_engine = ComparisonEngine(sigma_api, netflex_api)


# GÜNCELLEME: main fonksiyonu artık arayüzden gelen JSON komutlarını işliyor.
# 'action': 'search' -> Ürün arar
# 'action': 'export' -> Excel dosyası oluşturur
def main():
    logging.info("========================================")
    logging.info("      Python Arka Plan Servisi Başlatıldı")
    logging.info("========================================")
    atexit.register(sigma_api.stop_driver)
    logging.info("Servis hazır. Komutlar bekleniyor...")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            action = request.get("action")
            data = request.get("data")

            if action == "search":
                search_term = data
                if not search_term: continue

                # Önce veritabanında ara
                results = search_in_database(search_term)
                if results and results.get("results"):
                    logging.info(f"'{search_term}' için sonuçlar veritabanından anında bulundu.")
                    print(json.dumps(results))
                    sys.stdout.flush()
                    continue

                # Veritabanında yoksa web'de ara
                logging.info(f"'{search_term}' veritabanında bulunamadı. İnternetten yeni arama başlatılıyor...")
                web_results_data = comparison_engine.search_and_compare(search_term)

                if web_results_data and web_results_data.get("results"):
                    save_to_database(web_results_data["results"])

                print(json.dumps(web_results_data))
                sys.stdout.flush()
                logging.info(f"'{search_term}' için web sonuçları başarıyla gönderildi.")

            elif action == "export":
                logging.info("Excel dışa aktarma talebi alındı.")
                result = export_to_excel(data)
                print(json.dumps(result))
                sys.stdout.flush()

            else:
                logging.warning(f"Bilinmeyen eylem alındı: {action}")

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı alındı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            error_json = json.dumps({"error": f"Beklenmedik bir sunucu hatası oluştu: {e}"})
            print(error_json)
            sys.stdout.flush()


if __name__ == '__main__':
    main()
