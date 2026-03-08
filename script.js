// ── Dot positions ──────────────────────────────────────────────
// Grid: 0 1 2
//        3 4 5
//        6 7 8
const DOT_RADIUS = 14;
const GRID_PAD = 48;
const GRID_SIZE = 240;
const CELL = (GRID_SIZE - GRID_PAD * 2) / 2;
function dotPos(i) {
  const col = i % 3, row = Math.floor(i / 3);
  return { x: GRID_PAD + col * CELL, y: GRID_PAD + row * CELL };
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
// If going from a→b, and mid is between them, mid must be visited already.
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
// ── Canvas drawing helpers ─────────────────────────────────────
function drawGrid(ctx, pattern = [], { dotColor = '#334', lineColor = '#4466cc', activeColor = '#6688ff', highlightLast = false, found = false } = {}) {
  ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
  // Draw lines
  if (pattern.length > 1) {
    ctx.strokeStyle = found ? '#44dd88' : lineColor;
    ctx.lineWidth = found ? 4 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const p0 = dotPos(pattern[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pattern.length; i++) {
      const p = dotPos(pattern[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  // Draw dots
  const patternSet = new Set(pattern);
  for (let i = 0; i < 9; i++) {
    const { x, y } = dotPos(i);
    const inPattern = patternSet.has(i);
    const isLast = highlightLast && pattern.length > 0 && pattern[pattern.length - 1] === i;
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    if (found && inPattern) {
      ctx.fillStyle = '#1a4a2a';
    } else if (inPattern) {
      ctx.fillStyle = '#1a1a4a';
    } else {
      ctx.fillStyle = '#1a1a2a';
    }
    ctx.fill();
    ctx.strokeStyle = inPattern ? (found ? '#44dd88' : activeColor) : dotColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    if (found && inPattern) {
      ctx.fillStyle = '#44dd88';
    } else if (isLast) {
      ctx.fillStyle = '#aabbff';
    } else if (inPattern) {
      ctx.fillStyle = activeColor;
    } else {
      ctx.fillStyle = '#445';
    }
    ctx.fill();
    // Number label
    ctx.fillStyle = inPattern ? (found ? '#88ffbb' : '#aabbff') : '#444';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, x, y + DOT_RADIUS + 12);
  }
}
// ── Target pattern UI ──────────────────────────────────────────
const targetCanvas = document.getElementById('targetCanvas');
const targetCtx = targetCanvas.getContext('2d');
let targetPattern = [];
function redrawTarget() {
  drawGrid(targetCtx, targetPattern, {
    lineColor: '#22aa66',
    activeColor: '#44dd88',
    highlightLast: true,
    found: false
  });
  const display = document.getElementById('targetDisplay');
  if (targetPattern.length === 0) {
    display.innerHTML = 'No target set';
  } else if (targetPattern.length < 4) {
    display.innerHTML = `Pattern: <span>${targetPattern.map(d => d + 1).join(' → ')}</span> (need ${4 - targetPattern.length} more)`;
  } else {
    display.innerHTML = `Target: <span>${targetPattern.map(d => d + 1).join(' → ')}</span> (${targetPattern.length} dots)`;
  }
  document.getElementById('startBtn').disabled = targetPattern.length < 4 || running;
}
targetCanvas.addEventListener('click', (e) => {
  if (running) return;
  const rect = targetCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  for (let i = 0; i < 9; i++) {
    const { x, y } = dotPos(i);
    const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
    if (dist < DOT_RADIUS + 6) {
      // Check if valid move
      if (targetPattern.includes(i)) {
        // If clicking the last dot again, finalize
        break;
      }
      if (targetPattern.length === 0) {
        targetPattern.push(i);
      } else if (isValidMove(targetPattern[targetPattern.length - 1], i, new Set(targetPattern))) {
        targetPattern.push(i);
      } else {
        // Flash red briefly
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
drawGrid(bruteCtx);
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
// ── Stats ──────────────────────────────────────────────────────
const elAttempts = document.getElementById('attemptCount');
const elTotal = document.getElementById('totalPatterns');
const elElapsed = document.getElementById('elapsed');
const elStatus = document.getElementById('status');
const elCurrent = document.getElementById('currentAttempt');
const elProgress = document.getElementById('progressFill');
const elProgressText = document.getElementById('progressText');
const elLog = document.getElementById('logBox');
function addLog(text, cls = '') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  elLog.appendChild(div);
  elLog.scrollTop = elLog.scrollHeight;
  // Keep max 200 entries
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
  elStatus.textContent = 'Generating...';
  elStatus.className = 'value searching';
  // Generate patterns
  const minLen = parseInt(document.getElementById('minLength').value);
  await new Promise(r => setTimeout(r, 50)); // let UI update
  const allPatterns = generateAllPatterns(minLen);
  const total = allPatterns.length;
  elTotal.textContent = total.toLocaleString();
  addLog(`Generated ${total.toLocaleString()} valid patterns (min ${minLen} dots)`);
  addLog(`Target: [${targetPattern.map(d => d + 1).join(', ')}]`);
  addLog('Starting brute force...');
  elStatus.textContent = 'Searching';
  const targetStr = targetPattern.join(',');
  let attempts = 0;
  const startTime = performance.now();
  let lastDraw = performance.now();
  for (let i = 0; i < total; i++) {
    if (stopRequested) {
      elStatus.textContent = 'Stopped';
      addLog(`Stopped after ${attempts.toLocaleString()} attempts`);
      break;
    }
    const pattern = allPatterns[i];
    attempts++;
    const speed = SPEED_LEVELS[speedSlider.value];
    const now = performance.now();
    // Decide whether to draw this frame
    let shouldDraw = false;
    if (speed.delay === 0) {
      // Max speed: draw every ~30ms
      if (now - lastDraw > 30) shouldDraw = true;
    } else if (speed.delay < 1) {
      if (now - lastDraw > 1) shouldDraw = true;
    } else {
      shouldDraw = true;
    }
    const matched = pattern.join(',') === targetStr;
    if (shouldDraw || matched) {
      drawGrid(bruteCtx, pattern, { highlightLast: true, found: matched });
      elAttempts.textContent = attempts.toLocaleString();
      elCurrent.textContent = pattern.map(d => d + 1).join(' → ');
      const pct = ((attempts / total) * 100).toFixed(1);
      elProgress.style.width = pct + '%';
      elProgressText.textContent = `${pct}% (${attempts.toLocaleString()} / ${total.toLocaleString()})`;
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      elElapsed.textContent = elapsed + 's';
      lastDraw = now;
    }
    if (matched) {
      elStatus.textContent = 'FOUND!';
      elStatus.className = 'value found';
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      addLog(`FOUND pattern [${pattern.map(d => d + 1).join(', ')}] after ${attempts.toLocaleString()} attempts in ${elapsed}s`, 'hit');
      drawGrid(bruteCtx, pattern, { found: true });
      break;
    }
    // Pacing
    if (speed.delay > 0) {
      await new Promise(r => setTimeout(r, speed.delay));
    } else if (speed.delay === 0) {
      // Yield to UI occasionally at max speed
      if (attempts % 500 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    } else {
      if (attempts % 100 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
  if (!stopRequested && elStatus.textContent === 'Searching') {
    elStatus.textContent = 'Not Found';
    addLog('Pattern not found in generated set.');
  }
  // Final stats update
  const finalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  elElapsed.textContent = finalElapsed + 's';
  elAttempts.textContent = attempts.toLocaleString();
  running = false;
  document.getElementById('startBtn').disabled = targetPattern.length < 4;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('clearTarget').disabled = false;
  document.getElementById('minLength').disabled = false;
}
document.getElementById('startBtn').addEventListener('click', runBruteForce);
document.getElementById('stopBtn').addEventListener('click', () => { stopRequested = true; });
// Initial draw
drawGrid(bruteCtx);