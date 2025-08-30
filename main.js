// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

let win;
let pythonProcess = null;

function startPythonService() {
  const scriptPath = path.join(__dirname, 'desktop_app_electron.py');
  pythonProcess = spawn('python', ['-u', scriptPath]);
  console.log(`Python arka plan servisi başlatıldı. PID: ${pythonProcess.pid}`);

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON LOG]: ${data.toString()}`);
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
                    continue;
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
                } else {
                    console.warn(`Python'dan bilinmeyen mesaj türü alındı: ${type}`);
                }
            }
          } else {
             console.error('Python\'dan gelen JSON beklenen formatta değil:', completeJsonString);
          }
        } catch (error) {
            console.error('Python\'dan gelen JSON parse edilemedi:', completeJsonString, error);
            if (win && !win.isDestroyed()) {
                win.webContents.send('search-error', 'Python\'dan gelen veri anlaşılamadı.');
            }
        }
      }
      boundary = buffer.indexOf('\n');
    }
  });

  pythonProcess.on('close', (code) => {
    console.error(`Python servisi ${code} koduyla sonlandı.`);
    pythonProcess = null;
    if (win && !win.isDestroyed()) {
        win.webContents.send('search-error', 'Arka plan servisi beklenmedik bir şekilde sonlandı.');
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('Python servisi başlatılamadı:', err);
    if (win && !win.isDestroyed()) {
        win.webContents.send('search-error', `Arka plan servisi başlatılamadı: ${err.message}`);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF',
    icon: path.join(__dirname, 'icon.png'), // DÜZENLEME: Uygulama ikonu eklendi.
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  win.setMenu(null);

  win.loadURL('http://localhost:3000');

  win.webContents.on('did-finish-load', () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  startPythonService();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    console.log(`Uygulama kapanıyor, Python servisi (PID: ${pythonProcess.pid}) ve alt işlemleri sonlandırılıyor.`);
    if (process.platform === "win32") {
      exec(`taskkill /PID ${pythonProcess.pid} /T /F`, (err, stdout, stderr) => {
        if (err) {
          console.error("Python işlemini sonlandırırken hata oluştu (taskkill):", stderr);
        } else {
          console.log("Python işlemi ve alt işlemleri başarıyla sonlandırıldı.", stdout);
        }
      });
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
        const errorMessage = 'Python servisi hazır değil veya başlatılamadı.';
        if (win && !win.isDestroyed()) {
            win.webContents.send('search-error', errorMessage);
        }
    }
}

ipcMain.on('perform-search', (event, searchTerm) => {
  sendCommandToPython({ action: 'search', data: searchTerm });
});

ipcMain.on('export-to-excel', (event, data) => {
  sendCommandToPython({ action: 'export', data: data });
});
