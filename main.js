// main.js

const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require("electron")
// YENİ: autoUpdater eklendi
const { autoUpdater } = require("electron-updater")
const path = require("path")
const { spawn, exec, execSync } = require("child_process")

let win
let tray
let pythonProcess = null
let initialPythonStateMessage = null
let handshakeComplete = false
let shutdownInProgress = false
let killTimer = null

const isDev = !app.isPackaged

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'icon.png')
  : path.join(__dirname, 'assets', 'icon.png');

// --- YENİ: Güncelleme loglaması ---
autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

function executeFinalShutdown() {
    if (killTimer) {
        clearTimeout(killTimer)
        killTimer = null
    }
    console.log("Son kapatma işlemleri başlatılıyor.")
    if (pythonProcess && !pythonProcess.killed) {
        console.log(`Python işlemini (PID: ${pythonProcess.pid}) ve tüm alt işlemlerini zorla sonlandırılıyor.`)
        try {
            if (process.platform === "win32") {
                execSync(`taskkill /PID ${pythonProcess.pid} /T /F`)
            } else {
                process.kill(-pythonProcess.pid, "SIGKILL")
            }
        } catch (e) {
            console.error("Python işlem ağacı sonlandırılırken bir hata oluştu:", e.message)
        } finally {
            pythonProcess = null
        }
    }
    app.quit()
}

function startPythonService() {
  if (pythonProcess) {
    console.log("Python servisi zaten çalışıyor.")
    return
  }
  const userDataPath = app.getPath('userData');
  let scriptPath
  if (isDev) {
    scriptPath = path.join(__dirname, "desktop_app_electron.py")
    pythonProcess = spawn("python", ["-u", scriptPath, userDataPath])
  } else {
    scriptPath = path.join(process.resourcesPath, "bin", "desktop_app.exe")
    pythonProcess = spawn(scriptPath, [userDataPath])
  }
  console.log(`Python arka plan servisi başlatılıyor: ${scriptPath}`)
  console.log(`Güvenli veri kayıt yolu: ${userDataPath}`);

  pythonProcess.on("error", (err) => {
    console.error("Python servisi başlatılamadı:", err)
    if (win && !win.isDestroyed()) {
      win.webContents.send("python-crashed", `Python başlatılamadı: ${err.message}`)
    }
  })
  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`)
  pythonProcess.stderr.on("data", (data) => {
    console.error(`[PYTHON HATA]: ${data.toString()}`)
  })
  let buffer = ""
  pythonProcess.stdout.on("data", (data) => {
    buffer += data.toString()
    let boundary = buffer.indexOf("\n")
    while (boundary !== -1) {
      const completeJsonString = buffer.substring(0, boundary).trim()
      buffer = buffer.substring(boundary + 1)
      if (completeJsonString) {
        try {
          const message = JSON.parse(completeJsonString)
          if (message && typeof message === "object" && message.type) {
            const { type, data, context } = message
            if (type === 'python_shutdown_complete') {
                executeFinalShutdown();
                continue;
            }
            const channels = {
              python_services_ready: "services-ready",
              initial_setup_required: "initial-setup-required",
              authentication_error: "authentication-error",
              // license_error: "license-error", // YENİ SATIRI EKLEYİN
              product_found: "search-product-found",
              search_complete: "search-complete",
              export_result: "export-result",
              error: "search-error",
              settings_loaded: "settings-loaded",
              settings_saved: "settings-saved",
              batch_search_progress: "batch-search-progress",
              batch_search_complete: "batch-search-complete",
              log_search_term: "log-search-term",
              parities_updated: "parities-updated",
              calendar_notes_loaded: "calendar-notes-loaded",
              calendar_notes_saved: "calendar-notes-saved",
              show_notification: "show-notification",
              export_meetings_result: "export-meetings-result",
              // YENİ: Akıllı ayar yükseltme bildirimi
              new_settings_available: "new-settings-available",
              // YENİ: Orkim Stok Sonucu
              orkim_stock_result: "orkim-stock-result",
            }
            const channel = channels[type]
            const isStartupMessage = ["initial_setup_required", "python_services_ready", "authentication_error"/*, "license_error"*/].includes(type)
            if (isStartupMessage) {
              initialPythonStateMessage = { channel, data }
              if (handshakeComplete && win && !win.isDestroyed()) {
                win.webContents.send(channel, data)
              }
            } else if (type === "show_notification" && data) {
              if (Notification.isSupported()) {
                const notification = new Notification({
                  title: data.title || "Görüşme Hatırlatması",
                  body: data.body || "",
                  icon: iconPath,
                  actions: [{ type: "button", text: "Tamamlandı Olarak İşaretle" }],
                })
                notification.on("action", (event, index) => {
                  if (index === 0) {
                    sendCommandToPython({ action: "mark_meeting_complete", data: { noteDate: data.noteDate, meetingId: data.meetingId }})
                  }
                })
                notification.show()
              }
            } else if (win && !win.isDestroyed() && channel) {
              if (type === "product_found" && context) {
                win.webContents.send(channel, { product: data.product, context: context })
              } else {
                win.webContents.send(channel, data)
              }
            }
          }
        } catch (error) {
          console.error("Python'dan gelen JSON parse edilemedi:", completeJsonString, error)
        }
      }
      boundary = buffer.indexOf("\n")
    }
  })
  pythonProcess.on("close", (code) => {
    console.error(`Python servisi ${code} koduyla sonlandı.`)
    if (win && !win.isDestroyed() && code !== 0 && !shutdownInProgress) {
      initialPythonStateMessage = { channel: "python-crashed", data: `Arka plan servisi beklenmedik şekilde sonlandı (Kod: ${code}).` }
      if (win.webContents) {
        win.webContents.send("python-crashed")
      }
    }
    pythonProcess = null
  })
}

const loadDevUrlWithRetry = () => {
  win.loadURL("http://localhost:3000").catch((err) => {
    console.log("Geliştirme sunucusu henüz hazır değil, 2 saniye sonra tekrar denenecek...")
    setTimeout(loadDevUrlWithRetry, 2000)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#FFFFFF",
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  })
  win.once("ready-to-show", () => {
    win.show()
    startPythonService()
    // --- GÜNCELLEME: Daha fazla kontrol için manuel kontrolü tercih ediyoruz ---
    // autoUpdater.checkForUpdatesAndNotify(); // Bu satır yerine aşağıdaki kullanılır.
    autoUpdater.checkForUpdates();
  })
  win.on("close", (event) => {
    if (app.isQuitting) {
        win = null;
    } else {
        event.preventDefault();
        win.hide();
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'Uygulama Arka Planda',
                body: 'NPC-AI ERP arka planda çalışmaya devam ediyor. Tamamen kapatmak için sistem tepsisindeki ikona sağ tıklayın.',
                icon: iconPath
            });
            notification.show();
        }
    }
  });
  win.setMenu(null)
  if (isDev) {
    loadDevUrlWithRetry()
  } else {
    win.loadFile(path.join(__dirname, "out", "index.html"))
  }
}

app.whenReady().then(() => {
  createWindow()

  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Uygulamayı Göster', click: () => { if (win) { win.show() } } },
    { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit() } }
  ])
  tray.setToolTip('NPC-AI ERP')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { if (win) { win.isVisible() ? win.hide() : win.show() } })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (win) {
      win.show()
    }
  })
})

// --- YENİ: GÜNCELLEME OLAYLARI ---
// Bu olayları dinleyerek arayüze bilgi gönderiyoruz.
autoUpdater.on('update-available', (info) => {
  if(win) win.webContents.send('update-available', info);
});
autoUpdater.on('update-not-available', (info) => {
  if(win) win.webContents.send('update-not-available', info);
});
autoUpdater.on('download-progress', (progressObj) => {
  if(win) win.webContents.send('update-download-progress', progressObj);
});
autoUpdater.on('update-downloaded', (info) => {
  if(win) win.webContents.send('update-downloaded', info);
});
autoUpdater.on('error', (err) => {
  if(win) win.webContents.send('update-error', err);
});
// Arayüzden gelen yeniden başlatma komutunu dinle
ipcMain.on('restart-app-and-update', () => {
  autoUpdater.quitAndInstall();
});
// --- GÜNCELLEME OLAYLARI BİTİŞ ---

app.on("before-quit", (event) => {
  if (shutdownInProgress) return;
  console.log("Uygulama kapatma işlemi başlatıldı ('before-quit' olayı).");
  shutdownInProgress = true;
  app.isQuitting = true;
  event.preventDefault();
  sendCommandToPython({ action: "shutdown" });
  killTimer = setTimeout(() => {
    console.log("Python'dan zamanında yanıt alınamadı. Zorla kapatma işlemi tetikleniyor.");
    executeFinalShutdown();
  }, 4000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray icon mantığı yönetiyor
  }
})

function sendCommandToPython(command) {
  if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
    const commandString = JSON.stringify(command)
    pythonProcess.stdin.write(`${commandString}\n`)
  } else {
    console.error("Python servisi hazır değil veya zaten kapatılmış.")
  }
}

// --- YENİ: Uygulama versiyonunu döndüren handler ---
ipcMain.handle('get-app-version', () => app.getVersion());

// IPC Komutları...
// DEĞİŞİKLİK: 'searchTerm' yerine 'data' objesini al
ipcMain.on("perform-search", (event, data) => sendCommandToPython({ action: "search", data: data }))
ipcMain.on("cancel-search", () => sendCommandToPython({ action: "cancel_search" }))
ipcMain.on("export-to-excel", (event, data) => sendCommandToPython({ action: "export", data: data }))
ipcMain.on("load-settings", () => sendCommandToPython({ action: "load_settings" }))
ipcMain.on("save-settings", (event, settings) => sendCommandToPython({ action: "save_settings", data: settings }))
ipcMain.handle("select-file", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Documents", extensions: ["xlsx", "csv", "docx"] }],
    })
    if (!canceled) { return filePaths[0] } return null
})
ipcMain.on("start-batch-search", (event, data) => sendCommandToPython({ action: "start_batch_search", data: data }))
ipcMain.on("cancel-batch-search", () => sendCommandToPython({ action: "cancel_batch_search" }))
ipcMain.on("cancel-current-term-search", () => sendCommandToPython({ action: "cancel_current_term_search" }))
ipcMain.on("get-parities", () => sendCommandToPython({ action: "get_parities" }))
ipcMain.on("load-calendar-notes", () => sendCommandToPython({ action: "load_calendar_notes" }))
ipcMain.on("save-calendar-notes", (event, notes) => sendCommandToPython({ action: "save_calendar_notes", data: notes }))
ipcMain.on("export-meetings", (event, data) => sendCommandToPython({ action: "export_meetings", data: data }))
ipcMain.on("check-notifications-now", () => sendCommandToPython({ action: "check_notifications_now" }))
ipcMain.on("show-notification", (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: body,
            icon: iconPath,
        })
        notification.show()
    }
})

// YENİ: Orkim stok sorgulama
ipcMain.on("get-orkim-stock", (event, productUrl) => sendCommandToPython({ action: "get_orkim_stock", data: { url: productUrl } }))

// YENİ: Manuel güncelleme kontrolü
ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
});
ipcMain.once("renderer-ready", () => {
    console.log("Arayüz hazır. Saklanan ilk durum mesajı gönderiliyor (varsa).")
    handshakeComplete = true
    if (win && !win.isDestroyed() && initialPythonStateMessage) {
      win.webContents.send(initialPythonStateMessage.channel, initialPythonStateMessage.data)
    }
})
