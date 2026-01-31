let currentTheme = 'auto'

// Initialize theme on page load
function initTheme() {
  const savedTheme = localStorage.getItem('kwizletTheme') || 'auto'
  currentTheme = savedTheme
  applyTheme(savedTheme)
  updateThemeButtonStates()
}

// Apply to the document
function applyTheme(theme) {
  if (theme === 'auto') {
    document.body.classList.remove('light-mode', 'dark-mode')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.add('light-mode')
    }
  } else if (theme === 'dark') {
    document.body.classList.remove('light-mode')
    document.body.classList.add('dark-mode')
  } else {
    document.body.classList.remove('dark-mode')
    document.body.classList.add('light-mode')
  }
}

// Set theme to specific value
function setTheme(theme) {
  currentTheme = theme
  localStorage.setItem('kwizletTheme', theme)
  applyTheme(theme)
  updateThemeButtonStates()
}

// Update button active states
function updateThemeButtonStates() {
  const autoBtn = document.getElementById('themeAutoBtn')
  const lightBtn = document.getElementById('themeLightBtn')
  const darkBtn = document.getElementById('themeDarkBtn')
  
  if (autoBtn) autoBtn.classList.toggle('active', currentTheme === 'auto')
  if (lightBtn) lightBtn.classList.toggle('active', currentTheme === 'light')
  if (darkBtn) darkBtn.classList.toggle('active', currentTheme === 'dark')
  
  updateAutoIcon()
}

// Update auto theme icon
function updateAutoIcon() {
  const autoIcon = document.getElementById('autoIcon')
  if (!autoIcon) return
  
  const isWide = window.innerWidth > 768
  autoIcon.setAttribute('data-lucide', isWide ? 'monitor' : 'smartphone')
  if (window.lucide) {
    lucide.createIcons()
  }
}

// Listen for device theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'auto') {
    applyTheme('auto')
    updateAutoIcon()
  }
})

// Listen for window resize
window.addEventListener('resize', () => {
  updateAutoIcon()
})

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden === false) {
    const savedTheme = localStorage.getItem('kwizletTheme') || 'auto'
    if (savedTheme !== currentTheme) {
      currentTheme = savedTheme
      applyTheme(savedTheme)
      updateThemeButtonStates()
    }
  }
})

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme)
} else {
  initTheme()
}
