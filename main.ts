// "The World Today" — a newspaper front page summing up the world news of
// Friday 20 November 2026. Drawn pixel by pixel with a hand-made bitmap
// typeface and a hand-made PNG encoder. Node standard library only, no
// network, fully deterministic: two runs write byte-identical files.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette (newsprint) ----
const PAPER = [247, 242, 231];
const INK = [20, 20, 20];
const RED = [179, 32, 44];
const NAVY = [24, 52, 96];
const BLUE = [29, 78, 137];
const GOLD = [196, 141, 28];
const GREY = [110, 108, 100];
const LIGHT = [232, 226, 210];
const WHITE = [255, 255, 255];

// ---- canvas ----
const px = new Uint8Array(W * H * 3);
function fill(c: number[]) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) setPix(i, j, c);
}
function hline(x: number, y: number, w: number, c: number[]) {
  rect(x, y, w, 1, c);
}
function vline(x: number, y: number, h: number, c: number[]) {
  rect(x, y, 1, h, c);
}
function frame(x: number, y: number, w: number, h: number, c: number[]) {
  hline(x, y, w, c);
  hline(x, y + h - 1, w, c);
  vline(x, y, h, c);
  vline(x + w - 1, y, h, c);
}
function disc(cx: number, cy: number, r: number, c: number[]) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPix(x, y, c);
    }
}
function ring(cx: number, cy: number, r: number, c: number[]) {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    setPix(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

// ---- PNG encoder (CRC32 + zlib) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap typeface (hand-drawn glyphs, rows as 5-bit numbers) ----
const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
};

function glyph(ch: string): number[] {
  return GLYPHS[ch] ?? GLYPHS["?"];
}
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawChar(ch: string, x: number, y: number, scale: number, c: number[]) {
  const g = glyph(ch.toUpperCase());
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r] & (0x10 >> col))
        rect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(s: string, x: number, y: number, scale: number, c: number[]) {
  for (let i = 0; i < s.length; i++) drawChar(s[i], x + i * 6 * scale, y, scale, c);
}
function drawTextC(s: string, cx: number, y: number, scale: number, c: number[]) {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Greedy word wrap; returns lines that fit maxW pixels at the given scale.
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(
  s: string,
  x: number,
  y: number,
  maxW: number,
  scale: number,
  c: number[],
  maxLines = 99,
): number {
  const lines = wrap(s, maxW, scale).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++)
    drawText(lines[i], x, y + i * (7 * scale + 3), scale, c);
  return y + lines.length * (7 * scale + 3);
}

// ---- small pixel icons (drawn with rect/disc/ring primitives) ----
function iconGlobe(x: number, y: number, s: number, c: number[]) {
  ring(x + 20 * s, y + 20 * s, 18 * s, c);
  hline(x + 3 * s, y + 20 * s, 34 * s, c);
  for (let i = -2; i <= 2; i++) {
    const yy = y + 20 * s + i * 7 * s;
    hline(x + 6 * s, yy, 28 * s, c);
  }
  vline(x + 20 * s, y + 3 * s, 34 * s, c);
}
function iconStorm(x: number, y: number, s: number, c: number[]) {
  disc(x + 14 * s, y + 14 * s, 9 * s, c);
  disc(x + 24 * s, y + 12 * s, 10 * s, c);
  disc(x + 30 * s, y + 16 * s, 7 * s, c);
  rect(x + 6 * s, y + 16 * s, 30 * s, 6 * s, c);
  for (let i = 0; i < 4; i++) {
    vline(x + (10 + i * 7) * s, y + 26 * s, 7 * s, c);
    vline(x + (12 + i * 7) * s, y + 29 * s, 5 * s, c);
  }
}
function iconChartUp(x: number, y: number, s: number, c: number[]) {
  const bars = [8, 14, 20, 28];
  for (let i = 0; i < 4; i++)
    rect(x + (4 + i * 9) * s, y + (34 - bars[i]) * s, 6 * s, bars[i] * s, c);
  hline(x + 2 * s, y + 36 * s, 38 * s, c);
}
function iconChartDown(x: number, y: number, s: number, c: number[]) {
  const bars = [28, 20, 14, 8];
  for (let i = 0; i < 4; i++)
    rect(x + (4 + i * 9) * s, y + (34 - bars[i]) * s, 6 * s, bars[i] * s, c);
  hline(x + 2 * s, y + 36 * s, 38 * s, c);
}
function iconGavel(x: number, y: number, s: number, c: number[]) {
  rect(x + 6 * s, y + 6 * s, 20 * s, 7 * s, c);
  rect(x + 20 * s, y + 13 * s, 4 * s, 16 * s, c);
  rect(x + 8 * s, y + 29 * s, 26 * s, 4 * s, c);
  rect(x + 28 * s, y + 2 * s, 8 * s, 5 * s, c);
}
function iconRocket(x: number, y: number, s: number, c: number[]) {
  disc(x + 20 * s, y + 14 * s, 8 * s, c);
  rect(x + 14 * s, y + 14 * s, 12 * s, 14 * s, c);
  rect(x + 8 * s, y + 20 * s, 6 * s, 10 * s, c);
  rect(x + 26 * s, y + 20 * s, 6 * s, 10 * s, c);
  disc(x + 20 * s, y + 34 * s, 4 * s, c);
}
function iconBat(x: number, y: number, s: number, c: number[]) {
  rect(x + 10 * s, y + 4 * s, 8 * s, 22 * s, c);
  rect(x + 12 * s, y + 26 * s, 4 * s, 12 * s, c);
  disc(x + 30 * s, y + 30 * s, 6 * s, c);
}
function iconDove(x: number, y: number, s: number, c: number[]) {
  disc(x + 12 * s, y + 16 * s, 7 * s, c);
  rect(x + 16 * s, y + 12 * s, 16 * s, 7 * s, c);
  rect(x + 26 * s, y + 8 * s, 10 * s, 5 * s, c);
  rect(x + 8 * s, y + 22 * s, 18 * s, 4 * s, c);
  rect(x + 30 * s, y + 18 * s, 6 * s, 4 * s, c);
}
function iconDrop(x: number, y: number, s: number, c: number[]) {
  for (let r = 0; r < 12; r++) {
    const w = Math.min(r + 2, 12 - r + 4);
    hline(x + 20 * s - Math.floor(w / 2) * s, y + (6 + r * 2) * s, w * s, c);
  }
  disc(x + 20 * s, y + 30 * s, 6 * s, c);
}
function iconStar(x: number, y: number, s: number, c: number[]) {
  disc(x + 20 * s, y + 20 * s, 6 * s, c);
  rect(x + 19 * s, y + 4 * s, 2 * s, 32 * s, c);
  rect(x + 4 * s, y + 19 * s, 32 * s, 2 * s, c);
}
const ICONS: Record<string, (x: number, y: number, s: number, c: number[]) => void> = {
  globe: iconGlobe,
  storm: iconStorm,
  chartUp: iconChartUp,
  chartDown: iconChartDown,
  gavel: iconGavel,
  rocket: iconRocket,
  bat: iconBat,
  dove: iconDove,
  drop: iconDrop,
  star: iconStar,
};

// ---- the day's stories (verified from news search, 20 Nov 2026) ----
type Story = { kicker: string; head: string; body: string; src: string; icon: string };
const PANELS: Story[] = [
  {
    kicker: "THE HAGUE",
    head: "ICJ: MYANMAR COMMITTED GENOCIDE",
    body: "The Hague rules Myanmar committed genocide against the Rohingya.",
    src: "BBC",
    icon: "gavel",
  },
  {
    kicker: "CYCLONE AKVAN",
    head: "300,000 FLEE AS STORM HITS ODISHA",
    body: "Cyclone hits Odisha; 423 rescue teams out as trains are cancelled.",
    src: "THE HINDU",
    icon: "storm",
  },
  {
    kicker: "MARKETS",
    head: "ANTHROPIC'S $107BN RECORD DEBUT",
    body: "Shares close $97.17, up 17% on $83 offer, in the biggest IPO ever.",
    src: "BLOOMBERG",
    icon: "chartUp",
  },
  {
    kicker: "WALL STREET",
    head: "STOCKS TUMBLE 2% ON AI NERVES",
    body: "S&P 500 falls 2.02%; Dow sheds 1,101 points as AI nerves spread.",
    src: "YAHOO FINANCE",
    icon: "chartDown",
  },
  {
    kicker: "IRAN",
    head: "TRUMP: NO RUSH ON IRAN DECISION",
    body: "President pushes any war decision to 2027: 'We'll see what happens'.",
    src: "REUTERS",
    icon: "globe",
  },
  {
    kicker: "UKRAINE",
    head: "EUROPE READY FOR TALKS WITH RUSSIA",
    body: "Europe is ready to negotiate an end to the war, leaders say.",
    src: "BBC / AP",
    icon: "dove",
  },
  {
    kicker: "SPACE",
    head: "VOYAGER, A LIGHT-DAY FROM HOME",
    body: "Voyager 1 is now a full light-day from Earth - 25.9 billion km out.",
    src: "NASA",
    icon: "rocket",
  },
  {
    kicker: "CRICKET",
    head: "PHILLIPS' RECORD CENTURY",
    body: "Phillips' ton: first to hit centuries vs India in all formats.",
    src: "NDTV SPORTS",
    icon: "bat",
  },
  {
    kicker: "PACIFIC",
    head: "FIJI DECLARES DROUGHT DISASTER",
    body: "El Nino drought hits crisis levels in Fiji and Tonga; water short.",
    src: "MANILA TIMES",
    icon: "drop",
  },
];

// Short headlines for the "Also today" strip.
const ALSO: [string, string][] = [
  ["SOUTH AFRICA BEAT BANGLADESH BY 9 WICKETS", "QATAR TRIBUNE"],
  ["S KOREA COURT OVERTURNS EX-PM HAN CONVICTION", "STUDMENTOR"],
  ["US AND VENEZUELA AGREE TO RESTORE MILITARY COOPERATION", "US DEFENCE DEPT"],
  ["SOMALIA EXPELS UAE AMBASSADOR OVER ALLEGED INTERFERENCE", "BANGKOK POST"],
  ["GAZANS RETURN AS ISRAEL ENDS RARE GROUND OPERATION", "BANGKOK POST"],
  ["INDONESIA PASSES LAW TO SEIZE CRIMINAL ASSETS", "AFP"],
  ["HAYABUSA2 DROPS ASTEROID LANDING AFTER ENGINE TROUBLE", "SPACE.COM"],
  ["GTA 6 SALES PASS THE ODYSSEY'S $1.8BN GLOBAL RUN", "MEZHA"],
  ["NATIONAL BOOK AWARD: ASSADI'S 'PARADISO 17' WINS FICTION", "AP"],
  ["PRINCE HARRY: 'I'LL REJOIN ARMY TO FIGHT RUSSIA IF NEEDED'", "MANILA TIMES"],
  ["MODI OPENS FICCI CENTENARY; ASKS: 'WHERE ARE THE JOBS?'", "MATHRUBHUMI"],
  ["SENSEX UP 700 PTS; NIFTY TOPS 25,400", "JAGRAN JOSH"],
  ["MOON MEETS SATURN IN TONIGHT'S SKY", "SPACE.COM"],
  ["UK AND EU HOLD SUMMIT TO PATCH UP POST-BREXIT TIES", "MANILA TIMES"],
  ["POCHETTINO TAKES CHARGE AT MAN UTD", "QATAR TRIBUNE"],
];

// ---- layout ----
function masthead() {
  drawTextC("THE WORLD TODAY", W / 2, 20, 6, INK);
  hline(28, 70, W - 56, INK);
  hline(28, 74, W - 56, INK);
  drawTextC("FRIDAY 20 NOVEMBER 2026", W / 2, 84, 4, RED);
  drawTextC("ONE DAY - ONE PAGE - EVERY STORY THAT MATTERED", W / 2, 120, 2, GREY);
  hline(28, 142, W - 56, INK);
}

function lead() {
  const x = 28;
  const y = 150;
  const w = W - 56;
  const h = 152;
  rect(x, y, w, h, NAVY);
  frame(x, y, w, h, GOLD);
  drawText("LEAD STORY - SHENZHEN, CHINA", x + 20, y + 14, 2, GOLD);
  iconGlobe(x + 22, y + 48, 2, WHITE);
  drawText("THREE LEADERS, ONE TABLE", x + 122, y + 28, 4, WHITE);
  drawPara(
    "Trump, Xi and Putin meet in the first three-way summit of its kind, issuing a 'Declaration Towards Peace' on nuclear risks, trade and UN reform - but with no breakthrough.",
    x + 122,
    y + 68,
    w - 142,
    2,
    WHITE,
    3,
  );
  drawText("AFP / BBC / THE MANILA TIMES", x + 122, y + 124, 2, GOLD);
}

function panel(s: Story, x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, WHITE);
  frame(x, y, w, h, INK);
  drawText(s.kicker, x + 10, y + 8, 1, RED);
  ICONS[s.icon](x + w - 50, y + 6, 1, BLUE);
  drawPara(s.head, x + 10, y + 26, w - 62, 2, INK, 3);
  hline(x + 10, y + 82, w - 20, LIGHT);
  drawPara(s.body, x + 10, y + 90, w - 20, 2, INK, 3);
  drawText("(" + s.src + ")", x + 10, y + h - 18, 1, GREY);
}

function alsoToday() {
  drawText("ALSO TODAY", 28, 858, 2, RED);
  hline(28, 880, W - 56, INK);
  const colW = (W - 56 - 24) / 2;
  for (let i = 0; i < ALSO.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 28 + col * (colW + 24);
    const y = 890 + row * 11;
    drawText("*", x, y, 1, RED);
    drawText(ALSO[i][0], x + 10, y, 1, INK);
    const sw = textWidth(ALSO[i][0], 1);
    drawText("[" + ALSO[i][1] + "]", x + 10 + sw + 6, y, 1, GREY);
  }
}

function footer() {
  hline(28, 982, W - 56, INK);
  drawTextC(
    "SOURCES: AFP, AP, BBC, REUTERS, BLOOMBERG, THE HINDU, NDTV, MANILA TIMES, BANGKOK POST, SPACE.COM, QATAR TRIBUNE",
    W / 2,
    990,
    1,
    GREY,
  );
}

function main() {
  fill(PAPER);
  masthead();
  lead();
  drawText("THE DAY IN BRIEF", 28, 312, 3, INK);
  hline(28, 336, W - 56, INK);
  const pw = 304;
  const ph = 160;
  const gx = 28;
  const gy = 346;
  for (let i = 0; i < PANELS.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    panel(PANELS[i], gx + col * (pw + 16), gy + row * (ph + 12), pw, ph);
  }
  alsoToday();
  footer();
  const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(out, { recursive: true });
  writeFileSync(out + "/entry.png", encodePNG());
}

main();
