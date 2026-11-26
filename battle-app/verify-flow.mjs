import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

// 1. Previewサーバー起動
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
  cwd: "/workspaces/poke-fr-pvp-proto/battle-app",
  stdio: "ignore",
  env: { ...process.env, CI: "1" },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPageUp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("Server did not start.");
}

await waitForPageUp();

const browser = await chromium.launch({
  executablePath: "/opt/ms-playwright/chromium-1254/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errors = [];
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fail++;
    console.log(`FAIL: ${name}`);
  }
}

// -masterデータ（src/data/pokemonMaster.js と同一の順・spd値）
// index: 0 グラードン(3) / 1 ディアルガ(5) / 2 テストポケモン1(2) / 3 テストポケモン2(4)
//         4 テストポケモン3(1) / 5 テストポケモン4(5) / 6 テストポケモン5(2) / 7 テストポケモン6(3)
//         8 テストポケモン7(3) / 9 テストポケモン8(4)
const MASTER = [
  { name: "グラードン", spd: 3 },
  { name: "ディアルガ", spd: 5 },
  { name: "テストポケモン1", spd: 2 },
  { name: "テストポケモン2", spd: 4 },
  { name: "テストポケモン3", spd: 1 },
  { name: "テストポケモン4", spd: 5 },
  { name: "テストポケモン5", spd: 2 },
  { name: "テストポケモン6", spd: 3 },
  { name: "テストポケモン7", spd: 3 },
  { name: "テストポケモン8", spd: 4 },
];

// P1エントリー：指定カード（マスターインデックス順）をタップで追加
async function playEntryP1(cards) {
  await page.getByText("バトル スタート").click();
  await page.waitForSelector("text=プレイヤー1 の選び方");
  check("ENTRY_P1: 画面遷移", true);
  check("ENTRY_P1: 6スロット表示", (await page.locator(".slot").count()) === 6);
  check("ENTRY_P1: ポケモン一覧10体", (await page.locator(".pokemon-card").count()) === 10);
  check(
    "ENTRY_P1: けついボタンの初期無効化",
    (await page.getByText("これで けつい！").isDisabled()) === true
  );
  for (const i of cards) {
    await page.locator(".pokemon-card").nth(i).click();
  }
  check("ENTRY_P1: 手動選択で6枠埋まる", (await page.locator(".slot-filled").count()) === 6);
  await page.screenshot({ path: "/tmp/opencode/shot2_entry_p1.png" });
  await page.getByText("これで けつい！").click();
}

// P2エントリー：指定カード（マスターインデックス順）をタップで追加
async function playEntryP2(cards) {
  await page.waitForSelector("text=プレイヤー2 の選び方", { timeout: 6000 });
  check("ENTRY_P2: 中継後自動遷移", true);
  check("ENTRY_P2: 6スロット表示", (await page.locator(".slot").count()) === 6);
  for (const i of cards) {
    await page.locator(".pokemon-card").nth(i).click();
  }
  check("ENTRY_P2: 手動選択で6枠埋まる", (await page.locator(".slot-filled").count()) === 6);
  await page.screenshot({ path: "/tmp/opencode/shot4_entry_p2.png" });
  await page.getByText("これで けつい！").click();
}

// バトル選択：P1が先発カード p1i、P2が先発カード p2i を選び、結果フェーズまで進む
async function playBattleSelect(p1i, p2i) {
  await page.locator(".battle-command").nth(p1i).click();
  await page.waitForSelector(".battle-handover");
  await page.locator(".battle-handover-btn").click();
  await page.waitForSelector("text=P2の ターン！");
  await page.locator(".battle-command").nth(p2i).click();
  await page.waitForSelector("text=もういちど えらぶ（リセット）");
}

// バトル開始まで進める（P1/P2のチームが既知なので先発3体も固定）
async function startBattle(p1Cards, p2Cards) {
  await playEntryP1(p1Cards);
  await playEntryP2(p2Cards);
  await page.waitForSelector("text=TURN 1/6");
  check("BATTLE: 画面表示", true);
  check("BATTLE: ターン表示", (await page.getByText("TURN 1/6").count()) === 1);
  check("BATTLE: スコア表示", (await page.getByText("P1 0 - 0 P2").count()) === 1);
  check("BATTLE: P2先発3体", (await page.locator(".battle-row-p2 .battle-card").count()) === 3);
  check("BATTLE: P1先発3体", (await page.locator(".battle-row-p1 .battle-card").count()) === 3);
  const p1BattleNames = await page.locator(".battle-row-p1 .battle-name").allTextContents();
  const p2BattleNames = await page.locator(".battle-row-p2 .battle-name").allTextContents();
  check(
    "BATTLE: P1先発がエントリー先発と一致",
    JSON.stringify(p1BattleNames) === JSON.stringify(p1Cards.slice(0, 3).map((i) => MASTER[i].name))
  );
  check(
    "BATTLE: P2先発がエントリー先発と一致",
    JSON.stringify(p2BattleNames) === JSON.stringify(p2Cards.slice(0, 3).map((i) => MASTER[i].name))
  );
}

// ====================== パターン1：P1の spd が高い → P1 が先攻 ======================
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=バトル スタート");
check("TITLE: タイトル画面表示", (await page.getByText("POKE BATTLE").count()) === 1);
await page.screenshot({ path: "/tmp/opencode/shot1_title.png" });

// P1先発: T2(4)/T4(5)/T8(4) / P2先発: G(3)/D(5)/T1(2)
await startBattle([3, 5, 9, 0, 1, 2], [0, 1, 2, 3, 4, 5]);

// SELECT_P1
check(
  "SELECT_P1: メッセージ",
  (await page.locator(".battle-message p").innerText()) ===
    "P1の ターン！ こうげきする ポケモンを えらんでね！"
);
check("SELECT_P1: コマンド3ボタン", (await page.locator(".battle-command").count()) === 3);
await page.screenshot({ path: "/tmp/opencode/shot5_battle.png" });

await playBattleSelect(0, 0); // P1: T2(spd4) vs P2: G(spd3)
check("SPEED_RESULT: 遷移（リセットボタン表示）", (await page.locator(".battle-reset").count()) === 1);
check(
  "SPEED_RESULT: メッセージ（P1高速）",
  (await page.locator(".battle-message p").innerText()) ===
    "P1(▲4) vs P2(▲3)！ せんこうは P1 の テストポケモン2！"
);
check(
  "SPEED_RESULT: 1stバッジ1枚（P1選択カードに）",
  (await page.locator(".battle-order-badge-first").count()) === 1 &&
    (await page.locator(".battle-row-p1 .battle-card-selected .battle-order-badge").textContent()) ===
      "1st せんこう"
);
check(
  "SPEED_RESULT: 2ndバッジ1枚（P2選択カードに）",
  (await page.locator(".battle-order-badge-second").count()) === 1 &&
    (await page.locator(".battle-row-p2 .battle-card-selected .battle-order-badge").textContent()) ===
      "2nd こうこう"
);
check(
  "SPEED_RESULT: P1選択カード1枚（青ハイライト）",
  (await page.locator(".battle-card-selected.battle-card-selected-p1").count()) === 1
);
check(
  "SPEED_RESULT: P2選択カード1枚（赤ハイライト）",
  (await page.locator(".battle-card-selected.battle-card-selected-p2").count()) === 1
);
await page.screenshot({ path: "/tmp/opencode/shot7_speed_result_p1_fast.png" });

// リセット → SELECT_P1 に戻る
await page.locator(".battle-reset").click();
await page.waitForSelector("text=P1の ターン！");
check("RESET: SELECT_P1 に戻る", (await page.locator(".battle-handover").count()) === 0);
check("RESET: コマンド3ボタン", (await page.locator(".battle-command").count()) === 3);
check("RESET: バッジ解除", (await page.locator(".battle-order-badge").count()) === 0);
check("RESET: ハイライト解除", (await page.locator(".battle-card-selected").count()) === 0);
check("RESET: P1ラベル復帰", (await page.locator(".battle-command-player").textContent()) === "P1");

// ====================== パターン2：P2の spd が高い → P2 が先攻 ======================
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");

// P1先発: T1(2)/T3(1)/T5(2) / P2先発: G(3)/D(5)/T1(2)
await startBattle([2, 4, 6, 0, 1, 3], [0, 1, 2, 3, 4, 5]);
await playBattleSelect(0, 0); // P1: T1(spd2) vs P2: G(spd3)
check(
  "SPEED_RESULT: メッセージ（P2高速）",
  (await page.locator(".battle-message p").innerText()) ===
    "P1(▲2) vs P2(▲3)！ せんこうは P2 の グラードン！"
);
check(
  "SPEED_RESULT: 1stバッジ1枚（P2選択カードに）",
  (await page.locator(".battle-order-badge-first").count()) === 1 &&
    (await page.locator(".battle-row-p2 .battle-card-selected .battle-order-badge").textContent()) ===
      "1st せんこう"
);
check(
  "SPEED_RESULT: 2ndバッジ1枚（P1選択カードに）",
  (await page.locator(".battle-order-badge-second").count()) === 1 &&
    (await page.locator(".battle-row-p1 .battle-card-selected .battle-order-badge").textContent()) ===
      "2nd こうこう"
);
await page.screenshot({ path: "/tmp/opencode/shot8_speed_result_p2_fast.png" });

// ====================== パターン3： spd が同じ → ランダム ======================
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");

// P1先発: G(3)/T6(3)/T7(3) / P2先発: G(3)/D(5)/T1(2)
await startBattle([0, 7, 8, 1, 2, 4], [0, 1, 2, 3, 4, 5]);

const winners = [];
for (let i = 0; i < 10; i++) {
  await playBattleSelect(0, 0); // P1: G(spd3) vs P2: G(spd3) → 同速
  const msg = (await page.locator(".battle-message p").innerText());
  const m = msg.match(/^すばやさが おなじ\(▲3\)！ ランダムで せんこうは (P1|P2) の グラードン に きまった！$/);
  check(`TIE: 回 ${i + 1} メッセージ（同速ランダム）`, m !== null);
  if (m) winners.push(m[1]);
  // 回帰：バッジ表示の整合性
  check(
    `TIE: 回 ${i + 1} バッジ整合（1st×1 / 2nd×1）`,
    (await page.locator(".battle-order-badge-first").count()) === 1 &&
      (await page.locator(".battle-order-badge-second").count()) === 1
  );
  if (i < 9) {
    // リセットして次へ
    await page.locator(".battle-reset").click();
    await page.waitForSelector("text=P1の ターン！");
  }
}
check("TIE: 10回中 P1先攻もP2先攻も出た（ランダム確認）", winners.includes("P1") && winners.includes("P2"));
console.log(`  winners: P1=${winners.filter((w) => w === "P1").length} / P2=${winners.filter((w) => w === "P2").length}`);
await page.screenshot({ path: "/tmp/opencode/shot9_speed_result_tie.png" });

// もどる
await page.locator(".battle-reset").click();
await page.waitForSelector("text=P1の ターン！");
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");
check("BATTLE: タイトルへ戻る", true);

await browser.close();
server.kill();
// サイドのプロセスも掃除
await sleep(300);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (errors.length) {
  console.log("Console/page errors:");
  errors.forEach((e) => console.log("  " + e));
  fail++;
}
process.exit(fail === 0 ? 0 : 1);
