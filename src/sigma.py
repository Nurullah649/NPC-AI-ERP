import json
import logging
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, JavascriptException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class SigmaAldrichAPI:
    def __init__(self):
        self.drivers: Dict[str, webdriver.Chrome] = {}

    def start_drivers(self):
        countries = ['TR', 'US', 'DE', 'GB']
        threads = []
        for country in countries:
            thread = threading.Thread(
                target=self._start_single_driver,
                args=(country,),
                name=f"{country}-Driver-Starter"
            )
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        for country in countries:
            if self.drivers.get(country.lower()):
                logging.info(f"{country} driver hazır.")
            else:
                logging.warning(f"{country} driver başlatılamadı.")

    def _start_single_driver(self, country_code: str):
        logging.info(f"Selenium WebDriver '{country_code}' için başlatılıyor...")
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
            driver = webdriver.Chrome(options=options)
            driver.set_script_timeout(180)
            logging.info(f"Selenium WebDriver ('{country_code}') başarıyla başlatıldı.")

            url = f"https://www.sigmaaldrich.com/{country_code}/en"
            driver.get(url)

            try:
                cookie_wait = WebDriverWait(driver, 15)
                accept_button = cookie_wait.until(EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
                driver.execute_script("arguments[0].click();", accept_button)
                logging.info(f"({country_code}) Çerez onayı tıklandı (JS ile).")
            except TimeoutException:
                logging.debug(f"({country_code}) Çerez onayı butonu bulunamadı veya zaman aşımı.")

            self.drivers[country_code.lower()] = driver
        except Exception as e:
            logging.critical(f"'{country_code}' için WebDriver başlatılamadı: {e}", exc_info=True)
            if 'driver' in locals() and driver:
                driver.quit()

    def stop_drivers(self):
        logging.info("Tüm Selenium WebDriver'lar kapatılıyor.")
        for code, driver in self.drivers.items():
            if driver:
                logging.info(f"'{code.upper()}' driver kapatılıyor.")
                driver.quit()
        self.drivers.clear()

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        logging.info(f"Sigma (TR): '{search_term}' için arama yapılıyor...")
        all_products = []
        current_page = 1
        while True:
            result = self._search_page(search_term, current_page)
            if "error" in result or "errors" in result or not result.get('data'):
                break
            items = result['data'].get('getProductSearchResults', {}).get('items', [])
            if not items:
                break
            for item in items:
                cas = item.get('casNumber', 'N/A')
                for p in item.get('products', []):
                    if p.get('productNumber'):
                        all_products.append({
                            "product_name_sigma": p.get('name'), "product_number": p.get('productNumber'),
                            "product_key": p.get('productKey'), "brand": p.get('brand', {}).get('key', 'N-A'),
                            "cas_number": cas
                        })
            current_page += 1
        logging.info(f"Sigma'da (TR) toplam {len(all_products)} ürün bulundu.")
        return all_products

    def _search_page(self, search_term: str, page: int) -> Dict[str, Any]:
        driver = self.drivers.get('tr')
        if not driver:
            logging.error("Arama için TR driver bulunamadı.")
            return {"error": "TR driver not available"}

        query = "query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) { getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) { items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } } } }"
        variables = {"searchTerm": search_term, "page": page, "group": "substance", "selectedFacets": [],
                     "sort": "relevance", "type": "PRODUCT"}

        try:
            payload = {"operationName": "ProductSearch", "variables": variables, "query": query}
            js_script = f'const cb=arguments[arguments.length-1];fetch("https://www.sigmaaldrich.com/api/graphql",{{headers:{{"accept":"*/*","content-type":"application/json","x-gql-country":"TR","x-gql-language":"en"}},body:JSON.stringify({json.dumps(payload)}),method:"POST"}}).then(r=>r.json()).then(d=>cb(d)).catch(e=>cb({{"error":e.toString()}}));'
            return driver.execute_async_script(js_script)
        except JavascriptException as e:
            logging.error(f"JS çalıştırma hatası (TR): {e.msg}")
        except Exception as e:
            logging.error(f"Arama (TR) sırasında beklenmedik hata: {e}")
        return {"error": "script execution failed"}

    def get_all_product_prices(self, product_number: str, brand: str, product_key: str) -> Dict[str, Any]:
        results = {}
        with ThreadPoolExecutor(max_workers=len(self.drivers), thread_name_prefix='Price-Fetcher') as executor:
            future_to_country = {executor.submit(self._get_price_for_country, country, product_key, brand): country for
                                 country in self.drivers.keys()}
            for future in as_completed(future_to_country):
                country_code = future_to_country[future]
                try:
                    price_data = future.result()
                    results[country_code] = price_data
                except Exception as exc:
                    logging.error(f"Fiyat alınırken hata oluştu ({country_code.upper()}): {exc}")
                    results[country_code] = []
        return results

    def _get_price_for_country(self, country_code: str, product_key: str, brand: str) -> List[Dict[str, Any]]:
        driver = self.drivers.get(country_code.lower())
        if not driver:
            logging.warning(f"Fiyatlandırma için '{country_code.upper()}' driver'ı bulunamadı.")
            return []

        # GÜNCELLEME: `materialIds` parametresini kaldırdık, böylece tüm varyasyonlar gelir.
        variables = {"productNumber": product_key, "brand": brand.upper(), "productKey": product_key, "quantity": 1}
        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, productKey: $productKey}) { materialPricing { listPrice currency materialNumber availabilities { date key messageType } } } }"

        try:
            payload = {"operationName": "PricingAndAvailability", "variables": variables, "query": query}
            js_script = f'const cb=arguments[arguments.length-1];fetch("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability",{{headers:{{"accept":"*/*","content-type":"application/json","x-gql-country":"{country_code.upper()}","x-gql-language":"en"}},body:JSON.stringify({json.dumps(payload)}),method:"POST"}}).then(r=>r.json()).then(d=>cb(d)).catch(e=>cb({{"error":e.toString()}}));'
            result = driver.execute_async_script(js_script)

            if "error" in result or "errors" in result or not result.get('data'):
                logging.warning(f"Sigma Fiyat ({country_code.upper()}) '{product_key}' için sonuç alınamadı: {result}")
                return []

            material_pricing = result.get('data', {}).get('getPricingForProduct', {}).get('materialPricing', [])

            # GÜNCELLEME: Gelen tüm varyasyonları işleyip yeni bir liste oluşturuyoruz.
            variations = []
            if material_pricing:
                for price_info in material_pricing:
                    availability_date = None
                    # Temin tarihini bul
                    if price_info.get('availabilities'):
                        # Önce 'primary' olanı ara, bulamazsan ilkini al
                        primary_avail = next(
                            (a for a in price_info['availabilities'] if a.get('messageType') == 'primary'), None)
                        avail_to_use = primary_avail if primary_avail else price_info['availabilities'][0]

                        if avail_to_use and avail_to_use.get('date'):
                            timestamp_ms = avail_to_use['date']
                            # Timestamp (milisaniye) -> datetime objesi -> YYYY-AA-GG formatı
                            availability_date = datetime.fromtimestamp(timestamp_ms / 1000).strftime('%Y-%m-%d')

                    variations.append({
                        "material_number": price_info.get('materialNumber'),
                        "price": price_info.get('listPrice'),
                        "currency": price_info.get('currency'),
                        "availability_date": availability_date
                    })
            return variations

        except JavascriptException as e:
            logging.error(f"Fiyatlandırma JS hatası ({country_code.upper()}): {e.msg}")
        except Exception as e:
            logging.error(f"Fiyatlandırma sırasında beklenmedik hata ({country_code.upper()}): {e}")

        return []

