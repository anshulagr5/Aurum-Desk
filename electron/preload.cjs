const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aurumDesktop', {
  isDesktop: true,
  platform: process.platform,
  data: {
    load: () => ipcRenderer.invoke('aurum:data:load'),
    save: (data) => ipcRenderer.invoke('aurum:data:save', data),
    path: () => ipcRenderer.invoke('aurum:data:path'),
  },
  invoice: {
    selectDirectory: (currentPath) => ipcRenderer.invoke('aurum:invoice:select-directory', currentPath),
    savePdf: (payload) => ipcRenderer.invoke('aurum:invoice:save-pdf', payload),
  },
})
