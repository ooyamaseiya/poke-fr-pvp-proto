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

// ---- TITLE ----
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=バトル スタート");
check("TITLE: タイトル画面表示", (await page.getByText("POKE BATTLE").count()) === 1);
await page.screenshot({ path: "/tmp/opencode/shot1_title.png" });
await page.getByText("バトル スタート").click();

// ---- ENTRY_P1 ----
await page.waitForSelector("text=プレイヤー1 の選び方");
check("ENTRY_P1: 画面遷移", true);
check("ENTRY_P1: 6スロット表示", (await page.locator(".slot").count()) === 6);
{
  const labels = await page.locator(".slot-label").allTextContents();
  check(
    "ENTRY_P1: 先発ラベル3/控えラベル3",
    labels.filter((t) => t === "先発").length === 3 &&
      labels.filter((t) => t === "控え").length === 3
  );
}
check("ENTRY_P1: ポケモン一覧10体", (await page.locator(".pokemon-card").count()) === 10);
check(
  "ENTRY_P1: けついボタンの初期無効化",
  (await page.getByText("これで けつい！").isDisabled()) === true
);
// ランダムで6体選択
await page.getByText("ランダムで6たい えらぶ").click();
check("ENTRY_P1: ランダム選択で6枠埋まる", (await page.locator(".slot-filled").count()) === 6);
check(
  "ENTRY_P1: けついボタン有効化",
  (await page.getByText("これで けつい！").isDisabled()) === false
);
const p1Names = await page.locator(".slot-name").allTextContents();
check("ENTRY_P1: 名前が6つ入った", p1Names.length === 6);
await page.screenshot({ path: "/tmp/opencode/shot2_entry_p1.png" });
await page.getByText("これで けつい！").click();

// ---- HANDOVER_TO_P2 ----
await page.waitForSelector(".handover-message");
const handoverText = await page.locator(".handover-message").innerText();
check(
  "HANDOVER_TO_P2: 中継画面表示",
  handoverText.includes("P2に") && handoverText.includes("スマホを") && handoverText.includes("わたしてね！")
);
await page.screenshot({ path: "/tmp/opencode/shot3_handover.png" });
// 2.5秒後で自動遷移
await page.waitForSelector("text=プレイヤー2 の選び方", { timeout: 6000 });
check("ENTRY_P2: 中継後自動遷移", true);

// ---- ENTRY_P2 ----
check("ENTRY_P2: 6スロット表示", (await page.locator(".slot").count()) === 6);
// 手動で6体追加（カード1〜6）
for (let i = 0; i < 6; i++) {
  await page.locator(".pokemon-card").nth(i).click();
}
check("ENTRY_P2: 手動選択で6枠埋まる", (await page.locator(".slot-filled").count()) === 6);
// 満員後は追加不可
check("ENTRY_P2: 満員時はカード無効化", (await page.locator(".pokemon-card").first().isDisabled()) === true);
// スロットタップで削除（1つ削除→5枠）
await page.locator(".slot-filled").first().click();
check("ENTRY_P2: スロットタップで削除", (await page.locator(".slot-filled").count()) === 5);
// 再度1体追加で6体に
await page.locator(".pokemon-card").first().click();
check("ENTRY_P2: 再追加で6体", (await page.locator(".slot-filled").count()) === 6);
const p2Names = await page.locator(".slot-name").allTextContents();
check("ENTRY_P2: 名前が6つ入った", p2Names.length === 6);
await page.screenshot({ path: "/tmp/opencode/shot4_entry_p2.png" });
await page.getByText("これで けつい！").click();

// ---- BATTLE ----
await page.waitForSelector("text=TURN 1/6");
check("BATTLE: 画面表示", true);
check("BATTLE: ターン表示", (await page.getByText("TURN 1/6").count()) === 1);
check("BATTLE: スコア表示", (await page.getByText("P1 0 - 0 P2").count()) === 1);
check("BATTLE: P2先発3体", (await page.locator(".battle-row-p2 .battle-card").count()) === 3);
check("BATTLE: P1先発3体", (await page.locator(".battle-row-p1 .battle-card").count()) === 3);
check("BATTLE: P2 front画像", (await page.locator(".battle-row-p2 .battle-sprite-front").count()) === 3);
check("BATTLE: P1 back画像", (await page.locator(".battle-row-p1 .battle-sprite-back").count()) === 3);
// 名前がエントリー時の先発3体と一致
const p1BattleNames = await page.locator(".battle-row-p1 .battle-name").allTextContents();
const p2BattleNames = await page.locator(".battle-row-p2 .battle-name").allTextContents();
check(
  "BATTLE: P1先発がエントリー先発と一致",
  JSON.stringify(p1BattleNames) === JSON.stringify(p1Names.slice(0, 3))
);
check(
  "BATTLE: P2先発がエントリー先発と一致",
  JSON.stringify(p2BattleNames) === JSON.stringify(p2Names.slice(0, 3))
);
check("BATTLE: メッセージ表示", (await page.locator(".battle-message").count()) === 1);
check("BATTLE: コマンド3ボタン", (await page.locator(".battle-command").count()) === 3);
// コマンドタップで強調（押すとON、再押すとOFF）
await page.locator(".battle-command").first().click();
check("BATTLE: コマンド強調ON", (await page.locator(".battle-command-active").count()) === 1);
await page.locator(".battle-command").first().click();
check("BATTLE: コマンド強調OFF", (await page.locator(".battle-command-active").count()) === 0);
await page.screenshot({ path: "/tmp/opencode/shot5_battle.png" });
// もどる
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
