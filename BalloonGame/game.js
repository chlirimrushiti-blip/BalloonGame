const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const uiWorld = document.getElementById("uiWorld");
const uiLevel = document.getElementById("uiLevel");
const uiBalloons = document.getElementById("uiBalloons");
const uiArrows = document.getElementById("uiArrows");
const uiTime = document.getElementById("uiTime");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const btnPlay = document.getElementById("btnPlay");
const btnLevelSelect = document.getElementById("btnLevelSelect");

// AUDIO
const popSound = document.getElementById("popSound");
const bgMusic = document.getElementById("bgMusic");

let bgStarted = false;

function startBgMusic() {
  if (!bgMusic || bgStarted) return;
  bgStarted = true;
  try {
    bgMusic.volume = 0.25;
    bgMusic.play().catch(() => {});
  } catch (e) {}
}

function playPop() {
  if (!popSound) return;
  try {
    popSound.currentTime = 0;
    popSound.play().catch(() => {});
  } catch (e) {}
}

// PROGRESSO SALVATO
let maxLevelUnlocked = 1;

function loadProgress() {
  try {
    const raw = localStorage.getItem("ba_maxLevel");
    const val = parseInt(raw || "1", 10);
    if (!isNaN(val) && val >= 1 && val <= LEVELS.length) {
      maxLevelUnlocked = val;
    } else {
      maxLevelUnlocked = 1;
    }
  } catch (e) {
    maxLevelUnlocked = 1;
  }
}

function saveProgress() {
  try {
    localStorage.setItem("ba_maxLevel", String(maxLevelUnlocked));
  } catch (e) {}
}

function getLevelIndexById(id) {
  return LEVELS.findIndex(l => l.id === id);
}

let currentLevelIndex = 0;
let balloons = [];
let arrows = [];
let arrowsLeft = 0;
let timeLeft = null;
let timerActive = false;

let lastTimestamp = 0;
let playing = false;
let gameOver = false;

const GROUND_Y = canvas.height - 40;
const ARROW_SPEED = 380;
const BASE_BALLOON_RADIUS = 22;

// MITRA
let isFiring = false;
let fireX = null;
const FIRE_INTERVAL = 0.12;
let fireCooldown = 0;

// --------------------------------------------------
// Utility
// --------------------------------------------------
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function updateUiTime() {
  if (!timerActive || timeLeft === null) {
    uiTime.textContent = "--";
  } else {
    uiTime.textContent = timeLeft.toFixed(1);
  }
}

function spawnArrowAt(x) {
  if (arrowsLeft <= 0) return;
  arrowsLeft--;
  uiArrows.textContent = arrowsLeft;
  arrows.push({
    x,
    y: GROUND_Y,
    speedY: ARROW_SPEED
  });
}

// --------------------------------------------------
// Gestione livelli
// --------------------------------------------------
function loadLevelById(id) {
  const idx = getLevelIndexById(id);
  if (idx >= 0) {
    loadLevel(idx);
  }
}

function loadLevel(index) {
  const level = LEVELS[index];
  currentLevelIndex = index;
  balloons = [];
  arrows = [];
  gameOver = false;
  playing = true;

  arrowsLeft = level.arrows;
  timeLeft = level.timeLimit;
  timerActive = true;

  for (let i = 0; i < level.balloons; i++) {
    const radius = BASE_BALLOON_RADIUS * level.balloonSize;
    const x = randRange(radius + 10, canvas.width - radius - 10);
    const y = randRange(80, 220);

    let type = level.pattern;
    if (level.pattern === "mixed") {
      type = Math.random() < 0.5 ? "horizontal" : "zigzag";
    }

    const speedX = (Math.random() < 0.5 ? -1 : 1) * level.balloonSpeed;
    const balloon = {
      x,
      y,
      baseY: y,
      radius,
      speedX,
      zigzagPhase: Math.random() * Math.PI * 2,
      pattern: type
    };
    balloons.push(balloon);
  }

  uiWorld.textContent = level.world || Math.ceil(level.id / 10);
  uiLevel.textContent = level.id;
  uiBalloons.textContent = balloons.length;
  uiArrows.textContent = arrowsLeft;
  updateUiTime();

  isFiring = false;
  fireX = null;
  fireCooldown = 0;

  hideOverlay();
  lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
}

// --------------------------------------------------
// Overlay / menu
// --------------------------------------------------
function showMainMenu() {
  playing = false;
  gameOver = false;

  const total = LEVELS.length;
  const infoText = `
    Progresso salvato:<br>
    livello massimo raggiunto: <b>${maxLevelUnlocked}</b> di <b>${total}</b>.<br><br>
    Mondo 1: livelli 1-10<br>
    Mondo 2: livelli 11-20<br>
    Mondo 3: livelli 21-30
  `;

  overlay.style.display = "flex";
  overlayTitle.textContent = "Balloon Archer";
  overlayText.innerHTML = infoText;

  if (maxLevelUnlocked > 1) {
    btnPlay.textContent = `Continua (Lv ${maxLevelUnlocked})`;
  } else {
    btnPlay.textContent = "Gioca (Lv 1)";
  }

  btnPlay.onclick = () => {
    startBgMusic();
    loadLevelById(maxLevelUnlocked);
  };

  btnLevelSelect.textContent = "Nuova partita";
  btnLevelSelect.onclick = () => {
    maxLevelUnlocked = 1;
    saveProgress();
    startBgMusic();
    loadLevelById(1);
  };
}

function showOverlayWin(title, html) {
  overlay.style.display = "flex";
  overlayTitle.textContent = title;
  overlayText.innerHTML = html;

  btnPlay.style.display = "inline-block";
  btnLevelSelect.style.display = "inline-block";

  const level = LEVELS[currentLevelIndex];
  const isLast = level.id === LEVELS[LEVELS.length - 1].id;

  btnPlay.textContent = isLast
    ? "Torna al menu"
    : `Avanti (Lv ${level.id + 1})`;

  btnPlay.onclick = () => {
    if (isLast) {
      showMainMenu();
    } else {
      loadLevelById(level.id + 1);
    }
  };

  btnLevelSelect.textContent = "Riprova livello";
  btnLevelSelect.onclick = () => loadLevelById(level.id);
}

function showOverlayLose(title, html) {
  overlay.style.display = "flex";
  overlayTitle.textContent = title;
  overlayText.innerHTML = html;

  btnPlay.style.display = "inline-block";
  btnLevelSelect.style.display = "inline-block";

  const level = LEVELS[currentLevelIndex];

  btnPlay.textContent = "Riprova livello";
  btnPlay.onclick = () => loadLevelById(level.id);

  btnLevelSelect.textContent = "Torna al menu";
  btnLevelSelect.onclick = () => showMainMenu();
}

function hideOverlay() {
  overlay.style.display = "none";
}

// --------------------------------------------------
// Input (MITRA: tieni premuto)
// --------------------------------------------------
function getCanvasCoords(evt) {
  const rect = canvas.getBoundingClientRect();
  let clientX;

  if (evt.touches && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX;
  } else {
    clientX = evt.clientX;
  }

  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  return { x };
}

function handleStartFire(evt) {
  if (!playing || gameOver) return;
  const { x } = getCanvasCoords(evt);

  spawnArrowAt(x);

  isFiring = true;
  fireX = x;
  fireCooldown = FIRE_INTERVAL;

  evt.preventDefault();
}

function handleMoveFire(evt) {
  if (!isFiring) return;
  const { x } = getCanvasCoords(evt);
  fireX = x;
  evt.preventDefault();
}

function stopFiring() {
  isFiring = false;
  fireX = null;
}

canvas.addEventListener("mousedown", handleStartFire);
canvas.addEventListener("mousemove", handleMoveFire);
canvas.addEventListener("mouseup", stopFiring);
canvas.addEventListener("mouseleave", stopFiring);

canvas.addEventListener("touchstart", handleStartFire, { passive: false });
canvas.addEventListener("touchmove", handleMoveFire, { passive: false });
canvas.addEventListener("touchend", stopFiring);
canvas.addEventListener("touchcancel", stopFiring);

// --------------------------------------------------
// Game loop
// --------------------------------------------------
function gameLoop(timestamp) {
  if (!playing) return;

  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  update(dt);
  draw();

  if (playing) {
    requestAnimationFrame(gameLoop);
  }
}

// --------------------------------------------------
// Update
// --------------------------------------------------
function update(dt) {
  const level = LEVELS[currentLevelIndex];

  if (timerActive && timeLeft !== null) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateUiTime();
      loseLevel("Tempo scaduto! ⏱️");
      return;
    }
    updateUiTime();
  }

  if (isFiring && fireX !== null && arrowsLeft > 0) {
    fireCooldown -= dt;
    while (fireCooldown <= 0 && arrowsLeft > 0) {
      spawnArrowAt(fireX);
      fireCooldown += FIRE_INTERVAL;
    }
  }

  balloons.forEach(b => {
    if (b.pattern === "horizontal") {
      b.x += b.speedX * dt;
    } else if (b.pattern === "zigzag") {
      b.x += b.speedX * dt;
      b.zigzagPhase += dt * 3;
      b.y = b.baseY + Math.sin(b.zigzagPhase) * 25;
    }

    if (b.x < b.radius + 4) {
      b.x = b.radius + 4;
      b.speedX *= -1;
    }
    if (b.x > canvas.width - b.radius - 4) {
      b.x = canvas.width - b.radius - 4;
      b.speedX *= -1;
    }
  });

  arrows.forEach(a => {
    a.y -= a.speedY * dt;
  });

  arrows = arrows.filter(a => a.y + 10 > 0);

  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    let hitIndex = -1;

    for (let j = 0; j < balloons.length; j++) {
      const b = balloons[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.radius + 6) {
        hitIndex = j;
        break;
      }
    }

    if (hitIndex !== -1) {
      playPop();
      balloons.splice(hitIndex, 1);
      arrows.splice(i, 1);
    }
  }

  uiBalloons.textContent = balloons.length;

  if (balloons.length === 0) {
    winLevel();
    return;
  }
}

// --------------------------------------------------
// Disegno OGGETTO per ogni shape
// --------------------------------------------------
function drawBalloon(b, color1, color2) {
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.radius);
  ctx.lineTo(b.x, b.y + b.radius + 25);
  ctx.stroke();

  const g = ctx.createRadialGradient(
    b.x - b.radius / 3,
    b.y - b.radius / 3,
    4,
    b.x,
    b.y,
    b.radius
  );
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(b) {
  const r = b.radius;
  ctx.fillStyle = "#fb7185";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + r * 0.3);
  ctx.bezierCurveTo(
    b.x - r, b.y - r * 0.5,
    b.x - r * 1.2, b.y + r * 0.5,
    b.x, b.y + r
  );
  ctx.bezierCurveTo(
    b.x + r * 1.2, b.y + r * 0.5,
    b.x + r, b.y - r * 0.5,
    b.x, b.y + r * 0.3
  );
  ctx.fill();
}

function drawStar(b) {
  const r = b.radius;
  const spikes = 5;
  const inner = r * 0.4;
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  let rot = Math.PI / 2 * 3;
  let x = b.x;
  let y = b.y;
  ctx.moveTo(b.x, b.y - r);
  for (let i = 0; i < spikes; i++) {
    x = b.x + Math.cos(rot) * r;
    y = b.y + Math.sin(rot) * r;
    ctx.lineTo(x, y);
    rot += Math.PI / spikes;

    x = b.x + Math.cos(rot) * inner;
    y = b.y + Math.sin(rot) * inner;
    ctx.lineTo(x, y);
    rot += Math.PI / spikes;
  }
  ctx.closePath();
  ctx.fill();
}

function drawCloud(b) {
  const r = b.radius;
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(b.x - r * 0.6, b.y, r * 0.7, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(b.x, b.y - r * 0.5, r * 0.8, Math.PI, 0);
  ctx.arc(b.x + r * 0.6, b.y, r * 0.7, Math.PI * 1.5, Math.PI * 0.5);
  ctx.arc(b.x, b.y + r * 0.4, r * 0.8, 0, Math.PI);
  ctx.fill();
}

function drawSquare(b) {
  const r = b.radius;
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.roundRect(b.x - r, b.y - r, r * 2, r * 2, 6);
  ctx.fill();
}

function drawTriangle(b) {
  const r = b.radius;
  ctx.fillStyle = "#a855f7";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x - r, b.y + r);
  ctx.lineTo(b.x + r, b.y + r);
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(b) {
  const r = b.radius;
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x - r * 0.8, b.y);
  ctx.lineTo(b.x, b.y + r);
  ctx.lineTo(b.x + r * 0.8, b.y);
  ctx.closePath();
  ctx.fill();
}

function drawDonut(b) {
  const r = b.radius;
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTargetShape(b) {
  const r = b.radius;
  const colors = ["#fef2f2", "#ef4444", "#fee2e2", "#991b1b"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, r - (r * 0.25 * i), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBomb(b) {
  const r = b.radius;
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(b.x - r * 0.3, b.y - r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x + r * 0.3, b.y - r * 0.8);
  ctx.lineTo(b.x + r * 0.6, b.y - r * 1.2);
  ctx.stroke();
}

function drawApple(b) {
  const r = b.radius;
  const g = ctx.createRadialGradient(
    b.x - r / 3, b.y - r / 3, 4,
    b.x, b.y, r
  );
  g.addColorStop(0, "#fb7185");
  g.addColorStop(1, "#b91c1c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x - r * 0.4, b.y, r * 0.9, Math.PI * 0.8, Math.PI * 2.2);
  ctx.arc(b.x + r * 0.4, b.y, r * 0.9, Math.PI * 0.8, Math.PI * 2.2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x, b.y - r - 8);
  ctx.stroke();

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.ellipse(b.x + 6, b.y - r - 6, 5, 8, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCircleFruit(b, baseColor1, baseColor2) {
  const r = b.radius;
  const g = ctx.createRadialGradient(
    b.x - r / 3, b.y - r / 3, 4,
    b.x, b.y, r
  );
  g.addColorStop(0, baseColor1);
  g.addColorStop(1, baseColor2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawWatermelon(b) {
  const r = b.radius;
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#f97373";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.8, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#111827";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(b.x + i * (r * 0.3), b.y - r * 0.3, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStrawberry(b) {
  const r = b.radius;
  ctx.fillStyle = "#f97373";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + r);
  ctx.quadraticCurveTo(b.x - r, b.y, b.x, b.y - r);
  ctx.quadraticCurveTo(b.x + r, b.y, b.x, b.y + r);
  ctx.fill();

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(b.x - r * 0.5, b.y - r * 0.8);
  ctx.lineTo(b.x + r * 0.5, b.y - r * 0.8);
  ctx.lineTo(b.x, b.y - r * 1.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fee2e2";
  for (let i = -1; i <= 1; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(b.x + i * r * 0.3, b.y + j * r * 0.1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCherry(b) {
  const r = b.radius * 0.6;
  const off = r * 0.8;

  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x - off * 0.5, b.y - r);
  ctx.quadraticCurveTo(b.x - off, b.y - r * 1.5, b.x - off, b.y - r * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x + off * 0.5, b.y - r);
  ctx.quadraticCurveTo(b.x + off, b.y - r * 1.5, b.x + off, b.y - r * 2);
  ctx.stroke();

  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(b.x - off, b.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(b.x + off, b.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPear(b) {
  const r = b.radius;
  ctx.fillStyle = "#a3e635";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r * 0.5);
  ctx.bezierCurveTo(
    b.x - r * 0.8, b.y - r * 0.2,
    b.x - r * 0.8, b.y + r * 0.6,
    b.x, b.y + r
  );
  ctx.bezierCurveTo(
    b.x + r * 0.8, b.y + r * 0.6,
    b.x + r * 0.8, b.y - r * 0.2,
    b.x, b.y - r * 0.5
  );
  ctx.fill();

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r * 0.6);
  ctx.lineTo(b.x, b.y - r - 8);
  ctx.stroke();
}

function drawPineapple(b) {
  const r = b.radius;
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.roundRect(b.x - r * 0.7, b.y - r, r * 1.4, r * 1.8, 8);
  ctx.fill();

  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(b.x - r, b.y - r * 0.2 + i * r * 0.3);
    ctx.lineTo(b.x + r, b.y + r * 0.4 + i * r * 0.3);
    ctx.stroke();
  }

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r * 1.2);
  ctx.lineTo(b.x - r * 0.5, b.y - r * 0.6);
  ctx.lineTo(b.x + r * 0.5, b.y - r * 0.6);
  ctx.closePath();
  ctx.fill();
}

function drawBanana(b) {
  const r = b.radius * 1.2;
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(b.x, b.y + r * 0.2, r, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();

  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(b.x, b.y + r * 0.2, r * 0.9, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
}

function drawGrape(b) {
  const r = b.radius * 0.5;
  ctx.fillStyle = "#a855f7";
  const coords = [
    [0, 0], [-1, 0], [1, 0],
    [-0.5, -1], [0.5, -1],
    [0, 1]
  ];
  coords.forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(b.x + dx * r * 1.3, b.y + dy * r * 1.3, r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r * 2);
  ctx.lineTo(b.x - r * 0.7, b.y - r * 1.4);
  ctx.lineTo(b.x + r * 0.7, b.y - r * 1.4);
  ctx.closePath();
  ctx.fill();
}

function drawPlanet(b) {
  const r = b.radius;
  const g = ctx.createRadialGradient(b.x - r / 2, b.y - r / 2, 4, b.x, b.y, r);
  g.addColorStop(0, "#38bdf8");
  g.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(248,250,252,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, r + 6, r / 2, 0.4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMoon(b) {
  const r = b.radius;
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.arc(b.x + r * 0.4, b.y - r * 0.2, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSun(b) {
  const r = b.radius;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    const x1 = b.x + Math.cos(angle) * (r * 0.9);
    const y1 = b.y + Math.sin(angle) * (r * 0.9);
    const x2 = b.x + Math.cos(angle) * (r * 1.3);
    const y2 = b.y + Math.sin(angle) * (r * 1.3);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawRocket(b) {
  const r = b.radius;
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x - r * 0.5, b.y + r * 0.6);
  ctx.lineTo(b.x + r * 0.5, b.y + r * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, r * 0.4, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + r * 0.6);
  ctx.lineTo(b.x - r * 0.4, b.y + r * 1.1);
  ctx.lineTo(b.x + r * 0.4, b.y + r * 1.1);
  ctx.closePath();
  ctx.fill();
}

function drawUfo(b) {
  const r = b.radius;
  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y - r * 0.3, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, r * 1.3, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#facc15";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(b.x + i * r * 0.5, b.y + r * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawComet(b) {
  const r = b.radius;
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x - r * 1.5, b.y + r * 0.5);
  ctx.quadraticCurveTo(b.x - r, b.y, b.x, b.y);
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawMeteor(b) {
  const r = b.radius;
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4b5563";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(
      b.x + (Math.random() - 0.5) * r * 0.8,
      b.y + (Math.random() - 0.5) * r * 0.8,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawCrystal(b) {
  const r = b.radius;
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x - r * 0.6, b.y);
  ctx.lineTo(b.x, b.y + r);
  ctx.lineTo(b.x + r * 0.6, b.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y - r);
  ctx.lineTo(b.x, b.y + r);
  ctx.stroke();
}

function drawBlackHole(b) {
  const r = b.radius;
  const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, r * 1.3);
  g.addColorStop(0, "#020617");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrown(b) {
  const r = b.radius;
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(b.x - r, b.y + r * 0.5);
  ctx.lineTo(b.x - r * 0.8, b.y - r * 0.3);
  ctx.lineTo(b.x - r * 0.3, b.y);
  ctx.lineTo(b.x, b.y - r * 0.6);
  ctx.lineTo(b.x + r * 0.3, b.y);
  ctx.lineTo(b.x + r * 0.8, b.y - r * 0.3);
  ctx.lineTo(b.x + r, b.y + r * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.roundRect(b.x - r, b.y + r * 0.5, r * 2, r * 0.3, 4);
  ctx.fill();
}

// --------------------------------------------------
// Draw principale
// --------------------------------------------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#020617");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, GROUND_Y + 10, canvas.width, canvas.height - (GROUND_Y + 10));

  ctx.fillStyle = "#e5e7eb";
  const baseWidth = 60;
  const baseHeight = 10;
  ctx.fillRect(
    canvas.width / 2 - baseWidth / 2,
    GROUND_Y,
    baseWidth,
    baseHeight
  );

  const level = LEVELS[currentLevelIndex];
  const shape = level.shape || "balloon";

  balloons.forEach(b => {
    switch (shape) {
      case "balloon":
        drawBalloon(b, "#f97316", "#b91c1c");
        break;
      case "heart":
        drawHeart(b);
        break;
      case "star":
        drawStar(b);
        break;
      case "cloud":
        drawCloud(b);
        break;
      case "square":
        drawSquare(b);
        break;
      case "triangle":
        drawTriangle(b);
        break;
      case "diamond":
        drawDiamond(b);
        break;
      case "donut":
        drawDonut(b);
        break;
      case "target":
        drawTargetShape(b);
        break;
      case "bomb":
        drawBomb(b);
        break;

      case "apple":
        drawApple(b);
        break;
      case "orange":
        drawCircleFruit(b, "#fed7aa", "#ea580c");
        break;
      case "lemon":
        drawCircleFruit(b, "#fef9c3", "#eab308");
        break;
      case "watermelon":
        drawWatermelon(b);
        break;
      case "strawberry":
        drawStrawberry(b);
        break;
      case "cherry":
        drawCherry(b);
        break;
      case "pear":
        drawPear(b);
        break;
      case "pineapple":
        drawPineapple(b);
        break;
      case "banana":
        drawBanana(b);
        break;
      case "grape":
        drawGrape(b);
        break;

      case "planet":
        drawPlanet(b);
        break;
      case "moon":
        drawMoon(b);
        break;
      case "sun":
        drawSun(b);
        break;
      case "rocket":
        drawRocket(b);
        break;
      case "ufo":
        drawUfo(b);
        break;
      case "comet":
        drawComet(b);
        break;
      case "meteor":
        drawMeteor(b);
        break;
      case "crystal":
        drawCrystal(b);
        break;
      case "blackhole":
        drawBlackHole(b);
        break;
      case "crown":
        drawCrown(b);
        break;

      default:
        drawBalloon(b, "#f97316", "#b91c1c");
    }
  });

  ctx.fillStyle = "#facc15";
  arrows.forEach(a => {
    ctx.fillRect(a.x - 2, a.y - 15, 4, 15);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 18);
    ctx.lineTo(a.x - 5, a.y - 10);
    ctx.lineTo(a.x + 5, a.y - 10);
    ctx.closePath();
    ctx.fill();
  });

  if (timerActive && timeLeft !== null) {
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(`⏱ ${timeLeft.toFixed(1)}s`, canvas.width - 8, 20);
  }
}

// --------------------------------------------------
// Stelle + vittoria / sconfitta
// --------------------------------------------------
function computeStars() {
  const level = LEVELS[currentLevelIndex];
  const totalArrows = level.arrows;
  const arrowsUsed = totalArrows - arrowsLeft;
  const ratioArrows = arrowsUsed / totalArrows;

  let ratioTime = 0;
  if (level.timeLimit && timeLeft !== null) {
    ratioTime = timeLeft / level.timeLimit;
  }

  let stars = 3;
  if (ratioArrows > 0.85 && ratioTime < 0.2) stars = 2;
  if (ratioArrows > 0.95 && ratioTime < 0.05) stars = 1;
  return stars;
}

function winLevel() {
  playing = false;
  gameOver = true;
  const level = LEVELS[currentLevelIndex];

  if (level.id === maxLevelUnlocked && level.id < LEVELS.length) {
    maxLevelUnlocked = level.id + 1;
    saveProgress();
  }

  const isLast = level.id === LEVELS[LEVELS.length - 1].id;

  const stars = computeStars();
  const starsStr = "⭐".repeat(stars) + "☆".repeat(3 - stars);

  const nextText = (isLast
    ? "Hai completato tutti i 30 livelli disponibili! 🎉"
    : `Livello ${level.id} completato!<br>Prossimo livello: <b>${level.id + 1}</b>.`
  ) + `<br><br>Valutazione: <span style="font-size:20px">${starsStr}</span>`;

  showOverlayWin("Livello completato!", nextText);
}

function loseLevel(reason) {
  playing = false;
  gameOver = true;
  const level = LEVELS[currentLevelIndex];
  const text = `${reason}<br><br>Livello ${level.id} – ${level.name}`;
  showOverlayLose("Livello fallito", text);
}

// --------------------------------------------------
// Avvio
// --------------------------------------------------
loadProgress();
showMainMenu();
