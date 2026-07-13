let currentTheme = 'auto'

// DOM helper to get an element by ID
const byId = id => document.getElementById(id)

// Read the saved theme, falling back to auto
const savedTheme = () => localStorage.getItem('kwizletTheme') || 'auto'

// Initialize theme on page load
function initTheme() {
  currentTheme = savedTheme()
  applyTheme(currentTheme)
  updateThemeButtonStates()
}

// Apply to the document
function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.body.classList.toggle('dark-mode', isDark)
  document.body.classList.toggle('light-mode', !isDark)
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
  const buttons = { themeAutoBtn: 'auto', themeLightBtn: 'light', themeDarkBtn: 'dark' }
  for (const [id, theme] of Object.entries(buttons)) byId(id)?.classList.toggle('active', currentTheme === theme)
  updateAutoIcon()
}

// Update auto theme icon
function updateAutoIcon() {
  const autoIcon = byId('autoIcon')
  if (!autoIcon) return
  autoIcon.setAttribute('data-lucide', window.innerWidth > 768 ? 'monitor' : 'smartphone')
  if (window.lucide) lucide.createIcons()
}

// Listen for device theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'auto') {
    applyTheme('auto')
    updateAutoIcon()
  }
})

// Listen for window resize
window.addEventListener('resize', updateAutoIcon)

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden || savedTheme() === currentTheme) return
  currentTheme = savedTheme()
  applyTheme(currentTheme)
  updateThemeButtonStates()
})

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme)
} else {
  initTheme()
}
