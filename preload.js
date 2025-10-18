// preload.js

const { contextBridge, ipcRenderer } = require("electron")

const createListener = (channel) => (callback) => {
  const subscription = (_event, ...args) => callback(...args)
  ipcRenderer.on(channel, subscription)
  return () => {
    ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  // --- Komut Gönderme (Renderer -> Main) ---
  rendererReady: () => ipcRenderer.send("renderer-ready"),
  performSearch: (searchTerm) => ipcRenderer.send("perform-search", searchTerm),
  cancelSearch: () => ipcRenderer.send("cancel-search"),
  exportToExcel: (data) => ipcRenderer.send("export-to-excel", data),
  loadSettings: () => ipcRenderer.send("load-settings"),
  saveSettings: (settings) => ipcRenderer.send("save-settings", settings),
  selectFile: () => ipcRenderer.invoke("select-file"),
  startBatchSearch: (data) => ipcRenderer.send("start-batch-search", data),
  cancelBatchSearch: () => ipcRenderer.send("cancel-batch-search"),
  cancelCurrentTermSearch: () => ipcRenderer.send("cancel-current-term-search"),
  getParities: () => ipcRenderer.send("get-parities"),
  loadCalendarNotes: () => ipcRenderer.send("load-calendar-notes"),
  saveCalendarNotes: (notes) => ipcRenderer.send("save-calendar-notes", notes),
  exportMeetings: (data) => ipcRenderer.send("export-meetings", data),
  checkNotificationsNow: () => ipcRenderer.send("check-notifications-now"),
  showNotification: (data) => ipcRenderer.send("show-notification", data),

  // YENİ: Güncelleme komutu
  restartAppAndUpdate: () => ipcRenderer.send("restart-app-and-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),


  // --- Dinleyiciler (Main -> Renderer) ---
  onServicesReady: createListener("services-ready"),
  onInitialSetupRequired: createListener("initial-setup-required"),
  onProductFound: createListener("search-product-found"),
  onSearchComplete: createListener("search-complete"),
  onExportResult: createListener("export-result"),
  onSearchError: createListener("search-error"),
  onSettingsLoaded: createListener("settings-loaded"),
  onSettingsSaved: createListener("settings-saved"),
  onAuthenticationError: createListener("authentication-error"),
  onPythonCrashed: createListener("python-crashed"),
  onBatchSearchProgress: createListener("batch-search-progress"),
  onBatchSearchComplete: createListener("batch-search-complete"),
  onLogSearchTerm: createListener("log-search-term"),
  onParitiesUpdated: createListener("parities-updated"),
  onCalendarNotesLoaded: createListener("calendar-notes-loaded"),
  onCalendarNotesSaved: createListener("calendar-notes-saved"),
  onShowNotification: createListener("show-notification"),
  onExportMeetingsResult: createListener("export-meetings-result"),

  // YENİ: Güncelleme dinleyicileri
  onUpdateAvailable: createListener("update-available"),
  onUpdateNotAvailable: createListener("update-not-available"),
  onUpdateDownloadProgress: createListener("update-download-progress"),
  onUpdateDownloaded: createListener("update-downloaded"),
  onUpdateError: createListener("update-error"),

  // YENİ: Python'dan gelen yeni ayar bildirimi
  onNewSettingsAvailable: createListener("new-settings-available"),
})
