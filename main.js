// main.js

const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")
const isDev = require("electron-is-dev")
const { spawn, execFile } = require("child_process")
const fs = require("fs")

// --- Globals ---
let win = null
let pythonService = null
let splash = null
let tray = null
const appDataPath = app.getPath("userData")

// --- YENİ: Güncelleme loglaması ---
autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

// --- YENİ VE KRİTİK BÖLÜM: GİZLİ REPO İÇİN KİMLİK DOĞRULAMA ---
// Sizin verdiğiniz token buraya eklendi.
const GITHUB_READ_ONLY_TOKEN = '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';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Nurullah649',
  repo: 'NPC-AI-ERP',
  private: true,
  token: GITHUB_READ_ONLY_TOKEN
});
// --- YENİ BÖLÜM BİTİŞ ---


// --- Python Servisini Başlatma Fonksiyonu ---
const startPythonService = () => {
  try {
    const scriptPath = isDev
      ? path.join(__dirname, "..", "desktop_app_electron.py")
      : path.join(process.resourcesPath, "bin", "desktop_app_electron.exe")

    // GÜVENLİ VERİ YOLU: appDataPath'i Python'a argüman olarak gönder
    // Python scriptinin bu argümanı alacak şekilde ayarlandığından emin olun (sys.argv[1])
    pythonService = spawn(scriptPath, [appDataPath])

    pythonService.stdout.on("data", (data) => {
      const messages = data.toString().split('\n')
      for (const message of messages) {
        if (message.trim()) {
          try {
            const parsed = JSON.parse(message)
            if (win) {
              win.webContents.send(parsed.type, parsed.data)
            }
          } catch (e) {
            autoUpdater.logger.info(`Python: ${message}`)
          }
        }
      }
    })

    pythonService.stderr.on("data", (data) => {
      autoUpdater.logger.error(`Python Hata Çıktısı: ${data.toString()}`)
      if (win) {
        win.webContents.send("python-crashed")
      }
    })

    pythonService.on('close', (code)Code => {
      autoUpdater.logger.warn(`Python servisi kapandı, çıkış kodu: ${code}`)
      pythonService = null
      if (win) {
        win.webContents.send("python-crashed")
      }
    })
  } catch (err) {
    autoUpdater.logger.error(`Python başlatılamadı: ${err}`)
    if (win) {
      win.webContents.send("python-crashed")
    }
  }
}

// --- Pencere Oluşturma Fonksiyonu ---
function createWindow() {
  // Splash ekranı oluştur
  splash = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, "assets", "icon.png"),
  })
  splash.loadFile(path.join(__dirname, "splash.html"))

  // Ana pencereyi oluştur (başlangıçta gizli)
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 560,
    show: false,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Next.js (veya React) build dosyasını yükle
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "out", "index.html")}`
  win.loadURL(startUrl)

  // Geliştirme araçlarını aç (sadece geliştirme modunda)
  if (isDev) {
    win.webContents.openDevTools()
  }

  // --- ANA PENCERE HAZIR OLDUĞUNDA ---
  win.once("ready-to-show", () => {
    // Python servisini başlat
    startPythonService()

    // Güncellemeleri kontrol et (Artık gizli repoya erişebilecek)
    autoUpdater.checkForUpdates()

    // Splash ekranını kapat ve ana pencereyi göster
    // NOT: Python servisinden "ready" mesajı beklemek daha iyi bir yöntemdir
    // Şimdilik 4 saniye bekliyoruz.
    setTimeout(() => {
        if(splash) {
            splash.close()
            splash = null
        }
        win.show()
    }, 4000)
  })

  // Pencere kapatıldığında
  win.on("closed", () => {
    win = null
  })

  // Bildirim tepsisi (Tray)
  createTray()
}

// --- Tray (Sistem Tepsisi) Fonksiyonu ---
function createTray() {
  const iconName = "icon.png"
  const iconPath = path.join(__dirname, "assets", iconName);
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => {
        if (win) {
          win.show();
        }
      },
    },
    {
      label: 'Çıkış',
      click: () => {
        app.quit(); // Bu, 'before-quit' event'ini tetikler
      },
    },
  ]);

  tray.setToolTip('NPC-AI ERP');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });
}


// --- Uygulama Yaşam Döngüsü ---

app.on("ready", () => {
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Python servisi çalıştığı için hemen kapatmıyoruz
    // Tray icon'dan çıkış yapılmasını bekliyoruz
  }
})

app.on("activate", () => {
  if (win === null) {
    createWindow()
  }
})

// --- UYGULAMA KAPANIRKEN ---
app.on('before-quit', (e) => {
    if (pythonService) {
        autoUpdater.logger.info("Uygulama kapanıyor, Python servisi durduruluyor...")

        // Python'a JSON mesajı göndererek düzgün kapanmasını sağla
        try {
          pythonService.stdin.write(JSON.stringify({ action: "shutdown", data: null }) + '\n');
        } catch (err) {
           autoUpdater.logger.error("Python shutdown mesajı gönderilemedi, zorla kapatılıyor.");
           pythonService.kill('SIGTERM');
        }

        // Gerekirse bir süre bekleyip sonra zorla kapat
        setTimeout(() => {
          if (pythonService) {
             autoUpdater.logger.warn("Python servisi zamanında kapanmadı, zorla kapatılıyor.");
             pythonService.kill('SIGTERM');
          }
        }, 3000); // 3 saniye bekle
    }
});


// --- Auto-Updater Eventleri ---

autoUpdater.on("checking-for-update", () => {
  if (win) win.webContents.send("update-status", "checking")
})

autoUpdater.on("update-available", (info) => {
  if (win) win.webContents.send("update-available", info)
})

autoUpdater.on("update-not-available", (info) => {
  if (win) win.webContents.send("update-not-available", info)
})

autoUpdater.on("error", (err) => {
  if (win) win.webContents.send("update-error", err ? err.message : "Bilinmeyen güncelleme hatası")
})

autoUpdater.on("download-progress", (progressObj) => {
  if (win) win.webContents.send("update-download-progress", progressObj)
})

autoUpdater.on("update-downloaded", (info) => {
  if (win) win.webContents.send("update-downloaded", info)
})

// --- IPC Eventleri (Renderer -> Main) ---

// Renderer (page.tsx) hazır olduğunda Python'a haber ver
ipcMain.on("renderer-ready", () => {
  if (pythonService) {
    try {
      pythonService.stdin.write(JSON.stringify({ action: "renderer_ready", data: null }) + '\n');
    } catch(e) {
      autoUpdater.logger.error("Python'a 'renderer-ready' mesajı gönderilemedi.");
    }
  }
})

// Python'a komut göndermek için bir dinleyici
const sendToPython = (action, data) => {
  if (pythonService) {
    try {
      pythonService.stdin.write(JSON.stringify({ action, data }) + '\n');
    } catch (e) {
      autoUpdater.logger.error(`Python'a komut gönderilemedi (${action}): ${e}`);
    }
  } else {
    autoUpdater.logger.error(`Python servisi çalışmıyor. Komut gönderilemedi: ${action}`);
  }
}

// --- Renderer'dan Gelen Komutlar ---
ipcMain.on("perform-search", (event, searchTerm) => sendToPython("search", searchTerm))
ipcMain.on("cancel-search", () => sendToPython("cancel_search", null))
ipcMain.on("export-to-excel", (event, data) => sendToPython("export", data))
ipcMain.on("load-settings", () => sendToPython("load_settings", null))
ipcMain.on("save-settings", (event, settings) => sendToPython("save_settings", settings))
ipcMain.on("start-batch-search", (event, data) => sendToPython("start_batch_search", data))
ipcMain.on("cancel-batch-search", () => sendToPython("cancel_batch_search", null))
ipcMain.on("cancel-current-term-search", () => sendToPython("cancel_current_term_search", null))
ipcMain.on("get-parities", () => sendToPython("get_parities", null))
ipcMain.on("load-calendar-notes", () => sendToPython("load_calendar_notes", null))
ipcMain.on("save-calendar-notes", (event, notes) => sendToPython("save_calendar_notes", notes))
ipcMain.on("export-meetings", (event, data) => sendToPython("export_meetings", data))
ipcMain.on("check-notifications-now", () => sendToPython("check_notifications_now", null))

// Bildirim gösterme
ipcMain.on("show-notification", (event, data) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: data.title,
            body: data.body,
            icon: path.join(__dirname, "assets", "icon.png"),
        })
        notification.show()
        notification.on('click', () => {
            if (win) {
                win.show()
                // Gerekirse takvimde o tarihe gitmek için bir event gönderilebilir
                // win.webContents.send('go-to-calendar-date', data.noteDate);
            }
        });
    }
})

// Güncelle ve yeniden başlat komutu
ipcMain.on("restart-app-and-update", () => {
  autoUpdater.quitAndInstall()
})

// Dosya Seçme Diyaloğu
ipcMain.handle("select-file", async () => {
   const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Belgeler', extensions: ['xlsx', 'csv', 'docx'] },
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
})