const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 24;
const HUD_H = 72;
const MAP_W = 23;
const MAP_H = 17;

const STATE = {
  OPENING_SCROLL: "opening_scroll",
  OPENING_WAIT: "opening_wait",
  PLAYING: "playing",
  GAMEOVER: "gameover",
};

const DIR = {
  left: { x: -1, y: 0, angle: Math.PI },
  right: { x: 1, y: 0, angle: 0 },
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
};

// 0=道,1=壁,2=ドット,3=パワーエサ
const MAZE = [
  "11111111111111111111111",
  "13322222222112222222331",
  "12111121112112111211121",
  "12222221122222211222221",
  "12112111112112111121121",
  "12212122222222222121221",
  "11112121111111112121111",
  "00002122000000022120000",
  "11112121111111112121111",
  "22222221000000001222222",
  "11112121111111112121111",
  "00002122000000022120000",
  "11112121111111112121111",
  "12222122222222222122221",
  "12112112111111112121121",
  "13222222122222212222231",
  "11111111111111111111111",
];

let map = [];
let dotsLeft = 0;
let totalDots = 0;

let gameState = STATE.OPENING_SCROLL;
let openingOffset = canvas.height;
let openingReadyTimer = 0;

let score = 0;
let highScore = 0;
let round = 1;
let lives = 3;
let frightened = 0;

const pac = {
  x: 11,
  y: 13,
  px: 0,
  py: 0,
  dir: "left",
  next: "left",
  speed: 6.8,
  mouth: 0,
};

const ghosts = [];
const ghostBase = [
  { color: "#ff2f2f", x: 11, y: 9 },
  { color: "#ff9fd6", x: 10, y: 9 },
  { color: "#33d6ff", x: 12, y: 9 },
  { color: "#ff9d10", x: 11, y: 8 },
];

function resetMap() {
  map = MAZE.map((row) => row.split("").map(Number));
  dotsLeft = 0;
  totalDots = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 2 || map[y][x] === 3) {
        dotsLeft++;
        totalDots++;
      }
    }
  }
}

function resetActors() {
  pac.x = 11;
  pac.y = 13;
  pac.px = pac.x * TILE + TILE / 2;
  pac.py = HUD_H + pac.y * TILE + TILE / 2;
  pac.dir = "left";
  pac.next = "left";

  ghosts.length = 0;
  ghostBase.forEach((g, i) => {
    ghosts.push({
      x: g.x,
      y: g.y,
      px: g.x * TILE + TILE / 2,
      py: HUD_H + g.y * TILE + TILE / 2,
      dir: i % 2 ? "right" : "left",
      color: g.color,
      dead: false,
    });
  });
}

function startGamePlay() {
  resetMap();
  resetActors();
  frightened = 0;
  gameState = STATE.PLAYING;
}

function startOpening() {
  gameState = STATE.OPENING_SCROLL;
  openingOffset = canvas.height;
  openingReadyTimer = 0;
}

function tileAt(x, y) {
  if (y < 0 || y >= MAP_H) return 1;
  if (x < 0) x = MAP_W - 1;
  if (x >= MAP_W) x = 0;
  return map[y][x];
}

function canMove(x, y, dir) {
  const nx = x + DIR[dir].x;
  const ny = y + DIR[dir].y;
  return tileAt(nx, ny) !== 1;
}

function warp(e) {
  if (e.x < 0) e.x = MAP_W - 1;
  if (e.x >= MAP_W) e.x = 0;
}

function updatePac(dt) {
  if (canMove(pac.x, pac.y, pac.next)) pac.dir = pac.next;
  if (!canMove(pac.x, pac.y, pac.dir)) return;

  const step = pac.speed * TILE * dt;
  pac.px += DIR[pac.dir].x * step;
  pac.py += DIR[pac.dir].y * step;

  pac.x = Math.round((pac.px - TILE / 2) / TILE);
  pac.y = Math.round((pac.py - HUD_H - TILE / 2) / TILE);
  warp(pac);

  const t = tileAt(pac.x, pac.y);
  if (t === 2 || t === 3) {
    map[pac.y][pac.x] = 0;
    dotsLeft--;
    score += t === 2 ? 10 : 50;
    if (t === 3) frightened = 6;
  }
}

function pickGhostDir(g) {
  const dirs = ["left", "right", "up", "down"].filter((d) => canMove(g.x, g.y, d));
  if (dirs.length === 0) return g.dir;

  if (frightened > 0 && !g.dead) return dirs[(Math.random() * dirs.length) | 0];

  let best = dirs[0];
  let bestDist = Infinity;
  for (const d of dirs) {
    const nx = g.x + DIR[d].x;
    const ny = g.y + DIR[d].y;
    const dist = (pac.x - nx) ** 2 + (pac.y - ny) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function updateGhosts(dt) {
  ghosts.forEach((g) => {
    if (Math.random() < 0.06) g.dir = pickGhostDir(g);
    if (!canMove(g.x, g.y, g.dir)) g.dir = pickGhostDir(g);

    const speed = (frightened > 0 ? 3.2 : 5.8) * TILE * dt;
    g.px += DIR[g.dir].x * speed;
    g.py += DIR[g.dir].y * speed;

    g.x = Math.round((g.px - TILE / 2) / TILE);
    g.y = Math.round((g.py - HUD_H - TILE / 2) / TILE);
    warp(g);

    const hit = Math.hypot(g.px - pac.px, g.py - pac.py) < TILE * 0.45;
    if (!hit) return;

    if (frightened > 0) {
      score += 200;
      g.x = 11;
      g.y = 9;
      g.px = g.x * TILE + TILE / 2;
      g.py = HUD_H + g.y * TILE + TILE / 2;
      return;
    }

    lives--;
    if (lives <= 0) {
      gameState = STATE.GAMEOVER;
    } else {
      resetActors();
    }
  });
}

function drawOpening() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // 初心者向けメモ: ここで画面全体を下から上へスライドさせています。
  ctx.translate(0, openingOffset);

  ctx.fillStyle = "#7c0c12";
  ctx.font = "bold 46px monospace";
  ctx.fillText("1UP", 42, 70);
  ctx.fillText("HI-SCORE", 180, 70);
  ctx.fillText("2UP", 430, 70);

  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 52px monospace";
  ctx.fillText("0000", 42, 120);
  ctx.fillText("10000", 240, 120);
  ctx.fillText("00", 480, 120);

  const boxX = 42;
  const boxY = 170;
  const boxW = 468;
  const boxH = 130;

  ctx.fillStyle = "#e79672";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "#7d1a1c";
  ctx.lineWidth = 8;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#ce9f4b";
  ctx.font = "bold 62px sans-serif";
  ctx.fillText("PACPACMAN", 72, 255);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeText("PACPACMAN", 72, 255);

  ctx.fillStyle = "#f4f4f4";
  ctx.font = "bold 50px monospace";
  ctx.fillText("▶ 1 PLAYER", 110, 375);
  ctx.fillText("  2 PLAYERS", 110, 445);

  ctx.fillStyle = "#f4f4f4";
  ctx.font = "bold 24px monospace";
  const msg = gameState === STATE.OPENING_WAIT ? "PRESS ENTER TO START" : "OPENING...";
  ctx.fillText(msg, 108, 575);

  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, HUD_H);

  ctx.fillStyle = "#d7fcff";
  ctx.font = "bold 24px monospace";
  ctx.fillText("1UP", 14, 24);
  ctx.fillText(String(score).padStart(6, "0"), 14, 50);
  ctx.fillText("HI", 220, 24);
  ctx.fillText(String(highScore).padStart(6, "0"), 220, 50);

  ctx.fillStyle = "#ffe770";
  ctx.fillText(`R${String(round).padStart(2, "0")}`, 430, 24);
  ctx.fillText(`×${lives}`, 430, 50);
}

function drawMap() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = map[y][x];
      const px = x * TILE;
      const py = HUD_H + y * TILE;

      ctx.fillStyle = "#000";
      ctx.fillRect(px, py, TILE, TILE);

      if (t === 1) {
        ctx.strokeStyle = "#3071ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      } else if (t === 2) {
        ctx.fillStyle = "#ffd3d8";
        ctx.fillRect(px + TILE / 2 - 1.5, py + TILE / 2 - 1.5, 3, 3);
      } else if (t === 3) {
        ctx.fillStyle = "#ffd3d8";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPac() {
  pac.mouth += 0.18;
  const bite = Math.abs(Math.sin(pac.mouth)) * 0.35;
  const a = DIR[pac.dir].angle;
  ctx.fillStyle = "#ffe700";
  ctx.beginPath();
  ctx.moveTo(pac.px, pac.py);
  ctx.arc(pac.px, pac.py, TILE * 0.43, a + bite, a - bite + Math.PI * 2);
  ctx.fill();
}

function drawGhost(g) {
  const c = frightened > 0 ? (Math.floor(frightened * 8) % 2 ? "#fff" : "#2453ff") : g.color;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(g.px, g.py - 5, TILE * 0.4, Math.PI, 0);
  ctx.rect(g.px - TILE * 0.4, g.py - 5, TILE * 0.8, TILE * 0.55);
  ctx.fill();
}

function drawOverlay(title, sub) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(40, 230, canvas.width - 80, 140);
  ctx.strokeStyle = "#ffd96f";
  ctx.strokeRect(40, 230, canvas.width - 80, 140);
  ctx.fillStyle = "#ffd96f";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, 285);
  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.fillText(sub, canvas.width / 2, 320);
  ctx.textAlign = "start";
}

function draw() {
  if (gameState === STATE.OPENING_SCROLL || gameState === STATE.OPENING_WAIT) {
    drawOpening();
    return;
  }

  drawHud();
  drawMap();
  drawPac();
  ghosts.forEach(drawGhost);

  if (gameState === STATE.GAMEOVER) {
    drawOverlay("GAME OVER", "Enterでオープニングに戻る");
  }
}

let prev = 0;
function loop(ts) {
  if (!prev) prev = ts;
  const dt = Math.min((ts - prev) / 1000, 0.05);
  prev = ts;

  highScore = Math.max(highScore, score);

  if (gameState === STATE.OPENING_SCROLL) {
    openingOffset -= 260 * dt;
    if (openingOffset <= 0) {
      openingOffset = 0;
      openingReadyTimer += dt;
      if (openingReadyTimer > 0.4) gameState = STATE.OPENING_WAIT;
    }
  } else if (gameState === STATE.PLAYING) {
    if (frightened > 0) frightened -= dt;
    updatePac(dt);
    updateGhosts(dt);

    if (dotsLeft <= 0) {
      round++;
      startGamePlay();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  // 初心者向けメモ: キー操作時の画面スクロールを防ぎます。
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Spacebar"].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === "ArrowLeft") pac.next = "left";
  if (e.key === "ArrowRight") pac.next = "right";
  if (e.key === "ArrowUp") pac.next = "up";
  if (e.key === "ArrowDown") pac.next = "down";

  if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") && gameState === STATE.OPENING_WAIT) {
    startGamePlay();
  }

  if (e.key === "Enter" && gameState === STATE.GAMEOVER) {
    score = 0;
    round = 1;
    lives = 3;
    startOpening();
  }
});

startOpening();
requestAnimationFrame(loop);
