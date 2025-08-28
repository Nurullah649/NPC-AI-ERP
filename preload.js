// Electron'un contextBridge ve ipcRenderer modüllerini içe aktar
const { contextBridge, ipcRenderer } = require('electron');

// Güvenli bir şekilde ana işlem (main.js) ile arayüz (renderer)
// arasında iletişim kuracak bir API oluştur
contextBridge.exposeInMainWorld('electronAPI', {
  // Arayüzden çağrılacak fonksiyon: performSearch
  // Bu fonksiyon, ana işleme 'perform-search' mesajı gönderir
  performSearch: (searchTerm) => ipcRenderer.send('perform-search', searchTerm),

  // Ana işlemden gelen sonuçları dinlemek için bir fonksiyon
  // Arayüzdeki JavaScript, bu fonksiyonu kullanarak sonuçları alacak bir dinleyici (listener) kurabilir
  onResults: (callback) => ipcRenderer.on('search-results', (_event, value) => callback(value)),

  // Ana işlemden gelen hataları dinlemek için bir fonksiyon
  onSearchError: (callback) => ipcRenderer.on('search-error', (_event, value) => callback(value)),
});
