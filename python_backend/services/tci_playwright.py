# -*- coding: utf-8 -*-
"""
TCI Scraper - Playwright + Obscura CDP Edition
================================================
Selenium/Chrome yerine Obscura CDP sunucusu üzerinden Playwright kullanarak
TCI Chemicals web sitesinden ürün bilgilerini çeken servis.

Değişiklikler:
- Selenium WebDriver → Playwright CDP bağlantısı
- find_elements → page.query_selector_all / locator
- WebDriverWait → page.wait_for_selector
- get_attribute → element.get_attribute
- execute_script → page.evaluate
"""

import json
import logging
import signal
import threading
import os
import queue
import requests
from requests.adapters import HTTPAdapter
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from typing import Dict, Any, List, Generator
import time
import sys
import hashlib

from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext
from urllib.parse import quote, urlparse, urlunparse, parse_qs, urlencode


class Product:
    def __init__(self, name, code, variations, brand, cas_number):
        self.name = name
        self.code = code
        self.variations = variations
        self.brand = brand
        self.cas_number = cas_number

    def __repr__(self):
        return f"Product(Name='{self.name}', Code='{self.code}', CAS='{self.cas_number}', Variations={len(self.variations)}, Brand='{self.brand}')"


class TciScraper:
    def __init__(self, cdp_endpoint: str = "http://127.0.0.1:9222"):
        self.cdp_endpoint = cdp_endpoint
        self._playwright = None
        self._browser: Browser = None
        self._context: BrowserContext = None
        self._page: Page = None

    def reinit_driver(self):
        """Playwright bağlantısını başlat veya yeniden başlat."""
        if self._page:
            self.close_driver()
        try:
            logging.info("TCI Playwright+Obscura bağlantısı başlatılıyor...")
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.connect_over_cdp(self.cdp_endpoint)
            self._context = self._browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                extra_http_headers={
                    "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
                }
            )
            # Görselleri engelle (RAM tasarrufu)
            self._context.route("**/*.{png,jpg,jpeg,gif,svg,ico,webp,woff,woff2}", lambda route: route.abort())

            self._page = self._context.new_page()
            self._page.set_default_timeout(90000)
            logging.info("TCI Playwright+Obscura bağlantısı başarıyla kuruldu.")
        except Exception as e:
            logging.critical(f"TCI Playwright bağlantısı kurulurken kritik hata: {e}", exc_info=True)
            self._page = None
            self._cleanup_playwright()

    def kill_driver(self):
        """Bağlantıyı temizle — Obscura manager tarafından yönetilir."""
        logging.warning("TCI Playwright bağlantısı zorla temizleniyor...")
        self._cleanup_playwright()

    def _cleanup_playwright(self):
        """Playwright kaynaklarını temizle."""
        if self._page:
            try:
                self._page.close()
            except Exception:
                pass
            self._page = None
        if self._context:
            try:
                self._context.close()
            except Exception:
                pass
            self._context = None
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    def _get_subsequent_page_url(self, base_url: str, search_term: str, page: int) -> str:
        parsed_url = urlparse(base_url)
        query_params = parse_qs(parsed_url.query)
        q_param_value = f"{search_term}:productNameExactMatch"
        query_params['q'] = [q_param_value]
        query_params['text'] = [search_term]
        query_params['page'] = [str(page)]
        new_query = urlencode(query_params, doseq=True)
        new_url = urlunparse((parsed_url.scheme or "https", parsed_url.netloc or "www.tcichemicals.com", "/DE/de/search", parsed_url.params, new_query, parsed_url.fragment))
        return new_url

    def get_products(self, search_query: str, cancellation_token: threading.Event) -> Generator[List[Product], None, None]:
        if not self._page:
            logging.error("TCI Playwright bağlantısı kurulmamış. Arama yapılamıyor.")
            return
        if cancellation_token.is_set():
            logging.info("TCI araması başlangıçta iptal edildi.")
            return

        first_page_url = f"https://www.tcichemicals.com/DE/de/search?text={quote(search_query)}"
        base_search_url_for_params = first_page_url

        try:
            logging.info(f"'{search_query}' için TCI ilk sayfa açılıyor: {first_page_url}")
            self._page.goto(first_page_url, wait_until="domcontentloaded", timeout=90000)

            # Cookie consent
            try:
                accept_selector = "button:has-text('Alle akzeptieren'), button:has-text('OK'), button:has-text('Accept All')"
                accept_button = self._page.wait_for_selector(accept_selector, timeout=15000, state="visible")
                if accept_button:
                    accept_button.click()
                    logging.info("Cookie onay banner'ı kabul edildi.")
                    try:
                        self._page.wait_for_selector(accept_selector, state="hidden", timeout=5000)
                        logging.info("Cookie banner'ı kayboldu.")
                    except Exception:
                        logging.warning("Cookie banner'ı tıklandı ama kaybolmadı.")
            except Exception:
                logging.info("Cookie onay banner'ı bulunamadı veya zaman aşımına uğradı.")

            base_search_url_for_params = self._page.url

        except Exception as e:
            logging.error(f"TCI ana arama sayfası yüklenirken hata oluştu: {e}")
            return

        page_count = 1
        last_page_content_hash = ""
        max_empty_pages = 2

        while not cancellation_token.is_set():
            if page_count > 1:
                next_page_url = self._get_subsequent_page_url(base_search_url_for_params, search_query, page_count)
                logging.info(f"TCI: Sonraki sayfaya gidiliyor: {next_page_url}")
                try:
                    self._page.goto(next_page_url, wait_until="domcontentloaded", timeout=90000)
                except Exception as page_load_error:
                    logging.error(f"TCI: Sayfa {page_count} yüklenirken hata oluştu: {page_load_error}")
                    break

            logging.info(f"TCI Sayfa {page_count} taranıyor (URL: {self._page.url})...")

            # product-basic-wrap içinde tam liste/duble içerik olabiliyor; görünür listeyi hedefle.
            product_list_selector = "#product-list-wrap .prductlist[data-product-code1]"
            no_results_selector = "//*[contains(text(), 'keine Suchergebnisse') or contains(text(), 'no results')]"
            product_cards = []

            try:
                # Ürün listesi veya "sonuç yok" mesajını bekle
                try:
                    self._page.wait_for_selector(
                        f"{product_list_selector}, :text('keine Suchergebnisse'), :text('no results')",
                        timeout=60000,
                        state="attached"
                    )
                except Exception:
                    pass

                product_cards = self._page.query_selector_all(product_list_selector)
                if len(product_cards) > 60:
                    product_cards = product_cards[:60]
                if product_cards:
                    logging.info(f"{len(product_cards)} adet ürün kartı bulundu.")

                if not product_cards:
                    no_results = self._page.query_selector("text=keine Suchergebnisse") or self._page.query_selector("text=no results")
                    if no_results:
                        logging.info("TCI: 'Ürün bulunamadı' mesajı algılandı. Tarama tamamlanıyor.")
                        break
                    else:
                        logging.warning(f"TCI Sayfa {page_count}: Ürün kartı yok ve 'sonuç yok' mesajı da yok.")
                        max_empty_pages -= 1
                        if max_empty_pages <= 0:
                            logging.error("Arka arkaya çok fazla boş/hatalı sayfa algılandı. Tarama durduruluyor.")
                            break

                # İçerik hash kontrolü
                try:
                    product_wrap = self._page.query_selector("#product-basic-wrap")
                    if product_wrap:
                        content_html = product_wrap.evaluate("el => el.outerHTML")
                        current_content_hash = hashlib.md5(content_html.encode()).hexdigest()
                    else:
                        current_content_hash = hashlib.md5(self._page.content().encode()).hexdigest()
                except Exception:
                    current_content_hash = ""

                if current_content_hash == last_page_content_hash and page_count > 1:
                    logging.warning(f"TCI: Sayfa {page_count} içeriği öncekiyle aynı. Tarama durduruluyor.")
                    break
                last_page_content_hash = current_content_hash

            except Exception as e:
                logging.warning(f"TCI Sayfa {page_count}: Ürün listesi yüklenemedi: {e}")
                break

            page_products = []
            if product_cards:
                max_empty_pages = 2
                for card_index, card in enumerate(product_cards):
                    if cancellation_token.is_set():
                        break
                    try:
                        name_element = card.query_selector("a.name.product-title")
                        name = name_element.inner_text().strip() if name_element else "N/A"
                        code = (card.get_attribute("data-product-code1") or "").strip() or "N/A"
                        cas_number = (card.get_attribute("data-casNo") or "").strip() or "N/A"

                        variations = []
                        try:
                            pricing_table = card.query_selector("#PricingTable")
                            rows = pricing_table.query_selector_all("tr") if pricing_table else []
                        except Exception:
                            rows = []

                        for row_index, row in enumerate(rows):
                            cols = row.query_selector_all("td")
                            if not cols:
                                continue
                            unit = ''
                            price = ''
                            stock_info = []
                            for col in cols:
                                try:
                                    data_attr = col.get_attribute("data-attr")
                                    if not data_attr:
                                        continue
                                    data_attr = data_attr.strip().strip(':')
                                    text = col.inner_text().strip()
                                    if not text:
                                        continue
                                    if data_attr == "Einheit":
                                        unit = text
                                    elif data_attr == "Stückpreis":
                                        price = text.replace('\n', ' ')
                                    else:
                                        stock_info.append({'country': data_attr, 'stock': text})
                                except Exception as col_ex:
                                    logging.debug(f"Col err: {col_ex}")
                            if unit and price:
                                variations.append({'unit': unit, 'price': price, 'stock_info': stock_info})
                            elif unit or price:
                                logging.debug(f"Missing data: {code}, U:{unit}, P:{price}")

                        page_products.append(Product(name, code, variations, brand="TCI", cas_number=cas_number))
                    except Exception as e:
                        logging.error(f"Card err ({card_index + 1}): {e}", exc_info=False)

            if page_products:
                yield page_products
            elif page_count > 1 and not product_cards and max_empty_pages > 0:
                logging.info(f"TCI Sayfa {page_count}: Ürün bulunamadı. Sonraki sayfa deneniyor ({max_empty_pages} deneme kaldı).")
            elif page_count == 1 and not product_cards:
                logging.warning("TCI ilk sayfada ürün kartı bulunamadı. Tarama sonlandırılıyor.")
                break

            page_count += 1

    def close_driver(self):
        """Playwright bağlantısını temizle."""
        logging.info("TCI Playwright bağlantısı kapatılıyor...")
        self._cleanup_playwright()
        logging.info("TCI Playwright bağlantısı kapatıldı.")
