import logging
import time
import os
import signal
import threading
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException, \
    InvalidSessionIdException
from webdriver_manager.chrome import ChromeDriverManager
from typing import Generator, List, Dict, Any
from urllib.parse import quote


class Product:
    """
    Bir ürünün bilgilerini tutmak için basit bir sınıf.
    """

    def __init__(self, name, code, variations, brand, cas_number):
        self.name = name
        self.code = code
        self.variations = variations
        self.brand = brand
        self.cas_number = cas_number

    def __repr__(self):
        return f"Product(Name='{self.name}', Code='{self.code}', CAS='{self.cas_number}', Variations={len(self.variations)}, Brand='{self.brand}')"


class TciScraper:
    """
    TCI Chemicals web sitesinden ürün bilgilerini çekmek için tasarlanmış scraper sınıfı.
    """

    def __init__(self):
        self.driver = None

    def reinit_driver(self):
        """WebDriver'ı başlatır veya yeniden başlatır."""
        if self.driver:
            self.close_driver()
        try:
            logging.info("TCI Selenium WebDriver başlatılıyor...")
            options = webdriver.ChromeOptions()
            # Testler sırasında sorunu daha iyi görebilmek için headless modu geçici olarak devre dışı bırakabilirsiniz.
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--start-maximized")
            options.add_argument(
                "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")

            prefs = {
                "profile.managed_default_content_settings.images": 2,
                "profile.managed_default_content_settings.stylesheets": 2,
            }
            options.add_experimental_option("prefs", prefs)

            # Bot tespitini zorlaştıran ayarlar
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--disable-blink-features=AutomationControlled')

            service = ChromeService(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)

            # Bot olarak işaretlenmemek için ek bir script
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

            logging.info("TCI WebDriver başarıyla (yeniden) başlatıldı.")
        except Exception as e:
            logging.critical(f"TCI WebDriver başlatılırken kritik hata: {e}", exc_info=True)
            self.driver = None

    def kill_driver(self):
        """WebDriver işlemini zorla sonlandırır."""
        if not self.driver: return
        logging.warning("TCI WebDriver işlemi zorla sonlandırılıyor...")
        try:
            pid = self.driver.service.process.pid
            if os.name == 'nt':
                os.system(f"taskkill /F /PID {pid}")
            else:
                os.kill(pid, signal.SIGKILL)
            logging.info(f"TCI WebDriver işlemi (PID: {pid}) sonlandırıldı.")
        except Exception as e:
            logging.error(f"TCI WebDriver sonlandırılırken hata oluştu: {e}")
        finally:
            self.driver = None

    def get_products(self, search_query: str, cancellation_token: threading.Event) -> Generator[
        List[Product], None, None]:
        """
        Ürünleri çeker ve "Sonraki Sayfa" butonuna tıklayarak sayfalar arasında gezinir.
        """
        if not self.driver or cancellation_token.is_set():
            return

        encoded_query = quote(search_query)
        start_url = f"https://www.tcichemicals.com/AT/de/search?text={encoded_query}"

        try:
            self.driver.get(start_url)
            logging.info(f"'{search_query}' için TCI arama sayfası açıldı: {start_url}")

            # --- Cookie Onay Banner'ını Handle Etme ---
            try:
                wait = WebDriverWait(self.driver, 10)
                accept_button_selector = "//button[contains(text(), 'Alle akzeptieren')]"
                accept_button = wait.until(EC.element_to_be_clickable((By.XPATH, accept_button_selector)))
                accept_button.click()
                logging.info("Cookie onay banner'ı kabul edildi.")
                time.sleep(2)  # Banner'ın tamamen kaybolması için bekle
            except TimeoutException:
                logging.info("Cookie onay banner'ı bulunamadı, muhtemelen daha önce kabul edilmiş veya yok.")
            except Exception as e:
                logging.error(f"Cookie banner'ı tıklanırken bir hata oluştu: {e}")

        except WebDriverException as e:
            logging.error(f"TCI ana arama sayfası yüklenirken hata oluştu: {e}")
            return

        page_count = 1
        while not cancellation_token.is_set():
            logging.info(f"TCI Sayfa {page_count} taranıyor...")
            # Zaman aşımı süresini artırarak yavaş yüklenen sayfalara şans tanıyoruz
            wait = WebDriverWait(self.driver, 30)
            product_list_selector = "#product-basic-wrap div[data-product-code1]"

            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, product_list_selector)))
                product_cards = self.driver.find_elements(By.CSS_SELECTOR, product_list_selector)
                logging.info(f"{len(product_cards)} adet ürün kartı bulundu.")
            except TimeoutException:
                logging.info("Bu sayfada ürün kartı bulunamadı veya sayfa zaman aşımına uğradı. Tarama tamamlanıyor.")
                break

            if not product_cards:
                logging.info("Ürün kartları listesi boş. Tarama tamamlanıyor.")
                break

            # Sayfa geçişini doğrulamak için mevcut ürün kodlarını sakla
            current_product_codes = [card.get_attribute("data-product-code1") for card in product_cards]

            page_products = []
            for card in product_cards:
                if cancellation_token.is_set(): break
                try:
                    name = card.find_element(By.CSS_SELECTOR, "a.name.product-title").text.strip()
                    code = card.get_attribute("data-product-code1").strip()
                    cas_number = card.get_attribute("data-casNo").strip()
                    variations = []
                    # DEĞİŞİKLİK: Fiyat ve stok tablosunu daha detaylı ayrıştırma
                    rows = card.find_elements(By.CSS_SELECTOR, "#PricingTable tr")
                    for row in rows:  # Başlık satırını atlamaya gerek yok, data-attr ile kontrol edilecek
                        cols = row.find_elements(By.TAG_NAME, "td")
                        if not cols: continue

                        unit = ''
                        price = ''
                        stock_info = []

                        for col in cols:
                            try:
                                data_attr = col.get_attribute("data-attr").strip().strip(':')
                                text = col.text.strip()

                                if not text: continue

                                if data_attr == "Einheit":
                                    unit = text
                                elif data_attr == "Stückpreis":
                                    price = text.replace('\n', ' ')
                                else:
                                    stock_info.append({'country': data_attr, 'stock': text})
                            except:
                                continue  # Sütun işlenirken hata olursa atla

                        if unit and price:
                            variations.append({'unit': unit, 'price': price, 'stock_info': stock_info})

                    page_products.append(Product(name, code, variations, brand="TCI", cas_number=cas_number))
                except Exception as e:
                    logging.error(f"Bir TCI ürün kartı işlenirken hata oluştu: {e}", exc_info=False)

            if page_products:
                yield page_products

            # Sonraki sayfaya geçme
            try:
                next_button = self.driver.find_element(By.CSS_SELECTOR, "li.pagination-next a")
                self.driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                time.sleep(0.5)
                self.driver.execute_script("arguments[0].click();", next_button)
                logging.info("Sonraki sayfa butonuna tıklandı.")

                # --- YENİ VE KARARLI BEKLEME MANTIĞI ---
                # Yeni sayfadaki ilk ürünün kodunun, eskilerden farklı olmasını bekle
                wait.until(
                    lambda d: d.find_element(By.CSS_SELECTOR, product_list_selector).get_attribute(
                        "data-product-code1") not in current_product_codes
                )

                logging.info("Yeni sayfa içeriği başarıyla yüklendi.")
                page_count += 1
                time.sleep(random.uniform(1.0, 2.5))  # İnsan gibi davranmak için rastgele bekleme
            except NoSuchElementException:
                logging.info("TCI'da sonraki sayfa butonu bulunamadı. Tarama tamamlandı.")
                break
            except TimeoutException:
                logging.info("TCI'da sonraki sayfaya geçilemedi veya yeni içerik yüklenemedi. Tarama tamamlanıyor.")
                break

    def close_driver(self):
        """WebDriver'ı düzgünce kapatır."""
        if self.driver:
            try:
                self.driver.quit()
                logging.info("\nTCI WebDriver düzgünce kapatıldı.")
            except (WebDriverException, InvalidSessionIdException):
                logging.warning("TCI WebDriver kapatılırken zaten ulaşılamaz durumdaydı.")
            finally:
                self.driver = None
