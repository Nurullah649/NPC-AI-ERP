// main.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
// DEĞİŞİKLİK: senkron komut çalıştırmak için execSync eklendi.
const { spawn, exec, execSync } = require('child_process');

let win;
let pythonProcess = null;
let initialPythonStateMessage = null;
let handshakeComplete = false;

// UYGULAMANIN PAKETLENMİŞ OLUP OLMADIĞINI KONTROL EDEN DEĞİŞKEN
const isDev = !app.isPackaged;

function startPythonService() {
  if (pythonProcess) {
    console.log('Python servisi zaten çalışıyor.');
    return;
  }

  // Python betiğinin yolunu dinamik olarak belirle
  let scriptPath;
  if (isDev) {
    // Geliştirme ortamında, script ana dizinde
    scriptPath = path.join(__dirname, 'desktop_app_electron.py');
    pythonProcess = spawn('python', ['-u', scriptPath]);
  } else {
    // Paketlenmiş uygulamada, Python .exe'si 'resources' klasörünün içindeki 'bin' klasöründedir.
    // process.resourcesPath, 'resources' klasörünün yolunu verir.
    scriptPath = path.join(process.resourcesPath, 'bin', 'desktop_app.exe');
    pythonProcess = spawn(scriptPath);
  }

  console.log(`Python arka plan servisi başlatılıyor: ${scriptPath}`);

  pythonProcess.on('error', (err) => {
    console.error('Python servisi başlatılamadı:', err);
    // Hata durumunda kullanıcıya bilgi vermek için bir pencere gösterilebilir.
    if (win && !win.isDestroyed()) {
        win.webContents.send('python-crashed', `Python başlatılamadı: ${err.message}`);
    }
  });

  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`);

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON HATA]: ${data.toString()}`);
  });

  let buffer = '';
  pythonProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const completeJsonString = buffer.substring(0, boundary).trim();
      buffer = buffer.substring(boundary + 1);

      if (completeJsonString) {
        try {
          const message = JSON.parse(completeJsonString);
          if (message && typeof message === 'object' && message.type) {

            const { type, data, context } = message;
            const messagePayload = { ...message }; // Gelen mesajı kopyala

            const channels = {
              python_services_ready: 'services-ready',
              initial_setup_required: 'initial-setup-required',
              authentication_error: 'authentication-error',
              product_found: 'search-product-found',
              search_complete: 'search-complete',
              export_result: 'export-result',
              error: 'search-error',
              settings_loaded: 'settings-loaded',
              settings_saved: 'settings-saved',
              batch_search_progress: 'batch-search-progress',
              batch_search_complete: 'batch-search-complete',
              log_search_term: 'log-search-term', // YENİ: Arama kaydı kanalı
            };
            const channel = channels[type];

            const isStartupMessage = ['initial_setup_required', 'python_services_ready', 'authentication_error'].includes(type);

            if (isStartupMessage) {
                initialPythonStateMessage = { channel, data };
                if (handshakeComplete && win && !win.isDestroyed()) {
                    win.webContents.send(channel, data);
                }
            }
            else if (win && !win.isDestroyed() && channel) {
              // product_found mesajı için context'i de gönder
              if (type === 'product_found' && context) {
                  win.webContents.send(channel, { product: data.product, context: context });
              } else {
                  win.webContents.send(channel, data);
              }
            }
          }
        } catch (error) {
          console.error('Python\'dan gelen JSON parse edilemedi:', completeJsonString, error);
        }
      }
      boundary = buffer.indexOf('\n');
    }
  });

  pythonProcess.on('close', (code) => {
    console.error(`Python servisi ${code} koduyla sonlandı.`);
    if (win && !win.isDestroyed() && code !== 0) {
        initialPythonStateMessage = { channel: 'python-crashed', data: null };
        if (win.webContents) {
            win.webContents.send('python-crashed');
        }
    }
    pythonProcess = null;
  });
}

const loadDevUrlWithRetry = () => {
  win.loadURL('http://localhost:3000')
    .catch((err) => {
      console.log('Geliştirme sunucusu henüz hazır değil, 2 saniye sonra tekrar denenecek...');
      setTimeout(loadDevUrlWithRetry, 2000);
    });
};

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    startPythonService();
  });

  win.setMenu(null);

  if (isDev) {
    win.webContents.openDevTools();
    loadDevUrlWithRetry();
  } else {
    win.loadFile(path.join(__dirname,  'out', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('select-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
            { name: 'Documents', extensions: ['xlsx', 'csv', 'docx'] }
        ]
    });
    if (!canceled) {
        return filePaths[0];
    }
    return null;
  });

  ipcMain.once('renderer-ready', () => {
    console.log('Arayüz hazır. Saklanan ilk durum mesajı gönderiliyor (varsa).');
    handshakeComplete = true;
    if (win && !win.isDestroyed() && initialPythonStateMessage) {
        win.webContents.send(initialPythonStateMessage.channel, initialPythonStateMessage.data);
    }
  });

  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => {
  console.log('Uygulama kapanıyor, Python servisi ve alt işlemleri sonlandırılıyor...');

  sendCommandToPython({ action: 'shutdown' });

  if (pythonProcess && !pythonProcess.killed) {
    console.log(`Python işlemini (PID: ${pythonProcess.pid}) ve tüm alt işlemlerini sonlandırma garantisi alınıyor.`);
    try {
        if (process.platform === "win32") {
            execSync(`taskkill /PID ${pythonProcess.pid} /T /F`);
            console.log("taskkill komutu başarıyla çalıştırıldı ve tamamlandı.");
        } else {
            process.kill(-pythonProcess.pid, 'SIGKILL');
        }
    } catch (e) {
        console.error("Python işlemi sonlandırılırken bir hata oluştu:", e.message);
    }
    pythonProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function sendCommandToPython(command) {
  if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
    const commandString = JSON.stringify(command);
    pythonProcess.stdin.write(`${commandString}\n`);
  } else {
    console.error('Python servisi hazır değil veya zaten kapatılmış.');
  }
}

ipcMain.on('perform-search', (event, searchTerm) => sendCommandToPython({ action: 'search', data: searchTerm }));
ipcMain.on('cancel-search', () => sendCommandToPython({ action: 'cancel_search' }));
ipcMain.on('export-to-excel', (event, data) => sendCommandToPython({ action: 'export', data: data }));
ipcMain.on('load-settings', () => sendCommandToPython({ action: 'load_settings' }));
ipcMain.on('save-settings', (event, settings) => sendCommandToPython({ action: 'save_settings', data: settings }));
ipcMain.on('start-batch-search', (event, data) => sendCommandToPython({ action: 'start_batch_search', data: data }));
ipcMain.on('cancel-batch-search', () => sendCommandToPython({ action: 'cancel_batch_search' }));
ipcMain.on('cancel-current-term-search', () => sendCommandToPython({ action: 'cancel_current_term_search' }));
