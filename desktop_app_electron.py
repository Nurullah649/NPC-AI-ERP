# Gerekli Kütüphaneler: selenium, requests, openpyxl, python-dotenv, thefuzz, python-docx, googletrans==3.0.0, langdetect
import sys
import os
import time
import json
# 'atexit' kaldırıldı, çünkü artık güvenilir bir yöntem olarak kullanılmıyor.
import logging
import re
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from typing import Dict, Any, List, Generator
from pathlib import Path
import openpyxl
import docx  # Toplu arama için docx desteği
import csv  # Toplu arama için csv desteği
from dotenv import load_dotenv
from thefuzz import fuzz
import io
import queue

# Çeviri için yeni eklenen kütüphaneler
from googletrans import Translator
from langdetect import detect, LangDetectException

# Optimize edilmiş modülleri import et
# 'src' klasör yapınız olduğunu varsayarak. Eğer yoksa, 'from src import ...' yerine
# 'import sigma, netflex, tci' kullanın.
from src import sigma, netflex, tci, currency_converter

# --- BAŞLANGIÇTA KODLAMAYI AYARLA ---
if sys.platform == "win32":
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# --- PAKETLEME İÇİN DOSYA YOLU FONKSİYONU ---
def get_resource_path(relative_path: str) -> str:
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# --- Uygulama Veri Yolu Tanımı ---
def get_app_base_path() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(os.path.dirname(sys.executable))
    else:
        return Path(os.path.abspath("."))


APP_BASE_PATH = get_app_base_path()
LOGS_AND_SETTINGS_DIR = APP_BASE_PATH / "TalesJob_Veri"
SETTINGS_FILE_PATH = LOGS_AND_SETTINGS_DIR / "settings.json"


# --- Ayarları Yükleme Fonksiyonu ---
def load_settings() -> Dict[str, Any]:
    """Ayarları JSON dosyasından yükler. Dosya yoksa veya bozuksa varsayılanları döndürür."""
    default_settings = {
        "netflex_username": "", "netflex_password": "", "tci_coefficient": 1.4
    }
    if not SETTINGS_FILE_PATH.exists():
        return default_settings
    try:
        with open(SETTINGS_FILE_PATH, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            for key, value in default_settings.items():
                settings.setdefault(key, value)
            return settings
    except (json.JSONDecodeError, IOError) as e:
        logging.error(f"Ayarlar dosyası okunurken hata: {e}. Varsayılanlar kullanılıyor.")
        return default_settings


# --- Ayarları Kaydetme Fonksiyonu ---
def save_settings(new_settings: Dict[str, Any]):
    """Yeni ayarları JSON dosyasına kaydeder."""
    try:
        if 'tci_coefficient' in new_settings:
            if new_settings.get('tci_coefficient'):
                new_settings['tci_coefficient'] = float(str(new_settings['tci_coefficient']).replace(',', '.'))

        LOGS_AND_SETTINGS_DIR.mkdir(exist_ok=True)
        with open(SETTINGS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, indent=4)
        logging.info(f"Ayarlar başarıyla kaydedildi: {SETTINGS_FILE_PATH}")
    except (IOError, TypeError, ValueError) as e:
        logging.error(f"Ayarlar dosyasına yazılırken hata: {e}")


# --- Loglama Yapılandırması ---
def setup_logging():
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - (%(threadName)s) - %(message)s')
    log_dir = LOGS_AND_SETTINGS_DIR
    log_dir.mkdir(exist_ok=True)
    dev_log_file = log_dir / "developer.log"
    dev_handler = logging.FileHandler(dev_log_file, encoding='utf-8')
    dev_handler.setFormatter(formatter)
    dev_handler.setLevel(logging.INFO)
    admin_log_file = log_dir / "admin_activity.log"
    admin_handler = logging.FileHandler(admin_log_file, encoding='utf-8')
    admin_formatter = logging.Formatter('%(asctime)s - %(message)s')
    admin_handler.setFormatter(admin_formatter)
    admin_logger = logging.getLogger("admin")
    admin_logger.addHandler(admin_handler)
    admin_logger.setLevel(logging.INFO)
    admin_logger.propagate = False
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    logging.basicConfig(level=logging.INFO, handlers=[dev_handler, console_handler])
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("selenium").setLevel(logging.WARNING)
    logging.getLogger("googletrans").setLevel(logging.WARNING)
    return admin_logger


admin_logger = setup_logging()


# --- JSON Mesajlaşma ---
def send_to_frontend(message_type: str, data: Any, context: Dict = None):
    try:
        message_obj = {"type": message_type, "data": data}
        if context:
            message_obj["context"] = context

        message = json.dumps(message_obj)
        print(message, flush=True)
    except (TypeError, OSError, BrokenPipeError) as e:
        logging.error(f"Frontend'e mesaj gönderilemedi: {e}")


# --- Excel'e Aktarma ---
def export_to_excel(data: Dict[str, Any]):
    customer_name = data.get("customerName", "Bilinmeyen_Musteri")
    products = data.get("products", [])
    safe_customer_name = re.sub(r'[\\/*?:"<>|]', "", customer_name)
    desktop_path = Path.home() / "Desktop"
    desktop_path.mkdir(exist_ok=True)
    filename = f"{safe_customer_name}_urun_listesi_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = desktop_path / filename
    try:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Ürün Listesi"
        headers = ["Kaynak", "Ürün Adı", "Ürün Kodu", "Fiyat", "Stok Durumu"]
        sheet.append(headers)
        for cell in sheet["1:1"]: cell.font = openpyxl.styles.Font(bold=True)
        for product in products:
            row = [
                product.get("source", "N/A"), product.get("product_name", "N/A"),
                product.get("product_code", "N/A"), product.get("price_str", "N/A"),
                product.get("cheapest_netflex_stock", "N/A")
            ]
            sheet.append(row)
        for col in sheet.columns:
            max_length = max(len(str(cell.value)) for cell in col if cell.value)
            sheet.column_dimensions[col[0].column_letter].width = max_length + 2
        workbook.save(filepath)
        logging.info(f"Excel dosyası oluşturuldu: {filepath}")

        admin_logger.info(f"Müşteri Ataması ve Rapor: Müşteri='{customer_name}', Atanan Ürün Sayısı={len(products)}")
        for product in products:
            p_name = re.sub(re.compile('<.*?>'), '', product.get("product_name", "N/A"))
            p_code = product.get("product_code", "N/A")
            p_price = product.get("price_str", "N/A")
            admin_logger.info(f"  -> Atanan Ürün: Ad='{p_name}', Kod='{p_code}', Fiyat='{p_price}'")

        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel dosyası oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# --- Toplu Arama için Dosya Okuma ve Çeviri Fonksiyonları ---

translator = Translator()


def _translate_if_turkish(term: str) -> str:
    """Bir terimin Türkçe olup olmadığını algılar ve öyleyse İngilizce'ye çevirir."""
    if not term:
        return term
    try:
        lang = detect(term)
        if lang == 'tr':
            translated = translator.translate(term, src='tr', dest='en')
            if translated and translated.text:
                logging.info(f"Otomatik Çeviri: '{term}' (TR) -> '{translated.text}' (EN)")
                return translated.text
    except LangDetectException:
        pass
    except Exception as e:
        logging.error(f"'{term}' terimi çevrilirken bir hata oluştu: {e}", exc_info=False)
    return term


def _clean_term(term):
    """Arama terimini temizler (parantezleri kaldırır)."""
    if not isinstance(term, str):
        return ""
    cleaned_term = re.sub(r'\s*\([^)]*\)', '', term)
    return cleaned_term.strip()


def _extract_terms_from_xlsx(file_path):
    terms = []
    try:
        workbook = openpyxl.load_workbook(file_path, data_only=True)
        sheet = workbook.active
        for row in sheet.iter_rows(min_row=1, values_only=True):
            for i in range(min(2, len(row))):
                cell_value = row[i]
                cleaned_value = _clean_term(cell_value)
                translated_value = _translate_if_turkish(cleaned_value)
                if translated_value and len(translated_value) > 2 and translated_value not in terms:
                    terms.append(translated_value)
    except Exception as e:
        logging.error(f"Excel dosyası okunurken hata: {e}")
    return terms


def _extract_terms_from_csv(file_path):
    terms = []
    try:
        with open(file_path, mode='r', encoding='utf-8', errors='ignore') as csvfile:
            reader = csv.reader(csvfile)
            for row in reader:
                for i in range(min(2, len(row))):
                    cell_value = row[i]
                    cleaned_value = _clean_term(cell_value)
                    translated_value = _translate_if_turkish(cleaned_value)
                    if translated_value and len(translated_value) > 2 and translated_value not in terms:
                        terms.append(translated_value)
    except Exception as e:
        logging.error(f"CSV dosyası okunurken hata: {e}")
    return terms


def _extract_terms_from_docx(file_path):
    terms = []
    try:
        doc = docx.Document(file_path)
        for table in doc.tables:
            for row in table.rows:
                for i in range(min(2, len(row.cells))):
                    cell_text = row.cells[i].text
                    cleaned_text = _clean_term(cell_text)
                    translated_text = _translate_if_turkish(cleaned_text)
                    if translated_text and len(translated_text) > 2 and translated_text not in terms:
                        terms.append(translated_text)
        if not terms:
            for para in doc.paragraphs:
                cleaned_text = _clean_term(para.text)
                translated_text = _translate_if_turkish(cleaned_text)
                if translated_text and len(translated_text) > 2 and translated_text not in terms:
                    terms.append(translated_text)
    except Exception as e:
        logging.error(f"Word dosyası okunurken hata: {e}")
    return terms


def get_search_terms_from_file(file_path):
    if not os.path.exists(file_path):
        logging.error(f"Toplu arama dosyası bulunamadı: {file_path}")
        return []
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext == '.xlsx':
        return _extract_terms_from_xlsx(file_path)
    elif file_ext == '.csv':
        return _extract_terms_from_csv(file_path)
    elif file_ext == '.docx':
        return _extract_terms_from_docx(file_path)
    else:
        logging.error(f"Desteklenmeyen dosya formatı: {file_ext}")
        return []


# --- Karşılaştırma Motoru ---
class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, tci_api: tci.TciScraper,
                 initial_settings: Dict[str, Any], max_workers=10):
        self.sigma_api = sigma_api
        self.netflex_api = netflex_api
        self.tci_api = tci_api
        self.currency_converter = currency_converter.CurrencyConverter()
        self.max_workers = max_workers
        self.search_cancelled = threading.Event()
        self.batch_search_cancelled = threading.Event()
        self.settings = initial_settings

    def initialize_drivers(self):
        logging.info("Ağır servisler (Selenium sürücüleri) başlatılıyor...")
        start_time = time.monotonic()
        try:
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Heavy-Driver-Starter") as executor:
                future_sigma = executor.submit(self.sigma_api.start_drivers)
                future_tci = executor.submit(self.tci_api.reinit_driver)
                future_sigma.result()
                future_tci.result()
            elapsed = time.monotonic() - start_time
            logging.info(f"Tüm Selenium sürücüleri {elapsed:.2f} saniyede başarıyla başlatıldı.")
        except Exception as e:
            logging.critical(f"Selenium sürücüleri başlatılırken kritik hata: {e}", exc_info=True)
            raise e

    def _clean_html(self, raw_html: str) -> str:
        return re.sub(re.compile('<.*?>'), '', raw_html) if raw_html else ""

    def _process_single_sigma_product_and_send(self, raw_sigma_product: Dict[str, Any], context: Dict):
        """
        Tek bir Sigma ürününü alır, varyasyonlarını ve Netflex verilerini çeker,
        birleştirir ve sonucu arayüze gönderir.
        """
        try:
            if self.search_cancelled.is_set(): return False

            # Adım 1: Ürünün varyasyonlarını (fiyat/stok) çek
            s_num = raw_sigma_product.get('product_number')
            s_brand = raw_sigma_product.get('brand')
            s_key = raw_sigma_product.get('product_key')

            sigma_variations = self.sigma_api.get_all_product_prices(s_num, s_brand, s_key, self.search_cancelled)
            if self.search_cancelled.is_set(): return False

            # Adım 2: Netflex'te aranacak tüm kodları topla
            netflex_search_terms = {s_num}
            for country_vars in sigma_variations.values():
                for var in country_vars:
                    if mat_num := var.get('material_number'):
                        netflex_search_terms.add(mat_num)

            # Adım 3: Netflex aramasını yap
            netflex_cache = {}
            # Birden çok terimi tek seferde aramak daha verimli olabilir, ancak anlık geri bildirim için tek tek arama yapıyoruz.
            for term in netflex_search_terms:
                if self.search_cancelled.is_set(): return False
                if results := self.netflex_api.search_products(term, self.search_cancelled):
                    for r in results:
                        if r_code := r.get('product_code'):
                            netflex_cache[r_code] = r

            if self.search_cancelled.is_set(): return False

            # Adım 4: Tüm verileri birleştir ve son ürünü oluştur
            final_product = self._build_final_sigma_product(raw_sigma_product, netflex_cache, {s_num: sigma_variations})

            if final_product:
                send_to_frontend("product_found", {"product": final_product}, context=context)
                return True
        except Exception as e:
            logging.error(f"Tekil Sigma ürünü ({raw_sigma_product.get('product_number')}) işlenirken hata: {e}",
                          exc_info=False)
        return False

    def _build_final_sigma_product(self, sigma_product: Dict[str, Any], netflex_cache: Dict[str, Any],
                                   all_sigma_variations: Dict[str, Any]) -> Dict[str, Any] or None:
        """
        Ham Sigma ürünü, Netflex ve varyasyon verilerini alıp nihai ürün nesnesini oluşturur.
        Bu fonksiyon ağ çağrısı YAPMAZ.
        """
        s_name, s_num, s_brand, cas = (
            sigma_product.get('product_name_sigma'), sigma_product.get('product_number'),
            sigma_product.get('brand'), sigma_product.get('cas_number', 'N/A')
        )
        if not all([s_name, s_num, s_brand]): return None

        parities = self.currency_converter.get_parities()
        if "error" in parities:
            logging.error(f"Pariteler alınamadı: {parities['error']}. {s_num} için fiyat dönüşümü yapılamayacak.")

        cleaned_sigma_name = self._clean_html(s_name)
        sigma_variations = all_sigma_variations.get(s_num, {})
        all_eur_prices = []

        # HATA DÜZELTME: Sigma fiyatlarını EUR'ya çevir ve arayüz için formatla
        for country_code, variations in sigma_variations.items():
            for var in variations:
                price_eur = None
                original_price = var.get('price')
                currency = var.get('currency', '').upper()

                var['original_price_str'] = f"{original_price} {currency}" if original_price is not None else "N/A"

                if original_price is not None:
                    try:
                        if currency == 'USD' and parities.get('usd_eur'):
                            price_eur = original_price * parities['usd_eur']
                        elif currency == 'GBP' and parities.get('gbp_eur'):
                            price_eur = original_price * parities['gbp_eur']
                        elif currency == 'EUR':
                            price_eur = original_price

                        if price_eur is not None:
                            var['price_eur'] = price_eur
                            var['price_eur_str'] = f"€{price_eur:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                            all_eur_prices.append(price_eur)
                        else:
                            var['price_eur_str'] = "N/A"
                    except Exception:
                        var['price_eur_str'] = "N/A"
                else:
                    var['price_eur_str'] = "N/A"


        netflex_matches = []
        processed_codes = set()
        sigma_material_numbers = {var.get('material_number') for vars_list in sigma_variations.values() for var in
                                  vars_list if var.get('material_number')}

        for mat_num in sigma_material_numbers:
            if mat_num in netflex_cache and mat_num not in processed_codes:
                match = netflex_cache[mat_num]
                netflex_matches.append(match)
                if price := match.get('price_numeric'):
                    all_eur_prices.append(price)
                processed_codes.add(mat_num)

        # Genel en ucuz EUR fiyatını bul
        cheapest_eur_price = min(all_eur_prices) if all_eur_prices else None
        cheapest_eur_price_str = f"€{cheapest_eur_price:,.2f}".replace(",", "X").replace(".", ",").replace("X",
                                                                                                           ".") if cheapest_eur_price is not None else "N/A"

        # Orijinal en ucuz Netflex fiyatını bul (arayüzde hala kullanılıyor olabilir)
        cheapest_netflex_stock = "N/A"
        if priced_matches := [p for p in netflex_matches if p.get('price_numeric') is not None]:
            cheapest_netflex_stock = min(priced_matches, key=lambda x: x['price_numeric']).get('stock', "N/A")

        return {
            "source": "Sigma", "product_name": s_name, "product_number": s_num, "cas_number": cas,
            "brand": f"Sigma ({s_brand})", "sigma_variations": sigma_variations, "netflex_matches": netflex_matches,
            "cheapest_netflex_stock": cheapest_netflex_stock,
            "cheapest_eur_price_str": cheapest_eur_price_str
        }

    def _process_tci_product(self, tci_product: tci.Product, context: Dict = None) -> Dict[str, Any]:
        """ TCI ürünlerini işler ve sabit katsayı ile fiyat hesaplar. """
        processed_variations = []
        min_original_price = float('inf')
        cheapest_stock_summary = "N/A"

        for variation in tci_product.variations:
            original_price_str = variation.get('price', 'N/A')
            price_float = None
            try:
                price_str_cleaned = re.sub(r'[^\d,.]', '', original_price_str)
                price_standardized = ""
                last_comma, last_dot = price_str_cleaned.rfind(','), price_str_cleaned.rfind('.')
                if last_comma > last_dot:
                    price_standardized = price_str_cleaned.replace('.', '').replace(',', '.')
                elif last_dot > last_comma:
                    price_standardized = price_str_cleaned.replace(',', '')
                else:
                    price_standardized = price_str_cleaned.replace(',', '.')
                if price_standardized:
                    price_float = float(price_standardized)
            except (ValueError, TypeError):
                pass

            processed_variations.append({
                "unit": variation.get('unit'),
                "original_price": original_price_str,
                "original_price_numeric": price_float,
                "stock_info": variation.get('stock_info', [])
            })

            if price_float is not None and price_float < min_original_price:
                min_original_price = price_float
                if stock_info := variation.get('stock_info'):
                    cheapest_stock_summary = ', '.join([f"{s['country']}: {s['stock']}" for s in stock_info])

        cheapest_price_to_show = "N/A"
        if min_original_price != float('inf'):
            tci_coefficient = self.settings.get('tci_coefficient', 1.4)
            calculated_cheapest = min_original_price * tci_coefficient
            cheapest_price_to_show = f"€{calculated_cheapest:,.2f}".replace(",", "X").replace(".", ",").replace("X",".")

        return {
            "source": "TCI", "product_name": tci_product.name, "product_number": tci_product.code,
            "cas_number": tci_product.cas_number, "brand": "TCI",
            "cheapest_eur_price_str": cheapest_price_to_show,
            "cheapest_netflex_stock": cheapest_stock_summary,
            "tci_variations": processed_variations, "sigma_variations": {}, "netflex_matches": []
        }

    def search_and_compare(self, search_term: str, context: Dict = None):
        start_time = time.monotonic()
        logging.info(f"===== ANLIK ÜRÜN AKIŞI ARAMASI BAŞLATILDI: '{search_term}' =====")
        if not context:
            admin_logger.info(f"Arama Başlatıldı: Terim='{search_term}'")

        total_found = 0
        total_found_lock = threading.Lock()

        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="Source-Streamer") as executor:
            # TCI Görevi: Sayfa sayfa bulur ve her sayfadaki ürünleri anında gönderir
            def tci_stream_task():
                nonlocal total_found
                try:
                    for product_page in self.tci_api.get_products(search_term, self.search_cancelled):
                        if self.search_cancelled.is_set(): break
                        for product in product_page:
                            if self.search_cancelled.is_set(): break
                            processed_product = self._process_tci_product(product, context)
                            send_to_frontend("product_found", {"product": processed_product}, context=context)
                            with total_found_lock:
                                total_found += 1
                except Exception as e:
                    logging.error(f"TCI akışı sırasında hata: {e}", exc_info=True)

            # Sigma Görevi: Ürün ürün bulur, her birini anında zenginleştirir ve gönderir
            def sigma_stream_task():
                nonlocal total_found
                # Her bir ürünü paralel olarak işlemek için yeni bir thread havuzu
                with ThreadPoolExecutor(max_workers=self.max_workers,
                                        thread_name_prefix="Sigma-Product-Processor") as processor_executor:
                    try:
                        # İlk olarak pariteleri bir kere çek, her ürün için tekrar çekme
                        self.currency_converter.get_parities()
                        sigma_product_generator = self.sigma_api.search_products(search_term, self.search_cancelled)

                        futures = []
                        for raw_product in sigma_product_generator:
                            if self.search_cancelled.is_set(): break
                            # Her bir ham ürünü işlemek için bir görev gönder
                            future = processor_executor.submit(self._process_single_sigma_product_and_send, raw_product,
                                                               context)
                            futures.append(future)

                        # Görevlerin tamamlanmasını bekle ve başarılı olanları say
                        for future in as_completed(futures):
                            if future.result():  # Worker başarılıysa True döner
                                with total_found_lock:
                                    total_found += 1
                    except Exception as e:
                        logging.error(f"Sigma akışı sırasında hata: {e}", exc_info=True)

            future_tci = executor.submit(tci_stream_task)
            future_sigma = executor.submit(sigma_stream_task)

            future_tci.result()
            future_sigma.result()

        if not self.search_cancelled.is_set():
            elapsed_time = time.monotonic() - start_time
            logging.info(f"Arama Tamamlandı: '{search_term}', Toplam={total_found}, Süre={elapsed_time:.2f}s")
            send_to_frontend("search_complete", {"status": "complete", "total_found": total_found,
                                                 "execution_time": round(elapsed_time, 2)}, context=context)
        elif not context:
            send_to_frontend("search_complete", {"status": "cancelled"})
            logging.warning(f"Arama İptal Edildi: '{search_term}'")

    def run_batch_search(self, file_path, customer_name):
        logging.info(f"Toplu arama başlatıldı. Dosya: {file_path}, Müşteri: {customer_name}")
        self.batch_search_cancelled.clear()

        admin_logger.info(f"Toplu Arama Başlatıldı: Müşteri='{customer_name}', Dosya='{os.path.basename(file_path)}'")

        search_terms = get_search_terms_from_file(file_path)
        if not search_terms:
            send_to_frontend("batch_search_complete",
                             {"status": "error", "message": "Dosyadan okunacak ürün bulunamadı."})
            return

        total_terms = len(search_terms)
        for i, term in enumerate(search_terms):
            if self.batch_search_cancelled.is_set():
                logging.warning("Toplu arama kullanıcı tarafından iptal edildi.")
                break

            self.search_cancelled.clear()

            progress_data = {"term": term, "current": i + 1, "total": total_terms}
            send_to_frontend("batch_search_progress", progress_data)
            admin_logger.info(f"  -> Toplu Arama İlerleme ({i + 1}/{total_terms}): '{term}' aranıyor...")

            self.search_and_compare(term, context={"batch_search_term": term})

        if not self.batch_search_cancelled.is_set():
            logging.info("Tüm toplu arama terimleri tamamlandı.")
            send_to_frontend("batch_search_complete", {"status": "complete"})
            admin_logger.info(f"Toplu Arama Tamamlandı: Müşteri='{customer_name}'")
        else:
            send_to_frontend("batch_search_complete", {"status": "cancelled"})

    def force_cancel(self):
        if not self.search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. (Tekli veya Mevcut Terim)")
            self.search_cancelled.set()

    def force_cancel_batch(self):
        if not self.batch_search_cancelled.is_set():
            logging.info("Zorunlu iptal talebi alındı. (Tüm Toplu Arama)")
            self.batch_search_cancelled.set()
            self.force_cancel()


# --- Ana Fonksiyon ---
def main():
    logging.info("=" * 40 + "\n      Python Arka Plan Servisi Başlatıldı\n" + "=" * 40)
    services_initialized = threading.Event()
    sigma_api = sigma.SigmaAldrichAPI()
    tci_api = tci.TciScraper()
    currency_api = currency_converter.CurrencyConverter()
    netflex_api = None
    engine = None

    search_thread = None
    batch_search_thread = None

    def initialize_services(settings_data: Dict[str, Any]):
        nonlocal netflex_api, engine
        log_safe_settings = {k: v for k, v in settings_data.items() if 'password' not in k}
        logging.info(f"Servisler şu ayarlarla başlatılıyor: {log_safe_settings}")
        netflex_api = netflex.NetflexAPI(username=settings_data.get("netflex_username"),
                                         password=settings_data.get("netflex_password"))
        engine = ComparisonEngine(sigma_api, netflex_api, tci_api, initial_settings=settings_data)

        def full_initialization_service():
            logging.info("Tam servis başlatma süreci başladı.")
            try:
                logging.info("1. Adım: Netflex token'ı alınıyor...")
                netflex_api.get_token()
                logging.info("Netflex servisi başarıyla doğrulandı.")
                logging.info("2. Adım: Selenium sürücüleri başlatılıyor...")
                engine.initialize_drivers()
                logging.info("Tüm arka plan servisleri başarıyla başlatıldı ve HAZIR.")
                send_to_frontend("python_services_ready", True)
                services_initialized.set()
            except netflex.AuthenticationError as e:
                logging.error(f"Netflex kimlik doğrulama hatası: {e}", exc_info=False)
                send_to_frontend("authentication_error", True)
            except Exception as e:
                logging.critical(f"Servis başlatma sırasında kritik hata: {e}", exc_info=True)
                send_to_frontend("python_services_ready", False)

        threading.Thread(target=full_initialization_service, name="Full-Initializer", daemon=True).start()

    if SETTINGS_FILE_PATH.exists():
        current_settings = load_settings()
        initialize_services(current_settings)
    else:
        logging.warning("Ayarlar dosyası bulunamadı. Arayüzden ilk kurulum bekleniyor.")
        send_to_frontend("initial_setup_required", True)

    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            action, data = request.get("action"), request.get("data")
            logging.info(f"Arayüzden komut alındı: Eylem='{action}'")

            if action == "load_settings":
                send_to_frontend("settings_loaded", load_settings())
            elif action == "save_settings" and isinstance(data, dict):
                save_settings(data)
                if not services_initialized.is_set():
                    logging.info("İlk kurulum ayarları kaydedildi. Arka plan servisleri şimdi başlatılıyor.")
                    initialize_services(data)
                else:
                    engine.settings = data
                    engine.netflex_api.update_credentials(data.get("netflex_username"), data.get("netflex_password"))
                    logging.info("Çalışma zamanı ayarları güncellendi. Servisler yeniden başlatılıyor...")
                    services_initialized.clear()
                    initialize_services(data)
                    send_to_frontend("settings_saved", {"status": "success"})
            elif action == "search" and data:
                if not services_initialized.is_set():
                    send_to_frontend("search_error", "Servisler başlatılmadı.")
                    continue
                if search_thread and search_thread.is_alive():
                    engine.force_cancel()
                    search_thread.join(5.0)
                if batch_search_thread and batch_search_thread.is_alive():
                    engine.force_cancel_batch()
                    batch_search_thread.join(5.0)

                engine.search_cancelled.clear()
                search_thread = threading.Thread(target=engine.search_and_compare, args=(data,),
                                                 name="Search-Coordinator")
                search_thread.start()

            elif action == "start_batch_search" and data:
                if not services_initialized.is_set():
                    send_to_frontend("search_error", "Servisler başlatılmadı.")
                    continue
                if search_thread and search_thread.is_alive():
                    engine.force_cancel()
                    search_thread.join(5.0)
                if batch_search_thread and batch_search_thread.is_alive():
                    engine.force_cancel_batch()
                    batch_search_thread.join(5.0)

                batch_search_thread = threading.Thread(
                    target=engine.run_batch_search,
                    args=(data.get("filePath"), data.get("customerName")),
                    name="Batch-Search-Coordinator"
                )
                batch_search_thread.start()

            elif action == "cancel_search":
                if engine: engine.force_cancel()

            elif action == "cancel_current_term_search":
                if engine: engine.force_cancel()

            elif action == "cancel_batch_search":
                if engine: engine.force_cancel_batch()

            elif action == "export":
                send_to_frontend("export_result", export_to_excel(data))

            elif action == "get_parities":
                parities = currency_api.get_parities()
                send_to_frontend("parities_updated", parities)

            elif action == "shutdown":
                logging.info("Kapatma komutu alındı. Selenium sürücüleri temizleniyor...")
                if engine:
                    engine.force_cancel()
                    engine.force_cancel_batch()
                if search_thread and search_thread.is_alive(): search_thread.join(2.0)
                if batch_search_thread and batch_search_thread.is_alive(): batch_search_thread.join(2.0)

                sigma_api.stop_drivers()
                tci_api.close_driver()
                logging.info("Tüm sürücüler durduruldu. Python betiği sonlandırılıyor.")
                break

        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON formatı: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde beklenmedik hata: {e}", exc_info=True)
            send_to_frontend("error", f"Beklenmedik bir sunucu hatası: {str(e)}")
    logging.info("Python ana döngüsü sonlandı.")


if __name__ == '__main__':
    main()

