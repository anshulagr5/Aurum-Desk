const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { getDatabasePath, loadData, saveData } = require('./db.cjs')
const { openDatabase } = require('./db.cjs') // export it


// Ensure consistent app name so userData path is stable across dev and production
app.name = 'Aurum Desk'

function sanitizeFileName(fileName) {
  const cleaned = String(fileName ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .trim()

  return cleaned || 'invoice.pdf'
}

async function selectInvoiceDirectory(currentPath) {
  const [window] = BrowserWindow.getAllWindows()
  const result = await dialog.showOpenDialog(window, {
    title: 'Choose invoice save folder',
    defaultPath: currentPath || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}

async function saveInvoicePdf({ directoryPath, fileName, buffer }) {
  const targetDirectory = String(directoryPath ?? '').trim()
  if (!targetDirectory) {
    throw new Error('Invoice directory is required.')
  }

  await fs.mkdir(targetDirectory, { recursive: true })
  const targetFilePath = path.join(targetDirectory, sanitizeFileName(fileName))
  await fs.writeFile(targetFilePath, Buffer.from(buffer))
  return { filePath: targetFilePath }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: '#f3ead8',
    title: 'Aurum Desk',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.webContents.on('dom-ready', () => {
    window.webContents.setZoomFactor(0.8)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('aurum:data:load', async () => loadData())
  ipcMain.handle('aurum:data:save', async (_event, data) => {
    await saveData(data)
  })
  ipcMain.handle('aurum:data:path', async () => getDatabasePath())
  ipcMain.handle('aurum:invoice:select-directory', async (_event, currentPath) => selectInvoiceDirectory(currentPath))
  ipcMain.handle('aurum:invoice:save-pdf', async (_event, payload) => saveInvoicePdf(payload))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  event.preventDefault()
    const db = await openDatabase()
    await persistDatabase(db)
  app.exit()
})
