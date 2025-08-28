// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// 'win' ve 'pythonProcess' değişkenlerini global olarak tanımlıyoruz.
let win;
let pythonProcess = null;

/**
 * Python arka plan servisini başlatır.
 * Bu servis, tüm arama ve dışa aktarma işlemlerini yönetir.
 */
function startPythonService() {
  const scriptPath = path.join(__dirname, 'desktop_app_electron.py');
  pythonProcess = spawn('python', ['-u', scriptPath]); // '-u' parametresi I/O buffer'ını kapatır, anlık iletişim için önemlidir.
  console.log('Python arka plan servisi başlatıldı.');

  // Python'dan gelen logları (stderr) yakala ve terminale yazdır
  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON LOG]: ${data.toString()}`);
  });

  let buffer = ''; // Gelen veri parçalarını biriktirmek için bir tampon (buffer) oluştur

  // Python'dan gelen sonucu (stdout) dinle
  pythonProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const completeJsonString = buffer.substring(0, boundary).trim();
      buffer = buffer.substring(boundary + 1);

      if (completeJsonString) {
        try {
          const jsonResult = JSON.parse(completeJsonString);

          // GÜNCELLEME: Gelen JSON'ın yapısını kontrol ederek hangi kanala göndereceğimizi belirliyoruz.
          if (jsonResult.status) {
            // Bu bir Excel dışa aktarma sonucudur.
            console.log('Python\'dan Excel dışa aktarma sonucu alındı, arayüze gönderiliyor.');
            win.webContents.send('export-result', jsonResult);
          } else if ('results' in jsonResult) {
            // Bu bir arama sonucudur.
            console.log('Python\'dan arama sonucu alındı, arayüze gönderiliyor.');
            win.webContents.send('search-results', jsonResult);
          } else if (jsonResult.error) {
             console.error('Python betiği bir hata bildirdi:', jsonResult.error);
             win.webContents.send('search-error', jsonResult.error);
          } else {
            console.warn('Python\'dan bilinmeyen formatta bir JSON geldi:', jsonResult);
          }

        } catch (error) {
            const errorMessage = 'Python betiğinden gelen sonuç parse edilemedi.';
            console.error(errorMessage, completeJsonString); // Hatalı string'i logla
            win.webContents.send('search-error', errorMessage);
        }
      }
      boundary = buffer.indexOf('\n');
    }
  });

  pythonProcess.on('close', (code) => {
    console.error(`Python servisi ${code} koduyla sonlandı.`);
    pythonProcess = null;
    if (win && !win.isDestroyed()) {
        win.webContents.send('search-error', 'Python arka plan servisi beklenmedik bir şekilde sonlandı.');
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('Python servisi başlatılamadı:', err);
    if (win && !win.isDestroyed()) {
        win.webContents.send('search-error', `Python servisi başlatılamadı: ${err.message}`);
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
  // Geliştirme ortamı için localhost, build sonrası için ise dosya yolu kullanılır.
  win.loadURL('http://localhost:3000');
  // win.loadFile(path.join(__dirname, '../renderer/build/index.html')); // React build klasörünüzün yolunuza göre güncelleyin
}

app.whenReady().then(() => {
  createWindow();
  startPythonService();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    console.log('Uygulama kapanıyor, Python servisi sonlandırılıyor.');
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// GÜNCELLEME: Arayüzden gelen istekler artık JSON formatında komut olarak gönderiliyor.
function sendCommandToPython(command) {
    if (pythonProcess && pythonProcess.stdin && !pythonProcess.stdin.destroyed) {
        const commandString = JSON.stringify(command);
        console.log(`Python'a komut gönderiliyor: ${commandString}`);
        pythonProcess.stdin.write(`${commandString}\n`);
    } else {
        const errorMessage = 'Python servisi çalışmıyor veya hazır değil. İşlem yapılamadı.';
        console.error(errorMessage);
        if (win && !win.isDestroyed()) {
            win.webContents.send('search-error', errorMessage);
        }
    }
}

// Arayüzden 'perform-search' sinyali geldiğinde
ipcMain.on('perform-search', (event, searchTerm) => {
  sendCommandToPython({ action: 'search', data: searchTerm });
});

// YENİ: Arayüzden 'export-to-excel' sinyali geldiğinde
ipcMain.on('export-to-excel', (event, data) => {
  sendCommandToPython({ action: 'export', data: data });
});
