# -*- coding: utf-8 -*-
"""
Obscura Process Manager
========================
Obscura CDP sunucusunu yöneten yardımcı sınıf.
Obscura'yı bir subprocess olarak başlatır, durdurur ve sağlık kontrolü yapar.
"""

import subprocess
import logging
import time
import os
import signal
import threading
import socket
from pathlib import Path


class ObscuraManager:
    """Obscura CDP sunucusunu subprocess olarak yönetir."""

    def __init__(self, binary_path: str = None, port: int = 9222, workers: int = 4, stealth: bool = True):
        self.port = port
        self.workers = workers
        self.stealth = stealth
        self.process: subprocess.Popen = None
        self._lock = threading.Lock()

        # Binary yolunu bul
        if binary_path:
            self.binary_path = binary_path
        else:
            # Varsayılan konumlar
            project_root = Path(__file__).parent.parent
            candidates = [
                project_root / "obscura",
                project_root / "obscura-src" / "target" / "release" / "obscura",
                Path.home() / ".local" / "bin" / "obscura",
                Path("/usr/local/bin/obscura"),
            ]
            self.binary_path = None
            for candidate in candidates:
                if candidate.exists() and os.access(str(candidate), os.X_OK):
                    self.binary_path = str(candidate)
                    break

            if not self.binary_path:
                logging.warning("Obscura binary bulunamadı! Lütfen binary_path parametresi ile belirtin.")

    def _is_port_in_use(self) -> bool:
        """Portu kontrol et."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('127.0.0.1', self.port)) == 0

    def start(self) -> bool:
        """Obscura CDP sunucusunu başlat."""
        with self._lock:
            if self.process and self.process.poll() is None:
                logging.info(f"Obscura zaten çalışıyor (PID: {self.process.pid})")
                return True

            if not self.binary_path:
                logging.error("Obscura binary yolu belirtilmemiş veya bulunamadı!")
                return False

            if self._is_port_in_use():
                logging.warning(f"Port {self.port} zaten kullanımda. Mevcut Obscura instance'ı olabilir.")
                return True

            cmd = [
                self.binary_path, "serve",
                "--port", str(self.port),
                "--workers", str(self.workers),
            ]
            if self.stealth:
                cmd.append("--stealth")

            logging.info(f"Obscura başlatılıyor: {' '.join(cmd)}")
            try:
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    preexec_fn=os.setsid if os.name != 'nt' else None,
                )

                # Sunucunun hazır olmasını bekle
                max_wait = 10
                for i in range(max_wait * 10):
                    if self._is_port_in_use():
                        logging.info(f"Obscura başarıyla başlatıldı (PID: {self.process.pid}, Port: {self.port})")
                        return True
                    if self.process.poll() is not None:
                        stderr = self.process.stderr.read().decode('utf-8', errors='replace')
                        logging.error(f"Obscura başlatılamadı! Çıkış kodu: {self.process.returncode}, Hata: {stderr[:500]}")
                        return False
                    time.sleep(0.1)

                logging.error(f"Obscura {max_wait} saniye içinde hazır olmadı!")
                self.stop()
                return False

            except FileNotFoundError:
                logging.error(f"Obscura binary bulunamadı: {self.binary_path}")
                return False
            except Exception as e:
                logging.error(f"Obscura başlatılırken hata: {e}", exc_info=True)
                return False

    def stop(self):
        """Obscura'yı durdur."""
        with self._lock:
            if self.process:
                pid = self.process.pid
                logging.info(f"Obscura durduruluyor (PID: {pid})...")
                try:
                    if os.name != 'nt':
                        os.killpg(os.getpgid(pid), signal.SIGTERM)
                    else:
                        self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                        logging.info(f"Obscura düzgünce kapatıldı (PID: {pid})")
                    except subprocess.TimeoutExpired:
                        logging.warning(f"Obscura zorla sonlandırılıyor (PID: {pid})...")
                        if os.name != 'nt':
                            os.killpg(os.getpgid(pid), signal.SIGKILL)
                        else:
                            self.process.kill()
                        self.process.wait(timeout=3)
                except ProcessLookupError:
                    logging.info(f"Obscura süreci zaten kapanmış (PID: {pid})")
                except Exception as e:
                    logging.error(f"Obscura kapatılırken hata: {e}")
                finally:
                    self.process = None

    def is_running(self) -> bool:
        """Obscura'nın çalışıp çalışmadığını kontrol et."""
        if self.process and self.process.poll() is None:
            return self._is_port_in_use()
        return self._is_port_in_use()

    def get_ws_endpoint(self) -> str:
        """WebSocket endpoint URL'sini döndür."""
        return f"ws://127.0.0.1:{self.port}"

    def get_cdp_endpoint(self) -> str:
        """CDP endpoint URL'sini döndür."""
        return f"http://127.0.0.1:{self.port}"

    def restart(self) -> bool:
        """Obscura'yı yeniden başlat."""
        self.stop()
        time.sleep(1)
        return self.start()
