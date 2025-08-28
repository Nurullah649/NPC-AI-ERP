// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// GÜNCELLEME: 'exec' fonksiyonu eklendi.
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
          const { type, data } = message;

          switch (type) {
            case 'database_results':
              win.webContents.send('database-results', data);
              break;
            case 'product_found':
              win.webContents.send('search-product-found', data);
              break;
            case 'progress':
              win.webContents.send('search-progress', data);
              break;
            case 'complete':
              win.webContents.send('search-complete', data);
              break;
            case 'export_result':
              win.webContents.send('export-result', data);
              break;
            case 'error':
               win.webContents.send('search-error', data);
               break;
            default:
              console.warn(`Python'dan bilinmeyen mesaj türü alındı: ${type}`);
          }
        } catch (error) {
            console.error('Python\'dan gelen JSON parse edilemedi:', completeJsonString, error);
            win.webContents.send('search-error', 'Python\'dan gelen veri anlaşılamadı.');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  // Geliştirme için: win.loadURL('http://localhost:3000');
  win.loadFile(path.join(__dirname, '../renderer/build/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  startPythonService();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// GÜNCELLEME: Uygulama kapandığında Python işlemini ve TÜM ALT İŞLEMLERİNİ sonlandır.
app.on('window-all-closed', () => {
  if (pythonProcess) {
    console.log(`Uygulama kapanıyor, Python servisi (PID: ${pythonProcess.pid}) ve alt işlemleri sonlandırılıyor.`);

    // Windows için özel ve daha güvenilir kapatma komutu
    if (process.platform === "win32") {
      // /T -> İşlemi ve başlattığı tüm alt işlemleri sonlandırır. (En önemlisi bu)
      // /F -> İşlemi zorla sonlandırır.
      exec(`taskkill /PID ${pythonProcess.pid} /T /F`, (err, stdout, stderr) => {
        if (err) {
          console.error("Python işlemini sonlandırırken hata oluştu (taskkill):", err);
          return;
        }
        console.log("Python işlemi ve alt işlemleri başarıyla sonlandırıldı.", stdout);
      });
    } else {
      // macOS ve Linux için standart kill komutu genellikle yeterlidir.
      pythonProcess.kill('SIGINT');
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
        const errorMessage = 'Python servisi hazır değil.';
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
