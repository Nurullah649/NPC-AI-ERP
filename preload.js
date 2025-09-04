// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Tekrarlayan listener oluşturma kodunu basitleştiren bir yardımcı fonksiyon
const createListener = (channel) => (callback) => {
  const subscription = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, subscription);
  // Temizlik fonksiyonu: Component unmount olduğunda listener'ı kaldırmak için
  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
};

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Komut Gönderme (Renderer -> Main) ---
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  performSearch: (searchTerm) => ipcRenderer.send('perform-search', searchTerm),
  cancelSearch: () => ipcRenderer.send('cancel-search'),
  exportToExcel: (data) => ipcRenderer.send('export-to-excel', data),
  loadSettings: () => ipcRenderer.send('load-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),

  // --- Dinleyiciler (Main -> Renderer) ---
  onServicesReady: createListener('services-ready'),
  onInitialSetupRequired: createListener('initial-setup-required'),
  onProductFound: createListener('search-product-found'),
  onSearchComplete: createListener('search-complete'),
  onExportResult: createListener('export-result'),
  onSearchError: createListener('search-error'),
  onSettingsLoaded: createListener('settings-loaded'),
  onSettingsSaved: createListener('settings-saved'),
  onAuthenticationError: createListener('authentication-error'),
  onPythonCrashed: createListener('python-crashed'),
});
