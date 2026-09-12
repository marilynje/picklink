const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const output = path.join(__dirname, '..', 'docs', 'screenshots')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  fs.mkdirSync(output, { recursive: true })
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  const candidates = [
    { id: 'edge', name: 'Microsoft Edge', color: '#0aa4e8', paths: ['Microsoft/Edge/Application/msedge.exe'], profile: 'Personal' },
    { id: 'chrome', name: 'Google Chrome', color: '#f4b400', paths: ['Google/Chrome/Application/chrome.exe'], profile: 'Work' },
    { id: 'firefox', name: 'Mozilla Firefox', color: '#ff7139', paths: ['Mozilla Firefox/firefox.exe'], profile: 'Default' },
    { id: 'yandex', name: 'Yandex Browser', color: '#fc3f1d', paths: ['Yandex/YandexBrowser/Application/browser.exe'], profile: 'Personal' }
  ]
  const samples = (await Promise.all(candidates.map(async candidate => {
    const executable = roots.flatMap(root => candidate.paths.map(file => path.join(root, file))).find(fs.existsSync)
    if (!executable) return null
    let icon = ''
    try { icon = (await app.getFileIcon(executable, { size: 'large' })).toDataURL() } catch {}
    return { id: candidate.id, name: candidate.name, color: candidate.color, executable, installed: true, icon, profiles: [{ id: 'Default', name: candidate.profile, argument: '' }] }
  }))).filter(Boolean)
  if (!samples.some(browser => browser.id === 'chrome')) {
    const chromeLogo = fs.readFileSync(path.join(__dirname, '..', 'website', 'dist', 'assets', 'chrome-logo.svg')).toString('base64')
    samples.splice(Math.min(1, samples.length), 0, { id: 'chrome', name: 'Google Chrome', color: '#f4b400', executable: '', installed: true, icon: `data:image/svg+xml;base64,${chromeLogo}`, profiles: [{ id: 'Profile 1', name: 'Work', argument: '' }] })
  }
  if (!samples.some(browser => browser.id === 'firefox')) {
    const firefoxLogo = fs.readFileSync(path.join(__dirname, '..', 'website', 'dist', 'assets', 'firefox-logo.svg')).toString('base64')
    samples.splice(Math.min(2, samples.length), 0, { id: 'firefox', name: 'Mozilla Firefox', color: '#ff7139', executable: '', installed: true, icon: `data:image/svg+xml;base64,${firefoxLogo}`, profiles: [{ id: 'default-release', name: 'Default', argument: '' }] })
  }
  const sampleChoices = samples.map((browser, index) => ({ id: `${browser.id}-sample`, browserId: browser.id, profileId: browser.profiles[0].id, key: String(index + 1) }))
  let captureLanguage = 'ru'
  ipcMain.handle('browsers:list', () => samples)
  ipcMain.handle('settings:load', () => ({ theme: 'dark', language: captureLanguage, quickChoices: sampleChoices, extraBrowsers: [] }))
  ipcMain.handle('settings:save', () => true)
  ipcMain.handle('system:protocol-status', () => false)
  ipcMain.handle('app:initial-url', () => null)
  const windows = []
  const captureSet = async (language, suffix) => {
    captureLanguage = language
    const labels = language === 'ru'
      ? { browsers: 'Браузеры', general: 'Основные', test: 'Проверить ссылку' }
      : { browsers: 'Browsers', general: 'General', test: 'Test a link' }
    const win = new BrowserWindow({ width: 1120, height: 760, show: false, frame: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true } })
    windows.push(win)
    try {
      await win.loadFile(path.join(__dirname, '..', 'app-dist', 'index.html'))
    } catch (error) {
      if (win.isDestroyed()) throw error
      await wait(500)
    }
    await wait(1500)
    fs.writeFileSync(path.join(output, `general${suffix}.png`), (await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript(`([...document.querySelectorAll('nav button')].find(button => button.textContent.includes(${JSON.stringify(labels.browsers)})))?.click()`)
    await wait(500)
    fs.writeFileSync(path.join(output, `browsers${suffix}.png`), (await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript(`([...document.querySelectorAll('nav button')].find(button => button.textContent.includes(${JSON.stringify(labels.general)})))?.click()`)
    await wait(300)
    await win.webContents.executeJavaScript(`([...document.querySelectorAll('button')].find(button => button.textContent.includes(${JSON.stringify(labels.test)})))?.click()`)
    await wait(300)
    fs.writeFileSync(path.join(output, `picker${suffix}.png`), (await win.webContents.capturePage()).toPNG())
  }
  await captureSet('ru', '')
  await captureSet('en', '-en')
  windows.forEach(win => win.destroy())
  app.quit()
})
