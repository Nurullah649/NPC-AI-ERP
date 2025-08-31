import logging
import time
import os
import signal
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException, \
    InvalidSessionIdException
from webdriver_manager.chrome import ChromeDriverManager
from typing import Generator, List, Dict, Any


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
            # Chrome'un arka planda çalışması için headless modu aktif et
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--start-maximized")
            options.add_argument(
                "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            service = ChromeService(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
            logging.info("TCI WebDriver başarıyla (yeniden) başlatıldı.")
        except Exception as e:
            logging.critical(f"TCI WebDriver başlatılırken kritik hata: {e}", exc_info=True)
            self.driver = None

    def kill_driver(self):
        """WebDriver işlemini zorla sonlandırır."""
        if not self.driver:
            return
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

    def get_products(self, search_query, cancellation_token) -> Generator[List[Product], None, None]:
        """
        Kullanıcının sağladığı eski mantıkla ürünleri çeker ancak sonuçları sayfa sayfa akıtır (yield).
        """
        if not self.driver or cancellation_token.is_set():
            return

        base_url = f"https://www.tcichemicals.com/AT/de/search/?text={search_query}"
        page_count = 1

        try:
            self.driver.get(base_url)
            logging.info(f"'{search_query}' için TCI arama sayfası açıldı: {base_url}")

            while not cancellation_token.is_set():
                logging.info(f"\nTCI Sayfa {page_count} taranıyor...")
                wait = WebDriverWait(self.driver, 15)

                try:
                    wait.until(EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "#product-basic-wrap > div.prductlist.selectProduct")))
                    product_cards = self.driver.find_elements(By.CSS_SELECTOR,
                                                              "#product-basic-wrap > div.prductlist.selectProduct")
                    logging.info(f"{len(product_cards)} adet ürün kartı bulundu.")
                except TimeoutException:
                    logging.info("Bu sayfada ürün kartı bulunamadı veya sayfa yüklenemedi.")
                    break

                page_products = []
                for card in product_cards:
                    if cancellation_token.is_set(): break

                    try:
                        # Senin sağladığın eski veri çekme mantığı
                        name = card.find_element(By.CSS_SELECTOR, "a.name.product-title").text.strip()
                        code = card.get_attribute("data-product-code1").strip()
                        cas_number = card.get_attribute("data-casNo").strip()

                        variations = []
                        try:
                            pricing_table = card.find_element(By.ID, "PricingTable")
                            rows = pricing_table.find_elements(By.TAG_NAME, "tr")
                            for row in rows[1:]:
                                cols = row.find_elements(By.TAG_NAME, "td")
                                if len(cols) >= 2:
                                    unit = cols[0].text.strip()
                                    price = "Fiyat Yok"
                                    try:
                                        price_element = cols[1].find_element(By.CSS_SELECTOR, "div.listPriceNoStrike")
                                        price = price_element.text.strip()
                                    except NoSuchElementException:
                                        price = cols[1].text.strip()
                                    variations.append({'unit': unit, 'price': price})
                        except NoSuchElementException:
                            logging.warning(f"TCI ürünü '{name}' ({code}) için fiyat tablosu bulunamadı.")

                        product = Product(name, code, variations, brand="TCI", cas_number=cas_number)
                        page_products.append(product)

                    except Exception as e:
                        logging.error(f"Bir TCI ürün kartı işlenirken hata oluştu: {e}", exc_info=False)
                        continue

                # Sayfadaki ürünler bittikten sonra, eğer varsa, ana programa gönder (yield)
                if page_products:
                    logging.info(f"{len(page_products)} ürün ana programa akıtılıyor...")
                    yield page_products

                try:
                    # Sonraki sayfa mantığı
                    next_button = self.driver.find_element(By.CSS_SELECTOR, "li.pagination-next a")
                    if next_button.is_displayed() and next_button.is_enabled():
                        self.driver.execute_script("arguments[0].click();", next_button)
                        page_count += 1
                        time.sleep(3)
                    else:
                        logging.info("TCI'da sonraki sayfa butonu tıklanabilir değil. Tarama tamamlandı.")
                        break
                except NoSuchElementException:
                    logging.info("TCI'da sonraki sayfa butonu bulunamadı. Tarama tamamlandı.")
                    break

        except (WebDriverException, InvalidSessionIdException) as e:
            logging.error(f"TCI WebDriver ile iletişim kesildi, muhtemelen sonlandırıldı: {e}")
        except Exception as e:
            if not cancellation_token.is_set():
                logging.error(f"TCI taraması sırasında beklenmedik bir hata oluştu: {e}", exc_info=True)

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

# if __name__ == "__main__":
#     logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

#     scraper = TciScraper()

#     try:
#         scraper.reinit_driver()

#         search_term = "Melatonin"

#         cancel_token = threading.Event()

#         total_products_found = 0
#         # Jeneratörden gelen her sayfayı döngüyle al
#         for product_page in scraper.get_products(search_term, cancel_token):
#             if product_page:
#                 logging.info(f"--- {len(product_page)} adet ürün işleniyor ---")
#                 total_products_found += len(product_page)
#                 for p in product_page:
#                     print(p)

#         logging.info(f"\n---> Toplam {total_products_found} TCI ürünü bulundu.")

#     except Exception as e:
#          logging.error(f"Program çalışırken ana bir hata oluştu: {e}", exc_info=True)
#     finally:
#          scraper.close_driver()

