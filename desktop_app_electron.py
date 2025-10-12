# Gerekli Kütüphaneler: selenium, requests, openpyxl, python-dotenv, thefuzz, python-docx, googletrans==3.0.0, langdetect, chardet
import sys
import os
import time
import json
import logging
import re
import threading
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List
from pathlib import Path
import openpyxl
import docx
import csv
import chardet
from dotenv import load_dotenv
from thefuzz import fuzz
import io
from openpyxl.styles import Font, Alignment

from googletrans import Translator
from langdetect import detect, LangDetectException

from src import sigma, netflex, tci, currency_converter, orkim

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
CALENDAR_NOTES_FILE_PATH = LOGS_AND_SETTINGS_DIR / "calendar_notes.json"
NOTIFICATION_STATE_FILE = LOGS_AND_SETTINGS_DIR / "notification_state.json"

# Bildirim zamanlayıcı için global değişkenler
notification_thread = None
notification_running = False


# --- Ayarları Yükleme/Kaydetme Fonksiyonları ---
def load_settings() -> Dict[str, Any]:
    default_settings = {
        "netflex_username": "", "netflex_password": "", "tci_coefficient": 1.4,
        "sigma_coefficient_us": 1.0, "sigma_coefficient_de": 1.0, "sigma_coefficient_gb": 1.0,
        "orkim_username": "", "orkim_password": "", "OCR_API_KEY": ""
    }
    if not SETTINGS_FILE_PATH.exists(): return default_settings
    try:
        with open(SETTINGS_FILE_PATH, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            settings.update({k: v for k, v in default_settings.items() if k not in settings})
            return settings
    except (json.JSONDecodeError, IOError):
        return default_settings


def save_settings(new_settings: Dict[str, Any]):
    try:
        for key in ['tci_coefficient', 'sigma_coefficient_us', 'sigma_coefficient_de', 'sigma_coefficient_gb']:
            if key in new_settings and new_settings.get(key):
                new_settings[key] = float(str(new_settings[key]).replace(',', '.'))
        LOGS_AND_SETTINGS_DIR.mkdir(exist_ok=True)
        with open(SETTINGS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, indent=4)
    except (IOError, TypeError, ValueError) as e:
        logging.error(f"Ayarlar kaydedilirken hata: {e}")


# --- TAKVİM VE BİLDİRİM FONKSİYONLARI ---
def load_calendar_notes() -> list:
    if not CALENDAR_NOTES_FILE_PATH.exists(): return []
    try:
        with open(CALENDAR_NOTES_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_calendar_notes(notes: list):
    try:
        LOGS_AND_SETTINGS_DIR.mkdir(exist_ok=True)
        with open(CALENDAR_NOTES_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(notes, f, indent=4, ensure_ascii=False)
    except (IOError, TypeError) as e:
        logging.error(f"Takvim notları kaydedilirken hata: {e}")


def _mark_meeting_as_complete(note_date: str, meeting_id: str):
    try:
        notes = load_calendar_notes()
        for note in notes:
            if note.get("date") == note_date:
                for meeting in note.get("meetings", []):
                    if meeting.get("id") == meeting_id:
                        meeting["completed"] = True
                        save_calendar_notes(notes)
                        logging.info(f"Görüşme '{meeting_id}' tamamlandı olarak işaretlendi.")
                        send_to_frontend("calendar_notes_loaded", notes)
                        return
        logging.warning(f"Tamamlanacak görüşme bulunamadı: ID='{meeting_id}'")
    except Exception as e:
        logging.error(f"Görüşme tamamlanırken hata: {e}", exc_info=True)


def load_notification_state():
    if not NOTIFICATION_STATE_FILE.exists(): return {}
    try:
        with open(NOTIFICATION_STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_notification_state(state):
    try:
        LOGS_AND_SETTINGS_DIR.mkdir(exist_ok=True)
        with open(NOTIFICATION_STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=4)
    except (IOError, TypeError) as e:
        logging.error(f"Bildirim durumu kaydedilirken hata: {e}")


def _perform_notification_check():
    try:
        logging.info("Periyodik bildirim kontrolü çalıştırılıyor...")
        notes = load_calendar_notes()
        state = load_notification_state()
        sent_ids = set(state.get("sent_ids", []))
        now = datetime.now()
        today = now.date()
        current_hour = now.hour

        thirty_days_ago = today - timedelta(days=30)
        sent_ids = {nid for nid in sent_ids if len(nid.split('_')) > 1 and datetime.strptime(nid.split('_')[1],
                                                                                             '%Y-%m-%d').date() >= thirty_days_ago}

        for note in notes:
            for meeting in note.get("meetings", []):
                meeting_type = meeting.get("type", "toplantı")  # Eski veriler için varsayılan "toplantı"
                frequency = meeting.get("notificationFrequency")
                meeting_date_str = meeting.get("nextMeetingDate")

                if meeting.get("completed") or not meeting_date_str or frequency == "none":
                    continue

                try:
                    meeting_date = datetime.strptime(meeting_date_str, "%Y-%m-%d").date()
                    should_notify_today = False

                    # Yeni "Görüşme" tipi için mantık
                    if meeting_type == 'görüşme' and frequency.startswith('for_'):
                        try:
                            parts = frequency.split('_')
                            if len(parts) == 3:
                                duration_val = int(parts[1])
                                duration_unit = parts[2]
                                delta = timedelta(days=0)
                                if duration_unit == 'day' or duration_unit == 'days':
                                    delta = timedelta(days=duration_val)
                                elif duration_unit == 'week' or duration_unit == 'weeks':
                                    delta = timedelta(weeks=duration_val)

                                start_date = meeting_date
                                end_date = meeting_date + delta - timedelta(days=1)
                                if start_date <= today <= end_date:
                                    should_notify_today = True
                        except (ValueError, IndexError):
                            logging.warning(f"Geçersiz 'görüşme' sıklık formatı: {frequency}")

                    # "Toplantı" tipi (ve eski veriler) için mantık
                    else:
                        notification_start_date = None
                        if frequency == "on_day":
                            notification_start_date = meeting_date
                        elif frequency == "1_day_before":
                            notification_start_date = meeting_date - timedelta(days=1)
                        elif frequency == "1_week_before":
                            notification_start_date = meeting_date - timedelta(days=7)

                        if notification_start_date and (notification_start_date <= today <= meeting_date):
                            should_notify_today = True

                    if should_notify_today:
                        daily_frequency = meeting.get("notificationDailyFrequency", "once")
                        notification_hours = []
                        if daily_frequency == "once":
                            notification_hours = [9]
                        elif daily_frequency == "twice":
                            notification_hours = [9, 17]
                        elif daily_frequency == "thrice":
                            notification_hours = [9, 13, 17]
                        elif daily_frequency == "five_times":
                            notification_hours = [9, 11, 13, 15, 17]
                        elif daily_frequency == "ten_times":
                            notification_hours = list(range(9, 19))
                        elif daily_frequency == "hourly":
                            notification_hours = list(range(9, 18))

                        if current_hour in notification_hours:
                            notif_id = f"{meeting.get('id')}_{today.strftime('%Y-%m-%d')}_{current_hour}"
                            if notif_id not in sent_ids:
                                company_name = meeting.get('companyName', meeting.get('personName', 'Bilinmeyen'))
                                notif_title = f"{meeting_type.capitalize()} Hatırlatması: {company_name}"
                                notif_subtitle = f"Tarih: {meeting_date.strftime('%d.%m.%Y')}"

                                logging.info(
                                    f"Bildirim tetikleniyor: {company_name} - Tip: {meeting_type} - Sıklık: {daily_frequency} - Saat: {current_hour}")
                                send_to_frontend("show_notification", {
                                    "title": notif_title,
                                    "subtitle": notif_subtitle,
                                    "body": meeting.get("meetingNotes", "Not eklenmemiş."),
                                    "noteDate": note.get("date"),
                                    "meetingId": meeting.get("id")
                                })
                                sent_ids.add(notif_id)

                except (ValueError, TypeError) as e:
                    logging.warning(f"Etkinlik işlenemedi. Veri: {meeting}. Hata: {e}")

        state["sent_ids"] = list(sent_ids)
        save_notification_state(state)
    except Exception as e:
        logging.error(f"Bildirim kontrolü sırasında hata: {e}", exc_info=True)


def check_and_send_notifications():
    global notification_running
    while notification_running:
        _perform_notification_check()
        for _ in range(3600):
            if not notification_running: break
            time.sleep(1)


def start_notification_scheduler():
    global notification_thread, notification_running
    if notification_running: return
    notification_running = True
    notification_thread = threading.Thread(target=check_and_send_notifications, daemon=True,
                                           name="Notification-Scheduler")
    notification_thread.start()
    logging.info("Bildirim zamanlayıcı başlatıldı.")


def stop_notification_scheduler():
    global notification_running
    if notification_running:
        notification_running = False
        logging.info("Bildirim zamanlayıcı durduruluyor...")
        if notification_thread and notification_thread.is_alive():
            notification_thread.join(2.0)
        logging.info("Bildirim zamanlayıcı durduruldu.")


# --- Loglama Yapılandırması ---
def setup_logging():
    for handler in logging.root.handlers[:]: logging.root.removeHandler(handler)
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
    for logger_name in ["urllib3", "selenium", "googletrans"]: logging.getLogger(logger_name).setLevel(logging.WARNING)
    return admin_logger


admin_logger = setup_logging()


# --- JSON Mesajlaşma ---
def send_to_frontend(message_type: str, data: Any, context: Dict = None):
    try:
        message_obj = {"type": message_type, "data": data}
        if context: message_obj["context"] = context
        print(json.dumps(message_obj), flush=True)
    except (TypeError, OSError, BrokenPipeError) as e:
        logging.error(f"Frontend'e mesaj gönderilemedi: {e}")


# --- Diğer Yardımcı Fonksiyonlar (Excel, Dosya Okuma, vb.) ---
def export_meetings_to_excel(data: Dict[str, Any]):
    notes = data.get("notes", [])
    start_date_str = data.get("startDate")
    end_date_str = data.get("endDate")

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return {"status": "error", "message": "Geçersiz tarih formatı."}

    meetings_to_export = []
    all_meetings = []
    for note in notes:
        all_meetings.extend(note.get("meetings", []))

    unique_meetings = {m['id']: m for m in all_meetings}.values()

    for meeting in unique_meetings:
        try:
            meeting_date = None
            if meeting.get("nextMeetingDate"):
                meeting_date = datetime.strptime(meeting.get("nextMeetingDate"), "%Y-%m-%d").date()

            if meeting_date and start_date <= meeting_date <= end_date:
                meeting['actual_meeting_date'] = meeting_date
                # Kayıt tarihini bulmak için notları tekrar gez
                for note in notes:
                    if any(m['id'] == meeting['id'] for m in note.get('meetings', [])):
                        meeting['note_date'] = datetime.strptime(note.get("date"), "%Y-%m-%d").date()
                        break
                else:  # Eğer bulunamazsa
                    meeting['note_date'] = meeting_date  # Yaklaşık bir tarih ata

                meetings_to_export.append(meeting)
        except (ValueError, TypeError):
            continue

    if not meetings_to_export:
        return {"status": "info", "message": "Belirtilen tarih aralığında dışa aktarılacak etkinlik bulunamadı."}

    meetings_to_export.sort(key=lambda m: m['actual_meeting_date'])

    desktop_path = Path.home() / "Desktop"
    desktop_path.mkdir(exist_ok=True)
    filename = f"Etkinlik_Raporu_{start_date_str}_-_{end_date_str}.xlsx"
    filepath = desktop_path / filename

    try:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Etkinlik Listesi"

        headers = ["FİRMA ADI", "YETKİLİSİ", "DEPARTMANI", "MAİL ADRESİ", "TELEFON", "ETKİNLİK TİPİ", "KAYIT TARİHİ",
                   "ETKİNLİK TARİHİ",
                   "AÇIKLAMA"]
        sheet.append(headers)

        for cell in sheet["1:1"]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center")

        for meeting in meetings_to_export:
            formatted_meeting_date = meeting['actual_meeting_date'].strftime('%d.%m.%Y')
            formatted_note_date = meeting['note_date'].strftime('%d.%m.%Y') if 'note_date' in meeting else 'N/A'

            row = [
                meeting.get("companyName", ""),
                meeting.get("authorizedPerson", ""),
                meeting.get("department", ""),
                meeting.get("email", ""),
                meeting.get("phone", ""),
                meeting.get("type", "Bilinmiyor").capitalize(),
                formatted_note_date,
                formatted_meeting_date,
                meeting.get("meetingNotes", "")
            ]
            sheet.append(row)

        for col in sheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2) if max_length < 50 else 50
            sheet.column_dimensions[column].width = adjusted_width

        workbook.save(filepath)
        logging.info(f"Etkinlik listesi Excel dosyası oluşturuldu: {filepath}")
        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Etkinlik Excel'i oluşturulurken hata: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


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
            admin_logger.info(
                f"  -> Atanan Ürün: Ad='{p_name}', Kod='{product.get('product_code', 'N/A')}', Fiyat='{product.get('price_str', 'N/A')}'")
        return {"status": "success", "path": str(filepath)}
    except Exception as e:
        logging.error(f"Excel hatası: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


translator = Translator()


def _translate_if_turkish(term: str) -> str:
    if not term: return term
    try:
        if detect(term) == 'tr':
            translated = translator.translate(term, src='tr', dest='en')
            if translated and translated.text:
                logging.info(f"Otomatik Çeviri: '{term}' -> '{translated.text}'")
                return translated.text
    except (LangDetectException, Exception):
        pass
    return term


def _clean_term(term):
    if not isinstance(term, str): return ""
    return re.sub(r'\s*$$[^)]*$$', '', term).strip()


def process_raw_data(data: List[List[str]]) -> List[str]:
    if not data: return []
    first_row_idx = next(
        (i for i, row in enumerate(data) if any(str(cell).strip() for cell in row if cell is not None)), -1)
    if first_row_idx == -1: return []
    relevant_data = data[first_row_idx:]
    potential_header = [str(cell).strip().lower() if cell is not None else '' for cell in relevant_data[0]]
    keywords = ['malzeme', 'ad', 'ürün', 'sarflar', 'proforma', 'açıklama', 'description', 'item', 'name',
                'stock keeping unit']
    target_col_idx = -1
    for i, header_cell in enumerate(potential_header):
        if any(keyword in header_cell for keyword in keywords):
            target_col_idx = i
            break
    body = relevant_data[1:] if target_col_idx != -1 else relevant_data
    if target_col_idx == -1: target_col_idx = next((i for i, cell in enumerate(potential_header) if cell), 0)
    search_terms = [str(row[target_col_idx]).strip() for row in body if
                    len(row) > target_col_idx and row[target_col_idx] and str(row[target_col_idx]).strip()]
    return search_terms


def read_excel_terms(file_path: str) -> List[str]:
    try:
        return process_raw_data(list(openpyxl.load_workbook(file_path, data_only=True).active.values))
    except Exception as e:
        logging.error(f"Excel okuma hatası: {e}", exc_info=True);
        return []


def read_docx_terms(file_path: str) -> List[str]:
    try:
        doc = docx.Document(file_path)
        return [term for table in doc.tables for term in
                process_raw_data([[cell.text for cell in row.cells] for row in table.rows])]
    except Exception as e:
        logging.error(f"Word okuma hatası: {e}", exc_info=True);
        return []


def read_csv_terms(file_path: str) -> List[str]:
    try:
        with open(file_path, 'rb') as f_raw:
            encoding = chardet.detect(f_raw.read())['encoding'] or 'utf-8'
        with open(file_path, 'r', encoding=encoding, newline='', errors='replace') as f:
            try:
                dialect = csv.Sniffer().sniff(f.read(2048))
            except csv.Error:
                dialect = 'excel'
            f.seek(0)
            return process_raw_data(list(csv.reader(f, dialect)))
    except Exception as e:
        logging.error(f"CSV okuma hatası: {e}", exc_info=True);
        return []


def get_search_terms_from_file(file_path):
    ext_map = {'.xlsx': read_excel_terms, '.csv': read_csv_terms, '.docx': read_docx_terms}
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in ext_map: return []
    raw_terms = ext_map[file_ext](file_path)
    processed_terms = {_translate_if_turkish(_clean_term(term)) for term in raw_terms if _clean_term(term)}
    return [term for term in processed_terms if len(term) > 2]


# --- Karşılaştırma Motoru ---
class ComparisonEngine:
    def __init__(self, sigma_api: sigma.SigmaAldrichAPI, netflex_api: netflex.NetflexAPI, tci_api: tci.TciScraper,
                 orkim_api: orkim.OrkimScraper,
                 initial_settings: Dict[str, Any], max_workers=10):
        self.sigma_api, self.netflex_api, self.tci_api, self.orkim_api = sigma_api, netflex_api, tci_api, orkim_api
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
                f_sigma = executor.submit(self.sigma_api.start_drivers)
                f_tci = executor.submit(self.tci_api.reinit_driver)
                f_sigma.result();
                f_tci.result()
            logging.info(f"Tüm Selenium sürücüleri {time.monotonic() - start_time:.2f}s içinde başlatıldı.")
        except Exception as e:
            logging.critical(f"Selenium sürücüleri başlatılamadı: {e}", exc_info=True);
            raise e

    def _process_single_sigma_product_and_send(self, raw_sigma_product: Dict[str, Any], context: Dict):
        try:
            if self.search_cancelled.is_set(): return False
            s_num, s_brand, s_key, s_mids = raw_sigma_product.get('product_number'), raw_sigma_product.get(
                'brand'), raw_sigma_product.get('product_key'), raw_sigma_product.get('material_ids', [])
            sigma_variations = self.sigma_api.get_all_product_prices(s_num, s_brand, s_key.replace('.', ''), s_mids,
                                                                     self.search_cancelled)
            if self.search_cancelled.is_set(): return False
            netflex_terms = {s_num.replace('.', '')} if s_num else set()
            for country_vars in sigma_variations.values():
                for var in country_vars:
                    if mat_num := var.get('material_number'): netflex_terms.add(mat_num.replace('.', ''))
            netflex_cache = {}
            for term in netflex_terms:
                if self.search_cancelled.is_set(): return False
                if results := self.netflex_api.search_products(term, self.search_cancelled):
                    for r in results:
                        if r_code := r.get('product_code'): netflex_cache[r_code] = r
            if self.search_cancelled.is_set(): return False
            final_product = self._build_final_sigma_product(raw_sigma_product, netflex_cache, {s_num: sigma_variations},
                                                            self.settings)
            if final_product:
                send_to_frontend("product_found", {"product": final_product}, context=context)
                return True
        except Exception as e:
            logging.error(f"Tekil Sigma ürünü ({raw_sigma_product.get('product_number')}) işlenirken hata: {e}",
                          exc_info=True)
        return False

    def _build_final_sigma_product(self, sigma_product: Dict, netflex_cache: Dict, all_sigma_variations: Dict,
                                   settings: Dict) -> Dict or None:
        s_name, s_num, s_brand, cas = sigma_product.get('product_name_sigma'), sigma_product.get(
            'product_number'), sigma_product.get('brand'), sigma_product.get('cas_number', 'N/A')
        if not all([s_name, s_num, s_brand]): return None
        parities = self.currency_converter.get_parities()
        if "error" in parities: logging.error("Pariteler alınamadı.")
        sigma_variations = all_sigma_variations.get(s_num, {})
        all_price_options = []
        for country_code, variations in sigma_variations.items():
            coefficient = settings.get(f"sigma_coefficient_{country_code}", 1.0)
            for var in variations:
                if 'error' in var: continue
                price_eur, original_price, currency = None, var.get('price'), var.get('currency', '').upper()
                if original_price is not None:
                    try:
                        base_price_eur = None
                        if currency == 'USD' and parities.get('usd_eur'):
                            base_price_eur = original_price * parities['usd_eur']
                        elif currency == 'GBP' and parities.get('gbp_eur'):
                            base_price_eur = original_price * parities['gbp_eur']
                        elif currency == 'EUR':
                            base_price_eur = original_price
                        if base_price_eur is not None:
                            price_eur = base_price_eur * coefficient
                            if mat_num := var.get('material_number'): all_price_options.append(
                                {'price': price_eur, 'code': mat_num, 'source': f"Sigma ({country_code.upper()})"})
                    except Exception:
                        pass
        netflex_matches = []
        sigma_mat_nums = {var.get('material_number') for vars_list in sigma_variations.values() for var in vars_list if
                          var.get('material_number')}
        for mat_num in sigma_mat_nums:
            clean_mat_num = mat_num.replace('.', '')
            if clean_mat_num in netflex_cache:
                match = netflex_cache[clean_mat_num]
                netflex_matches.append(match)
                if price := match.get('price_numeric'): all_price_options.append(
                    {'price': price, 'code': match.get('product_code'), 'source': 'Netflex'})
        cheapest_option = min(all_price_options, key=lambda x: x['price']) if all_price_options else {}
        return {"source": "Sigma", "product_name": s_name, "product_number": s_num, "cas_number": cas,
                "brand": f"Sigma ({s_brand})", "sigma_variations": sigma_variations, "netflex_matches": netflex_matches}

    def _process_tci_product(self, tci_product: tci.Product, context: Dict = None) -> Dict[str, Any]:
        processed_variations = []
        for variation in tci_product.variations:
            original_price_str = variation.get('price', 'N/A')
            price_float = None
            try:
                cleaned = re.sub(r'[^\d,.]', '', original_price_str)
                standardized = cleaned.replace('.', '').replace(',', '.') if cleaned.rfind(',') > cleaned.rfind(
                    '.') else cleaned.replace(',', '')
                price_float = float(standardized) if standardized else None
            except (ValueError, TypeError):
                pass

            processed_variations.append({
                "unit": variation.get('unit'),
                "original_price": original_price_str,
                "original_price_numeric": price_float,
                "stock_info": variation.get('stock_info', [])
            })

        return {
            "source": "TCI",
            "product_name": tci_product.name,
            "product_number": tci_product.code,
            "cas_number": tci_product.cas_number,
            "brand": "TCI",
            "tci_variations": processed_variations,
            "sigma_variations": {},
            "netflex_matches": []
        }

    def _process_orkim_product(self, orkim_product: Dict[str, Any], context: Dict = None) -> Dict[str, Any]:
        """Orkim'den gelen ürün verisini standart formata çevirir."""
        price_str = orkim_product.get("price_str", "N/A")
        return {
            "source": "Orkim",
            "product_name": orkim_product.get("urun_adi", "N/A"),
            "product_number": orkim_product.get("k_kodu", "N/A"),
            "cas_number": "N/A",  # Orkim arama sayfasında bu bilgi yok
            "brand": "Orkim",
            "cheapest_eur_price_str": price_str,
            "cheapest_material_number": orkim_product.get("k_kodu", "N/A"),
            "cheapest_source_country": "Orkim",
            "sigma_variations": {},
            "netflex_matches": [],
            "tci_variations": []
        }

    def search_and_compare(self, search_term: str, context: Dict = None):
        start_time = time.monotonic()
        logging.info(f"ANLIK ARAMA BAŞLATILDI: '{search_term}'")
        if not context: send_to_frontend("log_search_term", {"term": search_term}); admin_logger.info(
            f"Arama: '{search_term}'")
        total_found = 0
        total_found_lock = threading.Lock()
        with ThreadPoolExecutor(max_workers=4, thread_name_prefix="Source-Streamer") as executor:
            def tci_task():
                nonlocal total_found
                try:
                    for product_page in self.tci_api.get_products(search_term, self.search_cancelled):
                        if self.search_cancelled.is_set(): break
                        for product in product_page:
                            if self.search_cancelled.is_set(): break
                            processed = self._process_tci_product(product, context)
                            send_to_frontend("product_found", {"product": processed}, context=context)
                            with total_found_lock:
                                total_found += 1
                except Exception as e:
                    logging.error(f"TCI akış hatası: {e}", exc_info=True)

            def sigma_task():
                nonlocal total_found
                with ThreadPoolExecutor(max_workers=self.max_workers,
                                        thread_name_prefix="Sigma-Processor") as processor:
                    try:
                        self.currency_converter.get_parities()
                        futures = [processor.submit(self._process_single_sigma_product_and_send, raw_product, context)
                                   for raw_product in self.sigma_api.search_products(search_term, self.search_cancelled)
                                   if not self.search_cancelled.is_set()]
                        for future in as_completed(futures):
                            if future.result():
                                with total_found_lock: total_found += 1
                    except Exception as e:
                        logging.error(f"Sigma akış hatası: {e}", exc_info=True)

            def orkim_task():
                nonlocal total_found
                try:
                    if self.orkim_api:
                        orkim_results = self.orkim_api.search_products(search_term, self.search_cancelled)
                        if self.search_cancelled.is_set(): return

                        for product in orkim_results:
                            if self.search_cancelled.is_set(): break
                            processed = self._process_orkim_product(product, context)
                            send_to_frontend("product_found", {"product": processed}, context=context)
                            with total_found_lock:
                                total_found += 1
                except Exception as e:
                    logging.error(f"Orkim akış hatası: {e}", exc_info=True)

            f_tci = executor.submit(tci_task)
            f_sigma = executor.submit(sigma_task)
            f_orkim = executor.submit(orkim_task)
            f_tci.result();
            f_sigma.result()
            f_orkim.result()
        if not self.search_cancelled.is_set():
            logging.info(
                f"Arama Tamamlandı: '{search_term}', Toplam={total_found}, Süre={time.monotonic() - start_time:.2f}s")
            send_to_frontend("search_complete", {"status": "complete", "total_found": total_found}, context=context)
        elif not context:
            send_to_frontend("search_complete", {"status": "cancelled"})
            logging.warning(f"Arama İptal Edildi: '{search_term}'")

    def run_batch_search(self, file_path, customer_name):
        logging.info(f"Toplu arama: Dosya={file_path}, Müşteri={customer_name}")
        self.batch_search_cancelled.clear()
        admin_logger.info(f"Toplu Arama: Müşteri='{customer_name}', Dosya='{os.path.basename(file_path)}'")
        search_terms = get_search_terms_from_file(file_path)
        if not search_terms:
            send_to_frontend("batch_search_complete", {"status": "error", "message": "Dosyadan ürün okunamadı."});
            return
        total_terms = len(search_terms)
        for i, term in enumerate(search_terms):
            if self.batch_search_cancelled.is_set(): logging.warning("Toplu arama iptal edildi."); break
            self.search_cancelled.clear()
            send_to_frontend("log_search_term", {"term": term})
            send_to_frontend("batch_search_progress", {"term": term, "current": i + 1, "total": total_terms})
            admin_logger.info(f"  -> Toplu Arama ({i + 1}/{total_terms}): '{term}'")
            self.search_and_compare(term, context={"batch_search_term": term})
        status = "cancelled" if self.batch_search_cancelled.is_set() else "complete"
        send_to_frontend("batch_search_complete", {"status": status})
        if status == 'complete': admin_logger.info(f"Toplu Arama Tamamlandı: Müşteri='{customer_name}'")

    def force_cancel(self):
        self.search_cancelled.set()

    def force_cancel_batch(self):
        self.batch_search_cancelled.set();
        self.force_cancel()


# --- Ana Fonksiyon ve Komut Döngüsü ---
def main():
    logging.info("=" * 40 + "\nPython Arka Plan Servisi Başlatıldı\n" + "=" * 40)
    start_notification_scheduler()
    services_initialized = threading.Event()
    sigma_api, tci_api, currency_api, orkim_api = sigma.SigmaAldrichAPI(), tci.TciScraper(), currency_converter.CurrencyConverter(), None
    netflex_api, engine, search_thread, batch_search_thread = None, None, None, None

    def initialize_services(settings_data: Dict[str, Any]):
        nonlocal netflex_api, engine, orkim_api
        logging.info(f"Servisler başlatılıyor...")
        netflex_api = netflex.NetflexAPI(username=settings_data.get("netflex_username"),
                                         password=settings_data.get("netflex_password"))
        orkim_api = orkim.OrkimScraper(
            username=settings_data.get("orkim_username"),
            password=settings_data.get("orkim_password"),
            openai_api_key=settings_data.get("OCR_API_KEY")
        )
        engine = ComparisonEngine(sigma_api, netflex_api, tci_api, orkim_api, initial_settings=settings_data)

        def init_task():
            try:
                netflex_api.get_token()
                engine.initialize_drivers()
                send_to_frontend("python_services_ready", True)
                services_initialized.set()
            except netflex.AuthenticationError:
                send_to_frontend("authentication_error", True)
            except Exception as e:
                logging.critical(f"Servis başlatma hatası: {e}", exc_info=True);
                send_to_frontend(
                    "python_services_ready", False)

        threading.Thread(target=init_task, name="Full-Initializer", daemon=True).start()

    if SETTINGS_FILE_PATH.exists():
        initialize_services(load_settings())
    else:
        send_to_frontend("initial_setup_required", True)

    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            action, data = request.get("action"), request.get("data")
            logging.info(f"Komut alındı: Eylem='{action}'")

            if action == "load_settings":
                send_to_frontend("settings_loaded", load_settings())
            elif action == "save_settings" and isinstance(data, dict):
                save_settings(data)
                if engine:
                    engine.settings = data
                    engine.netflex_api.update_credentials(data.get("netflex_username"), data.get("netflex_password"))
                    # Orkim API'yi de güncelle
                    if engine.orkim_api:
                        engine.orkim_api.username = data.get("orkim_username")
                        engine.orkim_api.password = data.get("orkim_password")
                        engine.orkim_api.openai_api_key = data.get("OCR_API_KEY")
                        engine.orkim_api.is_logged_in = False  # Re-login needed
                if not services_initialized.is_set():
                    services_initialized.clear();
                    initialize_services(data)
                send_to_frontend("settings_saved", {"status": "success"})
            elif action == "load_calendar_notes":
                send_to_frontend("calendar_notes_loaded", load_calendar_notes())
            elif action == "save_calendar_notes" and isinstance(data, list):
                save_calendar_notes(data)
                threading.Thread(target=_perform_notification_check, name="Manual-Notification-Check").start()
                send_to_frontend("calendar_notes_saved", {"status": "success"})
            elif action == "mark_meeting_complete" and isinstance(data, dict):
                if data.get("noteDate") and data.get("meetingId"):
                    _mark_meeting_as_complete(data["noteDate"], data["meetingId"])
            elif action in ["search", "start_batch_search"] and data:
                if not services_initialized.is_set(): send_to_frontend("search_error",
                                                                       "Servisler başlatılmadı."); continue
                if search_thread and search_thread.is_alive(): engine.force_cancel(); search_thread.join(5.0)
                if batch_search_thread and batch_search_thread.is_alive(): engine.force_cancel_batch(); batch_search_thread.join(
                    5.0)
                if action == "search":
                    engine.search_cancelled.clear()
                    search_thread = threading.Thread(target=engine.search_and_compare, args=(data,),
                                                     name="Search-Coordinator")
                    search_thread.start()
                else:
                    batch_search_thread = threading.Thread(target=engine.run_batch_search,
                                                           args=(data.get("filePath"), data.get("customerName")),
                                                           name="Batch-Search-Coordinator")
                    batch_search_thread.start()
            elif action == "cancel_search" or action == "cancel_current_term_search":
                if engine: engine.force_cancel()
            elif action == "cancel_batch_search":
                if engine: engine.force_cancel_batch()
            elif action == "export":
                send_to_frontend("export_result", export_to_excel(data))
            elif action == "export_meetings":
                send_to_frontend("export_meetings_result", export_meetings_to_excel(data))
            elif action == "get_parities":
                send_to_frontend("parities_updated", currency_api.get_parities())
            elif action == "shutdown":
                stop_notification_scheduler()
                if engine: engine.force_cancel_batch()
                if search_thread and search_thread.is_alive(): search_thread.join(2.0)
                if batch_search_thread and batch_search_thread.is_alive(): batch_search_thread.join(2.0)
                sigma_api.stop_drivers();
                tci_api.close_driver()
                break
        except json.JSONDecodeError:
            logging.error(f"Geçersiz JSON: {line}")
        except Exception as e:
            logging.critical(f"Ana döngüde hata: {e}", exc_info=True)

    stop_notification_scheduler()
    logging.info("Python ana döngüsü sonlandı.")


if __name__ == '__main__':
    main()
