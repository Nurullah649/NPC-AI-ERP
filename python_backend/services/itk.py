# -*- coding: utf-8 -*-
import requests
from urllib3 import Retry
from bs4 import BeautifulSoup
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
from requests.adapters import HTTPAdapter

class ItkScraper:
    def __init__(self, username, password):
        self.BASE_URL = "https://www.teknikkimya.com.tr"
        self.LOGIN_URL = f"{self.BASE_URL}/bayi_giris.php"
        self.PRODUCTS_URL = f"{self.BASE_URL}/urunler.php"
        self.USERNAME = username
        self.PASSWORD = password
        self.session = self._create_session()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/5.37.36',
            'Referer': self.LOGIN_URL
        }
        self.session.headers.update(self.headers)

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST"]
        )
        adapter = HTTPAdapter(pool_connections=20, pool_maxsize=100, pool_block=True, max_retries=retry_strategy)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session

    def _login(self):
        try:
            self.session.get(self.LOGIN_URL, verify=False, timeout=15)
            payload = {
                'kullanici1': self.USERNAME[0:3],
                'kullanici2': self.USERNAME[3:5],
                'kullanici3': self.USERNAME[5:8],
                'sifre': self.PASSWORD,
                'kullanici': f"{self.USERNAME[0:3]} {self.USERNAME[3:5]} {self.USERNAME[5:8]}"
            }
            response = self.session.post(self.LOGIN_URL, data=payload, verify=False, timeout=15)
            if "Giriş başarılı" in response.text:
                logging.info("ITK Scraper: Başarıyla giriş yapıldı.")
                return True
            else:
                logging.error("ITK Scraper: Giriş başarısız. Kullanıcı adı veya şifre yanlış olabilir.")
                return False
        except requests.exceptions.RequestException as e:
            logging.error(f"ITK Scraper: Giriş sırasında ağ hatası: {e}")
            return False

    def _get_category_links(self):
        try:
            response = self.session.get(self.PRODUCTS_URL, verify=False, timeout=15)
            if response.status_code != 200:
                logging.error(f"ITK Scraper: Ürün kategorileri sayfasına erişilemedi. Status: {response.status_code}")
                return []
            soup = BeautifulSoup(response.content, 'lxml')
            category_links = []
            product_divs = soup.find_all('div', class_='product')
            for product_div in product_divs:
                link_tag = product_div.find('a')
                if link_tag and 'href' in link_tag.attrs and 'urun_icerik.php' in link_tag['href']:
                    href = link_tag['href']
                    if href not in category_links:
                        category_links.append(f"{self.BASE_URL}/{href}")
            logging.info(f"ITK Scraper: {len(category_links)} adet ürün kategorisi bulundu.")
            return category_links
        except requests.exceptions.RequestException as e:
            logging.error(f"ITK Scraper: Kategori linkleri alınırken hata: {e}")
            return []

    def _scrape_category_page(self, link: str) -> List[Dict[str, Any]]:
        page_products = []
        try:
            category_page = self.session.get(link, verify=False, timeout=20)
            category_soup = BeautifulSoup(category_page.content, 'lxml')
            product_rows = category_soup.select('tbody tr')
            if not product_rows:
                product_rows = category_soup.select('table tr')[1:]
            for row in product_rows:
                try:
                    stok_kod_input = row.find('input', {'name': 'stok_kod'})
                    stok_adi_input = row.find('input', {'name': 'stok_adi'})
                    fiyat_input = row.find('input', {'name': 'fiyat'})
                    doviz_input = row.find('input', {'name': 'doviz'})
                    if not all([stok_kod_input, stok_adi_input, fiyat_input, doviz_input]):
                        continue
                    stok_kod = stok_kod_input['value']
                    stok_adi = stok_adi_input['value']
                    fiyat = fiyat_input['value']
                    doviz = doviz_input['value']
                    stok_span = row.find('span', title=lambda t: t and t.startswith('Stok:'))
                    if stok_span:
                        stok_durumu = stok_span.get_text(strip=True)
                        stok_adeti = stok_span['title'].replace('Stok:', '').strip()
                    else:
                        stok_durumu = "Belirtilmemiş"
                        stok_adeti = "N/A"
                    page_products.append({
                        "source": "ITK",
                        "product_code": stok_kod,
                        "product_name": stok_adi,
                        "stock_status": stok_durumu,
                        "stock_quantity": stok_adeti,
                        "price": float(fiyat.replace(',', '.')) if fiyat else 0.0,
                        "currency": doviz,
                        "price_str": f"{float(fiyat.replace(',', '.')):.2f} {doviz}" if fiyat else "N/A"
                    })
                except (AttributeError, TypeError, KeyError, ValueError):
                    logging.debug(f"ITK Scraper: Bir ürün satırı işlenemedi. Link: {link}", exc_info=False)
                    continue
            return page_products
        except requests.exceptions.RequestException as e:
            logging.warning(f"ITK Scraper: Kategori sayfası işlenirken hata: {link}. Hata: {e}")
            return []

    def get_all_products(self):
        if not self._login():
            return []
        category_links = self._get_category_links()
        if not category_links:
            return []
        all_products = []
        total_categories = len(category_links)
        start_time = time.monotonic()
        with ThreadPoolExecutor(max_workers=10, thread_name_prefix="ITK-Scraper") as executor:
            future_to_link = {executor.submit(self._scrape_category_page, link): link for link in category_links}
            processed_count = 0
            for future in as_completed(future_to_link):
                link = future_to_link[future]
                processed_count += 1
                try:
                    page_products = future.result()
                    if page_products:
                        all_products.extend(page_products)
                    logging.info(f"ITK Scraper: Kategori {processed_count}/{total_categories} işlendi ({len(page_products)} ürün bulundu).")
                except Exception as exc:
                    logging.error(f"ITK Scraper: Kategori {link} işlenirken kritik hata: {exc}")
        end_time = time.monotonic()
        logging.info(f"ITK Scraper: Toplam {len(all_products)} adet ürün {end_time - start_time:.2f} saniyede (paralel olarak) çekildi.")
        return all_products
