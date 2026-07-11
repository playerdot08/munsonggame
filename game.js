'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const State = Object.freeze({
  ENVELOPE: 'envelope',
  LETTER: 'letter',
  COUNTDOWN: 'countdown',
  PLAY: 'play',
  END: 'end'
});
let state = State.ENVELOPE;

const paths = {
  startBg: 'image/page_start01.jpg',
  envelope: 'image/envelope.png',
  letterBg: 'image/page_start02.jpg',
  letter: 'image/letter.png',
  startButton: 'image/start_button.png',
  playBg: 'image/page_play.png',
  endBg: 'image/page_end.png',
  player: 'image/player.png',
  wine: 'image/wine.png',
  life: 'image/life.png',
  noLife: 'image/no_life.png',
  finalScore: 'image/final_score.png',
  restartButton: 'image/restart_button.png'
};

const images = {};
for (const [name, src] of Object.entries(paths)) {
  const image = new Image();
  image.src = src;
  images[name] = image;
}
const ready = name => images[name]?.complete && images[name].naturalWidth > 0;

// 720×1280 전용 UI 배치
const envelopeRect = { x: 120, y: 390, w: 480, h: 375 };
const letterRect = { x: 60, y: 115, w: 600, h: 680 };
const startRect = { x: 245, y: 940, w: 230, h: 128 };
const finalScoreRect = { x: 115, y: 365, w: 490, h: 228 };
const restartRect = { x: 235, y: 700, w: 250, h: 139 };

const player = {
  x: 235,
  y: 1280 - 365,
  w: 250,
  h: 365,
  speed: 12.5
};

let wines = [];
let score = 0;
let lives = 3;
let elapsed = 0;
let spawnTimer = 0;
let lastTime = 0;
let leftPressed = false;
let rightPressed = false;
let dragging = false;
let countdownElapsed = 0;
const COUNTDOWN_DURATION = 3000;

function drawCover(image, x, y, w, h) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = w / h;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if (imageRatio > boxRatio) {
    sw = image.naturalHeight * boxRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / boxRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawBackground(name) {
  if (ready(name)) drawCover(images[name], 0, 0, W, H);
  else {
    ctx.fillStyle = '#a98466';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawImage(name, rect) {
  if (!ready(name)) return false;
  ctx.drawImage(images[name], rect.x, rect.y, rect.w, rect.h);
  return true;
}

function resetGame() {
  state = State.COUNTDOWN;
  wines = [];
  score = 0;
  lives = 3;
  elapsed = 0;
  spawnTimer = 0;
  countdownElapsed = 0;
  player.x = (W - player.w) / 2;
}

function drawEnvelopeScreen() {
  drawBackground('startBg');
  drawImage('envelope', envelopeRect);
}

function drawLetterScreen() {
  drawBackground('letterBg');
  drawImage('letter', letterRect);
  drawImage('startButton', startRect);
}

function currentBatchSize() {
  if (elapsed < 15000) return 1;
  if (elapsed < 30000) return Math.random() < 0.6 ? 2 : 1;
  if (elapsed < 50000) return 2 + (Math.random() < 0.45 ? 1 : 0);
  return 2 + Math.floor(Math.random() * 3);
}

function findSeparatedWineX(wineW, newWines) {
  const minCenterDistance = 130;
  const sideMargin = 18;
  const nearbyWines = wines.filter(wine => wine.y < 360).concat(newWines);
  let bestX = sideMargin + Math.random() * (W - wineW - sideMargin * 2);
  let bestDistance = -1;

  for (let attempt = 0; attempt < 45; attempt++) {
    const candidateX = sideMargin + Math.random() * (W - wineW - sideMargin * 2);
    const candidateCenter = candidateX + wineW / 2;
    let nearestDistance = Infinity;
    for (const other of nearbyWines) {
      const otherCenter = other.x + other.w / 2;
      nearestDistance = Math.min(nearestDistance, Math.abs(candidateCenter - otherCenter));
    }
    if (nearbyWines.length === 0 || nearestDistance >= minCenterDistance) return candidateX;
    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestX = candidateX;
    }
  }
  return bestX;
}

function spawnBatch() {
  const count = currentBatchSize();
  const wineW = 54;
  const wineH = 119;
  const baseSpeed = 4.75 + Math.min(6.2, elapsed / 22000);
  const newWines = [];

  for (let i = 0; i < count; i++) {
    const wine = {
      x: findSeparatedWineX(wineW, newWines),
      y: -wineH - Math.random() * 150,
      w: wineW,
      h: wineH,
      speed: baseSpeed + Math.random() * 0.8
    };
    newWines.push(wine);
  }
  wines.push(...newWines);
}

function updateGame(dt) {
  elapsed += dt;
  spawnTimer += dt;

  const spawnInterval = Math.max(700, 1700 - elapsed / 52);
  if (spawnTimer >= spawnInterval) {
    spawnTimer %= spawnInterval;
    spawnBatch();
  }

  const moveDistance = player.speed * (dt / 16.67);
  if (leftPressed) player.x -= moveDistance;
  if (rightPressed) player.x += moveDistance;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  // 상자 윗면에 위에서 닿을 때만 획득 처리
  const catchLineY = player.y + 18;
  const catchLeft = player.x + 34;
  const catchRight = player.x + player.w - 34;

  for (let i = wines.length - 1; i >= 0; i--) {
    const wine = wines[i];
    const previousBottom = wine.y + wine.h;
    wine.y += wine.speed * (dt / 16.67);
    const currentBottom = wine.y + wine.h;

    const horizontallyOnCrate = wine.x + wine.w > catchLeft && wine.x < catchRight;
    const crossedCrateTop = previousBottom <= catchLineY && currentBottom >= catchLineY;

    if (horizontallyOnCrate && crossedCrateTop) {
      wines.splice(i, 1);
      score += 1;
      continue;
    }

    if (wine.y > H) {
      wines.splice(i, 1);
      lives -= 1;
      if (lives <= 0) {
        state = State.END;
        dragging = false;
        break;
      }
    }
  }
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = 'rgba(31, 24, 18, .72)';
  ctx.fillRect(0, 0, W, 86);

  ctx.fillStyle = '#fff7e1';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(String(score), 42, 43);

  for (let i = 0; i < 3; i++) {
    const rect = { x: 490 + i * 70, y: 12, w: 58, h: 58 };
    drawImage(i < lives ? 'life' : 'noLife', rect);
  }
  ctx.restore();
}

function updateCountdown(dt) {
  countdownElapsed += dt;
  if (countdownElapsed >= COUNTDOWN_DURATION) {
    state = State.PLAY;
    elapsed = 0;
    spawnTimer = 0;
  }
}

function drawCountdownScreen() {
  drawBackground('playBg');
  drawImage('player', player);
  drawHUD();
  const remaining = Math.max(1, 3 - Math.floor(countdownElapsed / 1000));

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 190px Georgia, serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(50, 30, 15, 0.82)';
  ctx.fillStyle = '#fff3c4';
  ctx.strokeText(String(remaining), W / 2, H / 2);
  ctx.fillText(String(remaining), W / 2, H / 2);
  ctx.restore();
}

function drawPlayScreen() {
  drawBackground('playBg');
  for (const wine of wines) drawImage('wine', wine);
  drawImage('player', player);
  drawHUD();
}

function drawEndScreen() {
  drawBackground('endBg');
  drawImage('finalScore', finalScoreRect);

  ctx.save();
  ctx.fillStyle = '#604226';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 66px Georgia, serif';
  // 숫자를 점수판 중앙의 흰색 영역 안에 배치
  ctx.fillText(String(score), W / 2, finalScoreRect.y + 123);
  ctx.restore();

  drawImage('restartButton', restartRect);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * W / rect.width,
    y: (event.clientY - rect.top) * H / rect.height
  };
}

function inside(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w &&
         point.y >= rect.y && point.y <= rect.y + rect.h;
}

function movePlayerTo(pointerX) {
  player.x = Math.max(0, Math.min(W - player.w, pointerX - player.w / 2));
}

canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  const point = pointFromEvent(event);
  if (state === State.ENVELOPE && inside(point, envelopeRect)) state = State.LETTER;
  else if (state === State.LETTER && inside(point, startRect)) resetGame();
  else if (state === State.END && inside(point, restartRect)) resetGame();
  else if (state === State.PLAY) {
    dragging = true;
    movePlayerTo(point.x);
    canvas.setPointerCapture?.(event.pointerId);
  }
});

canvas.addEventListener('pointermove', event => {
  if (state !== State.PLAY || !dragging) return;
  event.preventDefault();
  movePlayerTo(pointFromEvent(event).x);
});

function stopDragging() { dragging = false; }
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);

window.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { leftPressed = true; event.preventDefault(); }
  if (event.key === 'ArrowRight') { rightPressed = true; event.preventDefault(); }
});
window.addEventListener('keyup', event => {
  if (event.key === 'ArrowLeft') leftPressed = false;
  if (event.key === 'ArrowRight') rightPressed = false;
});

function frame(time) {
  const dt = Math.min(34, time - lastTime || 16.67);
  lastTime = time;

  if (state === State.COUNTDOWN) updateCountdown(dt);
  else if (state === State.PLAY) updateGame(dt);

  ctx.clearRect(0, 0, W, H);
  if (state === State.ENVELOPE) drawEnvelopeScreen();
  else if (state === State.LETTER) drawLetterScreen();
  else if (state === State.COUNTDOWN) drawCountdownScreen();
  else if (state === State.PLAY) drawPlayScreen();
  else drawEndScreen();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
