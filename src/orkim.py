import requests
from bs4 import BeautifulSoup
from PIL import Image
import io
import base64
from openai import OpenAI
import json
import time
import hashlib
import logging
from typing import List, Dict, Any
from urllib.parse import urljoin, urlparse

class OrkimScraper:
    """
    Orkim Market web sitesinden ürün bilgilerini çekmek için tasarlanmış scraper sınıfı.
    Stok durumunu ve miktarını kontrol etme yeteneği eklenmiştir.
    """

    def __init__(self, username: str, password: str, openai_api_key: str):
        self.username = username
        self.password = password
        self.openai_api_key = openai_api_key
        self.base_url = "https://www.orkimmarket.com"
        self.login_page_url = f"{self.base_url}/giris"
        self.first_login_step_url = f"{self.base_url}/b2bgiris"
        self.second_login_step_url = f"{self.base_url}/b2bgiristamamla"
        self.search_url = f"{self.base_url}/arama"
        self.session = self._create_session()
        self.is_logged_in = False

    def _create_session(self):
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Referer": self.login_page_url,
            "Origin": self.base_url,
            "DNT": "1",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "X-Requested-With": "XMLHttpRequest"
        })
        return session

    def _process_captcha_image(self, image_bytes: bytes) -> bytes or None:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image = image.convert('L')
            threshold = 150
            image = image.point(lambda p: 255 if p > threshold else 0)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG")
            logging.info("Orkim CAPTCHA resmi disk'e yazılmadan, RAM üzerinde işlendi.")
            return buffer.getvalue()
        except Exception as e:
            logging.error(f"Orkim CAPTCHA RAM'de işlenirken hata oluştu: {e}")
            return None

    def _solve_captcha_with_gpt4o_mini(self, image_bytes: bytes) -> str or None:
        if not self.openai_api_key:
            raise ValueError("Orkim - OpenAI API anahtarı bulunamadı.")
        client = OpenAI(api_key=self.openai_api_key)
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        logging.info("Orkim: Temizlenmiş resim GPT-4o-mini'ye gönderiliyor...")
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": [
                        {"type": "text",
                         "text": "Bu resimdeki karakterleri boşluk bırakmadan, sadece harf ve rakam olacak şekilde metin olarak ver. Yanına başka hiçbir açıklama ekleme."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ], max_tokens=10
            )
            text = response.choices[0].message.content.strip()
            return "".join(filter(str.isalnum, text)).upper()
        except Exception as e:
            logging.error(f"Orkim - GPT-4o-mini ile CAPTCHA çözülürken bir hata oluştu: {e}")
            return None

    def _perform_two_step_login(self, captcha_text: str, re_security_code: str) -> bool:
        logging.info("Orkim: 1. Aşama: Giriş bilgileri gönderiliyor...")
        self.session.headers.update({"Accept": "application/json, text/javascript, */*; q=0.01"})
        payload_step1 = {"Email": self.username, "Sifre": self.password, "SecurityCode": captcha_text,
                         "ReSecurityCode": re_security_code}
        try:
            response_step1 = self.session.post(self.first_login_step_url, data=payload_step1, timeout=20)
            response_step1.raise_for_status()
            login_data = response_step1.json()
            if not login_data.get("IsSuccessful"):
                logging.error(f"Orkim GİRİŞ BAŞARISIZ (1. AŞAMA): {login_data.get('Message', 'Mesaj yok')}")
                return False
            kisi_kod = login_data.get("KisiKod")
            kurum_kod = login_data.get("Firmalar", [{}])[0].get("KurumKod")
            if not kisi_kod or not kurum_kod:
                logging.error("Orkim HATA: Yanıttan 'KisiKod' veya 'KurumKod' alınamadı.")
                return False
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logging.error(f"Orkim girişinin 1. aşamasında bir hata oluştu: {e}")
            return False

        logging.info("Orkim: 2. Aşama: Firma seçimi ve giriş tamamlama...")
        payload_step2 = {"Kurum": kurum_kod, "Email": self.username, "Sifre": self.password,
                         "SecurityCode": captcha_text, "ReSecurityCode": re_security_code, "KisiKod": kisi_kod}
        try:
            self.session.headers.update(
                {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"})
            response_step2 = self.session.post(self.second_login_step_url, data=payload_step2, timeout=20)
            response_step2.raise_for_status()
            if self.session.cookies.get('orkimmarket'):
                logging.info("Orkim GİRİŞ BAŞARILI! Oturum çerezi alındı.")
                self.is_logged_in = True
                return True
            else:
                logging.error("Orkim GİRİŞ BAŞARISIZ (2. AŞAMA)! Çerez (cookie) alınamadı.")
                return False
        except requests.exceptions.RequestException as e:
            logging.error(f"Orkim girişinin 2. aşamasında bir hata oluştu: {e}")
            return False

    def _login(self) -> bool:
        if self.is_logged_in:
            return True
        max_retries = 3
        for i in range(max_retries):
            logging.info(f"Orkim: Giriş denemesi {i + 1}/{max_retries}...")
            try:
                self.session.headers.update(
                    {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"})
                response = self.session.get(self.login_page_url, timeout=10)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'lxml')
                captcha_img = soup.find('img', {'id': 'SecurityCode'})
                re_code_tag = soup.find('input', {'name': 'ReSecurityCode'})
                if not captcha_img or not re_code_tag:
                    raise Exception("CAPTCHA veya ReSecurityCode alanı bulunamadı!")

                re_code_val = re_code_tag['value']
                captcha_url = urljoin(self.base_url, captcha_img['src'])
                captcha_bytes = self.session.get(captcha_url, timeout=10).content
                processed_bytes = self._process_captcha_image(captcha_bytes)
                if not processed_bytes: continue

                captcha_text = self._solve_captcha_with_gpt4o_mini(processed_bytes)
                if not captcha_text: continue

                calculated_hash = hashlib.md5(captcha_text.encode()).hexdigest()
                logging.info(
                    f"Orkim: Okunan='{captcha_text}', Hesaplanan MD5='{calculated_hash}', Beklenen='{re_code_val}'")
                if calculated_hash == re_code_val:
                    logging.info("Orkim: MD5 doğrulaması BAŞARILI.")
                    if self._perform_two_step_login(captcha_text, re_code_val):
                        return True
                else:
                    logging.warning("Orkim: MD5 doğrulaması BAŞARISIZ!")
            except Exception as e:
                logging.error(f"Orkim giriş döngüsünde hata: {e}")
            time.sleep(2)
        return False

    def _get_stock_from_page(self, product_url: str) -> int:
        """
        Bir ürünün stok miktarını, sepete yüksek miktarda ekleyip sonucu okuyarak alır.
        """
        try:
            # 1. Ürün sayfasına git
            detail_response = self.session.get(product_url, timeout=20)
            detail_response.raise_for_status()
            soup = BeautifulSoup(detail_response.text, 'lxml')

            # 2. Sepete ekleme formunu bul ve bilgilerini al
            form = soup.find('form', {'id': 'SepeteEkle'})
            if not form:
                logging.warning(f"Orkim: Stok kontrolü için {product_url} sayfasında sepet formu bulunamadı.")
                return 0

            action_url = urljoin(self.base_url, form.get('action'))
            urun_input = form.find('input', {'name': 'urun'})
            if not urun_input:
                logging.warning(f"Orkim: Stok kontrolü için {product_url} sayfasında 'urun' inputu bulunamadı.")
                return 0
            urun_value = urun_input.get('value')

            # 3. Yüksek miktarda ürünü sepete ekle
            payload = {'miktar': '999999,0', 'urun': urun_value}
            cart_response = self.session.post(action_url, data=payload, allow_redirects=True, timeout=20)
            cart_response.raise_for_status()
            cart_soup = BeautifulSoup(cart_response.text, 'lxml')

            # 4. Sepet sayfasından stok miktarını oku
            stock_quantity = 0
            qty_input = cart_soup.find('input', {'name': lambda n: n and 'SepetMiktar' in n})
            if qty_input and qty_input.get('value'):
                try:
                    stock_str = qty_input.get('value').replace(',', '.')
                    stock_quantity = int(float(stock_str))
                    logging.info(f"Orkim: Stok miktarı bulundu: {stock_quantity}")
                except (ValueError, TypeError):
                    logging.warning(f"Orkim: Stok miktarı '{qty_input.get('value')}' parse edilemedi.")
            else:
                logging.warning("Orkim: Sepet sayfasında miktar input'u bulunamadı.")

            # 5. Ürünü sepetten temizle
            remove_link_tag = cart_soup.find('a', {'href': lambda h: h and 'sepet-sil' in h})
            if remove_link_tag:
                remove_url = urljoin(self.base_url, remove_link_tag['href'])
                self.session.get(remove_url, timeout=20)
                logging.info("Orkim: Stok kontrolü sonrası ürün sepetten temizlendi.")
            else:
                logging.warning("Orkim: Sepet temizleme linki bulunamadı.")

            return stock_quantity

        except requests.exceptions.RequestException as e:
            logging.error(f"Orkim stok miktarı alınırken ağ hatası: {e}")
        except Exception as e:
            logging.error(f"Orkim stok miktarı alınırken genel hata: {e}", exc_info=True)

        return 0

    def search_products(self, search_term: str, cancellation_token) -> List[Dict[str, Any]]:
        if cancellation_token.is_set(): return []
        if not self._login():
            logging.error("Orkim'e giriş yapılamadı, arama atlanıyor.")
            return []

        logging.info(f"Orkim: '{search_term}' aranıyor...")
        all_scraped_data = []
        try:
            response = self.session.post(self.search_url, data={'arama': search_term, 'search1': ''},
                                         allow_redirects=True, timeout=30)
            response.raise_for_status()
            base_search_url = response.url.rsplit('/', 1)[0] + '/'

            page_number = 1
            last_page_content_hash = ""
            while not cancellation_token.is_set():
                logging.info(f"Orkim: Sayfa {page_number} taranıyor...")
                if page_number > 1:
                    response = self.session.get(f"{base_search_url}{page_number}?arama_gurup=", timeout=20)

                current_content_hash = hashlib.md5(response.text.encode()).hexdigest()
                if current_content_hash == last_page_content_hash:
                    logging.info("Orkim: Sayfa içeriği aynı, tarama tamamlandı.")
                    break
                last_page_content_hash = current_content_hash

                soup = BeautifulSoup(response.text, 'lxml')
                main_content = soup.find('div', class_='main_content')
                product_items = main_content.find_all('div', class_='asinItem') if main_content else []
                if not product_items:
                    logging.info(f"Orkim: Sayfa {page_number} üzerinde ürün bulunamadı, tarama tamamlandı.")
                    break

                for item in product_items:
                    if cancellation_token.is_set(): break
                    product_data = {}
                    product_name_tag = item.select_one('h3 a')
                    product_data['urun_adi'] = product_name_tag.get_text(strip=True) if product_name_tag else 'N/A'
                    product_url = product_name_tag['href'] if product_name_tag else None

                    kkodu_td = item.find('td', string='K.Kodu')
                    product_data['k_kodu'] = kkodu_td.find_next_sibling('td').get_text(
                        strip=True) if kkodu_td and kkodu_td.find_next_sibling('td') else 'N/A'

                    fiyat_td = item.find('td', string='Fiyat')
                    if fiyat_td and (fiyat_cell := fiyat_td.find_next_sibling('td')):
                        if birim_fiyat_tag := fiyat_cell.find('span', class_='birimfiyat'):
                            kdv_fiyat_tag = fiyat_cell.find('span', class_='kdvfiyat')
                            birim_fiyat = birim_fiyat_tag.get_text(strip=True)
                            kdv_fiyat = kdv_fiyat_tag.get_text(strip=True) if kdv_fiyat_tag else ''
                            product_data['price_str'] = f"{birim_fiyat} {kdv_fiyat}".strip()
                        else:
                            product_data['price_str'] = "Teklif İsteyiniz" if "Teklif İsteyiniz" in fiyat_cell.get_text(
                                strip=True) else "N/A"
                    else:
                        product_data['price_str'] = "N/A"

                    # Stok Durumu ve Miktarı Kontrolü
                    instock_img = item.find('img', src=lambda s: s and 'instock.png' in s)
                    outstock_img = item.find('img', src=lambda s: s and 'outstock.png' in s)

                    if instock_img:
                        product_data['stock_status'] = "Stokta Var"
                        if product_url:
                            product_data['stock_quantity'] = self._get_stock_from_page(product_url)
                        else:
                            product_data['stock_quantity'] = "N/A"
                    elif outstock_img:
                        product_data['stock_status'] = "Stokta Yok"
                        product_data['stock_quantity'] = 0
                    else:
                        product_data['stock_status'] = "Bilinmiyor"
                        product_data['stock_quantity'] = "N/A"

                    all_scraped_data.append(product_data)
                page_number += 1
        except Exception as e:
            logging.error(f"Orkim ürün arama/çekme sırasında hata: {e}", exc_info=True)

        logging.info(f"Orkim: '{search_term}' araması tamamlandı, {len(all_scraped_data)} ürün bulundu.")
        return all_scraped_data

    def close_driver(self):
        """Oturumu kapatır."""
        if self.session:
            self.session.close()
            logging.info("Orkim oturumu kapatıldı.")
