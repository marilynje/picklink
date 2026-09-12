const button = document.querySelector('.language')
let language = localStorage.getItem('picklink-site-language') || (navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en')

function applyLanguage() {
  document.documentElement.lang = language
  document.querySelectorAll('[data-en]').forEach(element => {
    element.textContent = element.dataset[language]
  })
  document.querySelectorAll('img[data-en-src]').forEach(image => {
    image.src = language === 'ru' ? image.dataset.ruSrc : image.dataset.enSrc
  })
  button.textContent = language === 'en' ? 'RU' : 'EN'
}

button.addEventListener('click', () => {
  language = language === 'en' ? 'ru' : 'en'
  localStorage.setItem('picklink-site-language', language)
  applyLanguage()
})

applyLanguage()
