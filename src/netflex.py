import sys
import time
import json
import logging
import threading
from typing import Dict, Any, List
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from dotenv import load_dotenv
import os

# --- .env Dosya Yolu Düzeltmesi ---
# Bu kodun 'src' gibi bir alt dizinde olduğunu varsayarak,
# proje kök dizinini bulmak için bir üst dizine çıkıyoruz.

# Bu dosyanın bulunduğu dizini alır (örn: .../proje_koku/src)
kod_dizini = Path(__file__).resolve().parent
# Bir üst dizine çıkarak proje kökünü bulur (örn: .../proje_koku)
proje_koku = kod_dizini.parent
# Proje kökünden itibaren doğru .env yolu oluşturulur (.../proje_koku/config/.env)
env_yolu = proje_koku / "config" / ".env"

# Belirtilen yoldaki .env dosyasını yükle
load_dotenv(dotenv_path=env_yolu)


# ------------------------------------


class NetflexAPI:
    def __init__(self, max_workers=10):
        """
        NetflexAPI sınıfı başlatıldığında ortam değişkenlerini okur
        ve oturum (session) ayarlarını yapar.
        """
        # Ortam değişkenlerini class başlatılırken okumak daha güvenilirdir.
        # Bu, 'None' dönme sorununu engeller.
        adi = os.getenv("KULLANICI")
        sifre = os.getenv("SIFRE")

        # Eğer kullanıcı adı veya şifre bulunamazsa, kritik bir log mesajı bas.
        if not adi or not sifre:
            logging.critical("Netflex HATA: .env dosyasından KULLANICI veya SIFRE okunamadı!")
            logging.critical(f"Aranan .env dosya yolu: {env_yolu}")
            # Bu durumda programın durması daha iyi olabilir, örneğin:
            # raise ValueError(".env dosyasında KULLANICI ve SIFRE değişkenleri ayarlanmalı.")

        self.credentials = {"adi": adi, "sifre": sifre}
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        self.session.mount('https://', adapter)
        self.token = None
        self.token_last_updated = 0
        self.token_lock = threading.Lock()

    def get_token(self):
        """
        API için geçerli bir token alır. Token eskiyse yenisini talep eder.
        Thread-safe (aynı anda birden fazla iş parçacığı tarafından güvenle çağrılabilir).
        """
        with self.token_lock:
            # Token varsa ve 59 dakikadan (3540 saniye) daha yeniyse mevcut token'ı kullan
            if self.token and (time.time() - self.token_last_updated < 3540):
                return self.token

            logging.info("Netflex: Yeni token alınıyor...")
            login_url = "https://netflex-api.interlab.com.tr/Users/authenticate/"
            headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
            try:
                response = self.session.post(login_url, headers=headers, json=self.credentials, timeout=60)
                response.raise_for_status()  # HTTP 4xx veya 5xx hatalarında exception fırlatır
                token_data = response.json()
                if token_data and 'accessToken' in token_data:
                    self.token = token_data['accessToken']
                    self.token_last_updated = time.time()
                    logging.info("Netflex: Giriş başarılı, yeni token alındı.")
                    return self.token
            except requests.exceptions.RequestException as e:
                # Hata mesajına daha fazla detay ekleyerek sorunu anlamayı kolaylaştırıyoruz.
                logging.error(f"Netflex HATA: Giriş sırasında bir ağ hatası oluştu: {e}")
                logging.error(f"Kullanılan bilgiler: Kullanıcı Adı='{self.credentials.get('adi')}'")
            return None

    def search_products(self, search_term: str) -> List[Dict[str, Any]]:
        """
        Verilen arama terimi için Netflex'te ürün arar.
        """
        token = self.get_token()
        if not token:
            logging.error("Netflex Arama HATA: Token alınamadığı için arama yapılamıyor.")
            return []

        logging.info(f"Netflex: '{search_term}' için ürün aranıyor...")
        timestamp = int(time.time() * 1000)
        search_url = f"https://netflex-api.interlab.com.tr/common/urun_sorgula?filter={search_term}&userId=285&nOfItems=250&_={timestamp}"
        headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0'}

        try:
            response = self.session.get(search_url, headers=headers, timeout=60)
            response.raise_for_status()
            products = response.json()

            found_products = []
            if not isinstance(products, list):
                logging.warning(f"Netflex: Beklenen ürün listesi gelmedi. Gelen yanıt: {products}")
                return []

            for product in products:
                price_value = product.get('urn_Fiyat')
                currency = product.get('urn_FiyatDovizi', '')
                price_numeric = float('inf')  # Sayısal sıralama için sonsuz bir değer
                price_str = "Fiyat Bilgisi Yok"

                # Fiyatın geçerli bir sayı olup olmadığını kontrol et
                if isinstance(price_value, (int, float)) and price_value > 0:
                    price_numeric = float(price_value)
                    price_str = f"{price_value} {currency}".strip()

                found_products.append({
                    "source": "Netflex",
                    "product_name": product.get('urn_Adi'),
                    "product_code": product.get('urn_Kodu'),
                    "price_numeric": price_numeric,
                    "price_str": price_str
                })
            return found_products

        except requests.exceptions.RequestException as e:
            logging.error(f"Netflex Arama HATA ('{search_term}'): Ağ hatası - {e}")
        except json.JSONDecodeError as e:
            logging.error(f"Netflex Arama HATA ('{search_term}'): Yanıt JSON olarak ayrıştırılamadı - {e}")
            logging.error(f"Hatalı yanıt içeriği: {response.text}")

        return []