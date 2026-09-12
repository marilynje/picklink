import { useEffect, useMemo, useState } from 'react'
import { AppWindow, Check, ChevronDown, CircleHelp, ExternalLink, Globe2, Info, LayoutGrid, Minus, MonitorCog, Moon, Plus, Search, Settings2, ShieldCheck, Sparkles, Sun, Trash2, X } from 'lucide-react'
import { type Language, languageNames, useLocalization } from './localization'

type Page = 'general' | 'browsers' | 'rules' | 'appearance' | 'about' | 'help'
type Rule = { id: number; match: string; browser: string; enabled: boolean }
type QuickChoice = { id: string; browserId: string; profileId: string; key: string }
const validShortcut = (value: string) => /^[\p{L}\p{N}]$/u.test(value)
const initialRules: Rule[] = [
  { id: 1, match: 'meet.google.com', browser: 'chrome', enabled: true },
  { id: 2, match: 'github.com', browser: 'edge', enabled: true },
  { id: 3, match: '*.figma.com', browser: 'chrome', enabled: false }
]
function BrowserMark({ browser, size = 38 }: { browser: BrowserInfo; size?: number }) {
  if (browser.icon) return <div className="browser-mark real" style={{ width: size, height: size }}><img src={browser.icon} alt="" /></div>
  const id = browser.id.replace(/^demo-/, '')
  const glyph = id === 'edge' ? 'e' : id === 'chrome' || id === 'chromium' ? '●' : id === 'firefox' ? '◒' : id === 'brave' ? '◆' : id === 'opera' || id === 'opera-gx' ? 'O' : id === 'vivaldi' ? 'V' : id === 'yandex' ? 'Я' : id === 'tor' ? 'T' : id === 'arc' ? 'A' : '◉'
  return <div className={`browser-mark ${id}`} style={{ width: size, height: size, background: browser.color }}><span>{glyph}</span></div>
}

function PicklinkLogo({ large = false }: { large?: boolean }) {
  const gradientId = large ? 'picklink-large' : 'picklink-small'
  return <svg className={`picklink-logo ${large ? 'large' : ''}`} viewBox="0 0 64 64" aria-label="Picklink"><defs><linearGradient id={gradientId} x1="7" y1="4" x2="58" y2="60"><stop stopColor="#a88aff"/><stop offset="1" stopColor="#5940bf"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="16" fill={`url(#${gradientId})`}/><path d="M21 51V16h15c10 0 16 5 16 14s-6 14-16 14H21" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="52" cy="30" r="2.3" fill="#ffd15c"/><circle cx="21" cy="51" r="2.3" fill="#73e6d2"/></svg>
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} aria-label="Переключить"><span /></button>
}

export default function App() {
  const [page, setPage] = useState<Page>('general')
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([])
  const [extraBrowsers, setExtraBrowsers] = useState<BrowserInfo[]>([])
  const [defaultBrowser, setDefaultBrowser] = useState('ask')
  const [startWithWindows, setStartWithWindows] = useState(true)
  const [showHost, setShowHost] = useState(true)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [toast, setToast] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [testUrl, setTestUrl] = useState('https://example.com')
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string>>({})
  const [profileShortcuts, setProfileShortcuts] = useState<Record<string, string>>({})
  const [quickChoices, setQuickChoices] = useState<QuickChoice[]>([])
  const [quickChoicesReady, setQuickChoicesReady] = useState(false)
  const [isDefault, setIsDefault] = useState(false)
  const [language, setLanguage] = useState<Language>('system')

  useLocalization(language)
  const settings = useMemo(() => ({ defaultBrowser, startWithWindows, showHost, theme, rules, shortcuts, selectedProfiles, profileShortcuts, quickChoices, extraBrowsers, language }), [defaultBrowser, startWithWindows, showHost, theme, rules, shortcuts, selectedProfiles, profileShortcuts, quickChoices, extraBrowsers, language])
  const mergeBrowsers = (found: BrowserInfo[], extras: BrowserInfo[]) => [...found, ...extras].filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
  const refreshBrowsers = () => window.picklink?.getBrowsers().then(list => { setBrowsers(mergeBrowsers(list, extraBrowsers)); notify(`Найдено браузеров: ${list.length}`) })
  useEffect(() => { Promise.all([window.picklink?.getBrowsers() ?? Promise.resolve([]), window.picklink?.loadSettings()]).then(([list, s]: any[]) => { const extras = (Array.isArray(s?.extraBrowsers) ? s.extraBrowsers : []).filter((browser: BrowserInfo) => !browser.id.startsWith('demo-')); setExtraBrowsers(extras); setBrowsers(mergeBrowsers(list, extras)); if (s) { setDefaultBrowser(s.defaultBrowser ?? 'ask'); setStartWithWindows(s.startWithWindows ?? true); setShowHost(s.showHost ?? true); setTheme(s.theme ?? 'system'); setRules(s.rules ?? initialRules); setShortcuts(s.shortcuts ?? {}); setSelectedProfiles(s.selectedProfiles ?? {}); setProfileShortcuts(s.profileShortcuts ?? {}); setLanguage(s.language ?? 'system') } const saved = Array.isArray(s?.quickChoices) ? s.quickChoices.filter((choice: QuickChoice) => !choice.browserId.startsWith('demo-')) : null; setQuickChoices(saved ?? list.map((browser: BrowserInfo, index: number) => ({ id: `${browser.id}-default`, browserId: browser.id, profileId: '', key: String(index + 1) }))); setQuickChoicesReady(true) }); window.picklink?.protocolStatus().then(setIsDefault); window.picklink?.getInitialUrl().then(url => { if (url) { setTestUrl(url); setPickerOpen(true) } }); window.picklink?.onUrl(url => { setTestUrl(url); setPickerOpen(true) }) }, [])
  useEffect(() => { if (!quickChoicesReady) return; const t = setTimeout(() => window.picklink?.saveSettings(settings), 250); return () => clearTimeout(t) }, [settings, quickChoicesReady])
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const sync = () => setSystemDark(media.matches); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync) }, [])
  useEffect(() => { const checkDefault = () => window.picklink?.protocolStatus().then(setIsDefault); window.addEventListener('focus', checkDefault); const timer = setInterval(checkDefault, 5000); return () => { window.removeEventListener('focus', checkDefault); clearInterval(timer) } }, [])

  const nav = [
    { id: 'general', label: 'Основные', icon: Settings2 }, { id: 'browsers', label: 'Браузеры', icon: Globe2 },
    { id: 'rules', label: 'Правила', icon: LayoutGrid }, { id: 'appearance', label: 'Оформление', icon: Sparkles }, { id: 'about', label: 'О приложении', icon: Info }
  ] as const
  const title = page === 'help' ? 'Помощь' : nav.find(n => n.id === page)?.label
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2200) }
  const choices = quickChoices.flatMap(choice => { const browser = browsers.find(item => item.id === choice.browserId); if (!browser) return []; const profile = browser.profiles?.find(item => item.id === choice.profileId); return [{ ...choice, browser, profile }] })
  const chooseBrowser = (browser: BrowserInfo, profileOverride?: BrowserProfile) => { const profile = profileOverride ?? browser.profiles?.find(item => item.id === selectedProfiles[browser.id]); window.picklink?.openUrl(browser, testUrl, profile); setPickerOpen(false); notify(`Открываю в ${browser.name}${profile ? ` · ${profile.name}` : ''}`) }
  useEffect(() => {
    if (!pickerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return setPickerOpen(false)
      const choice = choices.find(item => item.key.toLowerCase() === event.key.toLowerCase())
      if (choice) chooseBrowser(choice.browser, choice.profile)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen, choices])

  const activeTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  return <div className={`app theme-${activeTheme}`}>
    <header className="titlebar">
      <div className="brand"><PicklinkLogo/><b>Picklink</b></div>
      <div className="window-controls"><button onClick={() => window.picklink?.minimize()}><Minus size={15}/></button><button onClick={() => window.picklink?.maximize()}><AppWindow size={13}/></button><button className="close" onClick={() => window.picklink?.close()}><X size={16}/></button></div>
    </header>
    <div className="shell">
      <aside>
        <div className="status-card"><div className="status-dot"><Check size={13}/></div><div><strong>Picklink работает</strong><span>Ссылки под контролем</span></div></div>
        <nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon size={18}/><span>{item.label}</span></button>)}</nav>
        <button className={`help ${page === 'help' ? 'active' : ''}`} onClick={() => setPage('help')}><CircleHelp size={18}/>Помощь и поддержка</button>
      </aside>
      <main>
        <div className="main-head"><div><p className="eyebrow">НАСТРОЙКИ</p><h1>{title}</h1></div>{page === 'rules' && <button className="primary" onClick={() => setRules([...rules, { id: Date.now(), match: 'example.com', browser: browsers[0]?.id ?? 'edge', enabled: true }])}><Plus size={16}/>Новое правило</button>}</div>
        {page === 'general' && <General browsers={browsers} defaultBrowser={defaultBrowser} setDefaultBrowser={setDefaultBrowser} start={startWithWindows} setStart={setStartWithWindows} showHost={showHost} setShowHost={setShowHost} openPicker={() => setPickerOpen(true)} isDefault={isDefault} activate={() => window.picklink?.openDefaultApps().then(() => notify('Выберите Picklink для HTTP и HTTPS'))} />}
        {page === 'browsers' && <Browsers browsers={browsers} quickChoices={quickChoices} setQuickChoices={setQuickChoices} refreshBrowsers={refreshBrowsers} addCustomBrowser={async () => { const browser = await window.picklink?.chooseBrowserExecutable(); if (!browser) return; const extras = mergeBrowsers(extraBrowsers, [browser]); setExtraBrowsers(extras); setBrowsers(current => mergeBrowsers(current, [browser])); if (!quickChoices.some(item => item.browserId === browser.id)) { const used = new Set(quickChoices.map(item => item.key.toLowerCase())); const key = '1234567890abcdefghijklmnopqrstuvwxyz'.split('').find(value => !used.has(value)) ?? ''; setQuickChoices([...quickChoices, { id: `${browser.id}-default-${Date.now()}`, browserId: browser.id, profileId: '', key }]) } notify(`Добавлен ${browser.name}`) }}/>} 
        {page === 'rules' && <Rules rules={rules} browsers={browsers} setRules={setRules}/>} 
        {page === 'appearance' && <Appearance theme={theme} setTheme={setTheme} systemDark={systemDark} language={language} setLanguage={setLanguage}/>} 
        {page === 'about' && <About/>}
        {page === 'help' && <Help/>}
      </main>
    </div>
    {pickerOpen && <div className="overlay" onMouseDown={() => setPickerOpen(false)}><div className="picker" onMouseDown={e => e.stopPropagation()}><div className="picker-top"><div className="site-icon"><Globe2 size={20}/></div><div><span>Открыть ссылку</span><strong>{testUrl.replace(/^https?:\/\//, '')}</strong></div><button onClick={() => setPickerOpen(false)}><X size={17}/></button></div><div className="browser-grid">{choices.map(({ id, browser:b, profile, key }) => <button key={id} onClick={() => chooseBrowser(b, profile)}><BrowserMark browser={b} size={46}/><span>{b.name.replace('Microsoft ', '').replace('Google ', '').replace('Mozilla ', '')}</span>{profile ? <small>{profile.name}</small> : null}<kbd>{key}</kbd></button>)}</div><div className="picker-rule"><button onClick={() => { setRules([...rules, { id: Date.now(), match: new URL(testUrl).hostname, browser: browsers[0]?.id ?? 'edge', enabled: true }]); notify('Правило добавлено'); setPickerOpen(false) }}><Plus size={15}/>Всегда открывать этот сайт в выбранном браузере</button></div></div></div>}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) { return <section><div className="section-label"><h2>{title}</h2>{hint && <p>{hint}</p>}</div><div className="panel">{children}</div></section> }
function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) { return <div className="row"><div><strong>{title}</strong><p>{text}</p></div><div>{children}</div></div> }

function General({ browsers, defaultBrowser, setDefaultBrowser, start, setStart, showHost, setShowHost, openPicker, isDefault, activate }: any) {
  return <div className="content"><div className={`default-card ${isDefault ? 'ready' : ''}`}><div className="default-icon">{isDefault ? <Check size={22}/> : <ExternalLink size={21}/>}</div><div><strong>{isDefault ? 'Picklink уже открывает ваши ссылки' : 'Сделайте Picklink основным для ссылок'}</strong><p>{isDefault ? 'Обработчики HTTP и HTTPS подключены.' : 'После этого при клике на ссылку появится выбор браузера и профиля.'}</p></div><button className={isDefault ? 'secondary' : 'primary'} onClick={activate}>{isDefault ? 'Изменить' : 'Подключить'}</button></div><Section title="Поведение ссылок" hint="Решите, что делать с новыми ссылками."><Row title="Когда я открываю ссылку" text="Picklink покажет аккуратное окно выбора браузера."><div className="select-wrap"><select value={defaultBrowser} onChange={e => setDefaultBrowser(e.target.value)}><option value="ask">Всегда спрашивать</option>{browsers.map((b: BrowserInfo) => <option key={b.id} value={b.id}>Открывать в {b.name}</option>)}</select><ChevronDown size={15}/></div></Row><div className="test-box"><div><span className="test-kicker">БЫСТРАЯ ПРОВЕРКА</span><strong>Посмотрите, как будет выглядеть выбор</strong></div><button className="secondary" onClick={openPicker} disabled={!browsers.length}><ExternalLink size={15}/>Проверить ссылку</button></div></Section><Section title="Система"><Row title="Запускать вместе с Windows" text="Picklink будет готов сразу после входа в систему."><Toggle value={start} onChange={setStart}/></Row><Row title="Показывать адрес сайта" text="Отображать домен в окне выбора браузера."><Toggle value={showHost} onChange={setShowHost}/></Row></Section><div className="tip"><ShieldCheck size={19}/><div><strong>Ваши ссылки остаются приватными</strong><p>Все правила обрабатываются локально на этом компьютере.</p></div></div></div>
}

function Browsers({ browsers, quickChoices, setQuickChoices, refreshBrowsers, addCustomBrowser }: { browsers: BrowserInfo[]; quickChoices: QuickChoice[]; setQuickChoices: (items: QuickChoice[]) => void; refreshBrowsers: () => void; addCustomBrowser: () => void }) {
  const [adding, setAdding] = useState(false)
  const [browserId, setBrowserId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [newKey, setNewKey] = useState('')
  const selectableBrowsers = browsers.filter(browser => !browser.id.startsWith('custom-'))
  const selectedBrowser = selectableBrowsers.find(browser => browser.id === browserId) ?? selectableBrowsers[0]
  const addChoice = () => { if (!selectedBrowser) return; const used = new Set(quickChoices.map(item => item.key.toLowerCase())); const suggested = '1234567890abcdefghijklmnopqrstuvwxyz'.split('').find(key => !used.has(key)) ?? ''; const key = newKey && !used.has(newKey.toLowerCase()) ? newKey : suggested; setQuickChoices([...quickChoices, { id: `${selectedBrowser.id}-${profileId || 'default'}-${Date.now()}`, browserId: selectedBrowser.id, profileId, key }]); setAdding(false); setBrowserId(''); setProfileId(''); setNewKey('') }
  const updateChoice = (id: string, patch: Partial<QuickChoice>) => setQuickChoices(quickChoices.map(item => item.id === id ? { ...item, ...patch } : item))
  return <div className="content"><Section title="Браузеры для выбора" hint="Соберите только нужные сочетания браузеров и профилей."><div className="quick-choice-list">{quickChoices.map(choice => { const browser = browsers.find(item => item.id === choice.browserId); if (!browser) return null; const profile = browser.profiles?.find(item => item.id === choice.profileId); return <div className="quick-choice-row" key={choice.id}><BrowserMark browser={browser} size={32}/><div className="quick-choice-name"><strong>{browser.name}</strong><span title={profile?.name ?? 'Основной профиль'}>{profile?.name ?? 'Основной профиль'}</span></div><label><span>Клавиша</span><input maxLength={1} value={choice.key} onChange={event => { const key = event.target.value.slice(-1); if ((!key || validShortcut(key)) && !quickChoices.some(item => item.id !== choice.id && item.key.toLowerCase() === key.toLowerCase())) updateChoice(choice.id, { key }) }}/></label><button className="delete" aria-label="Удалить" onClick={() => setQuickChoices(quickChoices.filter(item => item.id !== choice.id))}><Trash2 size={16}/></button></div>})}{!quickChoices.length && <div className="empty-choices">Добавьте браузер или профиль для окна выбора.</div>}{adding && <div className="choice-editor"><select value={selectedBrowser?.id ?? ''} onChange={event => { setBrowserId(event.target.value); setProfileId('') }}>{selectableBrowsers.map(browser => <option key={browser.id} value={browser.id}>{browser.name}</option>)}</select><select value={profileId} onChange={event => setProfileId(event.target.value)}><option value="">Основной профиль</option>{selectedBrowser?.profiles?.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><input className="new-key" aria-label="Любая буква или цифра" title="Любая буква или цифра" placeholder="A–Z" maxLength={1} value={newKey} onChange={event => { const key = event.target.value.slice(-1); if ((!key || validShortcut(key)) && !quickChoices.some(item => item.key.toLowerCase() === key.toLowerCase())) setNewKey(key) }}/><button className="primary" onClick={addChoice}>Добавить</button><button className="secondary" onClick={() => { setAdding(false); setNewKey('') }}>Отмена</button></div>}<div className="choice-actions"><button className="secondary" onClick={() => setAdding(true)} disabled={!selectableBrowsers.length}><Plus size={15}/>Добавить</button><button className="secondary" onClick={addCustomBrowser}><Plus size={15}/>Указать путь</button><button className="secondary" onClick={refreshBrowsers}><Search size={15}/>Обновить браузеры</button></div></div></Section><div className="tip shortcut-tip"><Settings2 size={19}/><div><strong>Любая буква или цифра</strong><p>Назначьте каждой строке удобную клавишу. Esc закрывает окно выбора.</p></div></div></div>
}

function Rules({ rules, browsers, setRules }: { rules: Rule[]; browsers: BrowserInfo[]; setRules: (r: Rule[]) => void }) { return <div className="content"><Section title="Ссылки сами найдут нужный браузер" hint="Создавайте правила для сайтов, рабочих сервисов и отдельных профилей."><div className="rules">{rules.map(rule => <div className="rule" key={rule.id}><Toggle value={rule.enabled} onChange={v => setRules(rules.map(x => x.id === rule.id ? {...x, enabled: v} : x))}/><div className="rule-match"><Globe2 size={17}/><div><span>Адрес содержит</span><input value={rule.match} onChange={e => setRules(rules.map(x => x.id === rule.id ? {...x, match: e.target.value} : x))}/></div></div><span className="arrow">→</span><select value={rule.browser} onChange={e => setRules(rules.map(x => x.id === rule.id ? {...x, browser: e.target.value} : x))}>{browsers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="delete" onClick={() => setRules(rules.filter(x => x.id !== rule.id))}><Trash2 size={16}/></button></div>)}</div></Section></div> }

function Appearance({ theme, setTheme, systemDark, language, setLanguage }: { theme: string; setTheme: (v: any) => void; systemDark: boolean; language: Language; setLanguage: (v: Language) => void }) { const options = [{id:'system',label:'System',icon:MonitorCog},{id:'light',label:'Светлая',icon:Sun},{id:'dark',label:'Тёмная',icon:Moon}]; return <div className="content appearance-page"><Section title="Тема приложения" hint="Системная тема меняется автоматически вместе с оформлением устройства."><div className="theme-grid">{options.map(o => <button key={o.id} className={theme === o.id ? 'chosen' : ''} onClick={() => setTheme(o.id)}><div className={`theme-preview ${o.id === 'system' ? (systemDark ? 'dark' : 'light') : o.id}`}><div className="mini-side"/><div className="mini-content"><i/><i/><i/></div></div><span><o.icon size={16}/>{o.label}</span>{theme === o.id && <div className="theme-check"><Check size={12}/></div>}</button>)}</div></Section><Section title="Язык интерфейса" hint="Выберите язык приложения."><div className="language-grid">{(Object.keys(languageNames) as Language[]).map(code => <button key={code} className={language === code ? 'chosen' : ''} onClick={() => setLanguage(code)}><span>{code === 'system' ? 'SYS' : code.toUpperCase()}</span>{languageNames[code]}{language === code && <Check size={13}/>}</button>)}</div></Section></div> }
function About() { return <div className="content about-page"><div className="about"><PicklinkLogo large/><h2>Picklink</h2><p>Каждой ссылке — свой браузер.</p><span className="version"><span>Версия</span> 1.0.0</span></div><Section title="О проекте"><Row title="Приватно и локально" text="Быстрое и понятное управление ссылками без отправки данных."><span className="pill">Picklink</span></Row><Row title="Автор проекта" text="Дизайн, идея и разработка приложения."><span className="creator">@Marilynje</span></Row></Section></div> }

function Help() { return <div className="content help-page"><div className="help-hero"><CircleHelp size={23}/><div><strong>Как пользоваться Picklink</strong><p>Три коротких шага, чтобы ссылки открывались именно там, где нужно.</p></div></div><Section title="Начало работы"><div className="help-list"><div><b>1</b><span><strong>Подключите Picklink</strong><p>На вкладке «Основные» нажмите «Подключить» и назначьте Picklink для HTTP и HTTPS.</p></span></div><div><b>2</b><span><strong>Проверьте браузеры</strong><p>На вкладке «Браузеры» обновите список, выберите профиль и назначьте клавишу.</p></span></div><div><b>3</b><span><strong>Открывайте ссылки</strong><p>Выберите браузер мышью или нажмите его клавишу. Esc закрывает окно выбора.</p></span></div></div></Section><Section title="Если что-то не найдено"><div className="support-note"><strong>Обновите системную регистрацию браузера</strong><p>Откройте нужный браузер, временно назначьте его браузером по умолчанию, затем вернитесь в Picklink и нажмите «Обновить список». Это заставит браузер заново добавить себя в реестр приложений.</p></div></Section></div> }
