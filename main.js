// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

let win;
let pythonProcess = null;

function startPythonService() {
  // Geliştirme ve paketlenmiş uygulama yollarını belirle
  if (!app.isPackaged) {
    const scriptPath = path.join(__dirname, 'desktop_app_electron.py');
    pythonProcess = spawn('python', ['-u', scriptPath]);
  } else {
    const exePath = path.join(process.resourcesPath, 'bin', 'desktop_app.exe');
    pythonProcess = spawn(exePath);
  }

  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`);

  // Python'dan gelen standart hata (stderr) akışını dinle
  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON HATA]: ${data.toString()}`);
  });

  // Python'dan gelen standart çıktı (stdout) akışını dinle
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
            const { type, data } = message;
            if (win && !win.isDestroyed()) {
                if (type === 'python_services_ready') {
                    if(data){
                        console.log('Python servisleri hazır, React tarafına sinyal gönderiliyor.');
                    } else {
                        console.error('Python servisleri BAŞLATILAMADI, React tarafına sinyal gönderiliyor.');
                    }
                    win.webContents.send('services-ready', data);
                    return;
                }

                const channelMap = {
                    database_results: 'database-results',
                    product_found: 'search-product-found',
                    progress: 'search-progress',
                    complete: 'search-complete',
                    export_result: 'export-result',
                    error: 'search-error'
                };
                const channel = channelMap[type];
                if (channel) {
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
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error('Python servisi başlatılamadı:', err);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  win.setMenu(null);

  if (!app.isPackaged) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'medical-chemical-sales', 'out', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  startPythonService();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// --- DÜZELTME BAŞLANGICI: Düzgün Kapatma Mantığı ---
let isQuitting = false;

app.on('before-quit', (event) => {
    if (isQuitting) {
        return;
    }
    event.preventDefault(); // Uygulamanın hemen kapanmasını engelle
    isQuitting = true;
    console.log('Uygulama kapanıyor, Python servisine kapatma komutu gönderiliyor...');

    if (pythonProcess && !pythonProcess.killed) {
        // Python işleminin kapanmasını dinle
        pythonProcess.on('close', () => {
            console.log('Python servisi kapandı. Uygulama sonlandırılıyor.');
            app.quit(); // Şimdi uygulamayı güvenle kapat
        });

        // Python'a kapatma komutunu gönder
        sendCommandToPython({ action: 'shutdown' });

        // Python'un yanıt vermemesi ihtimaline karşı bir zaman aşımı ayarla
        setTimeout(() => {
            console.log('Python servisi zamanında kapanmadı, zorla sonlandırılıyor.');
            if (pythonProcess && !pythonProcess.killed) {
                // taskkill komutu ile tüm alt süreçleri (chrome.exe) de sonlandır
                exec(`taskkill /PID ${pythonProcess.pid} /T /F`);
            }
            // Zaman aşımı sonrası uygulamayı her durumda kapat
            app.quit();
        }, 3000); // 3 saniye bekle
    } else {
        // Python süreci zaten yoksa, doğrudan çık
        app.quit();
    }
});

app.on('window-all-closed', () => {
  // macOS dışında, tüm pencereler kapandığında uygulamayı kapatma sürecini başlat
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
// --- DÜZELTME SONU ---

function sendCommandToPython(command) {
    if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
        const commandString = JSON.stringify(command);
        pythonProcess.stdin.write(`${commandString}\n`);
    } else {
        console.error('Python servisi hazır değil veya zaten kapatılmış.');
    }
}

ipcMain.on('perform-search', (event, searchTerm) => {
  sendCommandToPython({ action: 'search', data: searchTerm });
});

ipcMain.on('export-to-excel', (event, data) => {
  sendCommandToPython({ action: 'export', data: data });
});

