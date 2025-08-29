import json
import logging
import threading
from typing import Dict, Any, List
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


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