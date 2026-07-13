// Global study state
let data = [], starredIndices = new Set(), currentFilename = ''

// Flashcards state
let fcDeck = [], fcIndex = 0, flipped = false

// Learn state
let learnDeck = [], learnIndex = 0, learnMode = 'term', score = 0
let answered = false, correctLog = [], summaryJustShown = false

// Match game state
let matchCards = [], matchSelected = [], matchPairsFound = 0
let matchTimer = 0, matchTimerInterval = null, matchBestTime = null

// Gravity game state
let gravityLevel = 1, gravityHighScore = 0, gravitySpeedMultiplier = 1, gravityNextHexagonId = 0
let gravityCurrentWords = [], gravityHexagons = [], gravityEnteredTerms = []
let gravityGameActive = false, gravityGameStarted = false
let gravitySpawnInterval = null, gravityFallInterval = null

// Generator and recent files
let termRowCount = 0
const MAX_RECENT_FILES = 3
const RECENT_FILES_KEY = 'kwizletRecentFiles'
const getRecentFiles = () => JSON.parse(localStorage.getItem(RECENT_FILES_KEY) || '[]')

// DOM helpers to get an element by ID and to make an element with properties
const getEl = id => document.getElementById(id)
const mkEl = (tag, props) => Object.assign(document.createElement(tag), props)

// Save a CSV file to the recent files, listing the newest first
function saveRecentFile(csvContent, filename) {
  const newFile = { id: Date.now().toString(), name: filename, content: csvContent, timestamp: new Date().toLocaleString() }
  const recentFiles = [newFile, ...getRecentFiles()].slice(0, MAX_RECENT_FILES)
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles))
  updateRecentFilesDisplay()
}

// Delete a recent file by ID
function deleteRecentFile(id) {
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(getRecentFiles().filter(f => f.id !== id)))
  updateRecentFilesDisplay()
}

// Load a recent file by ID
function loadRecentFile(id) {
  const file = getRecentFiles().find(f => f.id === id)
  if (file) loadCSV(file.content, file.name, false)
}

// Update the recent files display
function updateRecentFilesDisplay() {
  const container = getEl('recentFilesContainer')
  if (!container) return

  const recentFiles = getRecentFiles()
  if (recentFiles.length === 0) return void (container.innerHTML = '<p>No recent files</p>')

  const rows = recentFiles.map(file => `<div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 20px; background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, .05);"><div style="flex: 1; cursor: pointer; min-width: 0;" onclick="loadRecentFile('${file.id}')"><div style="font-size: 0.95rem; color: var(--text-primary); word-break: break-word;">${file.name}</div><div style="font-size: 0.8rem; color: var(--text-muted);">${file.timestamp}</div></div><button onclick="deleteRecentFile('${file.id}')" class="remove-btn" style="margin-left: 10px;">×</button></div>`).join('')
  container.innerHTML = `<div style="margin-top: 0; padding-bottom: 20px;"><p style="margin: 0 0 16px 0;">Recent Files:</p><div style="display: flex; flex-direction: column; gap: 8px;">${rows}</div></div>`
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  updateRecentFilesDisplay()
  addTermRow()

  const inp = getEl('gravityInput')
  if (inp) inp.addEventListener('keydown', handleGravityInput)
})

// Add a new term row to the generator
function addTermRow() {
  const rowId = termRowCount++
  getEl('termRows').appendChild(mkEl('div', { className: 'term-row', id: `row-${rowId}`, innerHTML: `<input type="text" placeholder="Term" class="term-input" id="term-${rowId}"><input type="text" placeholder="Definition" class="definition-input" id="definition-${rowId}"><input type="file" accept="image/*" class="image-input" id="image-${rowId}" onchange="handleImageUpload(${rowId})"><span class="image-status" id="status-${rowId}"></span><button onclick="removeTermRow(${rowId})" class="remove-btn">×</button>` }))
}

// Remove a term row but always keep at least one present
function removeTermRow(rowId) {
  const row = getEl(`row-${rowId}`)
  if (row) row.remove()
  if (document.querySelectorAll('.term-row').length === 0) addTermRow()
}

// Handle image upload and convert to base64
async function handleImageUpload(rowId) {
  const input = getEl(`image-${rowId}`)
  const status = getEl(`status-${rowId}`)
  if (!(input.files && input.files[0])) return

  const reader = new FileReader()
  reader.onload = e => {
    input.dataset.base64 = e.target.result
    status.textContent = '✓'
    status.style.color = '#4CAF50'
  }
  reader.onerror = () => {
    status.textContent = '✗'
    status.style.color = '#f44336'
  }
  reader.readAsDataURL(input.files[0])
}

// Generate and download the CSV file
function generateCSV() {
  const esc = v => v.includes(',') ? `"${v}"` : v
  const csvContent = [...document.querySelectorAll('.term-row')].map(row => ({
    term: row.querySelector('.term-input').value.trim(),
    def: row.querySelector('.definition-input').value.trim(),
    img: row.querySelector('.image-input').dataset.base64 || ''
  })).filter(r => r.term).map(r => `${esc(r.term)},${esc(r.def)},${r.img ? `"${r.img}"` : ''}\n`).join('')
  if (!csvContent) return void alert('Please add at least one term!')

  saveRecentFile(csvContent, 'kwizlet.csv')
  const a = mkEl('a', { href: URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' })), download: 'kwizlet.csv' })
  a.click()
  URL.revokeObjectURL(a.href)
}

// Parse CSV into objects
function parseCSV(text) {
  return text.trim().split(/\r?\n/).map(r => {
    const parts = []
    let current = '', inQuotes = false
    for (const char of r) {
      if (char === '"') inQuotes = !inQuotes
      else if (char === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ''
      } else current += char
    }
    parts.push(current.trim())

    // A base64 image data URL contains a comma so rejoin the split parts
    if (parts.length === 4 && parts[2] && parts[2].startsWith('data:image/')) {
      parts[2] = parts[2] + ',' + parts[3]
      parts.pop()
    }
    return { term: parts[0], definition: parts[1], image: parts[2] }
  })
}

// Load parsed CSV data into the study view shared by upload and recent files
function loadCSV(csvContent, filename, remember) {
  data = parseCSV(csvContent)
  currentFilename = filename
  if (remember) saveRecentFile(csvContent, filename)
  starredIndices.clear()
  nav.classList.remove('hidden')
  getEl('generator').classList.add('hidden')
  showList()

  // Update filename display
  const filenameSpan = getEl('filename')
  if (filenameSpan && currentFilename) filenameSpan.textContent = ` - ${currentFilename.replace(/\.csv$/i, '')}`
}

// Read a chosen CSV file and then load it, remembering it in recent files if asked
function readCSVFile(file, remember) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => loadCSV(reader.result, file.name, remember)
  reader.readAsText(file)
}

// Handle file upload button click
getEl('uploadBtn').addEventListener('click', () => {
  const input = mkEl('input', { type: 'file', accept: '.csv', onchange: () => readCSVFile(input.files[0], true) })
  input.click()
})

// Show specific view and hide others
function showView(id) {
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'))
  getEl(id).classList.remove('hidden')

  // Clean up gravity intervals if switching away from gravity
  if (id !== 'gravity') {
    clearGravityIntervals()
    gravityGameActive = false
  }
}

// Get active terms based on star filter
const getActiveTerms = () => starredIndices.size === 0 ? data : data.filter((_, idx) => starredIndices.has(idx))

// Active terms that have a term plus a definition or image so games can use them
const getValidTerms = () => getActiveTerms().filter(d => d.term && (d.definition || d.image))

// Build definition or image HTML for a card where styled adds sizing for large faces
const contentHTML = (d, styled) => !(d.definition || d.image) ? '[no definition provided]'
  : (d.definition ? `<div>${d.definition}</div>` : '') + (d.image ? `<img src="${d.image}"${styled ? ` style="max-width:100%;margin-top:${d.definition ? '10px' : '0'}"` : ''}>` : '')

// Toggle star status for a term
function toggleStar(index) {
  starredIndices.delete(index) || starredIndices.add(index)
  showList()
}

// Display list of all terms
function showList() {
  showView('list')
  termList.innerHTML = data.map((d, idx) => `<li><div style="display:flex;justify-content:space-between;align-items:flex-start;"><strong>${d.term}</strong><button class="star-btn ${starredIndices.has(idx) ? 'starred' : ''}" onclick="toggleStar(${idx})" style="background:none;border:none;cursor:pointer;font-size:1.2em;padding:0;color:#ffd700;flex-shrink:0;margin:0;">${starredIndices.has(idx) ? '★' : '☆'}</button></div>${d.definition ? `<br>${d.definition}` : ''}${d.image ? `<br><img src="${d.image}">` : ''}${!(d.definition || d.image) ? '<br>[no definition provided]' : ''}</li>`).join('')
}

// Initialize flashcards mode
function startFlashcards() {
  fcDeck = [...getActiveTerms()]
  fcIndex = 0
  flipped = false
  showView('flashcards')
  renderFlashcard()
}

// Render current flashcard
function renderFlashcard() {
  flashcard.innerHTML = flipped ? contentHTML(fcDeck[fcIndex], true) : fcDeck[fcIndex].term
  fcProgress.textContent = `${fcIndex + 1}/${fcDeck.length}`
  fcNextBtn.textContent = (fcIndex === fcDeck.length - 1) ? 'Done' : 'Next'
  fcShuffleBtn.style.display = (fcIndex === fcDeck.length - 1) ? 'none' : 'inline-block'
}

// Flashcard click to flip
flashcard.onclick = () => {
  flipped = !flipped
  flashcard.classList.add('flipping')
  setTimeout(() => renderFlashcard(), 150)
  setTimeout(() => flashcard.classList.remove('flipping'), 300)
}

// Next button handler for flashcards
fcNextBtn.onclick = () => {
  if (fcIndex === fcDeck.length - 1) return showList()
  flipped = false
  fcIndex++
  renderFlashcard()
}

// Shuffle remaining flashcards
function shuffleRemainingFC() {
  fcDeck = shuffleRemaining(fcDeck, fcIndex)
}

// Reset the current Learn round, sync the mode button, and re-render
function resetLearnRound() {
  learnIndex = 0
  score = 0
  correctLog = []
  learnModeBtn.textContent = learnMode === 'term' ? 'Switch to Definition Mode' : 'Switch to Term Mode'
  renderLearn()
}

// Initialize learn game mode
function startLearn() {
  learnDeck = getActiveTerms().filter(d => d.definition || d.image)
  if (learnDeck.length === 0) return void alert('Need at least 1 term with a definition or image to play Learn!')

  learnMode = 'term'
  showView('learn')
  resetLearnRound()
}

// Render learn question with up to four options wired by click delegation
function renderLearn() {
  answered = false
  learnNextBtn.disabled = true
  const correct = learnDeck[learnIndex]

  learnTerm.innerHTML = learnMode === 'term' ? correct.term : contentHTML(correct, true)
  learnProgress.textContent = `${learnIndex + 1}/${learnDeck.length}`

  // Start with the correct answer, then add random distractors
  const choices = shuffle([correct, ...shuffle(getActiveTerms().filter(d => d.definition || d.image)).filter(c => c !== correct).slice(0, 3)])

  options.innerHTML = choices.map(c => `<div class="option"${c === correct ? ' data-correct="1"' : ''}>${learnMode === 'term' ? contentHTML(c, false) : c.term}</div>`).join('')
  options.onclick = e => {
    const div = e.target.closest('.option')
    if (div) handleAnswer(div, div.dataset.correct === '1')
  }
}

// Handle answer selection in learn mode
function handleAnswer(div, isCorrect) {
  if (answered) return
  answered = true
  learnNextBtn.disabled = false

  if (isCorrect) {
    div.classList.add('correct')
    score++
    correctLog.push(learnIndex)
    return
  }

  // Highlight the correct option among the others
  div.classList.add('wrong')
  options.querySelector('[data-correct]').classList.add('correct')
}

// Next button handler for learn mode
learnNextBtn.onclick = () => {
  if (learnIndex === learnDeck.length - 1) return showSummary()
  learnIndex++
  renderLearn()
}

// Display final score summary
function showSummary() {
  showView('summary')
  summaryJustShown = true

  const missed = learnDeck.filter((d, i) => !correctLog.includes(i))
  let html = `You scored <strong>${score}</strong> out of <strong>${learnDeck.length}</strong> (${Math.round((score / learnDeck.length) * 100)}%).<br><br>`
  if (missed.length) html += '<strong>Missed terms:</strong><ul>' + missed.map(d => `<li>${d.term}</li>`).join('') + '</ul>'

  retryMissedBtn.classList.toggle('hidden', missed.length === 0)
  scoreText.innerHTML = html
}

// Retry only missed questions
function retryMissed() {
  learnDeck = learnDeck.filter((d, i) => !correctLog.includes(i))
  showView('learn')
  resetLearnRound()
}

// Toggle between term and definition modes
function toggleLearnMode() {
  learnMode = learnMode === 'term' ? 'definition' : 'term'
  resetLearnRound()
}

// Shuffle remaining learn questions
function shuffleRemainingLearn() {
  learnDeck = shuffleRemaining(learnDeck, learnIndex)
}

// Show the Match setup screen which needs at least 6 valid terms
function startMatch() {
  const enough = getValidTerms().length >= 6
  const best = enough ? `Best Time: ${matchBestTime !== null ? matchBestTime.toFixed(1) + 's' : 'Null'}` : 'Not Enough Terms'
  matchMessage.innerHTML = `<span style="color:#4255ff;font-weight:bold;">${best}</span>`
  matchStartBtn.style.display = enough ? 'inline-block' : 'none'

  showView('match')
  matchSetup.style.display = 'block'
  matchGame.classList.add('hidden')
}

// Initialize and start the match game with a term card and a definition card per pair
function startMatchGame() {
  matchCards = shuffle(shuffle([...getValidTerms()]).slice(0, 6).flatMap((item, idx) => [
    { pairId: idx, type: 'term', content: item.term, matched: false },
    { pairId: idx, type: 'definition', content: item.definition || '', image: item.image || '', matched: false }
  ]))

  matchSelected = []
  matchPairsFound = 0
  matchTimer = 0
  matchSetup.style.display = 'none'
  matchGame.classList.remove('hidden')

  if (matchTimerInterval) clearInterval(matchTimerInterval)
  matchTimerInterval = setInterval(() => {
    matchTimer += 0.1
    timerDisplay.textContent = `${matchTimer.toFixed(1)}s`
  }, 100)
  renderMatchGrid()
}

// Render the match game grid where matched cards stay hidden to preserve layout
function renderMatchGrid() {
  const grid = getEl('matchGrid')
  grid.innerHTML = matchCards.map((card, i) => {
    if (card.matched) return '<div class="match-card matched" style="visibility:hidden"></div>'
    const inner = card.type === 'definition' && card.image ? `${card.content ? `<div>${card.content}</div>` : ''}<img src="${card.image}">` : card.content
    return `<div class="match-card" data-i="${i}">${inner}</div>`
  }).join('')
  grid.onclick = e => {
    const div = e.target.closest('.match-card')
    if (div && div.dataset.i !== undefined) selectMatchCard(matchCards[+div.dataset.i], div)
  }
}

// Handle card selection in match game
function selectMatchCard(card, element) {
  if (card.matched || matchSelected.includes(card) || matchSelected.length >= 2) return

  card.el = element
  element.classList.add('selected')
  matchSelected.push(card)
  if (matchSelected.length !== 2) return

  const [first, second] = matchSelected
  const paired = first.pairId === second.pairId
  first.el.classList.remove('selected')
  second.el.classList.remove('selected')
  first.el.classList.add(paired ? 'correct-match' : 'wrong-match')
  second.el.classList.add(paired ? 'correct-match' : 'wrong-match')

  if (paired) {
    first.matched = second.matched = true
    matchPairsFound++

    // Brief delay before re-rendering
    setTimeout(() => {
      renderMatchGrid()
      matchSelected = []
      if (matchPairsFound !== 6) return
      clearInterval(matchTimerInterval)
      if (matchBestTime === null || matchTimer < matchBestTime) matchBestTime = matchTimer
      setTimeout(() => startMatch(), 150)
    }, 250)
  } else {
    // Mismatch so flash red and clear the selection
    setTimeout(() => {
      first.el.classList.remove('wrong-match')
      second.el.classList.remove('wrong-match')
      matchSelected = []
    }, 400)
  }
}

// Keyboard shortcut handlers
document.addEventListener('keydown', e => {
  // Run an action after suppressing the default behavior
  const press = fn => {
    e.preventDefault()
    fn()
  }

  if (!flashcards.classList.contains('hidden')) {
    if (e.code === 'Space') press(() => flashcard.click())
    if (e.key === 'Enter' || (e.key === 'Escape' && fcIndex === fcDeck.length - 1)) press(() => fcNextBtn.click())
  }

  if (!learn.classList.contains('hidden')) {
    if (e.key >= '1' && e.key <= '4' && options.children[Number(e.key) - 1]) options.children[Number(e.key) - 1].click()
    if (e.key === 'Enter' && !learnNextBtn.disabled) press(() => learnNextBtn.click())
  }

  if (!summary.classList.contains('hidden')) {
    if (e.key === 'Enter' && !summaryJustShown) press(() => retryMissedBtn.classList.contains('hidden') ? showList() : retryMissedBtn.click())
    if (e.key === 'Escape') press(() => showList())
  }
})

// Summary just shown flag reset
document.addEventListener('keyup', e => {
  if (e.key === 'Enter' && !summary.classList.contains('hidden')) summaryJustShown = false
})

// Shuffle an array in place
const shuffle = arr => arr.sort(() => Math.random() - 0.5)

// Shuffle only the not yet seen tail of a deck
const shuffleRemaining = (deck, index) => index >= deck.length - 1 ? deck : [...deck.slice(0, index + 1), ...shuffle(deck.slice(index + 1))]

// Clear the gravity spawn and fall intervals if running
function clearGravityIntervals() {
  if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
  if (gravityFallInterval) clearInterval(gravityFallInterval)
}

// Show a status message in the gravity game
function setGravityMessage(text, color) {
  const m = getEl('gravityMessage')
  m.textContent = text
  if (color) m.style.color = color
}

// Toggle the gravity start and stop button and game container
function setGravityRunning(on) {
  getEl('gravityToggleBtn').textContent = on ? 'Stop Game' : 'Start Game'
  getEl('gravityGameContainer').classList.toggle('hidden', !on)
}

// Enter Gravity mode and reset display state where per level arrays reset in startGravityLevel
function startGravity() {
  if (getValidTerms().length < 1) return void alert('Need at least 1 term with a definition or image to play Gravity!')

  gravityLevel = 1
  gravitySpeedMultiplier = 1
  gravityGameStarted = false
  showView('gravity')
  setGravityRunning(false)
  updateGravityDisplay()
}

// Start and stop toggle for the gravity game
function toggleGravityGame() {
  gravityGameStarted = !gravityGameStarted

  if (gravityGameStarted) {
    // Starting the game
    gravityEnteredTerms = []
    setGravityRunning(true)
    startGravityLevel()
  } else {
    // Stopping the game
    clearGravityIntervals()
    gravityGameActive = false
    setGravityRunning(false)
  }
}

// Start a new gravity level by spawning 5 fresh falling hexagons
function startGravityLevel() {
  const validTerms = getValidTerms()
  gravityCurrentWords = Array.from({ length: 5 }, () => validTerms[Math.floor(Math.random() * validTerms.length)])
  gravityEnteredTerms = []
  gravityHexagons = []
  gravityNextHexagonId = 0

  const gameArea = getEl('gravityGameArea')
  gameArea.querySelectorAll('.gravity-hexagon').forEach(h => h.remove())

  // Give the level circle a random muted color where each channel is one hex digit doubled
  const channel = () => (2 + Math.floor(Math.random() * 7)).toString(16).repeat(2)
  getEl('gravityLevelCircle').style.backgroundColor = `#${channel()}${channel()}${channel()}`

  const gravityInput = getEl('gravityInput')
  gravityInput.value = ''
  gravityInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setGravityMessage('')
  gravityGameActive = true
  clearGravityIntervals()

  // Start spawning hexagons
  let spawnIndex = 0
  gravitySpawnInterval = setInterval(() => {
    if (spawnIndex < gravityCurrentWords.length && gravityGameActive) spawnHexagon(gravityCurrentWords[spawnIndex++])
    else if (spawnIndex >= gravityCurrentWords.length) clearInterval(gravitySpawnInterval)
  }, 1500)
  gravityFallInterval = setInterval(updateGravityHexagons, 30)
}

// Spawn a new hexagon with word data
function spawnHexagon(wordData) {
  const gameArea = getEl('gravityGameArea')
  const hexId = gravityNextHexagonId++

  const hex = mkEl('div', { className: 'gravity-hexagon', id: `hex-${hexId}`, innerHTML: `<div class="hexagon-content">${wordData.image ? `<img src="${wordData.image}" />` : ''}${wordData.definition ? `<div class="hexagon-text">${wordData.definition}</div>` : ''}</div>` })
  Object.assign(hex.style, { left: Math.random() * (gameArea.offsetWidth - 120) + 'px', top: '-120px' })
  gameArea.appendChild(hex)
  gravityHexagons.push({ id: hexId, element: hex, term: wordData.term, y: -120, matched: false })
}

// Update positions of falling hexagons where one reaching the bottom ends the game
function updateGravityHexagons() {
  const gameArea = getEl('gravityGameArea')
  const speed = 1.2 * gravitySpeedMultiplier

  for (let i = gravityHexagons.length - 1; i >= 0; i--) {
    const hex = gravityHexagons[i]
    if (hex.matched) continue
    hex.y += speed
    hex.element.style.top = hex.y + 'px'
    if (hex.y <= gameArea.offsetHeight) continue

    // A hexagon reached the bottom so the game is over
    hex.element.remove()
    gravityHexagons.splice(i, 1)
    gravityGameActive = false
    clearGravityIntervals()
    setGravityMessage('Game Over! Starting over...', '#f44336')
    setTimeout(() => {
      gravityLevel = 1
      gravitySpeedMultiplier = 1
      startGravityLevel()
    }, 1500)
  }
}

// Update the level and high score readouts
function updateGravityDisplay() {
  getEl('gravityLevel').textContent = gravityLevel
  getEl('gravityHighScore').textContent = gravityHighScore
}

// Handle gravity input
function handleGravityInput(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const input = e.target.value.trim()
  if (!gravityGameActive) return
  e.target.value = ''

  // Match the lowest matching hexagon closest to landing
  const hex = gravityHexagons.filter(h => !h.matched && h.term.trim().toLowerCase() === input.toLowerCase()).sort((a, b) => b.y - a.y)[0]
  if (!hex) {
    setGravityMessage('Wrong term!', '#ff9800')
    setTimeout(() => setGravityMessage(''), 1000)
    return
  }

  hex.matched = true
  hex.element.classList.add('hexagon-matched')
  gravityEnteredTerms.push(input)
  setTimeout(() => {
    hex.element.remove()
    gravityHexagons.splice(gravityHexagons.indexOf(hex), 1)
  }, 300)

  // Check if all 5 terms have been entered in correct sequence
  if (gravityEnteredTerms.length !== 5) return
  if (JSON.stringify([...gravityEnteredTerms].sort()) !== JSON.stringify(gravityCurrentWords.map(w => w.term).sort())) return

  gravityGameActive = false
  clearGravityIntervals()
  gravityHighScore = Math.max(gravityHighScore, gravityLevel)
  updateGravityDisplay()
  setGravityMessage(`Level ${gravityLevel} Complete!`, '#4CAF50')
  setTimeout(() => {
    gravityLevel++
    gravitySpeedMultiplier += 0.15
    startGravityLevel()
  }, 1000)
}
