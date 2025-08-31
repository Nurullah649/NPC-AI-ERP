// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
// const isDev = require('electron-is-dev'); // Kullanıcının isteği üzerine kaldırıldı.

let win;
let pythonProcess = null;

function startPythonService() {
  let pythonExecutable;

  // GÜNCELLEME: 'electron-is-dev' yerine Electron'un kendi 'app.isPackaged' özelliği kullanıldı.
  // app.isPackaged, uygulama paketlendiğinde 'true', geliştirme ortamında 'false' döner.
  if (!app.isPackaged) {
    const scriptPath = path.join(__dirname, 'desktop_app_electron.py');
    pythonProcess = spawn('python', ['-u', scriptPath]);
  } else {
    // process.resourcesPath, uygulamanın kök klasöründeki resources dizinini gösterir.
    const exePath = path.join(process.resourcesPath, 'bin', 'desktop_app.exe');
    pythonProcess = spawn(exePath);
  }

  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`);

  pythonProcess.stderr.on('data', (data) => {
    // stderr'den gelen logları "HATA" olarak etiketleyelim ki daha net görünsün.
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
            const { type, data } = message;
            if (win && !win.isDestroyed()) {
                if (type === 'services_ready' && data === true) {
                    console.log('Python servisleri hazır, React tarafına sinyal gönderiliyor.');
                    win.webContents.send('services-ready');
                    return; // "continue" yerine "return" daha güvenli olabilir.
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

  // GÜNCELLEME: 'isDev' yerine '!app.isPackaged' kullanıldı.
  if (!app.isPackaged) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'medical-chemical-sales', 'out', 'index.html'));
  }

  // YENİ: Paket uygulamasında hata ayıklamayı kolaylaştırmak için
  // Geliştirici Araçları'nı otomatik olarak açıyoruz.
  win.webContents.on('did-finish-load', () => {
    // GÜNCELLEME: '!isDev' yerine 'app.isPackaged' kullanıldı.

  });
}


app.whenReady().then(() => {
  createWindow();
  startPythonService();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    if (process.platform === "win32") {
      exec(`taskkill /PID ${pythonProcess.pid} /T /F`);
    } else {
      process.kill(-pythonProcess.pid, 'SIGINT');
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function sendCommandToPython(command) {
    if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
        const commandString = JSON.stringify(command);
        pythonProcess.stdin.write(`${commandString}\n`);
    } else {
        if (win && !win.isDestroyed()) {
            win.webContents.send('search-error', 'Python servisi hazır değil.');
        }
    }
}

ipcMain.on('perform-search', (event, searchTerm) => {
  sendCommandToPython({ action: 'search', data: searchTerm });
});

ipcMain.on('export-to-excel', (event, data) => {
  sendCommandToPython({ action: 'export', data: data });
});

