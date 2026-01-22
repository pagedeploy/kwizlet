// Global state variables
let data = []
let starredIndices = new Set()
let fcDeck = []
let fcIndex = 0
let flipped = false
let learnDeck = []
let learnIndex = 0
let learnMode = 'term'
let score = 0
let answered = false
let correctLog = []
let summaryJustShown = false

// Match game state
let matchCards = []
let matchSelected = []
let matchTimer = 0
let matchTimerInterval = null
let matchPairsFound = 0
let matchBestTime = null
let matchSelectedElements = []

// Generator state
let termRowCount = 0

// Gravity game state
let gravityLevel = 1
let gravityHighScore = 0
let gravityCurrentWords = []
let gravityHexagons = []
let gravityGameActive = false
let gravitySpeedMultiplier = 1
let gravityNextHexagonId = 0
let gravitySpawnInterval = null
let gravityFallInterval = null
let gravityEnteredTerms = []
let gravityGameStarted = false

// Initialize with one empty row
window.addEventListener('DOMContentLoaded', () => {
  addTermRow()
})

// Add a new term row to the generator
function addTermRow() {
  const container = document.getElementById('termRows')
  const rowId = termRowCount++
  
  const row = document.createElement('div')
  row.className = 'term-row'
  row.id = `row-${rowId}`
  
  row.innerHTML = `
    <input type="text" placeholder="Term" class="term-input" id="term-${rowId}">
    <input type="text" placeholder="Definition" class="definition-input" id="definition-${rowId}">
    <input type="file" accept="image/*" class="image-input" id="image-${rowId}" onchange="handleImageUpload(${rowId})">
    <span class="image-status" id="status-${rowId}"></span>
    <button onclick="removeTermRow(${rowId})" class="remove-btn">×</button>
  `
  
  container.appendChild(row)
}

// Remove a term row
function removeTermRow(rowId) {
  const row = document.getElementById(`row-${rowId}`)
  if (row) {
    row.remove()
  }

  if (document.querySelectorAll('.term-row').length === 0) {
    addTermRow()
  }
}

// Handle image upload and convert to base64
async function handleImageUpload(rowId) {
  const input = document.getElementById(`image-${rowId}`)
  const status = document.getElementById(`status-${rowId}`)
  
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    
    reader.onload = (e) => {
      input.dataset.base64 = e.target.result
      status.textContent = '✓'
      status.style.color = '#4CAF50'
    }
    
    reader.onerror = () => {
      status.textContent = '✗'
      status.style.color = '#f44336'
    }
    
    reader.readAsDataURL(file)
  }
}

// Generate and download the CSV file
function generateCSV() {
  const rows = document.querySelectorAll('.term-row')
  let csvContent = ''
  
  rows.forEach(row => {
    const termInput = row.querySelector('.term-input')
    const defInput = row.querySelector('.definition-input')
    const imgInput = row.querySelector('.image-input')
    
    const term = termInput.value.trim()
    const definition = defInput.value.trim()
    const image = imgInput.dataset.base64 || ''
    
    if (term) {
      const escapedTerm = term.includes(',') ? `"${term}"` : term
      const escapedDef = definition.includes(',') ? `"${definition}"` : definition
      const escapedImage = image ? `"${image}"` : ''
      csvContent += `${escapedTerm},${escapedDef},${escapedImage}\n`
    }
  })
  
  if (!csvContent) {
    alert('Please add at least one term!')
    return
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'kwizlet.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Parse CSV into objects
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/)
  return rows.map(r => {
    const parts = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < r.length; i++) {
      const char = r[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    parts.push(current.trim())
    
    if (parts.length === 4 && parts[2] && parts[2].startsWith('data:image/')) {
      parts[2] = parts[2] + ',' + parts[3]
      parts.pop()
    }
    
    const [term, definition, image] = parts
    return { term, definition, image }
  })
}

// File upload handler
csvFile.onchange = e => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    data = parseCSV(reader.result)
    starredIndices.clear()
    nav.classList.remove('hidden')
    document.getElementById('generator').classList.add('hidden')
    showList()
  }
  reader.readAsText(file)
}

// Show specific view and hide others
function showView(id) {
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
  
  // Clean up gravity intervals if switching away from gravity
  if (id !== 'gravity') {
    if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
    if (gravityFallInterval) clearInterval(gravityFallInterval)
    gravityGameActive = false
  }
}

// Get active terms based on star filter
function getActiveTerms() {
  if (starredIndices.size === 0) {
    return data
  }
  return data.filter((_, idx) => starredIndices.has(idx))
}

// Toggle star status for a term
function toggleStar(index) {
  if (starredIndices.has(index)) {
    starredIndices.delete(index)
  } else {
    starredIndices.add(index)
  }
  showList()
}

// Display list of all terms
function showList() {
  showView('list')
  termList.innerHTML = ''
  data.forEach((d, idx) => {
    const li = document.createElement('li')
    const hasContent = d.definition || d.image
    const isStarred = starredIndices.has(idx)
    const starSymbol = isStarred ? '★' : '☆'
    li.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;"><strong>${d.term}</strong><button class="star-btn ${isStarred ? 'starred' : ''}" onclick="toggleStar(${idx})" style="background:none;border:none;cursor:pointer;font-size:1.2em;padding:0;color:#ffd700;flex-shrink:0;margin:0;">${starSymbol}</button></div>`
      + (d.definition ? `<br>${d.definition}` : '')
      + (d.image ? `<br><img src="${d.image}">` : '')
      + (!hasContent ? '<br>[no definition provided]' : '')
    termList.appendChild(li)
  })
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
  const d = fcDeck[fcIndex]
  if (flipped) {
    const hasContent = d.definition || d.image
    flashcard.innerHTML = hasContent
      ? `${d.definition ? `<div>${d.definition}</div>` : ''}`
      + `${d.image ? `<img src="${d.image}" style="max-width:100%;margin-top:${d.definition ? '10px' : '0'}">` : ''}`
      : '[no definition provided]'
  } else {
    flashcard.innerHTML = d.term
  }
  fcProgress.textContent = `${fcIndex + 1}/${fcDeck.length}`
  fcNextBtn.textContent = (fcIndex === fcDeck.length - 1) ? 'Done' : 'Next'
  fcShuffleBtn.style.display = (fcIndex === fcDeck.length - 1) ? 'none' : 'inline-block'
}

// Flashcard click to flip
flashcard.onclick = () => {
  flipped = !flipped
  flashcard.classList.add('flipping')
  setTimeout(() => {
    renderFlashcard()
  }, 150)
  setTimeout(() => {
    flashcard.classList.remove('flipping')
  }, 300)
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
  if (fcIndex >= fcDeck.length - 1) return
  const remaining = fcDeck.slice(fcIndex + 1)
  shuffle(remaining)
  fcDeck = [...fcDeck.slice(0, fcIndex + 1), ...remaining]
}

// Initialize learn game mode
function startLearn() {
  const activeTerms = getActiveTerms()
  learnDeck = activeTerms.filter(d => d.definition || d.image)
  
  if (learnDeck.length === 0) {
    alert('Need at least 1 term with a definition or image to play Learn!')
    return
  }
  
  learnIndex = 0
  learnMode = 'term'
  score = 0
  correctLog = []
  showView('learn')
  updateLearnModeButton()
  renderLearn()
}

// Render learn question with options
function renderLearn() {
  answered = false
  learnNextBtn.disabled = true
  const correct = learnDeck[learnIndex]

  if (learnMode === 'term') {
    learnTerm.textContent = correct.term
  } else {
    const hasContent = correct.definition || correct.image
    learnTerm.innerHTML = hasContent
      ? `${correct.definition ? `<div>${correct.definition}</div>` : ''}`
      + `${correct.image ? `<img src="${correct.image}" style="max-width:100%;margin-top:${correct.definition ? '10px' : '0'}">` : ''}`
      : '[no definition provided]'
  }

  learnProgress.textContent = `${learnIndex + 1}/${learnDeck.length}`

  const activeTerms = getActiveTerms()
  const validChoices = activeTerms.filter(d => d.definition || d.image)
  let choices = [correct]
  while (choices.length < 4 && choices.length < validChoices.length) {
    const r = validChoices[Math.floor(Math.random() * validChoices.length)]
    if (!choices.includes(r)) choices.push(r)
  }

  // If less than 4 choices, fill with any terms
  options.innerHTML = ''
  shuffle(choices).forEach(c => {
    const div = document.createElement('div')
    div.className = 'option'
    div.dataset.cardId = choices.indexOf(c)

    if (learnMode === 'term') {
      const hasContent = c.definition || c.image
      div.innerHTML = hasContent
        ? `${c.definition ? `<div>${c.definition}</div>` : ''}`
        + `${c.image ? `<img src="${c.image}">` : ''}`
        : '[no definition provided]'
    } else {
      div.textContent = c.term
    }

    div.onclick = () => handleAnswer(div, c === correct, c)
    options.appendChild(div)
  })
}

// Handle answer selection in learn mode
function handleAnswer(div, isCorrect, selectedCard) {
  if (answered) return
  answered = true
  learnNextBtn.disabled = false

  if (isCorrect) {
    div.classList.add('correct')
    score++
    correctLog.push(learnIndex)
  } else {
    div.classList.add('wrong')
    const correct = learnDeck[learnIndex]
    ;[...options.children].forEach(o => {
      if (o !== div) {
        const clickHandler = o.onclick.toString()
        if (learnMode === 'term') {
          if (correct.definition && o.innerHTML.includes(correct.definition)) {
            o.classList.add('correct')
          } else if (!correct.definition && correct.image && o.innerHTML.includes(correct.image)) {
            o.classList.add('correct')
          }
        } else {
          if (o.textContent === correct.term) {
            o.classList.add('correct')
          }
        }
      }
    })
  }
}

// Next button handler for learn mode
learnNextBtn.onclick = () => {
  if (learnIndex === learnDeck.length - 1) {
    showSummary()
  } else {
    learnIndex++
    renderLearn()
  }
}

// Display final score summary
function showSummary() {
  showView('summary')
  summaryJustShown = true
  const percent = Math.round((score / learnDeck.length) * 100)

  let html = `You scored <strong>${score}</strong> out of <strong>${learnDeck.length}</strong> (${percent}%).<br><br>`

  if (score < learnDeck.length) {
    html += '<strong>Missed terms:</strong><ul>'
    learnDeck.forEach((d, i) => {
      if (!correctLog.includes(i)) {
        html += `<li>${d.term}</li>`
      }
    })
    html += '</ul>'
    retryMissedBtn.classList.remove('hidden')
  } else {
    retryMissedBtn.classList.add('hidden')
  }

  scoreText.innerHTML = html
}

// Retry only missed questions
function retryMissed() {
  const missed = learnDeck.filter((d, i) => !correctLog.includes(i))
  learnDeck = missed
  learnIndex = 0
  score = 0
  correctLog = []
  showView('learn')
  updateLearnModeButton()
  renderLearn()
}

// Toggle between term and definition modes
function toggleLearnMode() {
  learnMode = learnMode === 'term' ? 'definition' : 'term'
  learnIndex = 0
  score = 0
  correctLog = []
  updateLearnModeButton()
  renderLearn()
}

// Update learn mode button text
function updateLearnModeButton() {
  learnModeBtn.textContent = learnMode === 'term'
    ? 'Switch to Definition Mode'
    : 'Switch to Term Mode'
}

// Shuffle remaining learn questions
function shuffleRemainingLearn() {
  if (learnIndex >= learnDeck.length - 1) return
  const remaining = learnDeck.slice(learnIndex + 1)
  shuffle(remaining)
  learnDeck = [...learnDeck.slice(0, learnIndex + 1), ...remaining]
}

// New Match game mode functions
function startMatch() {
  const activeTerms = getActiveTerms()
  const validTerms = activeTerms.filter(d => (d.term && (d.definition || d.image)))
  
  if (validTerms.length < 6) {
    matchMessage.innerHTML = '<span style="color:#4255ff;font-weight:bold;">Not Enough Terms</span>'
    matchStartBtn.style.display = 'none'
  } else {
    const timeValue = matchBestTime !== null ? `${matchBestTime.toFixed(1)}s` : 'Null'
    matchMessage.innerHTML = `<span style="color:#4255ff;font-weight:bold;">Best Time: ${timeValue}</span>`
    matchStartBtn.style.display = 'inline-block'
  }
  
  showView('match')
  matchSetup.style.display = 'block'
  matchGame.classList.add('hidden')
}

// Initialize and start the match game
function startMatchGame() {
  const activeTerms = getActiveTerms()
  const validTerms = activeTerms.filter(d => (d.term && (d.definition || d.image)))
  const selected = shuffle([...validTerms]).slice(0, 6)
  
  matchCards = []
  selected.forEach((item, idx) => {
    matchCards.push({
      id: idx * 2,
      pairId: idx,
      type: 'term',
      content: item.term,
      matched: false
    })
    
    const defContent = item.definition || ''
    const imgContent = item.image || ''
    matchCards.push({
      id: idx * 2 + 1,
      pairId: idx,
      type: 'definition',
      content: defContent,
      image: imgContent,
      matched: false
    })
  })
  
  shuffle(matchCards)
  
  matchSelected = []
  matchSelectedElements = []
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

// Render the match game grid
function renderMatchGrid() {
  const grid = document.getElementById('matchGrid')
  grid.innerHTML = ''
  
  matchCards.forEach(card => {
    const cardEl = document.createElement('div')
    cardEl.className = 'match-card'
    
    if (card.matched) {
      cardEl.classList.add('matched')
      cardEl.style.visibility = 'hidden'
    } else {
      if (card.type === 'term') {
        cardEl.textContent = card.content
      } else {
        if (card.content) {
          cardEl.textContent = card.content
        }
        if (card.image) {
          const img = document.createElement('img')
          img.src = card.image
          cardEl.innerHTML = ''
          if (card.content) {
            const text = document.createElement('div')
            text.textContent = card.content
            cardEl.appendChild(text)
          }
          cardEl.appendChild(img)
        }
      }
      
      cardEl.onclick = () => selectMatchCard(card, cardEl)
    }
    
    grid.appendChild(cardEl)
  })
}

// Handle card selection in match game
function selectMatchCard(card, element) {
  if (card.matched || matchSelected.includes(card)) return
  
  element.classList.add('selected')
  matchSelected.push(card)
  matchSelectedElements.push(element)
  
  if (matchSelected.length === 2) {
    const [first, second] = matchSelected
    const [firstEl, secondEl] = matchSelectedElements
    
    if (first.pairId === second.pairId) {
      firstEl.classList.remove('selected')
      secondEl.classList.remove('selected')
      firstEl.classList.add('correct-match')
      secondEl.classList.add('correct-match')
      
      first.matched = true
      second.matched = true
      matchPairsFound++
      
      // Brief delay before re-rendering
      setTimeout(() => {
        renderMatchGrid()
        matchSelected = []
        matchSelectedElements = []
        
        if (matchPairsFound === 6) {
          clearInterval(matchTimerInterval)
          const finalTime = matchTimer
          
          if (matchBestTime === null || finalTime < matchBestTime) {
            matchBestTime = finalTime
          }
          
          setTimeout(() => {
            startMatch()
          }, 150)
        }
      }, 250)
    } else {
      firstEl.classList.remove('selected')
      secondEl.classList.remove('selected')
      firstEl.classList.add('wrong-match')
      secondEl.classList.add('wrong-match')
      
      setTimeout(() => {
        firstEl.classList.remove('wrong-match')
        secondEl.classList.remove('wrong-match')
        matchSelected = []
        matchSelectedElements = []
      }, 400)
    }
  }
}


// Keyboard shortcut handlers
document.addEventListener('keydown', e => {
  if (!flashcards.classList.contains('hidden')) {
    if (e.code === 'Space') {
      e.preventDefault()
      flashcard.click()
    }
    if (e.key === 'Enter' || (e.key === 'Escape' && fcIndex === fcDeck.length - 1)) {
      e.preventDefault()
      fcNextBtn.click()
    }
  }

  if (!learn.classList.contains('hidden')) {
    if (e.key >= '1' && e.key <= '4') {
      const idx = Number(e.key) - 1
      if (options.children[idx]) options.children[idx].click()
    }
    if (e.key === 'Enter' && !learnNextBtn.disabled) {
      e.preventDefault()
      learnNextBtn.click()
    }
  }

  if (!summary.classList.contains('hidden')) {
    if (e.key === 'Enter' && !summaryJustShown) {
      e.preventDefault()
      if (!retryMissedBtn.classList.contains('hidden')) {
        retryMissedBtn.click()
      } else {
        showList()
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      showList()
    }
  }
})

// Summary just shown flag reset
document.addEventListener('keyup', e => {
  if (e.key === 'Enter' && !summary.classList.contains('hidden')) {
    summaryJustShown = false
  }
})

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5)
}

// Gravity game functions
function startGravity() {
  const activeTerms = getActiveTerms()
  const validTerms = activeTerms.filter(d => (d.term && (d.definition || d.image)))
  
  if (validTerms.length < 1) {
    alert('Need at least 1 term with a definition or image to play Gravity!')
    return
  }
  
  gravityLevel = 1
  gravitySpeedMultiplier = 1
  gravityCurrentWords = []
  gravityHexagons = []
  gravityNextHexagonId = 0
  gravityGameStarted = false
  gravityEnteredTerms = []
  
  showView('gravity')
  document.getElementById('gravityToggleBtn').textContent = 'Start Game'
  document.getElementById('gravityGameContainer').classList.add('hidden')
  updateGravityDisplay()
}

function toggleGravityGame() {
  if (!gravityGameStarted) {
    startGravityGame()
  } else {
    stopGravityGame()
  }
}

// Start the gravity game
function startGravityGame() {
  gravityGameStarted = true
  gravityEnteredTerms = []
  document.getElementById('gravityToggleBtn').textContent = 'Stop Game'
  document.getElementById('gravityGameContainer').classList.remove('hidden')
  startGravityLevel()
}

// Stop the gravity game
function stopGravityGame() {
  if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
  if (gravityFallInterval) clearInterval(gravityFallInterval)
  gravityGameActive = false
  gravityGameStarted = false
  document.getElementById('gravityToggleBtn').textContent = 'Start Game'
  document.getElementById('gravityGameContainer').classList.add('hidden')
}

// Start a new level in the gravity game
function startGravityLevel() {
  const activeTerms = getActiveTerms()
  const validTerms = activeTerms.filter(d => (d.term && (d.definition || d.image)))
  gravityCurrentWords = []
  
  for (let i = 0; i < 5; i++) {
    gravityCurrentWords.push(validTerms[Math.floor(Math.random() * validTerms.length)])
  }
  
  gravityEnteredTerms = []
  gravityHexagons = []
  gravityNextHexagonId = 0
  
  const gameArea = document.getElementById('gravityGameArea')
  
  const hexagons = gameArea.querySelectorAll('.gravity-hexagon')
  hexagons.forEach(h => h.remove())
  
  const levelCircle = document.getElementById('gravityLevelCircle')
  const r = (2 + Math.floor(Math.random() * 7)).toString(16)
  const g = (2 + Math.floor(Math.random() * 7)).toString(16)
  const b = (2 + Math.floor(Math.random() * 7)).toString(16)
  levelCircle.style.backgroundColor = `#${r}${r}${g}${g}${b}${b}`
  
  const gravityInput = document.getElementById('gravityInput')
  gravityInput.value = ''
  gravityInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
  
  const gravityMessage = document.getElementById('gravityMessage')
  gravityMessage.textContent = ''
  
  gravityGameActive = true
  
  if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
  if (gravityFallInterval) clearInterval(gravityFallInterval)
  
  // Start spawning hexagons
  let spawnIndex = 0
  gravitySpawnInterval = setInterval(() => {
    if (spawnIndex < gravityCurrentWords.length && gravityGameActive) {
      const word = gravityCurrentWords[spawnIndex]
      spawnHexagon(word)
      spawnIndex++
    } else if (spawnIndex >= gravityCurrentWords.length) {
      clearInterval(gravitySpawnInterval)
    }
  }, 1500)

  gravityFallInterval = setInterval(() => {
    updateGravityHexagons()
  }, 30)
}

// Spawn a new hexagon with word data
function spawnHexagon(wordData) {
  const gameArea = document.getElementById('gravityGameArea')
  const hexId = gravityNextHexagonId++
  
  const hex = document.createElement('div')
  hex.className = 'gravity-hexagon'
  hex.id = `hex-${hexId}`
  
  const content = wordData.definition || ''
  const image = wordData.image || ''
  
  hex.innerHTML = `
    <div class="hexagon-content">
      ${image ? `<img src="${image}" />` : ''}
      ${content ? `<div class="hexagon-text">${content}</div>` : ''}
    </div>
  `
  
  hex.style.left = Math.random() * (gameArea.offsetWidth - 120) + 'px'
  hex.style.top = '-120px'
  
  gameArea.appendChild(hex)
  
  gravityHexagons.push({
    id: hexId,
    element: hex,
    term: wordData.term,
    y: -120,
    matched: false
  })
}

// Update positions of falling hexagons
function updateGravityHexagons() {
  const gameArea = document.getElementById('gravityGameArea')
  const speed = 1.2 * gravitySpeedMultiplier
  
  for (let i = gravityHexagons.length - 1; i >= 0; i--) {
    const hex = gravityHexagons[i]
    
    if (!hex.matched) {
      hex.y += speed
      hex.element.style.top = hex.y + 'px'
      
      if (hex.y > gameArea.offsetHeight) {
        hex.element.remove()
        gravityHexagons.splice(i, 1)
        gravityGameActive = false
        
        if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
        if (gravityFallInterval) clearInterval(gravityFallInterval)
        
        const message = document.getElementById('gravityMessage')
        message.textContent = 'Game Over! Starting over...'
        message.style.color = '#f44336'
        
        setTimeout(() => {
          gravityLevel = 1
          gravitySpeedMultiplier = 1
          startGravityLevel()
        }, 1500)
      }
    }
  }
}

function updateGravityDisplay() {
  document.getElementById('gravityLevel').textContent = gravityLevel
  document.getElementById('gravityHighScore').textContent = gravityHighScore
}

// Handle gravity input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('gravityInput')
  if (inp) {
    inp.addEventListener('keydown', handleGravityInput)
  }
})

// Also attach to the element directly
setTimeout(() => {
  const inp = document.getElementById('gravityInput')
  if (inp) {
    inp.addEventListener('keydown', handleGravityInput)
  }
}, 100)

// Handle gravity input
function handleGravityInput(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const input = e.target.value.trim()
    
    if (!gravityGameActive) {
      return
    }
    
    let matchingHex = null
    let maxY = -Infinity
    
    for (let i = 0; i < gravityHexagons.length; i++) {
      const hex = gravityHexagons[i]
      
      if (!hex.matched && hex.term.trim().toLowerCase() === input.toLowerCase()) {
        if (hex.y > maxY) {
          maxY = hex.y
          matchingHex = { hex, index: i }
        }
      }
    }
    
    if (matchingHex) {
      const hex = matchingHex.hex
      const i = matchingHex.index
      
      hex.matched = true
      hex.element.classList.add('hexagon-matched')
      gravityEnteredTerms.push(input)
      
      setTimeout(() => {
        hex.element.remove()
        gravityHexagons.splice(i, 1)
      }, 300)
      
      // Check if all 5 terms have been entered in correct sequence
      if (gravityEnteredTerms.length === 5) {
        const generatedTerms = gravityCurrentWords.map(w => w.term)
        const termsMatch = JSON.stringify(gravityEnteredTerms.sort()) === JSON.stringify(generatedTerms.sort())
        
        if (termsMatch && gravityEnteredTerms.length === 5) {
          gravityGameActive = false
          if (gravitySpawnInterval) clearInterval(gravitySpawnInterval)
          if (gravityFallInterval) clearInterval(gravityFallInterval)
          
          gravityHighScore = Math.max(gravityHighScore, gravityLevel)
          updateGravityDisplay()
          
          const message = document.getElementById('gravityMessage')
          message.textContent = `Level ${gravityLevel} Complete!`
          message.style.color = '#4CAF50'
          
          setTimeout(() => {
            gravityLevel++
            gravitySpeedMultiplier += 0.15
            startGravityLevel()
          }, 1000)
        }
      }
      e.target.value = ''
      return
    }
    
    const message = document.getElementById('gravityMessage')
    message.textContent = 'Wrong term!'
    message.style.color = '#ff9800'
    
    setTimeout(() => {
      message.textContent = ''
    }, 1000)
    
    e.target.value = ''
  }
}
