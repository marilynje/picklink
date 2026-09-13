const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const { execFile, execFileSync } = require('child_process')
let mainWindow
let pendingUrl = process.argv.find(value => /^https?:\/\//i.test(value))

const candidates = [
  { id: 'edge', name: 'Microsoft Edge', color: '#0aa4e8', paths: ['Microsoft/Edge/Application/msedge.exe'] },
  { id: 'chrome', name: 'Google Chrome', color: '#f4b400', paths: ['Google/Chrome/Application/chrome.exe'] },
  { id: 'firefox', name: 'Mozilla Firefox', color: '#ff7139', paths: ['Mozilla Firefox/firefox.exe'] },
  { id: 'brave', name: 'Brave', color: '#fb542b', paths: ['BraveSoftware/Brave-Browser/Application/brave.exe'] },
  { id: 'opera', name: 'Opera', color: '#fa1e4e', paths: ['Opera/launcher.exe'] },
  { id: 'vivaldi', name: 'Vivaldi', color: '#ef3939', paths: ['Vivaldi/Application/vivaldi.exe'] },
  { id: 'yandex', name: 'Yandex Browser', color: '#fc3f1d', paths: ['Yandex/YandexBrowser/Application/browser.exe'] },
  { id: 'arc', name: 'Arc', color: '#6f61e8', paths: ['TheBrowserCompany/Arc/Arc.exe'] },
  { id: 'waterfox', name: 'Waterfox', color: '#2559d6', paths: ['Waterfox/waterfox.exe'] },
  { id: 'librewolf', name: 'LibreWolf', color: '#00ac83', paths: ['LibreWolf/librewolf.exe'] }
]

function knownBrowser(executable, registryName = '') {
  const value = `${registryName} ${path.basename(executable)}`.toLowerCase()
  return candidates.find(item => value.includes(item.id) || (item.id === 'edge' && value.includes('msedge')) || (item.id === 'yandex' && value.includes('browser.exe') && value.includes('yandex')))
}

function queryRegistry(root) {
  return new Promise(resolve => execFile('reg.exe', ['query', root, '/s'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
    if (error) return resolve([])
    const lines = stdout.split(/\r?\n/)
    const found = []
    let key = ''
    for (const line of lines) {
      if (/^HKEY_/i.test(line.trim())) key = line.trim()
      if (!/\\shell\\open\\command$/i.test(key)) continue
      const match = line.match(/^\s*(?:\(Default\)|@)\s+REG_\w+\s+(.+)$/i)
      if (!match) continue
      const command = match[1].trim().replace(/^"/, '')
      const executable = command.split(/\.exe"?/i)[0] + '.exe'
      if (fs.existsSync(executable)) {
        const parts = key.split('\\')
        const rootIndex = parts.findIndex(part => part.toLowerCase() === 'startmenuinternet')
        found.push({ executable, registryName: parts[rootIndex + 1] || path.basename(executable, '.exe') })
      }
    }
    resolve(found)
  }))
}

async function browserList() {
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  const fallback = candidates.map(browser => {
    const executable = roots.flatMap(root => browser.paths.map(p => path.join(root, p))).find(fs.existsSync)
    return { ...browser, executable: executable || '', installed: Boolean(executable) }
  }).filter(b => b.installed)
  const registry = (await Promise.all([
    queryRegistry('HKCU\\Software\\Clients\\StartMenuInternet'),
    queryRegistry('HKLM\\Software\\Clients\\StartMenuInternet'),
    queryRegistry('HKLM\\Software\\WOW6432Node\\Clients\\StartMenuInternet')
  ])).flat()
  const combined = [...registry.filter(entry => path.basename(entry.executable).toLowerCase() !== 'iexplore.exe').map(entry => {
    const known = knownBrowser(entry.executable, entry.registryName)
    const stableId = path.basename(entry.executable, '.exe').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return { id: known?.id || stableId, name: known?.name || entry.registryName.replace(/HTML$/i, ''), color: known?.color || '#6f61e8', executable: entry.executable, installed: true }
  }), ...fallback]
  const unique = combined.filter((item, index, list) => list.findIndex(other => other.executable.toLowerCase() === item.executable.toLowerCase()) === index)
  return Promise.all(unique.map(async browser => {
    let icon = ''
    try { icon = (await app.getFileIcon(browser.executable, { size: 'large' })).toDataURL() } catch {}
    return { ...browser, icon, profiles: discoverProfiles(browser) }
  }))
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }
function chromiumDataDir(browser) {
  const local = process.env.LOCALAPPDATA || ''
  const roaming = process.env.APPDATA || ''
  const map = {
    edge: path.join(local, 'Microsoft/Edge/User Data'), chrome: path.join(local, 'Google/Chrome/User Data'),
    brave: path.join(local, 'BraveSoftware/Brave-Browser/User Data'), vivaldi: path.join(local, 'Vivaldi/User Data'),
    yandex: path.join(local, 'Yandex/YandexBrowser/User Data'), arc: path.join(local, 'TheBrowserCompany/Arc/User Data'),
    opera: path.join(roaming, 'Opera Software/Opera Stable')
  }
  return map[browser.id]
}
function discoverProfiles(browser) {
  if (['firefox', 'waterfox', 'librewolf'].includes(browser.id)) {
    const vendor = browser.id === 'firefox' ? 'Mozilla/Firefox' : browser.id === 'waterfox' ? 'Waterfox' : 'LibreWolf'
    const ini = path.join(process.env.APPDATA || '', vendor, 'profiles.ini')
    try {
      return fs.readFileSync(ini, 'utf8').split(/\r?\n/).filter(line => /^Name=/i.test(line)).map((line, index) => ({ id: `profile-${index}`, name: line.slice(5), argument: '-P' }))
    } catch { return [] }
  }
  const dataDir = chromiumDataDir(browser)
  if (!dataDir) return []
  const cache = readJson(path.join(dataDir, 'Local State'))?.profile?.info_cache || {}
  const profiles = Object.entries(cache).map(([directory, data]) => ({ id: directory, name: data.name || directory, argument: `--profile-directory=${directory}` }))
  if (!profiles.length && fs.existsSync(dataDir)) profiles.push({ id: 'Default', name: 'Основной', argument: '--profile-directory=Default' })
  return profiles
}

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json') }
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) } catch { return null }
}

function createWindow() {
  const startsInPickerMode = Boolean(pendingUrl)
  const win = new BrowserWindow({
    width: startsInPickerMode ? 520 : 1120, height: startsInPickerMode ? 430 : 760,
    minWidth: startsInPickerMode ? 520 : 900, minHeight: startsInPickerMode ? 430 : 620,
    frame: false, backgroundColor: '#f7f7f8', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  mainWindow = win
  const dev = process.env.NODE_ENV !== 'production' && !app.isPackaged
  dev ? win.loadURL('http://localhost:5173') : win.loadFile(path.join(__dirname, '../app-dist/index.html'))
  if (startsInPickerMode) { win.setResizable(false); win.center() }
  win.once('ready-to-show', () => win.show())
}

function setPickerMode(win, enabled) {
  if (!win || win.isDestroyed()) return false
  if (enabled) {
    win.setMinimumSize(520, 430)
    win.setResizable(false)
    win.setSize(520, 430)
    win.center()
  } else {
    win.setResizable(true)
    win.setMinimumSize(900, 620)
    win.setSize(1120, 760)
    win.center()
  }
  return true
}

function regAdd(key, name, value) {
  const args = ['add', key, '/f']
  if (name === '') args.push('/ve')
  else args.push('/v', name)
  args.push('/t', 'REG_SZ', '/d', value)
  execFileSync('reg.exe', args, { windowsHide: true, stdio: 'ignore' })
}
function registerAsBrowser() {
  if (!app.isPackaged) return false
  const executable = process.execPath
  const command = `"${executable}" "%1"`
  try {
    regAdd('HKCU\\Software\\Classes\\PicklinkURL', '', 'Picklink URL Handler')
    regAdd('HKCU\\Software\\Classes\\PicklinkURL', 'URL Protocol', '')
    regAdd('HKCU\\Software\\Classes\\PicklinkURL\\DefaultIcon', '', `${executable},0`)
    regAdd('HKCU\\Software\\Classes\\PicklinkURL\\shell\\open\\command', '', command)
    regAdd('HKCU\\Software\\Picklink\\Capabilities', 'ApplicationName', 'Picklink')
    regAdd('HKCU\\Software\\Picklink\\Capabilities', 'ApplicationDescription', 'Выбор браузера и профиля для каждой ссылки')
    regAdd('HKCU\\Software\\Picklink\\Capabilities', 'ApplicationIcon', `${executable},0`)
    regAdd('HKCU\\Software\\Picklink\\Capabilities\\URLAssociations', 'http', 'PicklinkURL')
    regAdd('HKCU\\Software\\Picklink\\Capabilities\\URLAssociations', 'https', 'PicklinkURL')
    regAdd('HKCU\\Software\\RegisteredApplications', 'Picklink', 'Software\\Picklink\\Capabilities')
    return true
  } catch { return false }
}
function isDefaultHandler() {
  const assigned = protocol => {
    try {
      const output = execFileSync('reg.exe', ['query', `HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\${protocol}\\UserChoice`, '/v', 'ProgId'], { windowsHide: true, encoding: 'utf8' })
      return /PicklinkURL/i.test(output)
    } catch { return false }
  }
  return assigned('http') && assigned('https')
}

if (!app.requestSingleInstanceLock()) app.quit()
else app.on('second-instance', (_, argv) => {
  const url = argv.find(value => /^https?:\/\//i.test(value))
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); if (url) setPickerMode(mainWindow, true); mainWindow.show(); mainWindow.focus(); if (url) mainWindow.webContents.send('incoming-url', url) }
  else if (url) pendingUrl = url
})

app.whenReady().then(() => {
  if (app.isPackaged) registerAsBrowser()
  ipcMain.handle('browsers:list', () => browserList())
  ipcMain.handle('browsers:choose-executable', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Выберите файл браузера', properties: ['openFile'], filters: [{ name: 'Приложения Windows', extensions: ['exe'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const executable = result.filePaths[0]
    const known = knownBrowser(executable, path.basename(executable, '.exe'))
    let icon = ''
    try { icon = (await app.getFileIcon(executable, { size: 'large' })).toDataURL() } catch {}
    const browser = { id: `custom-${Buffer.from(executable.toLowerCase()).toString('hex').slice(-16)}`, name: known?.name || path.basename(executable, '.exe'), color: known?.color || '#6f61e8', executable, installed: true, icon }
    return { ...browser, profiles: discoverProfiles({ ...browser, id: known?.id || browser.id }) }
  })
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_, data) => { fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2)); return true })
  ipcMain.handle('system:register-browser', () => registerAsBrowser())
  ipcMain.handle('system:protocol-status', () => isDefaultHandler())
  ipcMain.handle('system:open-default-apps', async () => { registerAsBrowser(); await shell.openExternal('ms-settings:defaultapps?registeredAppUser=Picklink'); return true })
  ipcMain.handle('app:initial-url', () => { const url = pendingUrl || null; pendingUrl = null; return url })
  ipcMain.handle('browser:open', (_, { browser, url, profile }) => new Promise(resolve => {
    if (!browser?.executable) return shell.openExternal(url).then(() => resolve(true))
    let profileArgs = profile?.argument === '-P' ? ['-P', profile.name, '-no-remote'] : profile?.argument ? [profile.argument] : []
    if (browser.id === 'yandex' && profile?.id) profileArgs = [`--user-data-dir=${chromiumDataDir(browser)}`, `--profile-directory=${profile.id}`, '--new-window']
    execFile(browser.executable, [...profileArgs, url], error => resolve(!error))
  }))
  ipcMain.handle('window:set-picker-mode', (e, enabled) => setPickerMode(BrowserWindow.fromWebContents(e.sender), Boolean(enabled)))
  ipcMain.handle('window:minimize', e => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('window:maximize', e => { const w = BrowserWindow.fromWebContents(e.sender); w?.isMaximized() ? w.unmaximize() : w?.maximize() })
  ipcMain.handle('window:close', e => BrowserWindow.fromWebContents(e.sender)?.close())
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
