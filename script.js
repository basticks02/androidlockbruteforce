// ── Dot positions ──────────────────────────────────────────────
// Grid: 0 1 2
//        3 4 5
//        6 7 8
function dotPos(i, size = 240) {
  const pad = size * 0.2;
  const cell = (size - pad * 2) / 2;
  const col = i % 3, row = Math.floor(i / 3);
  return { x: pad + col * cell, y: pad + row * cell };
}
// ── Sound effect ──────────────────────────────────────────────
function playConnectSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Ignore if audio not supported
  }
}
// ── Android skip rules ─────────────────────────────────────────
const SKIP_MAP = {};
function addSkip(a, b, mid) {
  SKIP_MAP[`${a},${b}`] = mid;
  SKIP_MAP[`${b},${a}`] = mid;
}
addSkip(0, 2, 1);
addSkip(0, 6, 3);
addSkip(0, 8, 4);
addSkip(1, 7, 4);
addSkip(2, 6, 4);
addSkip(2, 8, 5);
addSkip(3, 5, 4);
addSkip(6, 8, 7);
function isValidMove(from, to, visited) {
  if (visited.has(to)) return false;
  const mid = SKIP_MAP[`${from},${to}`];
  if (mid !== undefined && !visited.has(mid)) return false;
  return true;
}
// ── Generate ALL valid patterns ────────────────────────────────
function generateAllPatterns(minLen = 4) {
  const results = [];
  function dfs(path, visited) {
    if (path.length >= minLen) {
      results.push([...path]);
    }
    if (path.length === 9) return;
    const last = path[path.length - 1];
    for (let next = 0; next < 9; next++) {
      if (isValidMove(last, next, visited)) {
        path.push(next);
        visited.add(next);
        dfs(path, visited);
        path.pop();
        visited.delete(next);
      }
    }
  }
  for (let start = 0; start < 9; start++) {
    dfs([start], new Set([start]));
  }
  return results;
}
// ── Human-likelihood scoring ──────────────────────────────────
// Lower score = more likely a human would pick this pattern.
// People prefer: corners, edges first, continuing same direction,
// adjacent moves, shorter patterns.
const CORNERS = new Set([0, 2, 6, 8]);
const EDGES = new Set([1, 3, 5, 7]);
const PERIMETER = new Set([0, 1, 2, 3, 5, 6, 7, 8]);

function scorePattern(pattern) {
  let score = 0;
  const start = pattern[0];

  // Starting position: top-left most common, then corners, edges, center
  if (start === 0) score -= 3;
  else if (CORNERS.has(start)) score -= 2;
  else if (EDGES.has(start)) score -= 1;
  else score += 2;

  // Shorter patterns are far more common (4-5 dots)
  score += (pattern.length - 4) * 3;

  for (let i = 1; i < pattern.length; i++) {
    const prev = pattern[i - 1];
    const curr = pattern[i];
    const prevCol = prev % 3, prevRow = Math.floor(prev / 3);
    const currCol = curr % 3, currRow = Math.floor(curr / 3);
    const dx = Math.abs(currCol - prevCol);
    const dy = Math.abs(currRow - prevRow);

    // Adjacent/diagonal moves are natural, jumps are unusual
    if (dx <= 1 && dy <= 1) {
      score -= 1;
    } else {
      score += 3;
    }

    // Staying on the perimeter is preferred (people trace edges first)
    if (PERIMETER.has(curr)) {
      score -= 1;
    } else {
      score += 1;
    }

    // Direction continuity: continuing the same sweep direction is very human
    // e.g. 1→2→3→6 (right then down along edge)
    if (i >= 2) {
      const prevPrev = pattern[i - 2];
      const ppCol = prevPrev % 3, ppRow = Math.floor(prevPrev / 3);
      const s1x = Math.sign(prevCol - ppCol), s1y = Math.sign(prevRow - ppRow);
      const s2x = Math.sign(currCol - prevCol), s2y = Math.sign(currRow - prevRow);
      if (s1x === s2x && s1y === s2y) {
        score -= 3; // same direction = very likely
      } else if (s1x === s2x || s1y === s2y) {
        score -= 1; // partial continuity (same axis)
      }
    }
  }
  return score;
}

function sortByLikelihood(patterns) {
  // Pre-compute scores then sort ascending (lowest = most human-like first)
  const scored = patterns.map((p, i) => ({ p, s: scorePattern(p), i }));
  scored.sort((a, b) => a.s - b.s || a.i - b.i);
  return scored.map(x => x.p);
}

// ── Canvas drawing helpers ─────────────────────────────────────
function drawGrid(ctx, pattern = [], size = 240, { dotColor = '#444', lineColor = '#888', activeColor = '#fff', highlightLast = false, found = false } = {}) {
  const pad = size * 0.2;
  const cell = (size - pad * 2) / 2;
  const dotRadius = size * 14 / 240;
  const innerRadius = size * 5 / 240;
  const fontSize = Math.round(size * 10 / 240);

  ctx.clearRect(0, 0, size, size);
  // Draw lines
  if (pattern.length > 1) {
    ctx.strokeStyle = found ? '#44dd88' : lineColor;
    ctx.lineWidth = found ? 4 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const p0 = dotPos(pattern[0], size);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pattern.length; i++) {
      const p = dotPos(pattern[i], size);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  // Draw dots
  const patternSet = new Set(pattern);
  for (let i = 0; i < 9; i++) {
    const { x, y } = dotPos(i, size);
    const inPattern = patternSet.has(i);
    const isLast = highlightLast && pattern.length > 0 && pattern[pattern.length - 1] === i;
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    if (found && inPattern) {
      ctx.fillStyle = '#1a3a2a';
    } else if (inPattern) {
      ctx.fillStyle = '#222';
    } else {
      ctx.fillStyle = '#111';
    }
    ctx.fill();
    ctx.strokeStyle = inPattern ? (found ? '#44dd88' : activeColor) : dotColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    if (found && inPattern) {
      ctx.fillStyle = '#44dd88';
    } else if (isLast) {
      ctx.fillStyle = '#ccc';
    } else if (inPattern) {
      ctx.fillStyle = activeColor;
    } else {
      ctx.fillStyle = '#333';
    }
    ctx.fill();
    // Number label
    ctx.fillStyle = inPattern ? (found ? '#44dd88' : '#ccc') : '#444';
    ctx.font = `${fontSize}px 'Source Code Pro', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, x, y + dotRadius + Math.round(size * 12 / 240));
  }
}
// ── Target pattern UI ──────────────────────────────────────────
const targetCanvas = document.getElementById('targetCanvas');
const targetCtx = targetCanvas.getContext('2d');
let targetPattern = [];
function redrawTarget() {
  const size = targetCanvas.width;
  drawGrid(targetCtx, targetPattern, size, {
    lineColor: '#999',
    activeColor: '#fff',
    highlightLast: true,
    found: false
  });
  const display = document.getElementById('targetDisplay');
  if (targetPattern.length === 0) {
    display.innerHTML = 'No target set';
  } else if (targetPattern.length < 4) {
    display.innerHTML = `<span>${targetPattern.map(d => d + 1).join(' → ')}</span> (need ${4 - targetPattern.length} more)`;
  } else {
    display.innerHTML = `<span>${targetPattern.map(d => d + 1).join(' → ')}</span> (${targetPattern.length} dots)`;
  }
  document.getElementById('startBtn').disabled = targetPattern.length < 4 || running;
}
targetCanvas.addEventListener('click', (e) => {
  if (running) return;
  const rect = targetCanvas.getBoundingClientRect();
  const size = targetCanvas.width;
  const scaleX = size / rect.width;
  const scaleY = size / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const hitRadius = (size * 14 / 240) + 6;
  for (let i = 0; i < 9; i++) {
    const { x, y } = dotPos(i, size);
    const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
    if (dist < hitRadius) {
      if (targetPattern.includes(i)) {
        break;
      }
      if (targetPattern.length === 0) {
        targetPattern.push(i);
      } else if (isValidMove(targetPattern[targetPattern.length - 1], i, new Set(targetPattern))) {
        targetPattern.push(i);
      } else {
        break;
      }
      playConnectSound();
      redrawTarget();
      break;
    }
  }
});
document.getElementById('clearTarget').addEventListener('click', () => {
  if (running) return;
  targetPattern = [];
  redrawTarget();
});
redrawTarget();
// ── Brute force canvas ────────────────────────────────────────
const bruteCanvas = document.getElementById('bruteCanvas');
const bruteCtx = bruteCanvas.getContext('2d');
drawGrid(bruteCtx, [], bruteCanvas.width);
// ── Speed settings ─────────────────────────────────────────────
const SPEED_LEVELS = [
  { label: '1/s', delay: 1000 },
  { label: '10/s', delay: 100 },
  { label: '50/s', delay: 20 },
  { label: '100/s', delay: 10 },
  { label: '500/s', delay: 2 },
  { label: '2000/s', delay: 0.5 },
  { label: 'Max', delay: 0 },
];
const speedSlider = document.getElementById('speedSlider');
const speedLabel = document.getElementById('speedLabel');
speedSlider.addEventListener('input', () => {
  speedLabel.textContent = SPEED_LEVELS[speedSlider.value].label;
});
speedLabel.textContent = SPEED_LEVELS[speedSlider.value].label;
// ── Terminal & Stats ──────────────────────────────────────────
const elProgress = document.getElementById('progressFill');
const elProgressText = document.getElementById('progressText');
const elLog = document.getElementById('logBox');
const elTerminalStatus = document.getElementById('terminalStatus');

function updateTerminalStatus(status, attempts, total, elapsed, currentPattern) {
  let text = `[${status}]`;
  if (total > 0) {
    text += ` ${attempts.toLocaleString()} / ${total.toLocaleString()}`;
  }
  if (elapsed !== null) {
    text += ` | ${elapsed}s`;
  }
  if (currentPattern) {
    text += ` | ${currentPattern}`;
  }
  elTerminalStatus.textContent = text;

  // Update class for color
  elTerminalStatus.className = 'terminal-status';
  if (status === 'FOUND') {
    elTerminalStatus.classList.add('found');
  } else if (status === 'SEARCHING') {
    elTerminalStatus.classList.add('searching');
  }
}

function addLog(text, cls = '') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = '> ' + text;
  elLog.appendChild(div);
  elLog.scrollTop = elLog.scrollHeight;
  while (elLog.children.length > 200) elLog.removeChild(elLog.firstChild);
}
// ── Brute Force Engine ─────────────────────────────────────────
let running = false;
let stopRequested = false;
async function runBruteForce() {
  running = true;
  stopRequested = false;
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('clearTarget').disabled = true;
  document.getElementById('minLength').disabled = true;
  elLog.innerHTML = '';
  updateTerminalStatus('GENERATING', 0, 0, null, null);
  // Generate patterns
  const minLen = parseInt(document.getElementById('minLength').value);
  await new Promise(r => setTimeout(r, 50));
  const rawPatterns = generateAllPatterns(minLen);
  addLog(`${rawPatterns.length.toLocaleString()} patterns (min ${minLen} dots)`);
  updateTerminalStatus('SORTING', 0, 0, null, null);
  addLog('sorting by human likelihood...');
  await new Promise(r => setTimeout(r, 10));
  const allPatterns = sortByLikelihood(rawPatterns);
  const total = allPatterns.length;
  addLog(`target: [${targetPattern.map(d => d + 1).join(', ')}]`);
  addLog('searching (common patterns first)...');
  updateTerminalStatus('SEARCHING', 0, total, '0.0', null);
  const targetStr = targetPattern.join(',');
  let attempts = 0;
  const startTime = performance.now();
  let lastDraw = performance.now();
  for (let i = 0; i < total; i++) {
    if (stopRequested) {
      updateTerminalStatus('STOPPED', attempts, total, ((performance.now() - startTime) / 1000).toFixed(1), null);
      addLog(`stopped after ${attempts.toLocaleString()} attempts`);
      break;
    }
    const pattern = allPatterns[i];
    attempts++;
    const speed = SPEED_LEVELS[speedSlider.value];
    const now = performance.now();
    let shouldDraw = false;
    if (speed.delay === 0) {
      if (now - lastDraw > 30) shouldDraw = true;
    } else if (speed.delay < 1) {
      if (now - lastDraw > 1) shouldDraw = true;
    } else {
      shouldDraw = true;
    }
    const matched = pattern.join(',') === targetStr;
    if (shouldDraw || matched) {
      drawGrid(bruteCtx, pattern, bruteCanvas.width, { highlightLast: true, found: matched });
      const patternStr = pattern.map(d => d + 1).join(' → ');
      const pct = ((attempts / total) * 100).toFixed(1);
      elProgress.style.width = pct + '%';
      elProgressText.textContent = `${pct}%`;
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      updateTerminalStatus('SEARCHING', attempts, total, elapsed, patternStr);
      lastDraw = now;
    }
    if (matched) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      updateTerminalStatus('FOUND', attempts, total, elapsed, pattern.map(d => d + 1).join(' → '));
      addLog(`FOUND [${pattern.map(d => d + 1).join(', ')}] in ${attempts.toLocaleString()} attempts, ${elapsed}s`, 'hit');
      drawGrid(bruteCtx, pattern, bruteCanvas.width, { found: true });
      break;
    }
    // Pacing
    if (speed.delay > 0) {
      await new Promise(r => setTimeout(r, speed.delay));
    } else if (speed.delay === 0) {
      if (attempts % 500 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    } else {
      if (attempts % 100 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  if (!stopRequested && !elTerminalStatus.classList.contains('found')) {
    const finalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    updateTerminalStatus('NOT FOUND', attempts, total, finalElapsed, null);
    addLog('pattern not found in generated set.');
  }
  // Final stats
  const finalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  if (elTerminalStatus.classList.contains('found')) {
    // Already updated
  }
  running = false;
  document.getElementById('startBtn').disabled = targetPattern.length < 4;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('clearTarget').disabled = false;
  document.getElementById('minLength').disabled = false;
}
document.getElementById('startBtn').addEventListener('click', runBruteForce);
document.getElementById('stopBtn').addEventListener('click', () => { stopRequested = true; });
// ── Responsive canvas resize ──────────────────────────────────
function resizeCanvases() {
  const targetWrapper = targetCanvas.parentElement;
  const targetSize = targetWrapper.clientWidth;
  if (targetSize > 0) {
    targetCanvas.width = targetSize;
    targetCanvas.height = targetSize;
    redrawTarget();
  }
  const bruteWrapper = bruteCanvas.parentElement;
  const bruteSize = bruteWrapper.clientWidth;
  if (bruteSize > 0) {
    bruteCanvas.width = bruteSize;
    bruteCanvas.height = bruteSize;
    drawGrid(bruteCtx, [], bruteSize);
  }
}
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvases, 150);
});
// Initial sizing
resizeCanvases();
