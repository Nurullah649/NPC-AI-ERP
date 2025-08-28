// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// 'win' ve 'pythonProcess' değişkenlerini global olarak tanımlıyoruz.
let win;
let pythonProcess = null;

/**
 * Python arka plan servisini başlatır.
 * Bu servis, tüm arama işlemlerini yönetir.
 */
function startPythonService() {
  const scriptPath = path.join(__dirname, 'desktop_app_electron.py');
  pythonProcess = spawn('python', [scriptPath]);
  console.log('Python arka plan servisi başlatıldı.');

  // Python'dan gelen logları (stderr) yakala ve terminale yazdır
  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON LOG]: ${data.toString()}`);
  });

  // --- PARSE HATASINI DÜZELTEN GÜNCELLEME ---
  let buffer = ''; // Gelen veri parçalarını biriktirmek için bir tampon (buffer) oluştur
  
  // Python'dan gelen sonucu (stdout) dinle
  pythonProcess.stdout.on('data', (data) => {
    // Gelen yeni veri parçasını tampona ekle
    buffer += data.toString();

    // Tamponda tam bir satır olup olmadığını kontrol et (JSON'lar satır sonu '\n' ile bitiyor)
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      // Tam satırı (JSON string'ini) al
      const completeJsonString = buffer.substring(0, boundary).trim();
      // Tampondan işlenen satırı çıkar, kalanı bir sonraki veri parçasıyla birleştirmek için sakla
      buffer = buffer.substring(boundary + 1);

      if (completeJsonString) {
        try {
          const jsonResult = JSON.parse(completeJsonString);
          console.log('Python\'dan tam bir sonuç alındı, arayüze gönderiliyor.');
          // Sonucu 'search-results' kanalıyla arayüze gönder
          win.webContents.send('search-results', jsonResult);
        } catch (error) {
            const errorMessage = 'Python betiğinden gelen sonuç parse edilemedi.';
            console.error(errorMessage, completeJsonString); // Hatalı string'i logla
            win.webContents.send('search-error', errorMessage);
        }
      }
      // Tamponda başka tam satır var mı diye döngüyü tekrar kontrol et
      boundary = buffer.indexOf('\n');
    }
  });
  // --- GÜNCELLEME SONU ---

  // Python işlemi beklenmedik bir şekilde kapanırsa
  pythonProcess.on('close', (code) => {
    console.error(`Python servisi ${code} koduyla sonlandı.`);
    pythonProcess = null; // İşlem sonlandığında referansı temizle
    win.webContents.send('search-error', 'Python arka plan servisi beklenmedik bir şekilde sonlandı.');
  });

  // Python işlemi başlatılamazsa
  pythonProcess.on('error', (err) => {
    console.error('Python servisi başlatılamadı:', err);
    win.webContents.send('search-error', `Python servisi başlatılamadı: ${err.message}`);
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
  win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  createWindow();
  startPythonService(); // Uygulama hazır olduğunda Python servisini başlat
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Uygulama kapandığında Python işlemini de sonlandır
app.on('window-all-closed', () => {
  if (pythonProcess) {
    console.log('Uygulama kapanıyor, Python servisi sonlandırılıyor.');
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Arayüzden 'perform-search' sinyali geldiğinde
ipcMain.on('perform-search', (event, searchTerm) => {
  if (pythonProcess && pythonProcess.stdin) {
    console.log(`Arama terimi Python'a gönderiliyor: ${searchTerm}`);
    // Arama terimini çalışan Python işleminin stdin'ine yaz
    pythonProcess.stdin.write(`${searchTerm}\n`);
  } else {
    const errorMessage = 'Python servisi çalışmıyor veya hazır değil. Arama yapılamadı.';
    console.error(errorMessage);
    win.webContents.send('search-error', errorMessage);
  }
});
