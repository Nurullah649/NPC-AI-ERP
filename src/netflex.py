import sys
import time
import json
import logging
import threading
from typing import Dict, Any, List

import requests
from requests.adapters import HTTPAdapter
import os


class NetflexAPI:
    def __init__(self, username: str, password: str, max_workers: int = 10):
        """
        NetflexAPI sınıfı, başlatılırken kullanıcı adı ve şifre alır.
        """
        self.credentials = {"adi": username, "sifre": password}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()

    # --- YENİ: Ayarlar değiştiğinde kimlik bilgilerini güncellemek için fonksiyon ---
    def update_credentials(self, username: str, password: str):
        """Kullanıcı adı ve şifreyi günceller ve token'ı sıfırlar."""
        with self.token_lock:
            logging.info("Netflex kimlik bilgileri güncelleniyor.")
            self.credentials = {"adi": username, "sifre": password}
            self.token = None # Token'ı geçersiz kıl, bir sonraki istekte yenisi alınsın
            self.token_last_updated = 0

    def get_token(self) -> str or None:
        """
        API için geçerli bir token alır. Token eskiyse yenisini talep eder.
        """
        with self.token_lock:
            if not self.credentials.get("adi") or not self.credentials.get("sifre"):
                logging.error("Netflex HATA: Token alınamaz, kullanıcı adı veya şifre eksik.")
                return None

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
        Verilen arama terimi için Netflex'te ürün arar.
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
            response = self.session.get(search_url, headers=headers, timeout=20)
            if cancel_event.is_set(): return []
            response.raise_for_status()
            products = response.json()

            if not isinstance(products, list):
                logging.warning(f"Netflex: Beklenen ürün listesi gelmedi. Gelen yanıt: {products}")
                return []

            found_products = []
            for product in products:
                if cancel_event.is_set():
                    logging.info("Netflex araması ürün işlenirken iptal edildi.")
                    break

                price_value = product.get('urn_Fiyat')
                currency = product.get('urn_FiyatDovizi', '')
                price_numeric = None
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
            return found_products
        except requests.exceptions.RequestException as e:
            if not cancel_event.is_set():
                logging.error(f"Netflex Arama HATA ('{search_term}'): Ağ hatası - {e}")
        except json.JSONDecodeError as e:
            if not cancel_event.is_set():
                logging.error(f"Netflex Arama HATA ('{search_term}'): Yanıt JSON olarak ayrıştırılamadı - {e}")
                response_text = response.text if 'response' in locals() else 'Yanıt alınamadı'
                logging.error(f"Hatalı yanıt içeriği: {response_text[:500]}...")
        return []
