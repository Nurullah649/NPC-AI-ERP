import json
import logging
import signal
import threading
import os
import requests
from requests.adapters import HTTPAdapter
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from typing import Dict, Any, List, Generator

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException, \
    ElementClickInterceptedException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class SigmaAldrichAPI:
    def __init__(self):
        self.drivers: Dict[str, webdriver.Chrome] = {}
        self.sessions: Dict[str, requests.Session] = {}
        # HIZ OPTİMİZASYONU: Her ülke için ayrı bir bağlantı havuzu.
        # Bu, her bir Sigma alan adına (TR, US, DE, GB) olan bağlantıların
        # yeniden kullanılmasını sağlayarak ağ gecikmesini azaltır.
        self.adapter = HTTPAdapter(pool_connections=4, pool_maxsize=20)

    def start_drivers(self):
        countries = ['TR', 'US', 'DE', 'GB']
        with ThreadPoolExecutor(max_workers=len(countries), thread_name_prefix="Driver-Starter") as executor:
            executor.map(self._start_single_driver, countries)

        for country in countries:
            if self.drivers.get(country.lower()) and self.sessions.get(country.lower()):
                logging.info(f"{country} sürücüsü ve oturumu hazır.")
            else:
                logging.warning(f"{country} sürücüsü ve/veya oturumu başlatılamadı.")

    def _start_single_driver(self, country_code: str):
        logging.info(f"Selenium WebDriver '{country_code}' için başlatılıyor...")
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        options.add_argument(f"user-agent={ua}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument("--disable-blink-features=AutomationControlled")

        # HIZ OPTİMİZASYONU: Resimlerin yüklenmesini engelleme.
        # Bu ayar, Selenium'un sayfayı açarken resimleri indirmesini önler.
        # Sayfa çok daha hızlı yüklenir ve çerezleri alıp API oturumuna geçme
        # süresi önemli ölçüde kısalır.
        prefs = {"profile.managed_default_content_settings.images": 2}
        options.add_experimental_option("prefs", prefs)

        driver = None
        try:
            driver = webdriver.Chrome(options=options)
            driver.set_script_timeout(30)
            logging.info(f"Selenium WebDriver ('{country_code}') başarıyla başlatıldı.")

            url = f"https://www.sigmaaldrich.com/{country_code}/en"
            driver.get(url)

            try:
                cookie_wait = WebDriverWait(driver, 15)
                accept_button = cookie_wait.until(
                    EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
                )

                # Önce normal tıklamayı deneyin
                accept_button.click()

                logging.info(f"({country_code}) Çerez onayı standart metotla tıklandı.")

            except ElementClickInterceptedException:
                # Eğer normal tıklama engellenirse, JavaScript ile zorlayın
                logging.warning(f"({country_code}) Standart tıklama engellendi. JavaScript ile deneniyor...")
                try:
                    driver.execute_script("arguments[0].click();", accept_button)
                    logging.info(f"({country_code}) Çerez onayı JavaScript ile başarıyla tıklandı.")
                except Exception as e:
                    logging.error(f"({country_code}) JavaScript tıklaması da başarısız oldu: {e}")

            except TimeoutException:
                logging.debug(f"({country_code}) Çerez onayı butonu 15 saniye içinde bulunamadı.")

            session = requests.Session()
            session.mount('https://', self.adapter)
            session.headers.update({
                "User-Agent": ua, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/json", "x-gql-country": country_code.upper(),
                "x-gql-language": "en", "Origin": "https://www.sigmaaldrich.com",
                "Referer": f"https://www.sigmaaldrich.com/{country_code.lower()}/en/search/ethanol?focus=products&page=1&perpage=30&sort=relevance&term=ethanol&type=product_group"
            })
            for cookie in driver.get_cookies():
                session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'])

            self.drivers[country_code.lower()] = driver
            self.sessions[country_code.lower()] = session
        except Exception as e:
            logging.critical(f"'{country_code}' için WebDriver başlatılamadı: {e}", exc_info=True)
            if driver:
                driver.quit()

    def stop_drivers(self):
        logging.info("Tüm Selenium sürücüleri ve oturumları kapatılıyor.")
        for code, driver in self.drivers.items():
            if driver:
                try:
                    driver.quit()
                    logging.info(f"'{code.upper()}' sürücüsü kapatıldı.")
                except (WebDriverException, InvalidSessionIdException):
                    logging.warning(f"'{code.upper()}' sürücüsü kapatılırken zaten ulaşılamaz durumdaydı.")
        self.drivers.clear()
        self.sessions.clear()

    def kill_drivers(self):
        logging.warning("Tüm Sigma WebDriver işlemleri zorla sonlandırılıyor...")
        driver_items = list(self.drivers.items())
        for code, driver in driver_items:
            try:
                pid = driver.service.process.pid
                if os.name == 'nt':
                    os.system(f"taskkill /F /PID {pid}")
                else:
                    os.kill(pid, signal.SIGKILL)
                logging.info(f"Sigma WebDriver '{code.upper()}' (PID: {pid}) sonlandırıldı.")
            except Exception as e:
                logging.error(f"Sigma WebDriver '{code.upper()}' sonlandırılırken hata: {e}")
        self.drivers.clear()
        self.sessions.clear()

    def search_products(self, search_term: str, cancellation_token: threading.Event) -> Generator[
        List[Dict[str, Any]], None, None]:
        logging.info(f"Sigma (TR): '{search_term}' için arama yapılıyor...")
        current_page = 1
        while True:
            if cancellation_token.is_set():
                logging.info("Sigma ürün arama görevi iptal edildi.")
                break

            result_json = self._search_page(search_term, current_page, cancellation_token)
            if result_json is None: break

            items = result_json.get('data', {}).get('getProductSearchResults', {}).get('items', [])
            if not items:
                logging.info(f"Sigma: '{search_term}' için {current_page - 1}. sayfadan sonra ürün bulunamadı.")
                break

            page_products = []
            for item in items:
                cas = item.get('casNumber', 'N/A')
                for p in item.get('products', []):
                    if p.get('productNumber'):
                        page_products.append({
                            "product_name_sigma": p.get('name'), "product_number": p.get('productNumber'),
                            "product_key": p.get('productKey'), "brand": p.get('brand', {}).get('key', 'N-A'),
                            "cas_number": cas
                        })

            logging.info(f"Sigma: {len(page_products)} ürün {current_page}. sayfada bulundu. Arayüze gönderiliyor.")
            yield page_products
            current_page += 1

    def _search_page(self, search_term: str, page: int, cancellation_token: threading.Event) -> Dict[str, Any] or None:
        if cancellation_token.is_set(): return None
        session = self.sessions.get('tr')
        if not session:
            logging.error("Arama için TR oturumu bulunamadı.")
            return None

        query = "query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) { getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) { items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } } } }"
        variables = {"searchTerm": search_term, "page": page, "group": "substance", "selectedFacets": [],
                     "sort": "relevance", "type": "PRODUCT"}
        payload = {"operationName": "ProductSearch", "variables": variables, "query": query}

        try:
            # HIZ OPTİMİZASYONU: Yavaş ve gereksiz 'make_cancellable_post_request' kaldırıldı.
            response = session.post("https://www.sigmaaldrich.com/api/graphql", json=payload, timeout=20)
            if cancellation_token.is_set(): return None
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Sigma arama (Sayfa {page}) sırasında hata: {e}")
            return None

    def get_all_product_prices(self, product_number: str, brand: str, product_key: str,
                               cancellation_token: threading.Event) -> Dict[str, Any]:
        results = {}
        with ThreadPoolExecutor(max_workers=len(self.sessions), thread_name_prefix='Price-Fetcher') as executor:
            future_to_country = {
                executor.submit(self._get_price_for_country, country, product_key, brand, cancellation_token): country
                for country in self.sessions.keys()
            }
            while future_to_country:
                if cancellation_token.is_set():
                    for f in future_to_country: f.cancel()
                    break

                try:
                    # HIZ OPTİMİZASYONU: Daha duyarlı iptal mekanizması.
                    # Timeout 3 saniyeden 0.2 saniyeye düşürüldü. Bu, iptal komutunun
                    # en fazla 0.2 saniye içinde fark edilmesini sağlar.
                    done_iterator = as_completed(future_to_country, timeout=0.2)

                    for future in done_iterator:
                        country_code = future_to_country.pop(future)
                        try:
                            price_data = future.result()
                            if price_data is not None:
                                results[country_code] = price_data
                        except Exception as exc:
                            if not cancellation_token.is_set():
                                logging.error(f"Fiyat alınırken hata oluştu ({country_code.upper()}): {exc}")
                            results[country_code] = []
                except FuturesTimeoutError:
                    # Bu zaman aşımı beklenen bir durumdur, iptal flag'ini kontrol etmek için döngüye devam edilir.
                    continue
        return results

    def _get_price_for_country(self, country_code: str, product_key: str, brand: str,
                               cancellation_token: threading.Event) -> List[Dict[str, Any]] or None:
        if cancellation_token.is_set(): return None
        session = self.sessions.get(country_code.lower())
        if not session:
            logging.warning(f"Fiyatlandırma için '{country_code.upper()}' oturumu bulunamadı.")
            return []

        variables = {"productNumber": product_key, "brand": brand.upper(), "productKey": product_key, "quantity": 1}
        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, productKey: $productKey}) { materialPricing { listPrice currency materialNumber availabilities { date key messageType } } } }"
        payload = {"operationName": "PricingAndAvailability", "variables": variables, "query": query}

        try:
            # HIZ OPTİMİZASYONU: Doğrudan ağ isteği.
            response = session.post("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability",
                                    json=payload, timeout=20)
            if cancellation_token.is_set(): return None
            response.raise_for_status()
            result = response.json()

            if "errors" in result or not result.get('data'): return []

            material_pricing = result.get('data', {}).get('getPricingForProduct', {}).get('materialPricing', [])
            variations = []
            for price_info in material_pricing:
                availability_date = None
                if avails := price_info.get('availabilities'):
                    avail = next((a for a in avails if a.get('messageType') == 'primary'), avails[0])
                    if avail_date := avail.get('date'):
                        availability_date = datetime.fromtimestamp(avail_date / 1000).strftime('%Y-%m-%d')

                variations.append({
                    "material_number": price_info.get('materialNumber'), "price": price_info.get('listPrice'),
                    "currency": price_info.get('currency'), "availability_date": availability_date
                })
            return variations
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Fiyatlandırma sırasında beklenmedik hata ({country_code.upper()}): {e}")
            return []
