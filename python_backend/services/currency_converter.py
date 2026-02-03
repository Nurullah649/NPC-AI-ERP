import requests
import xml.etree.ElementTree as ET
import logging
from datetime import datetime

class CurrencyConverter:
    def __init__(self):
        self.url = "https://www.tcmb.gov.tr/kurlar/today.xml"
        self.rates = {}
        self.last_updated = None

    def _fetch_rates(self):
        try:
            timestamp_url = f"{self.url}?_={int(datetime.now().timestamp() * 1000)}"
            response = requests.get(timestamp_url, timeout=15)
            response.raise_for_status()
            xml_root = ET.fromstring(response.content)
            self.rates = {}
            for currency in xml_root.findall('Currency'):
                code = currency.get('CurrencyCode')
                forex_selling_tag = currency.find('ForexSelling')
                if code and forex_selling_tag is not None and forex_selling_tag.text:
                    try:
                        rate = float(forex_selling_tag.text)
                        self.rates[code] = rate
                    except (ValueError, TypeError):
                        continue
            self.last_updated = datetime.now()
            logging.info(f"TCMB döviz kurları başarıyla güncellendi. Toplam {len(self.rates)} kur bulundu.")
            return True
        except requests.exceptions.RequestException as e:
            logging.error(f"TCMB döviz kuru verisi çekilirken ağ hatası oluştu: {e}")
        except ET.ParseError as e:
            logging.error(f"TCMB'den gelen XML verisi parse edilemedi: {e}")
        except Exception as e:
            logging.error(f"Döviz kurları alınırken beklenmedik bir hata oluştu: {e}")
        return False

    def get_parities(self) -> dict:
        if not self.rates or (self.last_updated and (datetime.now() - self.last_updated).total_seconds() > 3600):
            if not self._fetch_rates():
                return {"error": "Döviz kurları alınamadı."}
        try:
            usd_try = self.rates.get("USD")
            gbp_try = self.rates.get("GBP")
            eur_try = self.rates.get("EUR")
            if not all([usd_try, gbp_try, eur_try]):
                missing = [code for code, rate in [("USD", usd_try), ("GBP", gbp_try), ("EUR", eur_try)] if not rate]
                logging.error(f"Parite hesaplaması için gerekli kurlar bulunamadı: {', '.join(missing)}")
                return {"error": f"Gerekli kurlar bulunamadı: {', '.join(missing)}"}
            usd_eur_parity = usd_try / eur_try
            gbp_eur_parity = gbp_try / eur_try
            return {
                "usd_eur": round(usd_eur_parity, 4),
                "gbp_eur": round(gbp_eur_parity, 4),
                "last_updated": self.last_updated.strftime("%Y-%m-%d %H:%M:%S") if self.last_updated else "N/A"
            }
        except ZeroDivisionError:
            logging.error("Parite hesaplaması sırasında EUR kuru sıfır veya geçersiz olduğu için hata oluştu.")
            return {"error": "EUR kuru sıfır veya geçersiz."}
        except Exception as e:
            logging.error(f"Parite hesaplaması sırasında beklenmedik hata: {e}")
            return {"error": "Parite hesaplanırken bir hata oluştu."}
