// main.js

const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require("electron")
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

// --- MERKEZİ İKON YOLU TANIMI ---
// Bu değişken, uygulamanın paketlenmiş olup olmamasına göre doğru yolu kendisi bulur.
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'icon.png') // Kurulum sonrası
  : path.join(__dirname, 'assets', 'icon.png');            // Geliştirme sırasında

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
                console.log("Python işlem ağacı başarıyla sonlandırıldı.")
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

  let scriptPath
  if (isDev) {
    scriptPath = path.join(__dirname, "desktop_app_electron.py")
    pythonProcess = spawn("python", ["-u", scriptPath])
  } else {
    scriptPath = path.join(process.resourcesPath, "bin", "desktop_app.exe")
    pythonProcess = spawn(scriptPath)
  }

  console.log(`Python arka plan servisi başlatılıyor: ${scriptPath}`)

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

            // Intercept shutdown message from Python
            if (type === 'python_shutdown_complete') {
                console.log("Python'dan 'shutdown complete' onayı alındı.");
                executeFinalShutdown();
                continue; // Don't forward this to renderer.
            }

            const channels = {
              python_services_ready: "services-ready",
              initial_setup_required: "initial-setup-required",
              authentication_error: "authentication-error",
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
            }
            const channel = channels[type]

            const isStartupMessage = [
              "initial_setup_required",
              "python_services_ready",
              "authentication_error",
            ].includes(type)

            if (isStartupMessage) {
              initialPythonStateMessage = { channel, data }
              if (handshakeComplete && win && !win.isDestroyed()) {
                win.webContents.send(channel, data)
              }
            } else if (type === "show_notification" && data) {
              if (Notification.isSupported()) {
                const notification = new Notification({
                  title: data.title || "Görüşme Hatırlatması",
                  subtitle: data.subtitle || "",
                  body: data.body || "",
                  icon: iconPath,
                  actions: [{ type: "button", text: "Tamamlandı Olarak İşaretle" }],
                })

                notification.on("action", (event, index) => {
                  if (index === 0) {
                    sendCommandToPython({
                      action: "mark_meeting_complete",
                      data: {
                        noteDate: data.noteDate,
                        meetingId: data.meetingId,
                      },
                    })
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
      initialPythonStateMessage = { channel: "python-crashed", data: null }
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
  ipcMain.handle("select-file", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Documents", extensions: ["xlsx", "csv", "docx"] }],
    })
    if (!canceled) {
      return filePaths[0]
    }
    return null
  })

  ipcMain.once("renderer-ready", () => {
    console.log("Arayüz hazır. Saklanan ilk durum mesajı gönderiliyor (varsa).")
    handshakeComplete = true
    if (win && !win.isDestroyed() && initialPythonStateMessage) {
      win.webContents.send(initialPythonStateMessage.channel, initialPythonStateMessage.data)
    }
  })

  createWindow()

  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Uygulamayı Göster',
      click: () => {
        if (win) {
          win.show()
        }
      }
    },
    {
      label: 'Çıkış',
      click: () => {
        app.quit()
      }
    }
  ])
  tray.setToolTip('NPC-AI ERP')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.hide() : win.show()
    }
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (win) {
      win.show()
    }
  })
})

app.on("before-quit", (event) => {
  if (shutdownInProgress) {
    return; // Already handling shutdown, let it finish.
  }

  console.log("Uygulama kapatma işlemi başlatıldı ('before-quit' olayı).");
  shutdownInProgress = true;
  app.isQuitting = true; // Signal intent to quit for other event handlers like 'close'.

  // Prevent immediate quitting to allow for cleanup.
  event.preventDefault();

  // 1. Send graceful shutdown command to Python
  console.log("Python'a graceful shutdown komutu gönderiliyor...");
  sendCommandToPython({ action: "shutdown" });

  // 2. Set a fallback timer in case Python becomes unresponsive
  killTimer = setTimeout(() => {
    console.log("Python'dan zamanında yanıt alınamadı. Zorla kapatma işlemi tetikleniyor.");
    executeFinalShutdown();
  }, 4000); // 4 seconds timeout
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // This is handled by the tray icon logic now.
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

ipcMain.on("perform-search", (event, searchTerm) => sendCommandToPython({ action: "search", data: searchTerm }))
ipcMain.on("cancel-search", () => sendCommandToPython({ action: "cancel_search" }))
ipcMain.on("export-to-excel", (event, data) => sendCommandToPython({ action: "export", data: data }))
ipcMain.on("load-settings", () => sendCommandToPython({ action: "load_settings" }))
ipcMain.on("save-settings", (event, settings) => sendCommandToPython({ action: "save_settings", data: settings }))
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

