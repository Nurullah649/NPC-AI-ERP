// main.js

const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")
const fs = require("fs")
const { spawn, exec, execSync, execFileSync } = require("child_process")
const { StringDecoder } = require('string_decoder');

let win
let tray
let pythonProcess = null
let handshakeComplete = false // Arayüzün hazır olup olmadığını takip eder
let pendingRendererMessages = []
let pendingPythonCommands = []
let shutdownInProgress = false
let killTimer = null

const isDev = !app.isPackaged
const isLikelyWine = !!process.env.WINEPREFIX || !!process.env.WINELOADERNOEXEC

// Cache klasörünü yazılabilir kullanıcı alanına sabitle (Windows access denied/0x5 için).
const forcedUserDataDir = path.join(app.getPath("appData"), "NPC-AI-ERP")
const forcedCacheDir = path.join(forcedUserDataDir, "Cache")
fs.mkdirSync(forcedCacheDir, { recursive: true })
app.setPath("userData", forcedUserDataDir)
app.commandLine.appendSwitch("disk-cache-dir", forcedCacheDir)

if (isLikelyWine) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch("disable-gpu")
  app.commandLine.appendSwitch("disable-gpu-compositing")
  app.commandLine.appendSwitch("in-process-gpu")
  app.commandLine.appendSwitch("no-sandbox")
}

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'icon.png')
  : path.join(__dirname, '..', 'assets', 'icon.png');

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

function sendToRenderer(channel, payload) {
  if (!win || win.isDestroyed()) {
    return
  }

  if (!handshakeComplete) {
    pendingRendererMessages.push({ channel, payload })
    console.log(`Arayüz hazır değil, mesaj bekletiliyor: ${channel}`)
    return
  }

  win.webContents.send(channel, payload)
}

function flushPendingRendererMessages() {
  if (!win || win.isDestroyed() || !handshakeComplete || pendingRendererMessages.length === 0) {
    return
  }

  const messages = pendingRendererMessages
  pendingRendererMessages = []
  for (const { channel, payload } of messages) {
    win.webContents.send(channel, payload)
  }
}

function flushPendingPythonCommands() {
  if (!pythonProcess || !pythonProcess.stdin || pythonProcess.stdin.destroyed || pendingPythonCommands.length === 0) {
    return
  }

  const commands = pendingPythonCommands
  pendingPythonCommands = []
  for (const command of commands) {
    sendCommandToPython(command)
  }
}

function startPythonService() {
  if (pythonProcess) {
    console.log("Python servisi zaten çalışıyor.")
    return
  }
  const userDataPath = app.getPath('userData');
  let scriptPath
  if (isDev) {
    const pythonCmd = resolvePythonCommand()
    scriptPath = path.join(__dirname, "..", "python_backend", "main.py")
    pythonProcess = spawn(pythonCmd, ["-u", scriptPath, userDataPath])
  } else {
    const bundledExePath = path.join(process.resourcesPath, "bin", "desktop_app.exe")
    const bundledPyPath = path.join(process.resourcesPath, "python_backend", "main.py")
    if (fs.existsSync(bundledExePath)) {
      scriptPath = bundledExePath
      pythonProcess = spawn(scriptPath, [userDataPath])
    } else if (fs.existsSync(bundledPyPath)) {
      scriptPath = bundledPyPath
      const pythonCmd = resolvePythonCommand()
      ensureBundledPythonDeps(pythonCmd)
      pythonProcess = spawn(pythonCmd, ["-u", scriptPath, userDataPath])
      console.warn(`[PACKAGED FALLBACK] desktop_app.exe bulunamadı, script modunda başlatılıyor: ${bundledPyPath}`)
    } else {
      const errorMessage = "Python backend dosyası bulunamadı (desktop_app.exe / python_backend/main.py)."
      console.error(errorMessage)
      if (win && !win.isDestroyed()) {
        sendToRenderer("python-crashed", errorMessage)
      }
      return
    }
  }
  console.log(`Python arka plan servisi başlatılıyor: ${scriptPath}`)
  console.log(`Güvenli veri kayıt yolu: ${userDataPath}`);

  pythonProcess.on("error", (err) => {
    console.error("Python servisi başlatılamadı:", err)
    if (win && !win.isDestroyed()) {
      sendToRenderer("python-crashed", `Python başlatılamadı: ${err.message}`)
    }
  })
  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`)
  pythonProcess.stderr.on("data", (data) => {
    console.error(`[PYTHON HATA]: ${data.toString()}`)
  })
  const decoder = new StringDecoder('utf8');
  let buffer = ""
  pythonProcess.stdout.on("data", (data) => {
    buffer += decoder.write(data);
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
              new_settings_available: "new-settings-available",
              orkim_stock_result: "orkim-stock-result",
            }
            const channel = channels[type]

            if (type === "python_services_ready") {
              console.log("Python'dan 'python_services_ready' sinyali alındı. Arayüze 'services-ready' gönderiliyor.");
            }

            if (type === "show_notification" && data) {
              if (Notification.isSupported()) {
                const notification = new Notification({
                  title: data.title || "Görüşme Hatırlatması",
                  body: data.body || "",
                  icon: iconPath,
                  actions: [{ type: "button", text: "Tamamlandı Olarak İşaretle" }],
                })
                notification.on("action", (event, index) => {
                  if (index === 0) {
                    sendCommandToPython({ action: "mark_meeting_complete", data: { noteDate: data.noteDate, meetingId: data.meetingId } })
                  }
                })
                notification.show()
              }
            } else if (win && !win.isDestroyed() && channel) {
              if (type === "product_found" && context) {
                sendToRenderer(channel, { product: data.product, context: context })
              } else {
                sendToRenderer(channel, data)
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
      if (win.webContents) {
        sendToRenderer("python-crashed")
      }
    }
    pythonProcess = null
  })
  flushPendingPythonCommands()
}

function resolvePythonCommand() {
  if (process.env.NPC_AI_PYTHON) {
    return process.env.NPC_AI_PYTHON
  }

  const condaEnvName = process.env.NPC_AI_CONDA_ENV || "npcai"
  try {
    const output = execFileSync(
      "conda",
      ["run", "-n", condaEnvName, "python", "-c", "import sys; print(sys.executable)"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
    )
    const candidate = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop()
    if (candidate && fs.existsSync(candidate)) {
      console.log(`Python yorumlayıcısı conda ortamından seçildi (${condaEnvName}): ${candidate}`)
      return candidate
    }
  } catch (err) {
    console.warn(`Conda ortamı '${condaEnvName}' kullanılamadı, sistem Python'a geçiliyor: ${err.message}`)
  }

  return process.platform === "win32" ? "python" : "python3"
}

function ensureBundledPythonDeps(pythonCmd) {
  const runtimeDeps = [
    { module: "openpyxl", package: "openpyxl==3.1.5" },
    { module: "docx", package: "python-docx==1.2.0" },
    { module: "chardet", package: "chardet==5.2.0" },
    { module: "dotenv", package: "python-dotenv>=1.0.0" },
    { module: "thefuzz", package: "thefuzz==0.22.1" },
    { module: "googletrans", package: "googletrans==4.0.2" },
    { module: "langdetect", package: "langdetect==1.0.9" },
    { module: "requests", package: "requests>=2.31.0" },
    { module: "bs4", package: "beautifulsoup4==4.13.5" },
    { module: "lxml", package: "lxml==6.0.1" },
    { module: "PIL", package: "Pillow>=10.3.0,<13" },
    { module: "openai", package: "openai==1.106.1" },
    { module: "playwright", package: "playwright==1.58.0" },
    { module: "sqlalchemy", package: "SQLAlchemy==2.0.43" },
  ]

  const missingDeps = getMissingPythonDeps(pythonCmd, runtimeDeps)
  if (missingDeps.length === 0) {
    return
  }

  try {
    const runtimeRequirementsPath = path.join(process.resourcesPath, "python_backend", "runtime-requirements.txt")
    const pipArgs = ["-m", "pip", "install", "--disable-pip-version-check"]
    if (shouldUseUserPipInstall(pythonCmd)) {
      pipArgs.push("--user")
    }

    if (fs.existsSync(runtimeRequirementsPath)) {
      console.log(`Eksik Python bağımlılıkları kuruluyor (${missingDeps.map((dep) => dep.module).join(", ")}): ${runtimeRequirementsPath}`)
      execFileSync(pythonCmd, [...pipArgs, "-r", runtimeRequirementsPath], { stdio: "inherit" })
    } else {
      const packages = missingDeps.map((dep) => dep.package)
      console.log(`Eksik Python bağımlılıkları kuruluyor: ${packages.join(", ")}`)
      execFileSync(pythonCmd, [...pipArgs, ...packages], { stdio: "inherit" })
    }

    const stillMissing = getMissingPythonDeps(pythonCmd, runtimeDeps)
    if (stillMissing.length > 0) {
      console.error(`Python bağımlılık kurulumu tamamlanamadı. Eksikler: ${stillMissing.map((dep) => dep.module).join(", ")}`)
    } else {
      console.log("Python runtime bağımlılıkları hazır.")
    }
  } catch (err) {
    console.error("Python bağımlılık kurulumu başarısız:", err.message)
  }
}

function getMissingPythonDeps(pythonCmd, deps) {
  const modules = deps.map((dep) => dep.module)
  const checkScript = [
    "import importlib.util, json",
    `modules = ${JSON.stringify(modules)}`,
    "missing = [module for module in modules if importlib.util.find_spec(module) is None]",
    "print(json.dumps(missing))",
  ].join("\n")

  try {
    const output = execFileSync(pythonCmd, ["-c", checkScript], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    const missingModules = JSON.parse(output.trim() || "[]")
    return deps.filter((dep) => missingModules.includes(dep.module))
  } catch (err) {
    console.error(`Python import kontrolü çalıştırılamadı (${pythonCmd}):`, err.message)
    return deps
  }
}

function shouldUseUserPipInstall(pythonCmd) {
  const normalized = pythonCmd.replace(/\\/g, "/").toLowerCase()
  return !normalized.includes("/envs/")
}

const loadDevUrlWithRetry = () => {
  win.loadURL("http://localhost:3000").catch((err) => {
    console.log("Geliştirme sunucusu henüz hazır değil, 2 saniye sonra tekrar denenecek...")
    setTimeout(loadDevUrlWithRetry, 2000)
  })
}

function createWindow() {
  handshakeComplete = false
  pendingRendererMessages = []

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
      sandbox: false,
    },
  })
  win.once("ready-to-show", () => {
    win.show()
    startPythonService()
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
    win.loadFile(path.join(__dirname, "..", "out", "index.html"))
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

autoUpdater.on('update-available', (info) => sendToRenderer('update-available', info));
autoUpdater.on('update-not-available', (info) => sendToRenderer('update-not-available', info));
autoUpdater.on('download-progress', (progressObj) => sendToRenderer('update-download-progress', progressObj));
autoUpdater.on('update-downloaded', (info) => sendToRenderer('update-downloaded', info));
autoUpdater.on('error', (err) => sendToRenderer('update-error', err));
ipcMain.on('restart-app-and-update', () => { autoUpdater.quitAndInstall(); });

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

app.on("window-all-closed", () => { if (process.platform !== "darwin") { } })

function sendCommandToPython(command) {
  if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
    const commandString = JSON.stringify(command)
    pythonProcess.stdin.write(`${commandString}\n`)
  } else {
    if (command?.action !== "shutdown") {
      pendingPythonCommands.push(command)
      console.log(`Python servisi hazır değil, komut bekletiliyor: ${command?.action || "unknown"}`)
      return
    }
    console.error("Python servisi hazır değil veya zaten kapatılmış.")
  }
}

ipcMain.handle('get-app-version', () => app.getVersion());
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
    new Notification({ title: title, body: body, icon: iconPath }).show()
  }
})
ipcMain.on("get-orkim-stock", (event, productUrl) => sendCommandToPython({ action: "get_orkim_stock", data: { url: productUrl } }))
ipcMain.on('check-for-updates', () => { autoUpdater.checkForUpdates(); });

ipcMain.on('generate-pdf', async (event, { customerName, products }) => {
  const templatePath = path.join(__dirname, '..', 'assets', 'templates', 'invoice_template.html');
  const logoPath = path.join(__dirname, '..', 'assets', 'img', 'Tales_logo.png');

  try {
    let html = fs.readFileSync(templatePath, 'utf8');
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    html = html.replace('{{LOGO_SRC}}', `data:image/png;base64,${logoBase64}`);
    html = html.replace('{{MUSTERI_ADI}}', customerName || 'Değerli Müşterimiz');
    html = html.replace('{{TARIH}}', new Date().toLocaleDateString('tr-TR'));

    let total = 0;
    const productRows = products.map((p, index) => {
      const price = p.price_numeric || 0;
      total += price;
      return `
            <tr>
                <td>${index + 1}</td>
                <td>${p.product_name}</td>
                <td>${p.product_code}</td>
                <td>${p.unit}</td>
                <td>1</td>
                <td>${price.toFixed(2)} ${p.price_str.includes('€') ? 'EUR' : 'TRY'}</td>
                <td>${price.toFixed(2)} ${p.price_str.includes('€') ? 'EUR' : 'TRY'}</td>
            </tr>
        `;
    }).join('');

    html = html.replace('{{URUN_SATIRLARI}}', productRows);
    html = html.replace('{{TOPLAM_FIYAT}}', `${total.toFixed(2)} EUR`);

    const pdfPath = path.join(app.getPath('desktop'), `Teklif_${customerName.replace(/ /g, '_')}_${Date.now()}.pdf`);
    const pdfData = await win.webContents.printToPDF({
      marginsType: 0,
      pageSize: 'A4',
      printBackground: true,
    });

    fs.writeFileSync(pdfPath, pdfData);
    event.reply('generate-pdf-result', { status: 'success', path: pdfPath });
  } catch (error) {
    console.error('PDF oluşturulurken hata:', error);
    event.reply('generate-pdf-result', { status: 'error', message: error.message });
  }
});

// Arayüz hazır olduğunda bu olay tetiklenir.
ipcMain.on("renderer-ready", () => {
  console.log("Arayüz 'renderer-ready' sinyalini gönderdi.");
  handshakeComplete = true;
  flushPendingRendererMessages()
});
