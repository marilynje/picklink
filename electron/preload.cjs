const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('picklink', {
  getBrowsers: () => ipcRenderer.invoke('browsers:list'),
  chooseBrowserExecutable: () => ipcRenderer.invoke('browsers:choose-executable'),
  openUrl: (browser, url, profile) => ipcRenderer.invoke('browser:open', { browser, url, profile }),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  registerAsBrowser: () => ipcRenderer.invoke('system:register-browser'),
  openDefaultApps: () => ipcRenderer.invoke('system:open-default-apps'),
  protocolStatus: () => ipcRenderer.invoke('system:protocol-status'),
  getInitialUrl: () => ipcRenderer.invoke('app:initial-url'),
  onUrl: (callback) => ipcRenderer.on('incoming-url', (_, url) => callback(url)),
  setPickerMode: (enabled) => ipcRenderer.invoke('window:set-picker-mode', enabled),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close')
})
