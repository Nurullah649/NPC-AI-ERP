import json
import logging
import threading
import random
import zipfile
import os
import shutil
from typing import Dict, Any, List
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class SigmaAldrichAPI:
    def __init__(self):
        self.driver_tr = None
        self.driver_us = None
        self.driver_lock_tr = threading.Lock()
        self.driver_lock_us = threading.Lock()
        self.proxies = self._load_proxies()
        self.proxy_in_use = None

    def _load_proxies(self, filename="proxies.txt") -> List[str]:
        proxies = []
        try:
            with open(filename, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line: continue
                    parts = line.split(':')
                    if len(parts) == 4:
                        ip, port, user, password = parts
                        proxies.append(f"{user}:{password}@{ip}:{port}")
        except FileNotFoundError:
            logging.warning(f"Proxy dosyası bulunamadı: {filename}. ABD fiyatları alınamayacak.")
        except Exception as e:
            logging.error(f"Proxy dosyası okunurken hata: {e}")
        logging.info(f"{len(proxies)} adet proxy yüklendi.")
        return proxies

    def _start_single_driver(self, country: str) -> webdriver.Chrome:
        logging.info(f"Selenium WebDriver '{country}' için başlatılıyor...")
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument("--disable-blink-features=AutomationControlled")

        plugin_dir = f'proxy_auth_plugin_{country}'
        proxy_zip_path = None
        if country.upper() == 'US' and self.proxies:
            self.proxy_in_use = random.choice(self.proxies)
            logging.info(f"ABD için proxy kullanılıyor: {self.proxy_in_use.split('@')[1]}")
            user_pass, ip_port = self.proxy_in_use.split('@')
            username, password = user_pass.split(':')
            host, port = ip_port.split(':')

            manifest_json = """{"version": "1.0.0","manifest_version": 2,"name": "Chrome Proxy","permissions": ["proxy", "tabs", "unlimitedStorage", "storage","<all_urls>", "webRequest", "webRequestBlocking"],"background": { "scripts": ["background.js"] }}"""
            background_js = f"""var config = {{mode: "fixed_servers",rules: {{singleProxy: {{scheme: "http",host: "{host}",port: parseInt({port})}},bypassList: ["localhost"]}} }}; chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}}); function callbackFn(details) {{ return {{ authCredentials: {{ username: "{username}", password: "{password}" }} }}; }} chrome.webRequest.onAuthRequired.addListener(callbackFn, {{urls: ["<all_urls>"]}},['blocking']);"""

            if os.path.exists(plugin_dir): shutil.rmtree(plugin_dir)
            os.makedirs(plugin_dir)

            with open(os.path.join(plugin_dir, "manifest.json"), "w") as f:
                f.write(manifest_json)
            with open(os.path.join(plugin_dir, "background.js"), "w") as f:
                f.write(background_js)

            proxy_zip_path = f'{plugin_dir}.zip'
            with zipfile.ZipFile(proxy_zip_path, 'w', zipfile.ZIP_DEFLATED) as zp:
                for file in os.listdir(plugin_dir): zp.write(os.path.join(plugin_dir, file), file)
            options.add_extension(proxy_zip_path)

        driver = None
        try:
            driver = webdriver.Chrome(options=options)
            driver.set_script_timeout(180)
            logging.info(f"Selenium WebDriver ('{country}') başarıyla başlatıldı.")
            driver.get(f"https://www.sigmaaldrich.com/{country.upper()}/en")
            try:
                cookie_wait = WebDriverWait(driver, 15)
                accept_button = cookie_wait.until(EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
                driver.execute_script("arguments[0].click();", accept_button)
                logging.info(f"({country}) Çerez onayı tıklandı (JS ile).")
            except TimeoutException:
                logging.debug(f"({country}) Çerez onayı butonu bulunamadı.")
            return driver
        except Exception as e:
            logging.critical(f"WebDriver ('{country}') başlatılamadı: {e}", exc_info=True)
            if driver: driver.quit()
            return None
        finally:
            if proxy_zip_path and os.path.exists(proxy_zip_path): os.remove(proxy_zip_path)
            if os.path.exists(plugin_dir): shutil.rmtree(plugin_dir)

    def start_drivers(self):
        def start_tr():
            with self.driver_lock_tr: self.driver_tr = self._start_single_driver('TR')

        def start_us():
            with self.driver_lock_us: self.driver_us = self._start_single_driver('US')

        tr_thread = threading.Thread(target=start_tr, name="TR-Driver-Starter")
        us_thread = threading.Thread(target=start_us, name="US-Driver-Starter")
        tr_thread.start();
        us_thread.start()
        tr_thread.join();
        us_thread.join()

        if self.driver_tr:
            logging.info("TR driver hazır.")
        else:
            logging.error("KRİTİK: TR driver başlatılamadı.")
        if self.driver_us:
            logging.info("US driver (proxy ile) hazır.")
        else:
            logging.error("KRİTİK: US driver (proxy ile) başlatılamadı.")

    def stop_drivers(self):
        with self.driver_lock_tr:
            if self.driver_tr:
                logging.info("Selenium WebDriver (TR) kapatılıyor.")
                self.driver_tr.quit()
                self.driver_tr = None
        with self.driver_lock_us:
            if self.driver_us:
                info = f"({self.proxy_in_use.split('@')[1]})" if self.proxy_in_use else ""
                logging.info(f"Selenium WebDriver (US) {info} kapatılıyor.")
                self.driver_us.quit()
                self.driver_us = None

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        if not self.driver_tr:
            logging.error("Arama yapılamıyor, TR driver aktif değil.")
            return []

        logging.info(f"Sigma (TR): '{search_term}' için arama yapılıyor...")
        query = "query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) { getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) { items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } } } }"
        all_products = []
        current_page = 1
        while True:
            variables = {"searchTerm": search_term, "page": current_page, "group": "substance", "selectedFacets": [],
                         "sort": "relevance", "type": "PRODUCT"}

            # DÜZELTME: JS isteği daha sağlam bir yöntemle oluşturuluyor.
            payload = {"operationName": "ProductSearch", "variables": variables, "query": query}
            payload_json = json.dumps(payload)

            js_script = f"""
                const cb = arguments[arguments.length - 1];
                const payload = {payload_json};
                fetch("https://www.sigmaaldrich.com/api/graphql", {{
                    method: "POST",
                    headers: {{
                        "accept": "*/*",
                        "content-type": "application/json",
                        "x-gql-country": "TR",
                        "x-gql-language": "en"
                    }},
                    body: JSON.stringify(payload)
                }})
                .then(res => res.json())
                .then(data => cb(data))
                .catch(err => cb({{ "error": err.toString() }}));
            """
            try:
                result = self.driver_tr.execute_async_script(js_script)
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
                logging.error(f"JS çalıştırma hatası (TR): {e}")
                break
        logging.info(f"Sigma'da (TR) toplam {len(all_products)} ürün bulundu.")
        return all_products

    def _get_price_for_country(self, driver: webdriver.Chrome, product_number: str, brand: str, product_key: str,
                               country: str) -> Dict[str, Any]:
        if not driver: return {"price": None, "currency": None}
        variables = {"productNumber": product_key, "materialIds": [product_number], "brand": brand.upper(),
                     "productKey": product_key, "quantity": 1}
        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $materialIds: [String!], $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, materialIds: $materialIds, productKey: $productKey}) { materialPricing { listPrice currency materialNumber } } }"

        # DÜZELTME: JS isteği daha sağlam bir yöntemle oluşturuluyor.
        payload = {"operationName": "PricingAndAvailability", "variables": variables, "query": query}
        payload_json = json.dumps(payload)

        js_script = f"""
            const cb = arguments[arguments.length - 1];
            const payload = {payload_json};
            fetch("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability", {{
                method: "POST",
                headers: {{
                    "accept": "*/*",
                    "content-type": "application/json",
                    "x-gql-country": "{country.upper()}",
                    "x-gql-language": "en"
                }},
                body: JSON.stringify(payload)
            }})
            .then(res => res.json())
            .then(data => cb(data))
            .catch(err => cb({{ "error": err.toString() }}));
        """
        try:
            result = driver.execute_async_script(js_script)
            if "error" in result or "errors" in result or not result.get('data'):
                logging.warning(f"Sigma Fiyat ({country}) '{product_number}' için sonuç alınamadı: {result}")
                return {"price": None, "currency": None}
            material_pricing = result.get('data', {}).get('getPricingForProduct', {}).get('materialPricing', [])
            if material_pricing:
                for price_info in material_pricing:
                    if price_info.get('materialNumber') == product_number:
                        return {"price": price_info.get('listPrice'), "currency": price_info.get('currency')}
                return {"price": material_pricing[0].get('listPrice'), "currency": material_pricing[0].get('currency')}
        except Exception as e:
            logging.error(f"Sigma Fiyat ({country}) HATA ({product_number}): {e}")
        return {"price": None, "currency": None}

    def get_product_prices_both(self, product_number: str, brand: str, product_key: str) -> Dict[str, Dict[str, Any]]:
        results = {'tr': None, 'us': None}

        def get_tr_price(): results['tr'] = self._get_price_for_country(self.driver_tr, product_number, brand,
                                                                        product_key, 'TR')

        def get_us_price(): results['us'] = self._get_price_for_country(self.driver_us, product_number, brand,
                                                                        product_key, 'US')

        tr_thread = threading.Thread(target=get_tr_price, name="TR-Price-Fetcher")
        us_thread = threading.Thread(target=get_us_price, name="US-Price-Fetcher")
        tr_thread.start();
        us_thread.start()
        tr_thread.join();
        us_thread.join()

        return results

