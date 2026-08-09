# -*- coding: utf-8 -*-
"""
SigmaAldrich API - Playwright + Obscura CDP Edition
=====================================================
Selenium/Chrome yerine Obscura CDP sunucusu üzerinden Playwright kullanarak
cookie edinme ve session oluşturma işlemi yapan servis.

Değişiklikler:
- Selenium WebDriver → Playwright CDP bağlantısı
- Chrome Options → Obscura stealth mode (yerleşik)
- ChromeDriverManager → Obscura binary (tek bağımlılık)
- webdriver.Chrome → playwright.chromium.connect_over_cdp()
"""

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
import time
import sys

from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext


class SigmaAldrichAPI:
    def __init__(self, cdp_endpoint: str = "http://127.0.0.1:9222"):
        logging.info("SigmaAldrichAPI instance created (Playwright+Obscura mode).")
        self.cdp_endpoint = cdp_endpoint
        self.sessions: Dict[str, requests.Session] = {}
        self.adapter = HTTPAdapter(pool_connections=10, pool_maxsize=100, pool_block=True)
        self._playwright = None
        self._browser: Browser = None
        logging.debug("HTTPAdapter initialized with pool_connections=10, pool_maxsize=100.")

    def start_drivers(self):
        """Cookie'leri almak için Playwright ile Obscura CDP'ye bağlan."""
        logging.info("Starting all country sessions via Playwright+Obscura...")
        countries = ['US', 'DE', 'GB']

        # Playwright instance başlat
        self._playwright = sync_playwright().start()

        # Sync Playwright thread-safe değil; ülkeleri sıralı başlatıyoruz.
        for country in countries:
            try:
                self._get_cookies_for_country(country)
            except Exception as exc:
                logging.error(f"({country}) Cookie/session initialization failed: {exc}", exc_info=True)

        successful = [c.lower() for c in countries if self.sessions.get(c.lower())]
        if successful:
            logging.info(f"Successfully initialized sessions for: {', '.join(d.upper() for d in successful)}")
        failed = [c for c in countries if c.lower() not in successful]
        if failed:
            logging.error(f"Failed to initialize sessions for: {', '.join(failed)}")

        # Bu aşamadan sonra sadece requests.Session kullanılıyor; Playwright açık tutulmamalı.
        if self._playwright:
            try:
                self._playwright.stop()
                logging.info("Playwright instance stopped after cookie bootstrap.")
            except Exception as e:
                logging.warning(f"Playwright stop error after bootstrap: {e}")
            self._playwright = None

    def _get_cookies_for_country(self, country_code: str):
        """Tek bir ülke için Obscura CDP üzerinden cookie'leri al ve requests session oluştur."""
        logging.info(f"({country_code}) Getting cookies via Playwright+Obscura CDP...")
        browser = None
        context = None
        page = None

        try:
            # CDP üzerinden Obscura'ya bağlan
            browser = self._playwright.chromium.connect_over_cdp(self.cdp_endpoint)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.5",
                }
            )
            page = context.new_page()

            # Sayfa yükleme
            url = f"https://www.sigmaaldrich.com/{country_code}/en"
            logging.info(f"({country_code}) Navigating to: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=90000)

            # Cookie consent — JS ile doğrudan cookie set et (Obscura'da OneTrust render sorunu yok)
            try:
                page.evaluate("""() => {
                    document.cookie = "OptanonAlertBoxClosed=" + new Date().toISOString() + "; path=/; domain=.sigmaaldrich.com";
                    if (window.OneTrust) { try { OneTrust.AllowAll(); } catch(e) {} }
                }""")
                logging.info(f"({country_code}) Cookie consent set via JavaScript.")
                time.sleep(1)  # Cookie'lerin oluşması için kısa bekleme
            except Exception as cookie_err:
                logging.warning(f"({country_code}) Cookie consent JS failed (continuing): {cookie_err}")

            # Cookie'leri al
            ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            playwright_cookies = context.cookies()
            logging.info(f"({country_code}) Transferring {len(playwright_cookies)} cookies to requests session.")

            # requests session oluştur
            session = requests.Session()
            session.mount('https://', self.adapter)
            session.headers.update({
                "User-Agent": ua,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/json",
                "x-gql-country": country_code.upper(),
                "x-gql-language": "en",
                "Origin": "https://www.sigmaaldrich.com",
                "Referer": page.url,
            })

            # Cookie'leri session'a aktar
            for cookie in playwright_cookies:
                domain = cookie.get('domain', '')
                if domain:
                    try:
                        session.cookies.set(cookie['name'], cookie['value'], domain=domain)
                    except Exception as cookie_set_err:
                        logging.warning(f"({country_code}) Could not set cookie {cookie.get('name')}: {cookie_set_err}")
                else:
                    logging.warning(f"({country_code}) Skipping cookie with missing domain: {cookie.get('name')}")

            self.sessions[country_code.lower()] = session
            logging.info(f"({country_code}) Session is fully initialized and ready (Playwright+Obscura).")

        except Exception as main_ex:
            logging.critical(f"({country_code}) Session initialization failed catastrophically.", exc_info=True)
            raise main_ex
        finally:
            # Kaynakları temizle — Obscura tarafında context/page kapatılır
            if page:
                try:
                    page.close()
                except Exception:
                    pass
            if context:
                try:
                    context.close()
                except Exception:
                    pass
            if browser:
                try:
                    browser.close()
                except Exception:
                    pass

    def stop_drivers(self):
        """Session'ları ve Playwright'ı kapat."""
        logging.info("Shutting down all sessions (Playwright+Obscura mode).")
        for code, session in self.sessions.items():
            if session:
                try:
                    session.close()
                    logging.info(f"({code.upper()}) session closed.")
                except Exception as e:
                    logging.warning(f"({code.upper()}) error closing session: {e}")
        self.sessions.clear()

        # Playwright temizliği
        if self._playwright:
            try:
                self._playwright.stop()
                logging.info("Playwright instance stopped.")
            except Exception as e:
                logging.warning(f"Playwright stop error: {e}")
            self._playwright = None

        logging.info("All sessions have been cleared (Playwright+Obscura mode).")

    def kill_drivers(self):
        """Zorla temizleme — Obscura manager tarafından yapılır."""
        logging.warning("Force cleanup requested (Playwright+Obscura mode)...")
        self.stop_drivers()

    # ====================================================================
    # AŞAĞISI AYNEN KORUNDU — Selenium'a bağımlı değildi, sadece requests kullanıyor
    # ====================================================================

    def search_products(self, search_term: str, cancellation_token: threading.Event) -> Generator[Dict[str, Any], None, None]:
        logging.info(f"Starting product search for term: '{search_term}'")
        page_queue = queue.Queue(maxsize=5)
        producer_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="Sigma-Page-Producer")
        producer_future = None
        product_count = 0
        first_page_fetch_successful = False
        def page_producer():
            nonlocal first_page_fetch_successful
            current_page = 1
            has_more_pages = True
            while has_more_pages and not cancellation_token.is_set():
                logging.debug(f"Producer is fetching page {current_page} for '{search_term}'.")
                result_json = self._search_page(search_term, current_page, cancellation_token)
                if result_json is None or cancellation_token.is_set():
                    if current_page == 1 and not cancellation_token.is_set():
                        logging.error(f"Failed to fetch the first page for '{search_term}'. Stopping producer.")
                    has_more_pages = False
                else:
                    items = result_json.get('data', {}).get('getProductSearchResults', {}).get('items', [])
                    if not items:
                        if current_page == 1:
                            logging.warning(f"No items found on the first page for '{search_term}'. Check search term or site status.")
                            has_more_pages = False
                        else:
                            logging.info(f"No more items found for '{search_term}' at page {current_page}. Stopping producer.")
                            has_more_pages = False
                    else:
                        logging.debug(f"Producer found {len(items)} items on page {current_page}. Adding to queue.")
                        if cancellation_token.is_set():
                            has_more_pages = False
                            break
                        try:
                            while not cancellation_token.is_set():
                                try:
                                    page_queue.put(items, timeout=1)
                                    break
                                except queue.Full:
                                    continue
                        except Exception:
                            has_more_pages = False
                            break
                        if current_page == 1:
                            first_page_fetch_successful = True
                        current_page += 1
                        if not cancellation_token.is_set():
                            time.sleep(0.1)
            if not cancellation_token.is_set():
                try:
                    page_queue.put(None, timeout=5)
                except queue.Full:
                    logging.error("Could not put None signal into the queue.")
            logging.debug("Page producer thread finished.")
        producer_future = producer_executor.submit(page_producer)
        try:
            while True:
                try:
                    if cancellation_token.is_set():
                        logging.warning("Consumer breaking loop due to cancellation signal.")
                        break
                    items = page_queue.get(timeout=1)
                except queue.Empty:
                    if producer_future is None or producer_future.done():
                        if not first_page_fetch_successful and product_count == 0:
                            logging.error("Producer finished but first page was never successful and no products yielded.")
                        else:
                            logging.info("Consumer finished as producer is done and queue is empty.")
                        break
                    else:
                        continue
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
                            yield {"product_name_sigma": p.get('name', 'N/A'), "product_number": p.get('productNumber'), "product_key": p.get('productKey', 'N/A'), "brand": p.get('brand', {}).get('key', 'N/A'), "cas_number": cas, "material_ids": p.get('materialIds', [])}
                    if cancellation_token.is_set(): break
                if cancellation_token.is_set(): break
                page_queue.task_done()
        finally:
            logging.info(f"Search loop finished or cancelled. Total products yielded: {product_count}.")
            if producer_future and not producer_future.done():
                logging.debug("Waiting for producer thread to finish...")
                try:
                    producer_future.result(timeout=10)
                    logging.debug("Producer thread finished.")
                except FuturesTimeoutError:
                    logging.warning("Producer thread did not finish within 10 seconds after consumer.")
                except Exception as prod_ex:
                    logging.error(f"Producer thread finished with an error: {prod_ex}")
            producer_executor.shutdown(wait=False, cancel_futures=True)
            if cancellation_token.is_set():
                logging.warning("Sigma product search task was cancelled.")

    def _search_page(self, search_term: str, page: int, cancellation_token: threading.Event) -> Dict[str, Any] or None:
        if cancellation_token.is_set(): return None
        session = self.sessions.get('us')
        if not session:
            logging.error("US session not found for searching. Cannot proceed.")
            return None
        query = """
        query ProductSearch($searchTerm: String, $page: Int!, $sort: Sort, $group: ProductSearchGroup, $selectedFacets: [FacetInput!], $type: ProductSearchType) {
            getProductSearchResults(input: {searchTerm: $searchTerm, pagination: {page: $page}, sort: $sort, group: $group, facets: $selectedFacets, type: $type}) {
                items {
                    ... on Substance {
                        casNumber
                        products { name productNumber productKey brand { key } materialIds }
                    }
                    ... on Product { name productNumber productKey brand { key } materialIds }
                }
            }
        }
        """
        variables = {"searchTerm": search_term, "page": page, "group": "substance", "selectedFacets": [], "sort": "relevance", "type": "PRODUCT"}
        payload = {"operationName": "ProductSearch", "variables": variables, "query": query}
        logging.debug(f"Search API request for page {page}: Payload -> {json.dumps(payload, indent=2)}")
        try:
            if cancellation_token.is_set(): return None
            response = session.post("https://www.sigmaaldrich.com/api/graphql", json=payload, timeout=30)
            if cancellation_token.is_set(): return None
            logging.debug(f"Search API response for page {page}: Status Code {response.status_code}")
            response.raise_for_status()
            result = response.json()
            if "errors" in result and result["errors"]:
                logging.error(f"GraphQL API returned errors on page {page}: {result['errors']}")
                return None
            if not isinstance(result.get('data', {}).get('getProductSearchResults', {}).get('items'), list):
                logging.error(f"Unexpected API response structure on page {page}. 'items' list not found or not a list. Response: {result}")
                return None
            return result
        except requests.exceptions.HTTPError as e:
            if not cancellation_token.is_set():
                logging.error(f"HTTP Error during search (Page {page}): {e.response.status_code} - {e.response.reason}. Response: {e.response.text[:500]}")
            return None
        except requests.exceptions.Timeout:
            if not cancellation_token.is_set():
                logging.error(f"Timeout occurred during search (Page {page}) after 30 seconds.")
            return None
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Error during Sigma search (Page {page}): {e}", exc_info=True)
            return None

    def get_all_product_prices(self, product_number: str, brand: str, product_key: str, material_ids: List[str], cancellation_token: threading.Event) -> Dict[str, Any]:
        logging.info(f"Fetching all prices for Product: {product_number} (Key: {product_key}) using {len(material_ids) if material_ids else 0} material IDs.")
        results = {}
        available_countries = list(self.sessions.keys())
        if not available_countries:
            logging.warning("No active sessions available to fetch prices.")
            return {}
        logging.debug(f"Fetching prices for available countries: {available_countries}")
        price_executor = ThreadPoolExecutor(max_workers=len(available_countries), thread_name_prefix='Price-Fetcher')
        future_to_country = {}
        try:
            future_to_country = {price_executor.submit(self._get_price_for_country, country, product_number, product_key, brand, material_ids, cancellation_token): country for country in available_countries}
            if cancellation_token.is_set():
                logging.warning("Price fetching cancelled before starting tasks.")
                return {}
            logging.debug(f"Price fetch tasks created for countries: {list(future_to_country.values())}")
            timeout_seconds = 60
            end_time = time.time() + timeout_seconds
            while future_to_country and time.time() < end_time:
                if cancellation_token.is_set():
                    logging.warning("Price fetching cancelled during execution.")
                    break
                try:
                    done_iterator = as_completed(future_to_country, timeout=0.5)
                    for future in done_iterator:
                        country_code = future_to_country.pop(future)
                        try:
                            if future.cancelled():
                                logging.warning(f"({country_code.upper()}) Price fetch task was cancelled.")
                                results[country_code] = []
                                continue
                            price_data = future.result()
                            if price_data is None:
                                logging.warning(f"({country_code.upper()}) Price fetch task returned None (likely cancelled).")
                                results[country_code] = []
                            elif isinstance(price_data, list):
                                logging.info(f"({country_code.upper()}) Successfully processed price request (found {len(price_data)} variations).")
                                results[country_code] = price_data
                            else:
                                logging.error(f"({country_code.upper()}) Expected list from _get_price_for_country, but got {type(price_data)}.")
                                results[country_code] = []
                        except Exception as exc:
                            if not cancellation_token.is_set():
                                logging.error(f"Exception fetching price for {country_code.upper()}: {exc}", exc_info=False)
                            results[country_code] = []
                except FuturesTimeoutError:
                    continue
            if future_to_country:
                remaining_countries = [future_to_country[f] for f in future_to_country]
                if time.time() >= end_time:
                    logging.warning(f"Price fetching timed out after {timeout_seconds} seconds. Remaining tasks for countries: {remaining_countries}")
        finally:
            logging.debug("Shutting down Price-Fetcher executor.")
            if 'future_to_country' in locals() and future_to_country:
                for f in future_to_country: f.cancel()
            price_executor.shutdown(wait=False, cancel_futures=True)
            logging.info(f"Finished price fetching process for {product_number}. Got results for {len(results)} countries.")
        return results

    def _get_price_for_country(self, country_code: str, product_number: str, product_key: str, brand: str, material_ids: List[str], cancellation_token: threading.Event) -> List[Dict[str, Any]] or None:
        if cancellation_token.is_set(): return None
        session = self.sessions.get(country_code.lower())
        if not session:
            logging.warning(f"({country_code.upper()}) Session not found for pricing. Skipping.")
            return []
        if material_ids is None: material_ids = []
        unique_material_ids = list(set(filter(None, material_ids)))
        query = """
        query PricingAndAvailability($productNumber: String!, $brand: String, $quantity: Int!, $productKey: String, $materialIds: [String!]) {
            getPricingForProduct(input: {productNumber: $productNumber, brand: $brand, quantity: $quantity, productKey: $productKey, materialIds: $materialIds}) {
                materialPricing { listPrice currency materialNumber packageSize availabilities { date key messageType } }
            }
        }
        """
        variables = {"productNumber": product_number, "brand": brand.upper() if brand else None, "productKey": product_key, "quantity": 1, "materialIds": unique_material_ids}
        payload = {"operationName": "PricingAndAvailability", "variables": variables, "query": query}
        url = "https://www.sigmaaldrich.com/api/graphql"
        logging.debug(f"({country_code.upper()}) Pricing request for {product_key}. Payload: {json.dumps(variables)}")
        try:
            if cancellation_token.is_set(): return None
            response = session.post(url, json=payload, timeout=45)
            if cancellation_token.is_set(): return None
            logging.debug(f"({country_code.upper()}) Pricing response status: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            if "errors" in result and result["errors"]:
                logging.warning(f"({country_code.upper()}) GraphQL API returned errors for {product_key} (pricing). Errors: {result['errors']}")
                return []
            pricing_data = result.get('data', {}).get('getPricingForProduct')
            if pricing_data is None:
                logging.info(f"({country_code.upper()}) No pricing data found (API returned null) for {product_key}.")
                return []
            material_pricing = pricing_data.get('materialPricing', [])
            if not isinstance(material_pricing, list):
                logging.error(f"({country_code.upper()}) Unexpected structure for materialPricing (not a list) for {product_key}. Data: {material_pricing}")
                return []
            variations = []
            for price_info in material_pricing:
                if cancellation_token.is_set(): return None
                if not isinstance(price_info, dict):
                    logging.warning(f"({country_code.upper()}) Skipping invalid price_info item (not a dict): {price_info}")
                    continue
                availability_date = None
                avails = price_info.get('availabilities')
                if isinstance(avails, list) and avails:
                    avail = next((a for a in avails if isinstance(a, dict) and a.get('messageType') == 'primary'), avails[0] if avails and isinstance(avails[0], dict) else None)
                    if isinstance(avail, dict) and (avail_date := avail.get('date')):
                        try:
                            availability_date = datetime.fromtimestamp(int(avail_date) / 1000).strftime('%Y-%m-%d')
                        except (ValueError, TypeError, OSError):
                            logging.warning(f"({country_code.upper()}) Invalid availability date format: {avail_date}")
                            availability_date = str(avail_date)
                list_price = price_info.get('listPrice')
                numeric_price = None
                try:
                    if list_price is not None:
                        numeric_price = float(list_price)
                except (ValueError, TypeError):
                    logging.warning(f"({country_code.upper()}) Invalid listPrice format: {list_price}")
                variations.append({"material_number": price_info.get('materialNumber', 'N/A'), "price": numeric_price, "currency": price_info.get('currency', 'N/A'), "package_size": price_info.get('packageSize', 'N/A'), "availability_date": availability_date})
            if cancellation_token.is_set(): return None
            logging.debug(f"({country_code.upper()}) Parsed {len(variations)} price variations for {product_key}.")
            return variations
        except requests.exceptions.HTTPError as e:
            if not cancellation_token.is_set():
                logging.error(f"HTTP Error during pricing request ({country_code.upper()}) for {product_key}: {e.response.status_code}. Response: {e.response.text[:500]}")
            return []
        except requests.exceptions.Timeout:
            if not cancellation_token.is_set():
                logging.error(f"Timeout occurred during pricing request ({country_code.upper()}) for {product_key} after 45 seconds.")
            return []
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if not cancellation_token.is_set():
                logging.error(f"Error during pricing request ({country_code.upper()}) for {product_key}: {e}", exc_info=False)
            return []
        except Exception as e:
            if not cancellation_token.is_set():
                logging.error(f"Unexpected error during pricing processing ({country_code.upper()}) for {product_key}: {e}", exc_info=True)
            return []
