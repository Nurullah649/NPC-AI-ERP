import sys
import time
import json
import logging
import threading
from typing import Dict, Any, List
from queue import Queue, Empty

import requests
from requests.adapters import HTTPAdapter
import os


def make_cancellable_request(session, url, headers, cancel_event: threading.Event):
    """
    Bir `requests` GET isteğini kendi thread'inde çalıştırarak iptal edilebilir hale getirir.
    Ana thread'i bloklamaz ve periyodik olarak iptal sinyalini kontrol eder.

    Args:
        session: Kullanılacak requests.Session objesi.
        url: İstek atılacak URL.
        headers: İstek için kullanılacak başlıklar.
        cancel_event: İptal durumunu kontrol etmek için threading.Event.

    Returns:
        İstek başarılı olursa response objesi, iptal edilirse veya hata olursa None.
    """
    result_queue = Queue()

    def request_worker():
        """Ağ isteğini yapan ve sonucu kuyruğa koyan işçi fonksiyonu."""
        try:
            # Gerçek ağ isteği burada yapılır. Timeout hala bir güvenlik ağı olarak kalabilir.
            response = session.get(url, headers=headers, timeout=20)
            result_queue.put(response)
        except Exception as e:
            result_queue.put(e)

    # İşçi thread'ini başlat
    worker_thread = threading.Thread(target=request_worker)
    worker_thread.daemon = True
    worker_thread.start()

    # İşçi thread'i çalışırken, sonucu periyodik olarak kontrol et
    while worker_thread.is_alive():
        # Dışarıdan bir iptal sinyali gelip gelmediğini kontrol et
        if cancel_event.is_set():
            logging.info(f"Ağ isteği ({url[:50]}...) dış sinyal ile iptal edildi.")
            return None

        try:
            # Kısa bir süre sonucu beklemeye çalış. Bu, döngünün sürekli CPU kullanmasını engeller.
            # Ve ana thread'i uzun süre bloklamaz.
            result = result_queue.get(timeout=0.1)

            # Sonuç bir istisna ise, onu logla ve None dön
            if isinstance(result, Exception):
                if not cancel_event.is_set():
                    if isinstance(result, requests.exceptions.Timeout):
                        logging.warning(f"Netflex ağ isteği zaman aşımına uğradı.")
                    else:
                        logging.error(f"Netflex ağ isteğinde hata: {result}")
                return None

            # Başarılı sonuç geldiyse, response'u dön
            return result
        except Empty:
            # Kuyruk boşsa (işçi hala çalışıyor), döngüye devam et
            continue

    return None


class NetflexAPI:
    def __init__(self, username: str, password: str, max_workers: int = 10):
        """
        NetflexAPI sınıfı, başlatılırken kullanıcı adı ve şifre alır.
        .env dosyasını okuma sorumluluğu bu sınıftan kaldırılmıştır.
        """
        if not username or not password:
            logging.critical("Netflex HATA: Başlatma sırasında KULLANICI adı veya SIFRE sağlanmadı!")
            raise ValueError("NetflexAPI için KULLANICI adı ve SIFRE gereklidir.")

        self.credentials = {"adi": username, "sifre": password}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()

    def get_token(self) -> str or None:
        """
        API için geçerli bir token alır. Token eskiyse yenisini talep eder.
        Thread-safe (aynı anda birden fazla iş parçacığı tarafından güvenle çağrılabilir).
        """
        with self.token_lock:
            if self.token and (time.time() - self.token_last_updated < 3540):
                return self.token

            logging.info("Netflex: Yeni token alınıyor...")
            login_url = "https://netflex-api.interlab.com.tr/Users/authenticate/"
            headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            try:
                response = self.session.post(login_url, headers=headers, json=self.credentials, timeout=20)
                response.raise_for_status()
                token_data = response.json()
                if token_data and 'accessToken' in token_data:
                    self.token = token_data['accessToken']
                    self.token_last_updated = time.time()
                    logging.info("Netflex: Giriş başarılı, yeni token alındı.")
                    return self.token
            except requests.exceptions.RequestException as e:
                logging.error(f"Netflex HATA: Giriş sırasında bir ağ hatası oluştu: {e}")
                logging.error(f"Kullanılan bilgiler: Kullanıcı Adı='{self.credentials.get('adi')}'")
            return None

    def search_products(self, search_term: str, cancel_event: threading.Event) -> List[Dict[str, Any]]:
        """
        Verilen arama terimi için Netflex'te ürün arar. İstek, dışarıdan gelen sinyallerle iptal edilebilir.
        """
        if cancel_event.is_set():
            return []

        token = self.get_token()
        if not token:
            logging.error("Netflex Arama HATA: Token alınamadığı için arama yapılamıyor.")
            return []

        timestamp = int(time.time() * 1000)
        search_url = f"https://netflex-api.interlab.com.tr/common/urun_sorgula?filter={search_term}&userId=285&nOfItems=250&_={timestamp}"
        headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0'}

        try:
            # Artık bloklayıcı olmayan, iptal edilebilir isteği kullan
            response = make_cancellable_request(self.session, search_url, headers, cancel_event)

            # İstek iptal edildiyse veya başarısız olduysa, response None olacaktır
            if response is None:
                if not cancel_event.is_set():
                    logging.error(f"Netflex Arama ('{search_term}') isteği başarısız oldu veya zaman aşımına uğradı.")
                return []

            response.raise_for_status()
            if cancel_event.is_set(): return []

            products = response.json()
            found_products = []
            if not isinstance(products, list):
                logging.warning(f"Netflex: Beklenen ürün listesi gelmedi. Gelen yanıt: {products}")
                return []

            for product in products:
                if cancel_event.is_set():
                    logging.info("Netflex araması ürün işlenirken iptal edildi.")
                    break

                price_value = product.get('urn_Fiyat')
                currency = product.get('urn_FiyatDovizi', '')
                price_numeric = float('inf')
                price_str = "Fiyat Bilgisi Yok"

                if isinstance(price_value, (int, float)) and price_value > 0:
                    price_numeric = float(price_value)
                    price_str = f"{price_value} {currency}".strip()

                stock_value = product.get('urn_Stok')
                stock_info = "N/A"
                if isinstance(stock_value, (int, float)):
                    stock_info = int(stock_value)

                found_products.append({
                    "source": "Netflex",
                    "product_name": product.get('urn_Adi'),
                    "product_code": product.get('urn_Kodu'),
                    "price_numeric": price_numeric,
                    "price_str": price_str,
                    "stock": stock_info
                })

            if cancel_event.is_set():
                return []

            return found_products

        except requests.exceptions.RequestException as e:
            if not cancel_event.is_set():
                logging.error(f"Netflex Arama HATA ('{search_term}'): Ağ hatası - {e}")
        except json.JSONDecodeError as e:
            if not cancel_event.is_set():
                logging.error(f"Netflex Arama HATA ('{search_term}'): Yanıt JSON olarak ayrıştırılamadı - {e}")
                response_text = response.text if 'response' in locals() and hasattr(response,
                                                                                    'text') else 'Yanıt alınamadı'
                logging.error(f"Hatalı yanıt içeriği: {response_text[:500]}...")

        return []

