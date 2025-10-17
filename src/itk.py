# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import time
import logging

# Güvensiz SSL istekleri hakkındaki uyarıları bastırmak için
from requests.packages.urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


class ItkScraper:
    """
    İstanbul Teknik Kimya web sitesinden ürün verilerini çekmek için tasarlanmış scraper sınıfı.
    Giriş yapar, tüm kategorileri gezer ve ürün bilgilerini toplar.
    """

    def __init__(self, username, password):
        self.BASE_URL = "https://www.teknikkimya.com.tr"
        self.LOGIN_URL = f"{self.BASE_URL}/bayi_giris.php"
        self.PRODUCTS_URL = f"{self.BASE_URL}/urunler.php"
        self.USERNAME = username
        self.PASSWORD = password
        self.session = requests.Session()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Referer': self.LOGIN_URL
        }
        self.session.headers.update(self.headers)

    def _login(self):
        """Siteye bayi girişi yapar."""
        try:
            # Önce cookie almak için giriş sayfasını ziyaret et
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
        """Ürünler sayfasından tüm kategori linklerini toplar."""
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

    def get_all_products(self):
        """Tüm kategorileri gezerek tüm ürünleri çeker ve bir liste olarak döndürür."""
        if not self._login():
            return []

        category_links = self._get_category_links()
        if not category_links:
            return []

        all_products = []
        total_categories = len(category_links)
        for i, link in enumerate(category_links, 1):
            logging.info(f"ITK Scraper: Kategori {i}/{total_categories} işleniyor: {link.split('marka=')[-1]}")
            try:
                time.sleep(0.5)  # Sunucuyu yormamak için kısa bir bekleme
                category_page = self.session.get(link, verify=False, timeout=20)
                category_soup = BeautifulSoup(category_page.content, 'lxml')

                product_rows = category_soup.select('tbody tr')
                if not product_rows:
                    product_rows = category_soup.select('table tr')[1:]

                for row in product_rows:
                    try:
                        stok_kod = row.find('input', {'name': 'stok_kod'})['value']
                        stok_adi = row.find('input', {'name': 'stok_adi'})['value']
                        fiyat = row.find('input', {'name': 'fiyat'})['value']
                        doviz = row.find('input', {'name': 'doviz'})['value']

                        stok_span = row.find('span', title=lambda t: t and t.startswith('Stok:'))
                        if stok_span:
                            stok_durumu = stok_span.get_text(strip=True)
                            stok_adeti = stok_span['title'].replace('Stok:', '').strip()
                        else:
                            stok_durumu = "Belirtilmemiş"
                            stok_adeti = "N/A"

                        all_products.append({
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
                        continue
            except requests.exceptions.RequestException as e:
                logging.warning(f"ITK Scraper: Kategori sayfası işlenirken hata: {link}. Hata: {e}")
                continue

        logging.info(f"ITK Scraper: Toplam {len(all_products)} adet ürün başarıyla çekildi.")
        return all_products
