import sys
import time
import json
import atexit
import logging
import re
import threading
from typing import Dict, Any, List
import requests
from requests.adapters import HTTPAdapter
import os
import os
from dotenv import load_dotenv
from pathlib import Path  # Dosya yollarını yönetmek için modern bir kütüphane

# Projenin ana dizinini bul
# Path(__file__) -> Bu dosyanın (main.py) yolunu verir
# .resolve() -> Tam (mutlak) yolu verir
# .parent -> Bir üst dizine çıkar
proje_dizini = Path(__file__).resolve().parent

# .env dosyasının tam yolunu oluştur
env_yolu = proje_dizini / "config" / ".env"
load_dotenv(dotenv_path=env_yolu)
adi = os.getenv("KULLANICI")
sifre = os.getenv("DB_HOST")


class NetflexAPI:
    def __init__(self, max_workers=10):
        self.credentials = {"adi":adi, "sifre": sifre}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()

    def get_token(self):
        with self.token_lock:
            if self.token and (time.time() - self.token_last_updated < 3540): return self.token
            logging.info("Netflex: Yeni token alınıyor...")
            login_url = "https://netflex-api.interlab.com.tr/Users/authenticate/"
            headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            try:
                response = self.session.post(login_url, headers=headers, json=self.credentials, timeout=60)
                response.raise_for_status()
                token_data = response.json()
                if token_data and 'accessToken' in token_data:
                    self.token = token_data['accessToken']
                    self.token_last_updated = time.time()
                    logging.info("Netflex: Giriş başarılı, yeni token alındı.")
                    return self.token
            except requests.exceptions.RequestException as e:
                logging.error(f"Netflex HATA: Giriş sırasında bir ağ hatası oluştu: {e}")
            return None

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        token = self.get_token()
        if not token: return []
        logging.info(f"Netflex: '{search_term}' için ürün aranıyor...")
        timestamp = int(time.time() * 1000)
        search_url = f"https://netflex-api.interlab.com.tr/common/urun_sorgula?filter={search_term}&userId=285&nOfItems=250&_={timestamp}"
        headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0'}
        try:
            response = self.session.get(search_url, headers=headers, timeout=60)
            response.raise_for_status()
            products = response.json()
            found_products = []
            if isinstance(products, list):
                for product in products:
                    price_value = product.get('urn_Fiyat')
                    currency = product.get('urn_FiyatDovizi', '')
                    price_numeric = float('inf')
                    price_str = "Fiyat Bilgisi Yok"
                    if isinstance(price_value, (int, float)) and price_value > 0:
                        price_numeric = float(price_value)
                        price_str = f"{price_value} {currency}".strip()
                    found_products.append({
                        "source": "Netflex", "product_name": product.get('urn_Adi'),
                        "product_code": product.get('urn_Kodu'), "price_numeric": price_numeric,
                        "price_str": price_str
                    })
            return found_products
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logging.error(f"Netflex Arama HATA ('{search_term}'): {e}")
        return []