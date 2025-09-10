import json
import logging
import signal
import threading
import os
import queue
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
        # YENİ LOGLAMA: Sınıfın bir örneği oluşturulduğunda logla.
        logging.info("SigmaAldrichAPI instance created.")
        self.drivers: Dict[str, webdriver.Chrome] = {}
        self.sessions: Dict[str, requests.Session] = {}
        # YENİ LOGLAMA: HTTPAdapter'ın konfigürasyonunu logla.
        self.adapter = HTTPAdapter(pool_connections=10, pool_maxsize=100, pool_block=True)
        logging.debug("HTTPAdapter initialized with pool_connections=10, pool_maxsize=100.")

    def start_drivers(self):
        # YENİ LOGLAMA: Sürücü başlatma sürecinin başlangıcını logla.
        logging.info("Starting all country drivers and sessions concurrently...")
        countries = ['US', 'DE', 'GB']
        with ThreadPoolExecutor(max_workers=len(countries), thread_name_prefix="Driver-Starter") as executor:
            executor.map(self._start_single_driver, countries)

        # YENİ LOGLAMA: Başlatma sürecinin sonucunu özetle.
        successful_drivers = [c.lower() for c in countries if self.drivers.get(c.lower())]
        if successful_drivers:
            logging.info(f"Successfully initialized drivers for: {', '.join(d.upper() for d in successful_drivers)}")
        failed_drivers = [c for c in countries if c.lower() not in successful_drivers]
        if failed_drivers:
            logging.error(f"Failed to initialize drivers for: {', '.join(failed_drivers)}")

    def _start_single_driver(self, country_code: str):
        logging.info(f"({country_code}) Starting Selenium WebDriver...")
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        options.add_argument(f"user-agent={ua}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument("--disable-blink-features=AutomationControlled")
        prefs = {"profile.managed_default_content_settings.images": 2}
        options.add_experimental_option("prefs", prefs)
        # YENİ LOGLAMA: Kullanılan Chrome seçeneklerini DEBUG seviyesinde logla.
        logging.debug(f"({country_code}) Chrome options configured: {options.arguments}")

        driver = None
        try:
            driver = webdriver.Chrome(options=options)
            driver.set_script_timeout(30)
            logging.info(f"({country_code}) WebDriver instance created successfully.")

            url = f"https://www.sigmaaldrich.com/{country_code}/en"
            # YENİ LOGLAMA: Hangi URL'ye gidildiğini logla.
            logging.info(f"({country_code}) Navigating to URL: {url}")
            driver.get(url)

            accept_button = None
            try:
                cookie_wait = WebDriverWait(driver, 15)
                accept_button = cookie_wait.until(
                    EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
                )
                accept_button.click()
                logging.info(f"({country_code}) Cookie consent button clicked using standard method.")
            except ElementClickInterceptedException:
                logging.warning(f"({country_code}) Standard click was intercepted. Retrying with JavaScript click...")
                try:
                    driver.execute_script("arguments[0].click();", accept_button)
                    logging.info(f"({country_code}) Cookie consent button successfully clicked using JavaScript.")
                except Exception as e:
                    logging.error(f"({country_code}) JavaScript click also failed for cookie button.", exc_info=True)
            except TimeoutException:
                # YENİ LOGLAMA: Butonun bulunamadığını daha açık bir şekilde logla.
                logging.warning(f"({country_code}) Cookie consent button was not found or clickable within 15 seconds.")

            session = requests.Session()
            session.mount('https://', self.adapter)
            session.headers.update({
                "User-Agent": ua, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/json", "x-gql-country": country_code.upper(),
                "x-gql-language": "en", "Origin": "https://www.sigmaaldrich.com",
                "Referer": f"https://www.sigmaaldrich.com/{country_code.lower()}/en"
            })

            driver_cookies = driver.get_cookies()
            # YENİ LOGLAMA: Oturuma kaç adet çerez eklendiğini logla.
            logging.info(
                f"({country_code}) Transferring {len(driver_cookies)} cookies from WebDriver to requests session.")
            for cookie in driver_cookies:
                session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'])

            self.drivers[country_code.lower()] = driver
            self.sessions[country_code.lower()] = session
            # YENİ LOGLAMA: Ülke için tüm sürecin başarıyla tamamlandığını logla.
            logging.info(f"({country_code}) WebDriver and session are fully initialized and ready.")

        except Exception as e:
            logging.critical(f"({country_code}) WebDriver initialization failed catastrophically.", exc_info=True)
            if driver:
                driver.quit()

    def stop_drivers(self):
        logging.info("Shutting down all Selenium drivers and sessions.")
        for code, driver in self.drivers.items():
            if driver:
                try:
                    driver.quit()
                    logging.info(f"({code.upper()}) driver was shut down gracefully.")
                except (WebDriverException, InvalidSessionIdException) as e:
                    logging.warning(f"({code.upper()}) driver was already unreachable during shutdown: {e}")
        self.drivers.clear()
        self.sessions.clear()
        logging.info("All drivers and sessions have been cleared.")

    def kill_drivers(self):
        logging.warning("Forcefully terminating all Sigma WebDriver processes...")
        driver_items = list(self.drivers.items())
        for code, driver in driver_items:
            try:
                pid = driver.service.process.pid
                if os.name == 'nt':
                    os.system(f"taskkill /F /PID {pid}")
                else:
                    os.kill(pid, signal.SIGKILL)
                logging.info(f"({code.upper()}) WebDriver process (PID: {pid}) was killed.")
            except Exception as e:
                logging.error(f"({code.upper()}) Error while trying to kill WebDriver process.", exc_info=True)
        self.drivers.clear()
        self.sessions.clear()
        logging.warning("Forced termination complete. All drivers and sessions cleared.")

    def search_products(self, search_term: str, cancellation_token: threading.Event) -> Generator[
        Dict[str, Any], None, None]:
        # YENİ LOGLAMA: Arama işleminin başlangıcını ve parametrelerini logla.
        logging.info(f"Starting product search for term: '{search_term}'")
        page_queue = queue.Queue(maxsize=5)  # Ağ beklemesini en aza indirmek için tampon
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="Sigma-Page-Producer")

        product_count = 0

        def page_producer():
            current_page = 1
            has_more_pages = True
            while has_more_pages and not cancellation_token.is_set():
                # YENİ LOGLAMA: Sayfa üreticisinin hangi sayfayı istediğini logla.
                logging.debug(f"Producer is fetching page {current_page} for '{search_term}'.")
                result_json = self._search_page(search_term, current_page, cancellation_token)

                if result_json is None or cancellation_token.is_set():
                    has_more_pages = False
                    logging.info("Stopping producer thread due to cancellation or no more results.")
                else:
                    items = result_json.get('data', {}).get('getProductSearchResults', {}).get('items', [])
                    if not items:
                        has_more_pages = False
                        logging.info(
                            f"No more items found for '{search_term}' at page {current_page}. Stopping producer.")
                    else:
                        # YENİ LOGLAMA: Kuyruğa kaç adet öğe eklendiğini logla.
                        logging.debug(f"Producer found {len(items)} items on page {current_page}. Adding to queue.")
                        page_queue.put(items)
                        current_page += 1
            page_queue.put(None)  # İşin bittiğini belirten sinyal

        producer_future = executor.submit(page_producer)

        while not cancellation_token.is_set():
            items = page_queue.get()
            if items is None:
                logging.info("Consumer received 'None' signal. Breaking loop.")
                break

            logging.debug(f"Consumer is processing a batch of {len(items)} items.")
            for item in items:
                if cancellation_token.is_set(): break
                cas = item.get('casNumber', 'N/A')
                for p in item.get('products', []):
                    if cancellation_token.is_set(): break
                    if p.get('productNumber'):
                        product_count += 1
                        yield {
                            "product_name_sigma": p.get('name'), "product_number": p.get('productNumber'),
                            "product_key": p.get('productKey'), "brand": p.get('brand', {}).get('key', 'N-A'),
                            "cas_number": cas
                        }

        # YENİ LOGLAMA: Arama sonucunda toplam kaç ürün bulunduğunu logla.
        logging.info(f"Search for '{search_term}' finished. Total products yielded: {product_count}.")
        executor.shutdown(wait=False, cancel_futures=True)
        if cancellation_token.is_set():
            logging.warning("Sigma product search task was cancelled by the user.")

    def _search_page(self, search_term: str, page: int, cancellation_token: threading.Event) -> Dict[str, Any] or None:
        if cancellation_token.is_set(): return None
        # DEĞİŞİKLİK: Arama için 'tr' yerine 'us' oturumu kullanılıyor.
        session = self.sessions.get('us')
        if not session:
            logging.error("US session not found for searching. Cannot proceed.")
            return None

        query = "query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) { getProductSearchResults(input: { searchTerm: $searchTerm, pagination: { page: $page }, sort: $sort, group: $group, facets: $selectedFacets, type: $type }) { items { ... on Substance { casNumber products { name productNumber productKey brand { key } } } } } }"
        variables = {"searchTerm": search_term, "page": page, "group": "substance", "selectedFacets": [],
                     "sort": "relevance", "type": "PRODUCT"}
        payload = {"operationName": "ProductSearch", "variables": variables, "query": query}

        # YENİ LOGLAMA: API'ye gönderilecek payload'ı DEBUG seviyesinde logla.
        logging.debug(f"Search API request for page {page}: Payload -> {json.dumps(payload)}")
        try:
            response = session.post("https://www.sigmaaldrich.com/api/graphql", json=payload, timeout=20)
            if cancellation_token.is_set(): return None

            # YENİ LOGLAMA: Yanıtın durum kodunu logla.
            logging.debug(f"Search API response for page {page}: Status Code {response.status_code}")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            # YENİ LOGLAMA: HTTP hatalarını yanıt içeriğiyle birlikte daha detaylı logla.
            logging.error(f"HTTP Error during search (Page {page}): {e}. Response: {e.response.text}")
            return None
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Error during Sigma search (Page {page}).", exc_info=True)
            return None

    def get_all_product_prices(self, product_number: str, brand: str, product_key: str,
                               cancellation_token: threading.Event) -> Dict[str, Any]:
        # YENİ LOGLAMA: Fiyat çekme işleminin başlangıcını logla.
        logging.info(f"Fetching all prices for Product: {product_number}, Brand: {brand}, Key: {product_key}")
        results = {}

        with ThreadPoolExecutor(max_workers=len(self.sessions), thread_name_prefix='Price-Fetcher') as executor:
            future_to_country = {
                executor.submit(self._get_price_for_country, country, product_key, brand, cancellation_token): country
                for country in self.sessions.keys()
            }

            if not future_to_country:
                logging.warning("No active sessions to fetch prices with.")
                return {}

            # YENİ LOGLAMA: Hangi ülkeler için fiyat sorgusu başlatıldığını logla.
            logging.debug(f"Price fetch tasks created for countries: {list(future_to_country.values())}")

            while future_to_country:
                if cancellation_token.is_set():
                    logging.warning("Price fetching cancelled. Cancelling all active future tasks.")
                    for f in future_to_country: f.cancel()
                    break

                try:
                    done_iterator = as_completed(future_to_country, timeout=0.2)
                    for future in done_iterator:
                        country_code = future_to_country.pop(future)
                        try:
                            price_data = future.result()
                            if price_data is not None:
                                # YENİ LOGLAMA: Bir ülke için fiyat verisinin başarıyla alındığını logla.
                                logging.info(
                                    f"({country_code.upper()}) Successfully fetched {len(price_data)} price variations.")
                                results[country_code] = price_data
                        except Exception as exc:
                            if not cancellation_token.is_set():
                                logging.error(f"An exception occurred while fetching price for {country_code.upper()}.",
                                              exc_info=True)
                            results[country_code] = []
                except FuturesTimeoutError:
                    continue  # As completed'in timeout'u normaldir, döngüye devam et.

        # YENİ LOGLAMA: Fiyat çekme işleminin tamamlandığını ve sonucu özetle.
        logging.info(f"Finished price fetching for {product_number}. Got results for {len(results)} countries.")
        return results

    def _get_price_for_country(self, country_code: str, product_key: str, brand: str,
                               cancellation_token: threading.Event) -> List[Dict[str, Any]] or None:
        if cancellation_token.is_set(): return None
        session = self.sessions.get(country_code.lower())
        if not session:
            logging.warning(f"({country_code.upper()}) Session not found for pricing. Skipping.")
            return []

        variables = {"productNumber": product_key, "brand": brand.upper(), "productKey": product_key, "quantity": 1}
        query = "query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $productKey: String) { getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, productKey: $productKey}) { materialPricing { listPrice currency materialNumber availabilities { date key messageType } } } }"
        payload = {"operationName": "PricingAndAvailability", "variables": variables, "query": query}

        # YENİ LOGLAMA: Fiyat API'sine gönderilen payload'ı logla.
        logging.debug(f"({country_code.upper()}) Price API Request: Payload -> {json.dumps(payload)}")
        try:
            response = session.post("https://www.sigmaaldrich.com/api?operation=PricingAndAvailability", json=payload,
                                    timeout=20)
            if cancellation_token.is_set(): return None

            # YENİ LOGLAMA: Yanıtın durum kodunu logla.
            logging.debug(f"({country_code.upper()}) Price API Response: Status Code {response.status_code}")
            response.raise_for_status()
            result = response.json()

            if "errors" in result or not result.get('data'):
                # YENİ LOGLAMA: API'den gelen hataları spesifik olarak logla.
                logging.warning(
                    f"({country_code.upper()}) API returned errors or no data for {product_key}. Response: {result}")
                return []

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
            # YENİ LOGLAMA: Parse edilen veriyi DEBUG seviyesinde logla.
            logging.debug(f"({country_code.upper()}) Parsed price variations: {variations}")
            return variations
        except requests.exceptions.HTTPError as e:
            logging.error(f"HTTP Error during pricing ({country_code.upper()}): {e}. Response: {e.response.text}")
            return []
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Unexpected error during pricing ({country_code.upper()}).", exc_info=True)
            return []
