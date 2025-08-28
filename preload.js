// Electron'un contextBridge ve ipcRenderer modüllerini içe aktar
const { contextBridge, ipcRenderer } = require('electron');

// Güvenli bir şekilde ana işlem (main.js) ile arayüz (renderer)
// arasında iletişim kuracak bir API oluştur
contextBridge.exposeInMainWorld('electronAPI', {
  // Arama işlemini tetikler
  performSearch: (searchTerm) => ipcRenderer.send('perform-search', searchTerm),

  // YENİ: Gelen anlık verileri dinlemek için kanallar
  onDatabaseResults: (callback) => ipcRenderer.on('database-results', (_event, value) => callback(value)),
  onProductFound: (callback) => ipcRenderer.on('search-product-found', (_event, value) => callback(value)),
  onSearchProgress: (callback) => ipcRenderer.on('search-progress', (_event, value) => callback(value)),
  onSearchComplete: (callback) => ipcRenderer.on('search-complete', (_event, value) => callback(value)),

  // Hata ve Excel kanalları
  onSearchError: (callback) => ipcRenderer.on('search-error', (_event, value) => callback(value)),
  exportToExcel: (data) => ipcRenderer.send('export-to-excel', data),
  onExportResult: (callback) => ipcRenderer.on('export-result', (_event, value) => callback(value)),
});
