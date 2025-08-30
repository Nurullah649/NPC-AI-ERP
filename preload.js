// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Listener'ları yönetmek için bir yardımcı fonksiyon.
// Bu, her 'on...' fonksiyonu için tekrar eden kodu azaltır ve listener temizleme özelliği ekler.
const createListener = (channel) => (callback) => {
  // Electron'dan gelen 'event' argümanını atlayıp sadece asıl veriyi ('...args') callback'e iletiyoruz.
  const subscription = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, subscription);

  // React'in useEffect cleanup'ı için bir kaldırma fonksiyonu döndürüyoruz.
  // Bu, component kaldırıldığında listener'ın da bellekten silinmesini sağlar.
  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
};

// Güvenli bir şekilde ana işlem (main.js) ile arayüz (renderer)
// arasında iletişim kuracak bir API oluştur
contextBridge.exposeInMainWorld('electronAPI', {
  // Main process'e komut göndermek için fonksiyonlar
  performSearch: (searchTerm) => ipcRenderer.send('perform-search', searchTerm),
  exportToExcel: (data) => ipcRenderer.send('export-to-excel', data),

  // Gelen verileri dinlemek için kanallar
  // YENİ: Servislerin hazır olduğunu bildiren kanal
  onServicesReady: createListener('services-ready'),

  // Mevcut kanallarınız
  onDatabaseResults: createListener('database-results'),
  onProductFound: createListener('search-product-found'),
  onSearchProgress: createListener('search-progress'),
  onSearchComplete: createListener('search-complete'),
  onExportResult: createListener('export-result'),
  onSearchError: createListener('search-error'),
});

