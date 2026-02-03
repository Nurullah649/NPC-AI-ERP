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
import hashlib

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException, ElementClickInterceptedException, JavascriptException, NoSuchElementException, ElementNotInteractableException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service as ChromeService
from urllib.parse import quote, urlparse, urlunparse, parse_qs, urlencode

class Product:
    def __init__(self, name, code, variations, brand, cas_number):
        self.name = name
        self.code = code
        self.variations = variations
        self.brand = brand
        self.cas_number = cas_number

    def __repr__(self):
        return f"Product(Name='{self.name}', Code='{self.code}', CAS='{self.cas_number}', Variations={len(self.variations)}, Brand='{self.brand}')"

class TciScraper:
    def __init__(self):
        self.driver = None

    def reinit_driver(self):
        if self.driver:
            self.close_driver()
        try:
            logging.info("TCI Selenium WebDriver başlatılıyor...")
            options = webdriver.ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-extensions')
            options.add_argument('--log-level=3')
            options.add_argument('--disable-software-rasterizer')
            options.page_load_strategy = 'eager'
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--start-maximized")
            options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            prefs = {"profile.managed_default_content_settings.images": 2}
            options.add_experimental_option("prefs", prefs)
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--disable-infobars')
            try:
                service = ChromeService(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=options)
            except ValueError as ve:
                logging.error(f"ChromeDriverManager hatası: {ve}. Cache temizlenip tekrar denenebilir.")
                raise
            except Exception as driver_ex:
                logging.error(f"WebDriver başlatılırken bilinmeyen hata: {driver_ex}")
                raise
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.set_page_load_timeout(90)
            logging.info("TCI WebDriver başarıyla (yeniden) başlatıldı.")
        except Exception as e:
            logging.critical(f"TCI WebDriver başlatılırken kritik hata: {e}", exc_info=True)
            self.driver = None

    def kill_driver(self):
        if not self.driver: return
        logging.warning("TCI WebDriver işlemi zorla sonlandırılıyor...")
        try:
            if self.driver.service and hasattr(self.driver.service, 'process'):
                pid = self.driver.service.process.pid
                if os.name == 'nt':
                    os.system(f"taskkill /F /PID {pid}")
                else:
                    os.kill(pid, signal.SIGKILL)
                logging.info(f"TCI WebDriver işlemi (PID: {pid}) sonlandırıldı.")
            else:
                logging.warning(f"TCI Driver service/process object not found. PID could not be determined.")
        except Exception as e:
            logging.error(f"TCI WebDriver sonlandırılırken hata oluştu: {e}")
        finally:
            self.driver = None

    def _get_subsequent_page_url(self, base_url: str, search_term: str, page: int) -> str:
        parsed_url = urlparse(base_url)
        query_params = parse_qs(parsed_url.query)
        q_param_value = f"{search_term}:productNameExactMatch"
        query_params['q'] = [q_param_value]
        query_params['text'] = [search_term]
        query_params['page'] = [str(page)]
        new_query = urlencode(query_params, doseq=True)
        new_url = urlunparse((parsed_url.scheme or "https", parsed_url.netloc or "www.tcichemicals.com", "/DE/de/search", parsed_url.params, new_query, parsed_url.fragment))
        return new_url

    def get_products(self, search_query: str, cancellation_token: threading.Event) -> Generator[List[Product], None, None]:
        if not self.driver:
            logging.error("TCI WebDriver başlatılmamış. Arama yapılamıyor.")
            return
        if cancellation_token.is_set():
            logging.info("TCI araması başlangıçta iptal edildi.")
            return
        first_page_url = f"https://www.tcichemicals.com/DE/de/search?text={quote(search_query)}"
        base_search_url_for_params = first_page_url
        try:
            logging.info(f"'{search_query}' için TCI ilk sayfa açılıyor (eager): {first_page_url}")
            self.driver.get(first_page_url)
            try:
                cookie_wait = WebDriverWait(self.driver, 15)
                accept_button_selector = "//button[contains(text(), 'Alle akzeptieren') or contains(text(), 'OK') or contains(text(), 'Accept All')]"
                accept_button = cookie_wait.until(EC.element_to_be_clickable((By.XPATH, accept_button_selector)))
                self.driver.execute_script("arguments[0].scrollIntoView(true);", accept_button)
                time.sleep(0.3)
                self.driver.execute_script("arguments[0].click();", accept_button)
                logging.info("Cookie onay banner'ı kabul edildi.")
                try:
                    cookie_wait.until(EC.invisibility_of_element_located((By.XPATH, accept_button_selector)))
                    logging.info("Cookie banner'ı kayboldu.")
                except TimeoutException:
                    logging.warning("Cookie banner'ı tıklandı ama kaybolmadı (veya kontrol edilemedi).")
            except TimeoutException:
                logging.info("Cookie onay banner'ı bulunamadı veya zaman aşımına uğradı.")
            except Exception as e:
                logging.warning(f"Cookie banner'ı tıklanırken bir hata oluştu (Devam ediliyor): {e}")
            base_search_url_for_params = self.driver.current_url
        except WebDriverException as e:
            logging.error(f"TCI ana arama sayfası yüklenirken hata oluştu: {e}")
            try:
                if hasattr(self.driver, 'options') and "--headless" not in getattr(self.driver, 'options', {}).arguments:
                    self.driver.save_screenshot("tci_error_screenshot.png")
                    logging.info("Hata anı ekran görüntüsü 'tci_error_screenshot.png' olarak kaydedildi.")
            except Exception as ss_err:
                logging.error(f"Ekran görüntüsü alınırken hata: {ss_err}")
            return
        page_count = 1
        last_page_content_hash = ""
        max_empty_pages = 2
        while not cancellation_token.is_set():
            if page_count > 1:
                next_page_url = self._get_subsequent_page_url(base_search_url_for_params, search_query, page_count)
                logging.info(f"TCI: Sonraki sayfaya gidiliyor (eager): {next_page_url}")
                try:
                    self.driver.get(next_page_url)
                except WebDriverException as page_load_error:
                    logging.error(f"TCI: Sayfa {page_count} yüklenirken hata oluştu: {page_load_error}")
                    try:
                        if hasattr(self.driver, 'options') and "--headless" not in getattr(self.driver, 'options', {}).arguments:
                            self.driver.save_screenshot(f"tci_page_load_error_{page_count}.png")
                            logging.info(f"Sayfa yükleme hatası ekran görüntüsü 'tci_page_load_error_{page_count}.png' olarak kaydedildi.")
                    except Exception as ss_err:
                        logging.error(f"Ekran görüntüsü alınırken hata: {ss_err}")
                    break
            logging.info(f"TCI Sayfa {page_count} taranıyor (URL: {self.driver.current_url})...")
            wait_products = WebDriverWait(self.driver, 60)
            product_list_selector = "#product-basic-wrap div[data-product-code1]"
            no_results_selector = "//*[contains(text(), 'keine Suchergebnisse') or contains(text(), 'no results')]"
            product_cards = []
            try:
                wait_products.until(EC.any_of(EC.presence_of_element_located((By.CSS_SELECTOR, product_list_selector)), EC.presence_of_element_located((By.XPATH, no_results_selector))))
                try:
                    product_cards = self.driver.find_elements(By.CSS_SELECTOR, product_list_selector)
                    if product_cards: logging.info(f"{len(product_cards)} adet ürün kartı bulundu.")
                except NoSuchElementException:
                    product_cards = []
                if not product_cards:
                    try:
                        self.driver.find_element(By.XPATH, no_results_selector)
                        logging.info("TCI: 'Ürün bulunamadı' mesajı algılandı. Tarama tamamlanıyor.")
                        break
                    except NoSuchElementException:
                        logging.warning(f"TCI Sayfa {page_count}: Ürün kartı yok ve 'sonuç yok' mesajı da yok.")
                        max_empty_pages -= 1
                        if max_empty_pages <= 0:
                            logging.error("Arka arkaya çok fazla boş/hatalı sayfa algılandı. Tarama durduruluyor.")
                            break
                try:
                    product_wrap_element = self.driver.find_element(By.ID, "product-basic-wrap")
                    current_content_hash = hashlib.md5(product_wrap_element.get_attribute('outerHTML').encode()).hexdigest()
                except NoSuchElementException:
                    current_content_hash = hashlib.md5(self.driver.page_source.encode()).hexdigest()
                if current_content_hash == last_page_content_hash and page_count > 1:
                    logging.warning(f"TCI: Sayfa {page_count} içeriği öncekiyle aynı ({last_page_content_hash}). Muhtemelen son sayfa veya hata. Tarama durduruluyor.")
                    break
                last_page_content_hash = current_content_hash
            except TimeoutException:
                logging.warning(f"TCI Sayfa {page_count}: Ürün listesi veya 'sonuç yok' mesajı {wait_products._timeout} saniye içinde yüklenemedi (DOM'a gelmedi).")
                try:
                    if hasattr(self.driver, 'options') and "--headless" not in getattr(self.driver, 'options', {}).arguments:
                        screenshot_path = f"tci_timeout_page_{page_count}.png"
                        self.driver.save_screenshot(screenshot_path)
                        logging.info(f"Zaman aşımı ekran görüntüsü '{screenshot_path}' olarak kaydedildi.")
                except Exception as ss_err:
                    logging.error(f"Ekran görüntüsü alınırken hata: {ss_err}")
                logging.info("Zaman aşımı nedeniyle tarama sonlandırılıyor.")
                break
            page_products = []
            if product_cards:
                max_empty_pages = 2
                for card_index, card in enumerate(product_cards):
                    if cancellation_token.is_set(): break
                    try:
                        name_element = card.find_element(By.CSS_SELECTOR, "a.name.product-title")
                        name = name_element.text.strip() if name_element else "N/A"
                        code = card.get_attribute("data-product-code1").strip() or "N/A"
                        cas_number = card.get_attribute("data-casNo").strip() or "N/A"
                        variations = []
                        try:
                            pricing_table = card.find_element(By.ID, "PricingTable")
                            rows = pricing_table.find_elements(By.TAG_NAME, "tr")
                        except NoSuchElementException:
                            rows = []
                        for row_index, row in enumerate(rows):
                            cols = row.find_elements(By.TAG_NAME, "td")
                            if not cols: continue
                            unit = ''; price = ''; stock_info = []
                            for col in cols:
                                try:
                                    data_attr = col.get_attribute("data-attr")
                                    if not data_attr: continue
                                    data_attr = data_attr.strip().strip(':')
                                    text = col.text.strip()
                                    if not text: continue
                                    if data_attr == "Einheit": unit = text
                                    elif data_attr == "Stückpreis": price = text.replace('\n', ' ')
                                    else: stock_info.append({'country': data_attr, 'stock': text})
                                except Exception as col_ex:
                                    logging.debug(f"Col err: {col_ex}")
                            if unit and price:
                                variations.append({'unit': unit, 'price': price, 'stock_info': stock_info})
                            elif unit or price:
                                logging.debug(f"Missing data: {code}, U:{unit}, P:{price}")
                        page_products.append(Product(name, code, variations, brand="TCI", cas_number=cas_number))
                    except Exception as e:
                        logging.error(f"Card err ({card_index + 1}): {e}", exc_info=False)
            if page_products:
                yield page_products
            elif page_count > 1 and not product_cards and max_empty_pages > 0:
                logging.info(f"TCI Sayfa {page_count}: Ürün bulunamadı, ancak 'sonuç yok' mesajı da yok. Sonraki sayfa deneniyor ({max_empty_pages} deneme kaldı).")
            elif page_count == 1 and not product_cards:
                pass
            page_count += 1

    def close_driver(self):
        if self.driver:
            try:
                logging.info("TCI WebDriver kapatılıyor...")
                self.driver.quit()
                logging.info("TCI WebDriver düzgünce kapatıldı.")
            except (WebDriverException, InvalidSessionIdException):
                logging.warning("TCI WebDriver kapatılırken zaten ulaşılamaz durumdaydı.")
            except Exception as e:
                logging.error(f"TCI WebDriver kapatılırken beklenmedik hata: {e}")
            finally:
                self.driver = None
