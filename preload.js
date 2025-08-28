// Electron'un contextBridge ve ipcRenderer modüllerini içe aktar
const { contextBridge, ipcRenderer } = require('electron');

// Güvenli bir şekilde ana işlem (main.js) ile arayüz (renderer)
// arasında iletişim kuracak bir API oluştur
contextBridge.exposeInMainWorld('electronAPI', {
  // Arayüzden çağrılacak fonksiyon: performSearch
  // Bu fonksiyon, ana işleme 'perform-search' mesajı gönderir
  performSearch: (searchTerm) => ipcRenderer.send('perform-search', searchTerm),

  // Ana işlemden gelen arama sonuçlarını dinlemek için bir fonksiyon
  onResults: (callback) => ipcRenderer.on('search-results', (_event, value) => callback(value)),

  // Ana işlemden gelen hataları dinlemek için bir fonksiyon
  onSearchError: (callback) => ipcRenderer.on('search-error', (_event, value) => callback(value)),

  // YENİ: Arayüzden Excel'e aktarma işlemini tetiklemek için fonksiyon
  exportToExcel: (data) => ipcRenderer.send('export-to-excel', data),

  // YENİ: Ana işlemden gelen Excel aktarma sonucunu dinlemek için fonksiyon
  onExportResult: (callback) => ipcRenderer.on('export-result', (_event, value) => callback(value)),
});
