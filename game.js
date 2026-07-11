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

const envelopeRect = { x: 45, y: 235, w: 310, h: 242 };
const letterRect = { x: 30, y: 82, w: 340, h: 430 };
const startRect = { x: 130, y: 570, w: 140, h: 78 };
const finalScoreRect = { x: 45, y: 195, w: 310, h: 145 };
const restartRect = { x: 130, y: 385, w: 140, h: 78 };

const player = {
  x: 125,
  y: 750 - 218,
  w: 150,
  h: 218,
  speed: 7
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
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

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
  if (ready(name)) {
    ctx.drawImage(images[name], rect.x, rect.y, rect.w, rect.h);
    return true;
  }
  return false;
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
  return 2 + Math.floor(Math.random() * 3); // 2~4개
}

function findSeparatedWineX(wineW, newWines) {
  const minCenterDistance = 72;

  // 화면 위쪽에 있는 기존 와인과 이번에 생성하는 와인을 모두 비교합니다.
  const nearbyWines = wines
    .filter(wine => wine.y < 210)
    .concat(newWines);

  let bestX = Math.random() * (W - wineW);
  let bestDistance = -1;

  // 무작위 위치를 여러 번 뽑아 충분히 떨어진 위치를 우선 선택합니다.
  for (let attempt = 0; attempt < 35; attempt++) {
    const candidateX = Math.random() * (W - wineW);
    const candidateCenter = candidateX + wineW / 2;

    let nearestDistance = Infinity;
    for (const other of nearbyWines) {
      const otherCenter = other.x + other.w / 2;
      nearestDistance = Math.min(nearestDistance, Math.abs(candidateCenter - otherCenter));
    }

    if (nearbyWines.length === 0 || nearestDistance >= minCenterDistance) {
      return candidateX;
    }

    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestX = candidateX;
    }
  }

  // 자리가 부족한 경우에도 가장 멀리 떨어진 후보를 사용합니다.
  return bestX;
}

function spawnBatch() {
  const count = currentBatchSize();
  const wineW = 30;
  const wineH = 66;
  const baseSpeed = 2.65 + Math.min(3.5, elapsed / 22000);
  const newWines = [];

  for (let i = 0; i < count; i++) {
    const wine = {
      x: findSeparatedWineX(wineW, newWines),
      // 같은 순간에 생성되어도 세로 위치가 완전히 일렬로 겹치지 않게 합니다.
      y: -wineH - Math.random() * 95,
      w: wineW,
      h: wineH,
      speed: baseSpeed + Math.random() * 0.45
    };

    newWines.push(wine);
  }

  wines.push(...newWines);
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function updateGame(dt) {
  elapsed += dt;
  spawnTimer += dt;

  const spawnInterval = Math.max(650, 1450 - elapsed / 55);
  if (spawnTimer >= spawnInterval) {
    spawnTimer %= spawnInterval;
    spawnBatch();
  }

  const moveDistance = player.speed * (dt / 16.67);
  if (leftPressed) player.x -= moveDistance;
  if (rightPressed) player.x += moveDistance;
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  // 와인은 플레이어 옆이나 몸이 아니라 머리 위 상자의 윗면으로
  // 위에서 아래로 떨어질 때만 잡힌 것으로 처리합니다.
  const catchLineY = player.y + 10;
  const catchLeft = player.x + 20;
  const catchRight = player.x + player.w - 20;

  for (let i = wines.length - 1; i >= 0; i--) {
    const wine = wines[i];
    const previousBottom = wine.y + wine.h;
    wine.y += wine.speed * (dt / 16.67);
    const currentBottom = wine.y + wine.h;

    const wineLeft = wine.x;
    const wineRight = wine.x + wine.w;
    const horizontallyOnCrate =
      wineRight > catchLeft && wineLeft < catchRight;
    const crossedCrateTop =
      previousBottom <= catchLineY && currentBottom >= catchLineY;

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
  ctx.fillRect(0, 0, W, 50);

  ctx.fillStyle = '#fff7e1';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 25px Georgia, serif';
  ctx.fillText(String(score), 24, 25);

  for (let i = 0; i < 3; i++) {
    const rect = { x: 270 + i * 39, y: 7, w: 35, h: 35 };
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
  ctx.font = 'bold 118px Georgia, serif';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(50, 30, 15, 0.8)';
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
  ctx.font = 'bold 42px Georgia, serif';
  // 점수가 리본 아래로 내려가지 않도록 점수판 안쪽 중앙에 배치
  ctx.fillText(String(score), W / 2, 267);
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

  if (state === State.ENVELOPE && inside(point, envelopeRect)) {
    state = State.LETTER;
  } else if (state === State.LETTER && inside(point, startRect)) {
    resetGame();
  } else if (state === State.END && inside(point, restartRect)) {
    resetGame();
  } else if (state === State.PLAY) {
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
  if (event.key === 'ArrowLeft') {
    leftPressed = true;
    event.preventDefault();
  }
  if (event.key === 'ArrowRight') {
    rightPressed = true;
    event.preventDefault();
  }
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
