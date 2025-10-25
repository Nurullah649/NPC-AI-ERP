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
import re  # Import regex module
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse
import threading  # YENİ IMPORT

# YENİ IMPORTLAR
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


class OrkimScraper:
    """
    Orkim Market web sitesinden ürün bilgilerini çekmek için tasarlanmış scraper sınıfı.
    Doğrudan ürün sayfasına yönlendirmeleri ve arama sonuç sayfalarını işleyebilir.
    Stok durumunu ve fiyatını doğru bir şekilde çıkarmaya çalışır.
    Oturumu arka planda yönetir.
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
        self.price_check_url = f"{self.base_url}/urun-fiyat-goster"
        self.account_check_url = f"{self.base_url}/hesabim"  # Oturum kontrolü için
        self.session = self._create_session()
        self.is_logged_in = False
        self.session_manager_stop_event = threading.Event()  # Arka plan thread'ini durdurmak için
        logging.getLogger("urllib3").setLevel(logging.WARNING)

    def _create_session(self):
        """
        Gelişmiş bağlantı havuzlama ve yeniden deneme stratejileri ile
        bir requests.Session nesnesi oluşturur.
        """
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST"]
        )
        adapter = HTTPAdapter(
            pool_connections=20,
            pool_maxsize=100,
            pool_block=True,
            max_retries=retry_strategy
        )
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Referer": self.login_page_url,
            "Origin": self.base_url,
            "DNT": "1",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        })
        return session

    def _process_captcha_image(self, image_bytes: bytes) -> bytes or None:
        # ... (Bu fonksiyon aynı kaldı) ...
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
        # ... (Bu fonksiyon aynı kaldı) ...
        if not self.openai_api_key:
            logging.error("Orkim - OpenAI API anahtarı bulunamadı.")
            return None  # Changed from raising error to returning None
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
            # Added more robust filtering
            filtered_text = "".join(filter(str.isalnum, text)).upper()
            if not filtered_text:
                logging.warning(f"Orkim - GPT-4o-mini boş veya geçersiz CAPTCHA metni döndürdü: '{text}'")
                return None
            return filtered_text
        except Exception as e:
            logging.error(f"Orkim - GPT-4o-mini ile CAPTCHA çözülürken bir hata oluştu: {e}")
            return None

    def _perform_two_step_login(self, captcha_text: str, re_security_code: str) -> bool:
        # ... (Bu fonksiyon aynı kaldı) ...
        logging.info("Orkim: 1. Aşama: Giriş bilgileri gönderiliyor...")
        # Ensure correct headers for AJAX request
        self.session.headers.update({
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
        })
        payload_step1 = {"Email": self.username, "Sifre": self.password, "SecurityCode": captcha_text,
                         "ReSecurityCode": re_security_code}
        try:
            response_step1 = self.session.post(self.first_login_step_url, data=payload_step1, timeout=20)
            response_step1.raise_for_status()
            login_data = response_step1.json()
            if not login_data.get("IsSuccessful"):
                # Handle specific error message for wrong CAPTCHA
                if "Doğrulama kodu hatalı" in login_data.get('Message', ''):
                    logging.warning(
                        f"Orkim GİRİŞ BAŞARISIZ (1. AŞAMA): CAPTCHA hatalı ('{captcha_text}'). Yeniden denenecek.")
                    return False  # Indicate CAPTCHA failure for retry
                else:
                    logging.error(f"Orkim GİRİŞ BAŞARISIZ (1. AŞAMA): {login_data.get('Message', 'Mesaj yok')}")
                    return False  # Indicate other login failure

            kisi_kod = login_data.get("KisiKod")
            # Handle potential multiple firms, take the first one
            firmalar = login_data.get("Firmalar", [])
            if not firmalar:
                logging.error("Orkim HATA: Yanıtta firma bilgisi bulunamadı.")
                return False
            kurum_kod = firmalar[0].get("KurumKod")

            if not kisi_kod or not kurum_kod:
                logging.error(f"Orkim HATA: Yanıttan 'KisiKod' ({kisi_kod}) veya 'KurumKod' ({kurum_kod}) alınamadı.")
                return False
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logging.error(f"Orkim girişinin 1. aşamasında bir hata oluştu: {e}")
            return False

        logging.info("Orkim: 2. Aşama: Firma seçimi ve giriş tamamlama...")
        payload_step2 = {"Kurum": kurum_kod, "Email": self.username, "Sifre": self.password,
                         "SecurityCode": captcha_text, "ReSecurityCode": re_security_code, "KisiKod": kisi_kod}
        try:
            # Update headers for standard form submission
            self.session.headers.update({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "X-Requested-With": None  # Remove AJAX header
            })
            response_step2 = self.session.post(self.second_login_step_url, data=payload_step2, timeout=20)
            response_step2.raise_for_status()
            # Check if the response URL indicates successful login (e.g., dashboard) or check for specific text
            if "hesabim" in response_step2.url or "Merhaba" in response_step2.text:
                logging.info("Orkim GİRİŞ BAŞARILI! Oturum çerezi alındı.")
                self.is_logged_in = True
                return True
            else:
                logging.error("Orkim GİRİŞ BAŞARISIZ (2. AŞAMA)! Giriş sonrası sayfa beklenildiği gibi değil.")
                # Log response content for debugging if needed
                # logging.debug(f"Orkim 2. Aşama Yanıt İçeriği: {response_step2.text[:500]}")
                return False
        except requests.exceptions.RequestException as e:
            logging.error(f"Orkim girişinin 2. aşamasında bir hata oluştu: {e}")
            return False

    def _login(self) -> bool:
        # Bu fonksiyon artık CAPTCHA çözme işlemini yapar, ancak sadece
        # arka plan yöneticisi tarafından çağrılır.
        if self.is_logged_in:  # Zaten açıksa tekrar deneme
            # Ancak yine de bir sağlık kontrolü yapalım, belki düştü
            if self.check_session_health():
                return True
            else:
                logging.warning("Orkim: _login çağrıldı ama oturum düşmüş gibi görünüyor. Yeniden giriş denenecek.")
                self.is_logged_in = False  # Yeniden girişi zorunlu kıl

        max_retries = 5
        for i in range(max_retries):
            # Arka plan thread'i durdurulmak istenirse çık
            if self.session_manager_stop_event.is_set():
                logging.info("Orkim: Arka plan yöneticisi durdurulduğu için giriş denemesi iptal edildi.")
                return False

            logging.info(f"Orkim (Arka Plan): Giriş denemesi {i + 1}/{max_retries}...")
            try:
                self.session.headers.update({
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                    "X-Requested-With": None
                })
                response = self.session.get(self.login_page_url, timeout=15)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'lxml')
                captcha_img = soup.find('img', {'id': 'SecurityCode'})
                re_code_tag = soup.find('input', {'name': 'ReSecurityCode'})
                if not captcha_img or not re_code_tag:
                    logging.error("Orkim HATA: Giriş sayfasında CAPTCHA veya ReSecurityCode alanı bulunamadı!")
                    time.sleep(2)
                    continue

                re_code_val = re_code_tag.get('value', '')
                if not re_code_val:
                    logging.error("Orkim HATA: ReSecurityCode değeri alınamadı!")
                    time.sleep(2)
                    continue

                captcha_url_relative = captcha_img.get('src')
                if not captcha_url_relative:
                    logging.error("Orkim HATA: CAPTCHA resim URL'si alınamadı!")
                    time.sleep(2)
                    continue
                captcha_url = urljoin(self.base_url, captcha_url_relative)

                self.session.headers.update(
                    {"Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"})
                captcha_response = self.session.get(captcha_url, timeout=15)
                captcha_response.raise_for_status()
                captcha_bytes = captcha_response.content

                processed_bytes = self._process_captcha_image(captcha_bytes)
                if not processed_bytes:
                    logging.warning("Orkim: CAPTCHA işlenemedi.")
                    time.sleep(3)
                    continue

                captcha_text = self._solve_captcha_with_gpt4o_mini(processed_bytes)
                if not captcha_text:
                    logging.warning("Orkim: CAPTCHA çözülemedi.")
                    time.sleep(3)
                    continue

                calculated_hash = hashlib.md5(captcha_text.encode()).hexdigest()
                logging.info(
                    f"Orkim: Okunan='{captcha_text}', Hesaplanan MD5='{calculated_hash}', Beklenen='{re_code_val}'")

                if self._perform_two_step_login(captcha_text, re_code_val):
                    return True  # Başarılı giriş

            except requests.exceptions.RequestException as e:
                logging.error(f"Orkim giriş döngüsünde ağ hatası: {e}")
            except Exception as e:
                logging.error(f"Orkim giriş döngüsünde beklenmedik hata: {e}", exc_info=True)

            wait_time = 2 + i
            logging.info(f"Orkim: Giriş başarısız, {wait_time} saniye sonra tekrar denenecek...")
            # Durdurma sinyalini beklerken uyu
            if self.session_manager_stop_event.wait(timeout=wait_time):
                logging.info("Orkim: Giriş beklemesi sırasında durdurma sinyali alındı.")
                return False

        logging.error(f"Orkim: {max_retries} deneme sonunda giriş yapılamadı.")
        self.is_logged_in = False  # Başarısız olduysa durumu güncelle
        return False

    # --- YENİ FONKSİYON: Oturum Sağlık Kontrolü ---
    def check_session_health(self) -> bool:
        """Oturumun hala geçerli olup olmadığını hızlıca kontrol eder."""
        if not self.is_logged_in:
            return False  # Henüz hiç giriş yapılmadıysa sağlıksız kabul et
        try:
            self.session.headers.update({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "X-Requested-With": None,
                "Referer": self.base_url  # Ana sayfadan geliyormuş gibi
            })
            response = self.session.get(self.account_check_url, timeout=10,
                                        allow_redirects=False)  # Redirect'leri takip etme
            # Eğer giriş sayfasına yönlendirilmiyorsa VE "Merhaba" içeriyorsa oturum sağlıklıdır
            if response.status_code == 200 and "Merhaba" in response.text:
                return True
            else:
                logging.warning(
                    f"Orkim oturum sağlık kontrolü başarısız. Status: {response.status_code}, URL: {response.url}")
                self.is_logged_in = False  # Oturum düşmüş, durumu güncelle
                return False
        except requests.exceptions.RequestException as e:
            logging.warning(f"Orkim oturum sağlık kontrolü sırasında ağ hatası: {e}")
            # Ağ hatası durumunda hemen sağlıksız demek yerine bir sonraki kontrole bırakabiliriz.
            # Şimdilik sağlıksız kabul edelim:
            self.is_logged_in = False
            return False

    # --- YENİ FONKSİYON: Arka Plan Oturum Yöneticisi ---
    def run_background_session_manager(self):
        """
        Oturumu periyodik olarak kontrol eden ve gerekirse yenileyen
        arka plan thread fonksiyonu.
        """
        logging.info("Orkim Arka Plan Oturum Yöneticisi başlatıldı.")
        # Başlangıçta hemen bir giriş yapmayı dene
        if not self.is_logged_in:
            logging.info("Orkim: İlk oturum açma denemesi (arka plan)...")
            self._login()

        while not self.session_manager_stop_event.is_set():
            try:
                if not self.check_session_health():
                    logging.warning("Orkim oturumu düşmüş veya sağlıksız. Arka planda yenileniyor...")
                    if not self._login():  # Yavaş olan, AI destekli CAPTCHA çözümünü burada yap
                        # Giriş başarısız olduysa bir süre bekle
                        logging.error(
                            "Orkim: Arka planda oturum yenileme başarısız oldu. 5 dakika sonra tekrar denenecek.")
                        if self.session_manager_stop_event.wait(timeout=300): break  # 5 dk bekle veya durdurulursa çık
                        continue  # Döngüye devam et
                else:
                    logging.debug("Orkim oturumu sağlıklı.")  # INFO yerine DEBUG, logları azaltmak için

            except Exception as e:
                logging.error(f"Orkim arka plan oturum yöneticisi hatası: {e}", exc_info=True)

            # Her 15 dakikada bir kontrol et (veya durdurma sinyali gelene kadar bekle)
            logging.debug("Orkim oturum yöneticisi 15 dakika bekliyor...")
            if self.session_manager_stop_event.wait(timeout=900):  # 15 dakika = 900 saniye
                break  # Durdurma sinyali geldiyse döngüden çık

        logging.info("Orkim Arka Plan Oturum Yöneticisi durduruldu.")

    def _get_product_price_ajax(self, urun_no: str) -> str:
        # ... (Bu fonksiyon aynı kaldı) ...
        if not urun_no:
            return "N/A"
        try:
            payload = {'UrunNo': urun_no}
            # Ensure correct headers for AJAX request
            self.session.headers.update({
                "Accept": "*/*",  # More generic accept for potential plain text response
                "X-Requested-With": "XMLHttpRequest",
                "Referer": self.session.headers.get("Referer", self.base_url)  # Use last known referer
            })
            response = self.session.post(self.price_check_url, data=payload, timeout=15)
            response.raise_for_status()
            # The response might be plain text "Teklif İsteyiniz" or JSON/HTML, handle appropriately
            # Assuming plain text based on the example
            price_text = response.text.strip()
            # Clean up potential extra characters or quotes
            if price_text.startswith('"') and price_text.endswith('"'):
                price_text = price_text[1:-1]
            logging.info(f"Orkim: AJAX fiyat sorgusu sonucu (UrunNo: {urun_no}): '{price_text}'")
            return price_text if price_text else "N/A"
        except requests.exceptions.RequestException as e:
            logging.error(f"Orkim: AJAX fiyat sorgusu hatası (UrunNo: {urun_no}): {e}")
            return "Hata"
        except Exception as e:
            logging.error(f"Orkim: AJAX fiyat sorgusu sırasında beklenmedik hata: {e}", exc_info=True)
            return "Hata"

    def _parse_product_page(self, html_content: str, product_url: str, search_logic: str) -> List[
        Dict[str, Any]]:  # search_logic eklendi
        """Parses a direct product page HTML."""
        # ... (Fonksiyonun iç mantığı _get_stock_from_page çağrısı hariç aynı) ...
        logging.info(f"Orkim: Ürün sayfası ayrıştırılıyor: {product_url}")
        soup = BeautifulSoup(html_content, 'lxml')
        product_data = {}
        product_data['source'] = "Orkim"
        product_data['product_url'] = product_url  # Add product URL

        # Extract Name
        title_tag = soup.find('h1', class_='page_title')
        product_data['urun_adi'] = title_tag.get_text(strip=True) if title_tag else 'N/A'

        # Extract Codes, Brand, Packaging from the info table
        info_table = soup.find('table', class_='urunbilgi')
        if info_table:
            rows = info_table.find_all('tr')
            for row in rows:
                header_tag = row.find('th')
                value_tag = row.find('td')
                if header_tag and value_tag:
                    header_text = header_tag.get_text(strip=True).lower()
                    value_text = value_tag.get_text(strip=True)

                    if 'katalog kodu' in header_text:
                        product_data['k_kodu'] = value_text
                    elif 'üretici kodu' in header_text:
                        product_data['uretici_kodu'] = value_text
                    elif 'markası' in header_text:
                        brand_strong = value_tag.find('strong')
                        product_data['brand'] = brand_strong.get_text(strip=True) if brand_strong else value_text
                    elif 'ambalaj' in header_text:
                        product_data['ambalaj'] = value_text

        # Extract Price (Bu kısım aynı kaldı)
        price_button = soup.find('a', id='fiyatGoster')
        if price_button:
            logging.info("Orkim: 'Fiyatı Göster' butonu bulundu. AJAX isteği yapılacak.")
            # Extract UrunNo using regex from the script tag
            urun_no = None
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and 'urun-fiyat-goster' in script.string:
                    match = re.search(r"UrunNo\s*:\s*(\d+)", script.string)
                    if match:
                        urun_no = match.group(1)
                        logging.info(f"Orkim: UrunNo bulundu: {urun_no}")
                        break
            if urun_no:
                product_data['price_str'] = self._get_product_price_ajax(urun_no)
            else:
                logging.warning("Orkim: 'Fiyatı Göster' butonu var ama UrunNo bulunamadı.")
                product_data['price_str'] = "N/A"
        else:
            # Look for direct price
            price_area = soup.find('div', id='fiyatAlani', style=lambda s: s is None or 'display:none' not in s)
            if price_area:
                # Example 2 structure: Liste Fiyatı, Size Özel Net Fiyat, KDV Hariç TL Fiyat
                list_price_th = price_area.find_parent('table').find('th',
                                                                     string=re.compile(r'Liste Fiyatı', re.IGNORECASE))
                special_price_th = price_area.find_parent('table').find('th', string=re.compile(r'Size Özel Net Fiyat',
                                                                                                re.IGNORECASE))
                tl_price_th = price_area.find_parent('table').find('th', string=re.compile(r'KDV Hariç TL Fiyat',
                                                                                           re.IGNORECASE))

                price_parts = []
                if list_price_th and (td := list_price_th.find_next_sibling('td')):
                    list_price_str = td.get_text(separator=' ', strip=True).replace(' + KDV', '+KDV')
                    if list_price_str: price_parts.append(f"Liste: {list_price_str}")
                if special_price_th and (td := special_price_th.find_next_sibling('td')):
                    special_price_str = td.get_text(separator=' ', strip=True).replace(' + KDV', '+KDV')
                    if special_price_str: price_parts.append(f"Özel: {special_price_str}")
                if tl_price_th and (td := tl_price_th.find_next_sibling('td')):
                    tl_price_str = td.get_text(separator=' ', strip=True)
                    if tl_price_str: price_parts.append(f"TL: {tl_price_str}")

                product_data['price_str'] = " / ".join(price_parts) if price_parts else "N/A"
                logging.info(f"Orkim: Direkt fiyat bulundu: {product_data['price_str']}")

            else:
                logging.warning("Orkim: Fiyat bilgisi bulunamadı (Ne buton ne de direkt alan).")
                product_data['price_str'] = "N/A"

        # --- GÜNCELLENMİŞ STOK MANTIĞI ---
        stock_status = "Bilinmiyor"
        stock_quantity: Any = "N/A"  # Default quantity
        stock_th = soup.find('th', string=re.compile(r'^\s*Stok\s*$', re.IGNORECASE))
        if stock_th and (stock_td := stock_th.find_next_sibling('td')):
            stock_text = stock_td.get_text(strip=True)
            if "Stokta Var" in stock_text:
                stock_status = "Stokta Var"
                # Yavaş _get_stock_from_page çağrısı KALDIRILDI.
                stock_quantity = "Var"  # Sadece "Var" yaz
            elif "Stokta Yok" in stock_text:
                stock_status = "Stokta Yok"
                stock_quantity = 0
            else:
                # Check images as fallback
                instock_img = soup.find('img', src=lambda s: s and 'instock.png' in s)
                outstock_img = soup.find('img', src=lambda s: s and 'outstock.png' in s)
                if instock_img:
                    stock_status = "Stokta Var"
                    # Yavaş _get_stock_from_page çağrısı KALDIRILDI.
                    stock_quantity = "Var"  # Sadece "Var" yaz
                elif outstock_img:
                    stock_status = "Stokta Yok"
                    stock_quantity = 0
        # --- STOK MANTIĞI SONU ---

        product_data['stock_status'] = stock_status
        product_data['stock_quantity'] = stock_quantity  # Use derived quantity

        # Fill missing default keys
        product_data.setdefault('k_kodu', 'N/A')
        product_data.setdefault('uretici_kodu', 'N/A')
        product_data.setdefault('brand', 'Orkim')  # Default if not found
        product_data.setdefault('ambalaj', 'N/A')

        logging.info(f"Orkim: Ürün sayfası ayrıştırma sonucu: {product_data}")
        return [product_data]  # Return as a list containing one product

    def search_products(self, search_term: str, cancellation_token, search_logic: str = "exact") -> List[
        Dict[str, Any]]:
        if cancellation_token.is_set(): return []

        # --- YENİ: Giriş kontrolü KALDIRILDI ---
        # Arka plan yöneticisinin oturumu canlı tuttuğunu varsayıyoruz.
        # if not self._login(): # <-- BU SATIR SİLİNDİ
        #     logging.error("Orkim'e giriş yapılamadı, arama atlanıyor.")
        #     return []
        if not self.is_logged_in:  # Hızlı kontrol: Eğer arka plan yöneticisi henüz giriş yapamadıysa
            logging.warning("Orkim oturumu henüz aktif değil. Arama sonuçları eksik olabilir veya hata verebilir.")
            # İsteğe bağlı olarak burada hata döndürebilir veya boş liste döndürebilirsiniz.
            # Şimdilik devam etmeyi deneyelim, belki oturum tam o anda açılır.

        logging.info(f"Orkim: '{search_term}' aranıyor (Mantık: {search_logic})...")
        all_scraped_data = []
        term_lower = search_term.lower()

        try:
            self.session.headers.update({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": None
            })
            response = self.session.post(self.search_url, data={'arama': search_term, 'search1': ''},
                                         allow_redirects=True, timeout=30)
            response.raise_for_status()

            if "/urun/" in response.url:
                logging.info(f"Orkim: '{search_term}' araması doğrudan ürün sayfasına yönlendirdi: {response.url}")
                parsed_products = self._parse_product_page(response.text, response.url,
                                                           search_logic)  # search_logic iletildi
                if not parsed_products: return []
                product = parsed_products[0]
                match_found = False
                if search_logic == "exact":  # Esnek exact mantığı korundu
                    if (term_lower in product.get('urun_adi', '').lower() or
                            term_lower in product.get('k_kodu', '').lower() or
                            term_lower in product.get('uretici_kodu', '').lower()):
                        match_found = True
                else:
                    match_found = True
                return [product] if match_found else []

            logging.info(f"Orkim: '{search_term}' araması sonuç sayfasına yönlendirdi: {response.url}")
            base_search_url = response.url
            parsed_url = urlparse(base_search_url)
            base_path_for_page = parsed_url.path if parsed_url.path.endswith('/') else parsed_url.path.rsplit('/', 1)[
                                                                                           0] + '/'
            pagination_base = urljoin(self.base_url, base_path_for_page)

            page_number = 1
            last_page_content_hash = ""

            while not cancellation_token.is_set():
                current_url = response.url
                logging.info(f"Orkim: Sayfa {page_number} taranıyor ({current_url})...")
                soup = BeautifulSoup(response.text, 'lxml')
                main_content = soup.find('div', class_='main_content')
                product_items = main_content.find_all('div', class_='asinItem') if main_content else []
                current_content_hash = hashlib.md5(str(product_items).encode()).hexdigest()
                if current_content_hash == last_page_content_hash and page_number > 1:
                    logging.warning(f"Orkim: Sayfa {page_number} içeriği öncekiyle aynı, döngüden çıkılıyor.")
                    break
                last_page_content_hash = current_content_hash
                if not product_items:
                    logging.info(f"Orkim: Sayfa {page_number} üzerinde ürün bulunamadı, tarama tamamlandı.")
                    break

                for item in product_items:
                    if cancellation_token.is_set(): break
                    product_data = {}
                    product_data['source'] = "Orkim"
                    product_name_tag = item.select_one('h3 a')
                    product_data['urun_adi'] = product_name_tag.get_text(strip=True) if product_name_tag else 'N/A'
                    product_url = urljoin(self.base_url,
                                          product_name_tag['href']) if product_name_tag and product_name_tag.get(
                        'href') else None
                    product_data['product_url'] = product_url

                    kkodu_td = item.find('td', string='K.Kodu')
                    product_data['k_kodu'] = kkodu_td.find_next_sibling('td').get_text(
                        strip=True) if kkodu_td and kkodu_td.find_next_sibling('td') else 'N/A'
                    product_data['brand'] = "Orkim"

                    fiyat_td = item.find('td', string='Fiyat')
                    if fiyat_td and (fiyat_cell := fiyat_td.find_next_sibling('td')):
                        if birim_fiyat_tag := fiyat_cell.find('span', class_='birimfiyat'):
                            kdv_fiyat_tag = fiyat_cell.find('span', class_='kdvfiyat')
                            birim_fiyat = birim_fiyat_tag.get_text(strip=True)
                            kdv_fiyat = kdv_fiyat_tag.get_text(strip=True) if kdv_fiyat_tag else ''
                            product_data['price_str'] = f"{birim_fiyat} {kdv_fiyat}".strip()
                        elif "Teklif İsteyiniz" in fiyat_cell.get_text():
                            product_data['price_str'] = "Teklif İsteyiniz"
                        else:
                            product_data['price_str'] = fiyat_cell.get_text(strip=True) or "N/A"
                    else:
                        product_data['price_str'] = "N/A"

                    # --- GÜNCELLENMİŞ STOK MANTIĞI ---
                    stock_status = "Bilinmiyor"
                    stock_quantity: Any = "N/A"
                    instock_img = item.find('img', src=lambda s: s and 'instock.png' in s)
                    outstock_img = item.find('img', src=lambda s: s and 'outstock.png' in s)
                    if instock_img:
                        stock_status = "Stokta Var"
                        stock_quantity = "Var"  # Detaylı sorgu yok, sadece "Var"
                    elif outstock_img:
                        stock_status = "Stokta Yok"
                        stock_quantity = 0
                    # --- STOK MANTIĞI SONU ---

                    product_data['stock_status'] = stock_status
                    product_data['stock_quantity'] = stock_quantity

                    match_found = False
                    if search_logic == "exact":  # Esnek exact mantığı korundu
                        if (term_lower in product_data.get('urun_adi', '').lower() or
                                term_lower in product_data.get('k_kodu', '').lower()):
                            match_found = True
                    else:
                        match_found = True

                    if match_found:
                        all_scraped_data.append(product_data)

                next_page_link = soup.find('a', class_='sonrakiSayfa')
                if not next_page_link:
                    next_page_link = soup.find('a', string='»', href=True)
                    if next_page_link and 'disabled' in next_page_link.get('class', []):
                        next_page_link = None

                if next_page_link and next_page_link.get('href'):
                    next_page_url = urljoin(current_url, next_page_link['href'])
                    logging.info(f"Orkim: Sonraki sayfaya geçiliyor: {next_page_url}")
                    page_number += 1
                    self.session.headers.update({
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                        "Content-Type": None,
                        "X-Requested-With": None,
                        "Referer": current_url
                    })
                    response = self.session.get(next_page_url, timeout=20)
                    response.raise_for_status()
                else:
                    logging.info("Orkim: Sonraki sayfa linki bulunamadı, tarama tamamlandı.")
                    break

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                logging.warning(f"Orkim: '{search_term}' araması 404 hatası verdi (Ürün bulunamadı veya sayfa yok).")
            else:
                logging.error(f"Orkim: HTTP hatası: {e}", exc_info=True)
        except Exception as e:
            logging.error(f"Orkim ürün arama/çekme sırasında hata: {e}", exc_info=True)

        logging.info(f"Orkim: '{search_term}' araması tamamlandı, {len(all_scraped_data)} ürün bulundu.")
        return all_scraped_data

    # Bu fonksiyon artık sadece doğrudan ürün sayfası ayrıştırmasında veya
    # gelecekte eklenebilecek manuel stok sorgulama için kullanılabilir.
    # search_products içinden çağrılmıyor.
    def _get_stock_from_page(self, product_url: str) -> int:
        # ... (Bu fonksiyonun içeriği aynı kaldı, sadece çağrılma yeri değişti) ...
        try:
            # 1. Ürün sayfasına git
            self.session.headers.update({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Content-Type": None,
                "X-Requested-With": None,
                "Referer": self.session.headers.get("Referer")  # Keep previous referer
            })
            detail_response = self.session.get(product_url, timeout=20)
            detail_response.raise_for_status()
            soup = BeautifulSoup(detail_response.text, 'lxml')

            # 2. Sepete ekleme formunu bul ve bilgilerini al
            form = soup.find('form', {'id': 'SepeteEkle'})
            if not form:
                logging.warning(f"Orkim: Stok kontrolü için {product_url} sayfasında sepet formu bulunamadı.")
                return 0  # Return 0 instead of "N/A" for consistency

            action_url = urljoin(self.base_url, form.get('action'))
            urun_input = form.find('input', {'name': 'urun'})
            if not urun_input or not urun_input.get('value'):
                logging.warning(
                    f"Orkim: Stok kontrolü için {product_url} sayfasında 'urun' inputu bulunamadı veya değeri yok.")
                return 0
            urun_value = urun_input.get('value')

            # 3. Yüksek miktarda ürünü sepete ekle
            payload = {'miktar': '999999,0', 'urun': urun_value}
            # Update headers for POST
            self.session.headers.update({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                # Expecting HTML response
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": None,
                "Referer": product_url  # Referer is the product page
            })
            cart_response = self.session.post(action_url, data=payload, allow_redirects=True, timeout=25)
            cart_response.raise_for_status()
            cart_soup = BeautifulSoup(cart_response.text, 'lxml')
            cart_page_url = cart_response.url  # URL after potential redirect

            # 4. Sepet sayfasından stok miktarını oku
            stock_quantity = 0
            # More robust selector for quantity input, assuming it's within a form related to the cart item
            qty_input = cart_soup.select_one(f'input[name*="SepetMiktar"][value]')  # More specific selector
            if qty_input:
                try:
                    stock_str = qty_input.get('value', '0').replace(',', '.')
                    stock_quantity = int(float(stock_str))
                    logging.info(f"Orkim: Stok miktarı bulundu ({product_url}): {stock_quantity}")
                except (ValueError, TypeError):
                    logging.warning(f"Orkim: Stok miktarı '{qty_input.get('value')}' parse edilemedi ({product_url}).")
            else:
                # Check if the product was added at all - maybe an error message?
                if "Sepetinizde ürün bulunmamaktadır" in cart_response.text:
                    logging.warning(f"Orkim: Sepet boş, ürün eklenemedi (muhtemelen stok yok) ({product_url}).")
                    stock_quantity = 0
                else:
                    logging.warning(
                        f"Orkim: Sepet sayfasında miktar input'u bulunamadı ({product_url}). Sepet içeriği: {cart_soup.prettify()[:1000]}")

            # 5. Ürünü sepetten temizle (using the correct item ID if possible)
            item_id_input = cart_soup.select_one(f'input[name*="UrunNo"][value]')  # Try to find item ID
            remove_link_tag = None
            if item_id_input:
                item_id = item_id_input.get('value')
                remove_link_tag = cart_soup.find('a', {'href': lambda h: h and f'sepet-sil/{item_id}' in h})

            if remove_link_tag and remove_link_tag.get('href'):
                remove_url = urljoin(self.base_url, remove_link_tag['href'])
                # Update headers for GET request to remove item
                self.session.headers.update({
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                    "Content-Type": None,
                    "X-Requested-With": None,
                    "Referer": cart_page_url  # Referer is the cart page
                })
                remove_response = self.session.get(remove_url, timeout=20)
                if remove_response.ok:
                    logging.info(f"Orkim: Stok kontrolü sonrası ürün sepetten temizlendi ({product_url}).")
                else:
                    logging.warning(
                        f"Orkim: Sepet temizleme isteği başarısız oldu ({product_url}, Status: {remove_response.status_code}).")
            else:
                logging.warning(f"Orkim: Sepet temizleme linki bulunamadı ({product_url}).")

            return stock_quantity

        except requests.exceptions.RequestException as e:
            logging.error(f"Orkim stok miktarı alınırken ağ hatası ({product_url}): {e}")
        except Exception as e:
            logging.error(f"Orkim stok miktarı alınırken genel hata ({product_url}): {e}",
                          exc_info=False)  # Reduce noise

        return 0  # Return 0 on error

    def close_driver(self):
        """Oturumu kapatır ve arka plan thread'ini durdurur."""
        logging.info("Orkim kapatılıyor...")
        self.session_manager_stop_event.set()  # Arka plan thread'ine durma sinyali gönder
        if self.session:
            self.session.close()
            logging.info("Orkim oturumu kapatıldı.")

