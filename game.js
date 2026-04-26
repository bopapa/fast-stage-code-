const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 24;
const HUD = 72;

// 0=道,1=壁,2=ドット,3=パワーエサ,4=巣,5=ゴーストの一方通行マス
const MAP_TEXT = [
  "11111111111111111111111",
  "13322222222112222222331",
  "12111121112112111211121",
  "12222221122222211222221",
  "12112111112112111121121",
  "12212122222222222121221",
  "11112121111111112121111",
  "00002121444444412120000",
  "11112121411114112121111",
  "22222222400000422222222",
  "11112121411114112121111",
  "00002121444444412120000",
  "11112121111111112121111",
  "12222122222222222122221",
  "12112112111111112121121",
  "13222222122222212222231",
  "11111111111111111111111",
];

const DIRS = {
  left: { x: -1, y: 0, a: Math.PI },
  right: { x: 1, y: 0, a: 0 },
  up: { x: 0, y: -1, a: -Math.PI / 2 },
  down: { x: 0, y: 1, a: Math.PI / 2 },
};

const GHOST_TYPES = [
  { key: "blinky", jp: "オイカケ", nick: "アカベイ", color: "#ff2a2a", startMode: "chase" },
  { key: "pinky", jp: "マチブセ", nick: "ピンキー", color: "#ff9fd0", startMode: "scatter" },
  { key: "inky", jp: "キマグレ", nick: "アオスケ", color: "#34d7ff", startMode: "scatter" },
  { key: "clyde", jp: "オトボケ", nick: "グズタ", color: "#ff9d11", startMode: "scatter" },
];

const FRUITS = ["🍒", "🍓", "🍊", "🍎", "🍈", "🔔", "⭐", "🔑"];

let map = [];
let score = 0;
let highScore = 0;
let round = 1;
let lives = 3;
let dotsLeft = 0;
let totalDots = 0;
let gameState = "opening";
let frightenedTimer = 0;
let modeTimer = 0;
let modeIndex = 0;
let intermission = 0;
let openingY = canvas.height + 180;
let openingHold = 0;
let openingReady = false;

let fruit = null;
let fruitTimer = 0;
let fruitSpawnCount = 0;

const pacman = { x: 11, y: 13, px: 0, py: 0, dir: "left", nextDir: "left", speed: 7.1, mouth: 0 };
const ghosts = [];

function mapAt(x, y) {
  if (y < 0 || y >= map.length) return 1;
  if (x < 0) x = map[0].length - 1;
  if (x >= map[0].length) x = 0;
  return map[y][x];
}

function canMove(x, y, dir, isGhost = false) {
  const nx = x + DIRS[dir].x;
  const ny = y + DIRS[dir].y;
  const t = mapAt(nx, ny);
  if (t === 1) return false;
  // 初心者向けメモ: 一方通行はゴーストだけが「上から下へ」入れません。
  if (isGhost && t === 5 && dir === "down") return false;
  return true;
}

function warp(entity) {
  if (entity.x < 0) entity.x = map[0].length - 1;
  if (entity.x >= map[0].length) entity.x = 0;
}

function resetMap() {
  map = MAP_TEXT.map((row) => row.split("").map(Number));
  dotsLeft = 0;
  totalDots = 0;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === 2 || map[y][x] === 3) {
        dotsLeft++;
        totalDots++;
      }
    }
  }
}

function resetActors() {
  pacman.x = 11;
  pacman.y = 13;
  pacman.px = pacman.x * TILE + TILE / 2;
  pacman.py = HUD + pacman.y * TILE + TILE / 2;
  pacman.dir = "left";
  pacman.nextDir = "left";

  ghosts.length = 0;
  const home = [[11, 9], [10, 9], [12, 9], [11, 8]];
  GHOST_TYPES.forEach((g, i) => {
    ghosts.push({
      ...g,
      x: home[i][0],
      y: home[i][1],
      px: home[i][0] * TILE + TILE / 2,
      py: HUD + home[i][1] * TILE + TILE / 2,
      dir: i % 2 === 0 ? "left" : "right",
      mode: g.startMode,
      dead: false,
      released: i === 0,
      releaseTime: i * 3.5,
      localTime: 0,
    });
  });
}

function startRound() {
  resetMap();
  resetActors();
  frightenedTimer = 0;
  modeTimer = 0;
  modeIndex = 0;
  fruit = null;
  fruitTimer = 0;
  fruitSpawnCount = 0;
  openingReady = false;
  gameState = "playing";
}

function restartGame() {
  score = 0;
  round = 1;
  lives = 3;
  gameState = "opening";
  openingY = canvas.height + 180;
  openingHold = 0;
  openingReady = false;
}

function getGhostTarget(g) {
  const corners = {
    blinky: { x: 22, y: 0 },
    pinky: { x: 1, y: 0 },
    inky: { x: 22, y: 16 },
    clyde: { x: 1, y: 16 },
  };

  if (g.dead) return { x: 11, y: 9 };
  if (g.mode === "scatter") return corners[g.key];

  if (g.key === "blinky") return { x: pacman.x, y: pacman.y };
  if (g.key === "pinky") return { x: pacman.x + DIRS[pacman.dir].x * 4, y: pacman.y + DIRS[pacman.dir].y * 4 };
  if (g.key === "inky") {
    const b = ghosts[0];
    return { x: pacman.x * 2 - b.x, y: pacman.y * 2 - b.y };
  }
  const d = Math.hypot(pacman.x - g.x, pacman.y - g.y);
  return d > 6 ? { x: pacman.x, y: pacman.y } : corners.clyde;
}

function chooseGhostDir(g) {
  const options = Object.keys(DIRS).filter((d) => canMove(g.x, g.y, d, true));
  if (options.length === 0) return g.dir;

  const opposite = { left: "right", right: "left", up: "down", down: "up" };
  const nonReverse = options.filter((d) => d !== opposite[g.dir]);
  const candidates = nonReverse.length ? nonReverse : options;

  if (g.mode === "frightened") return candidates[(Math.random() * candidates.length) | 0];

  const target = getGhostTarget(g);
  let best = candidates[0];
  let bestDist = 1e9;
  for (const dir of candidates) {
    const nx = g.x + DIRS[dir].x;
    const ny = g.y + DIRS[dir].y;
    const dist = (target.x - nx) ** 2 + (target.y - ny) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function updatePacman(dt) {
  if (canMove(pacman.x, pacman.y, pacman.nextDir)) pacman.dir = pacman.nextDir;
  if (!canMove(pacman.x, pacman.y, pacman.dir)) return;

  const speed = pacman.speed * TILE * dt;
  pacman.px += DIRS[pacman.dir].x * speed;
  pacman.py += DIRS[pacman.dir].y * speed;

  pacman.x = Math.round((pacman.px - TILE / 2) / TILE);
  pacman.y = Math.round((pacman.py - HUD - TILE / 2) / TILE);
  warp(pacman);

  const t = mapAt(pacman.x, pacman.y);
  if (t === 2 || t === 3) {
    map[pacman.y][pacman.x] = 0;
    dotsLeft--;
    score += t === 2 ? 10 : 50;

    if (t === 3) {
      frightenedTimer = Math.max(3.2, 7 - round * 0.2);
      ghosts.forEach((g) => {
        if (!g.dead) g.mode = "frightened";
      });
    }
  }

  if (fruit && pacman.x === fruit.x && pacman.y === fruit.y) {
    score += 200 + round * 20;
    fruit = null;
    fruitTimer = 0;
  }
}

function updateGhosts(dt, elapsedSec) {
  ghosts.forEach((g) => {
    g.localTime += dt;
    if (!g.released && elapsedSec > g.releaseTime) g.released = true;
    if (!g.released) return;

    const gx = (g.px - TILE / 2) / TILE;
    const gy = (g.py - HUD - TILE / 2) / TILE;
    if (Math.abs(gx - g.x) < 0.1 && Math.abs(gy - g.y) < 0.1) g.dir = chooseGhostDir(g);

    let speed = (6.1 + Math.min(round * 0.22, 2.6)) * TILE * dt;
    if (g.mode === "frightened") speed = 3.8 * TILE * dt;
    if ((g.y === 7 || g.y === 9) && (g.x < 2 || g.x > 20)) speed *= 0.65; // ワープトンネル内の減速

    g.px += DIRS[g.dir].x * speed;
    g.py += DIRS[g.dir].y * speed;

    g.x = Math.round((g.px - TILE / 2) / TILE);
    g.y = Math.round((g.py - HUD - TILE / 2) / TILE);
    warp(g);

    if (g.dead && g.x === 11 && g.y === 9) {
      g.dead = false;
      g.mode = "chase";
    }

    const hit = Math.hypot(g.px - pacman.px, g.py - pacman.py) < TILE * 0.43;
    if (!hit) return;

    if (g.mode === "frightened" && !g.dead) {
      score += 200;
      g.dead = true;
      g.mode = "dead";
      return;
    }

    if (!g.dead) {
      lives--;
      if (lives <= 0) {
        gameState = "gameover";
      } else {
        resetActors();
      }
    }
  });
}

function updateMode(dt) {
  if (frightenedTimer > 0) {
    frightenedTimer -= dt;
    if (frightenedTimer <= 0) {
      ghosts.forEach((g) => {
        if (!g.dead) g.mode = "chase";
      });
    }
    return;
  }

  // 交互モード: 縄張り→追跡→縄張り...（切替時は反転）
  const table = [7, 20, 7, 20, 5, 20, 5, Infinity];
  modeTimer += dt;
  if (modeTimer <= table[modeIndex]) return;

  modeTimer = 0;
  modeIndex = Math.min(modeIndex + 1, table.length - 1);
  const next = modeIndex % 2 === 0 ? "scatter" : "chase";
  const reverse = { left: "right", right: "left", up: "down", down: "up" };

  ghosts.forEach((g) => {
    if (!g.dead) {
      g.mode = next;
      g.dir = reverse[g.dir];
    }
  });
}

function updateFruit(dt) {
  if (fruitSpawnCount < 2) {
    const rate = (totalDots - dotsLeft) / Math.max(1, totalDots);
    if (!fruit && rate > 0.35 + fruitSpawnCount * 0.3) {
      fruitSpawnCount++;
      fruit = { x: 11, y: 10, icon: FRUITS[Math.min(round - 1, FRUITS.length - 1)] };
      fruitTimer = 10;
    }
  }

  if (fruit) {
    fruitTimer -= dt;
    if (fruitTimer <= 0) fruit = null;
  }
}


function drawOpening() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  const boxW = 470;
  const boxH = 132;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = openingY;

  ctx.fillStyle = "#e79572";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "#7d1a1c";
  ctx.lineWidth = 8;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#ce9f4b";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText("PACPACMAN", boxX + 32, boxY + 88);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeText("PACPACMAN", boxX + 32, boxY + 88);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "bold 50px monospace";
  ctx.fillText("▶ 1 PLAYER", 120, boxY + 205);
  ctx.fillText("  2 PLAYERS", 120, boxY + 270);

  ctx.fillStyle = "#8d1b1f";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText("PACPACMAN", 160, boxY + 350);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "bold 34px monospace";
  ctx.fillText("© 1980  1984 PACPAC LTD.", 56, boxY + 426);
  ctx.fillText("ALL RIGHTS RESERVED", 82, boxY + 474);

  if (openingReady) {
    ctx.fillStyle = "#fff47a";
    ctx.font = "bold 28px monospace";
    ctx.fillText("PRESS ENTER TO START", 86, boxY + 530);
  }
}

function drawHud() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, HUD);

  ctx.fillStyle = "#d4f9ff";
  ctx.font = "bold 26px monospace";
  ctx.fillText("1UP", 16, 24);
  ctx.fillText(String(score).padStart(6, "0"), 16, 50);

  ctx.fillText("HI", 220, 24);
  ctx.fillText(String(highScore).padStart(6, "0"), 220, 50);

  ctx.fillStyle = "#ffe772";
  ctx.font = "bold 22px monospace";
  ctx.fillText(`R${String(round).padStart(2, "0")}`, 430, 24);
  ctx.fillText(`×${lives}`, 430, 50);
}

function drawWallCell(x, y) {
  const px = x * TILE;
  const py = HUD + y * TILE;
  ctx.fillStyle = "#000";
  ctx.fillRect(px, py, TILE, TILE);

  ctx.strokeStyle = "#2c5bff";
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);

  ctx.strokeStyle = "#7dc0ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
}

function drawMap() {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      const t = map[y][x];
      if (t === 1) {
        drawWallCell(x, y);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(x * TILE, HUD + y * TILE, TILE, TILE);
      }

      if (t === 2) {
        ctx.fillStyle = "#ffd0d8";
        ctx.fillRect(x * TILE + TILE / 2 - 1.5, HUD + y * TILE + TILE / 2 - 1.5, 3, 3);
      }

      if (t === 3) {
        ctx.fillStyle = "#ffc6d0";
        ctx.beginPath();
        ctx.arc(x * TILE + TILE / 2, HUD + y * TILE + TILE / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (fruit) {
    ctx.font = "22px sans-serif";
    ctx.fillText(fruit.icon, fruit.x * TILE + 3, HUD + fruit.y * TILE + 20);
  }
}

function drawPacman() {
  pacman.mouth += 0.18;
  const bite = Math.abs(Math.sin(pacman.mouth)) * 0.35;
  const angle = DIRS[pacman.dir].a;

  ctx.fillStyle = "#ffe800";
  ctx.beginPath();
  ctx.moveTo(pacman.px, pacman.py);
  ctx.arc(pacman.px, pacman.py, TILE * 0.43, angle + bite, angle - bite + Math.PI * 2);
  ctx.fill();
}

function drawGhost(g) {
  let color = g.color;
  if (g.mode === "frightened") {
    color = frightenedTimer < 2 && Math.floor(frightenedTimer * 8) % 2 ? "#ffffff" : "#2453ff";
  }
  if (g.dead) color = "#f6f8ff";

  const x = g.px;
  const y = g.py;
  const w = TILE * 0.82;
  const h = TILE * 0.82;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.22, w * 0.5, Math.PI, 0);
  ctx.rect(x - w * 0.5, y - h * 0.22, w, h * 0.62);
  ctx.fill();

  // ギザギザの足元（ピクセル風）
  ctx.fillRect(x - w * 0.5, y + h * 0.2, w * 0.2, h * 0.16);
  ctx.clearRect(x - w * 0.3, y + h * 0.2, w * 0.1, h * 0.16);
  ctx.fillRect(x - w * 0.1, y + h * 0.2, w * 0.2, h * 0.16);
  ctx.clearRect(x + w * 0.1, y + h * 0.2, w * 0.1, h * 0.16);
  ctx.fillRect(x + w * 0.3, y + h * 0.2, w * 0.2, h * 0.16);

  if (!g.dead) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 5, y - 3, 4, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f68b7";
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 2, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawActors() {
  drawPacman();
  ghosts.forEach(drawGhost);
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(40, 230, canvas.width - 80, 140);
  ctx.strokeStyle = "#ffd96f";
  ctx.strokeRect(40, 230, canvas.width - 80, 140);

  ctx.fillStyle = "#ffd96f";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, 286);

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.fillText(subtitle, canvas.width / 2, 324);
  ctx.textAlign = "start";
}

function draw() {
  if (gameState === "opening") {
    drawOpening();
    return;
  }

  drawHud();
  drawMap();
  drawActors();

  if (gameState === "intermission") drawOverlay("COFFEE BREAK", "15秒の休憩デモ");
  if (gameState === "gameover") drawOverlay("GAME OVER", "Enterキーで再スタート");
}

let prev = 0;
function loop(ts) {
  if (!prev) prev = ts;
  const dt = Math.min((ts - prev) / 1000, 0.05);
  prev = ts;

  highScore = Math.max(highScore, score);

  if (gameState === "opening") {
    const targetY = 160;
    if (openingY > targetY) {
      openingY -= 220 * dt;
    } else {
      openingY = targetY;
      openingHold += dt;
      if (openingHold > 0.7) openingReady = true;
    }
  } else if (gameState === "playing") {
    updateMode(dt);
    updatePacman(dt);
    updateGhosts(dt, performance.now() / 1000);
    updateFruit(dt);

    if (dotsLeft <= 0) {
      round++;
      if ([2, 5, 9, 13, 17].includes(round - 1)) {
        gameState = "intermission";
        intermission = 15;
      } else {
        startRound();
      }
    }
  } else if (gameState === "intermission") {
    intermission -= dt;
    if (intermission <= 0) startRound();
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  const blocked = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Spacebar"];
  if (blocked.includes(e.key)) e.preventDefault();

  if (e.key === "ArrowLeft") pacman.nextDir = "left";
  if (e.key === "ArrowRight") pacman.nextDir = "right";
  if (e.key === "ArrowUp") pacman.nextDir = "up";
  if (e.key === "ArrowDown") pacman.nextDir = "down";

  if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") && gameState === "opening" && openingReady) {
    startRound();
  }

  if (e.key === "Enter" && gameState === "gameover") restartGame();
});

restartGame();
requestAnimationFrame(loop);
