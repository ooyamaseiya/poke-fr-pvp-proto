// Step 2-4a-3 検証スクリプト：P2控え交代 + 目隠し（手渡し）画面
// 対象の4振るい（4 behaviors）:
//   S1: P2のみたおれる → 目隠し画面 → ボタンで P2モーダルが開く
//   S2: P1+P2 同一ターンでたおれる → P1交代完了後に P2目隠し画面へ自動遷移
//   S3: P2が2体同時たおれる → 目隠し画面は1回だけ → 2回連続でモーダル交代
//   S4: 交代完了後 SELECT_P1 に到達し、エラーなし（各シナリオ末尾で確認）
//
// 確定性のため Math.random = () => 0.95 にオーバーライド:
//   ダメージ変動係数 = 0.9 + 0.95*0.2 = 1.09
//   T004(130atk) vs T004(40def): floor((130*0.65-40*0.25)*1.09) = 80 → 80HPのT004をKO
//   T003(70atk) vs T004(40def): floor((70*0.65-40*0.25)*1.09) = 38 → KO不能
//   すばやさ同点時: 0.95 < 0.5 ではない → P2先攻
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

// マスターカードインデックス:
// 0 グラードン(3) / 1 ディアルガ(5) / 2 テストポケモン1(2) / 3 テストポケモン2(4)
// 4 テストポケモン3(1) / 5 テストポケモン4(5) / 6 テストポケモン5(2) / 7 テストポケモン6(3)
// 8 テストポケモン7(3) / 9 テストポケモン8(4)
//
// T004: HP80 atk130 def40 spd5   T003: HP150 atk70 def100 spd1
// T001: HP120 atk90 def70 spd2   T002: HP100 atk120 def55 spd4
// T005: HP160 atk85 def110 spd2  T006: HP90 atk100 def60 spd3  T007: HP110 atk95 def80 spd3

await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => { Math.random = () => 0.95; });
check("INIT: Math.random を確定化（0.95）", (await page.evaluate(() => Math.random())) === 0.95);

// ---------- helpers ----------
async function enterTeam(cards) {
  for (const i of cards) await page.locator(".pokemon-card").nth(i).click();
  check("ENTRY: 6枠埋まる", (await page.locator(".slot-filled").count()) === 6);
  await page.getByText("これで けつい！").click();
}

async function startBattle(p1Cards, p2Cards) {
  await page.getByText("バトル スタート").click();
  await page.waitForSelector("text=プレイヤー1 の選び方");
  await enterTeam(p1Cards);
  await page.waitForSelector("text=プレイヤー2 の選び方", { timeout: 8000 });
  await enterTeam(p2Cards);
  await page.waitForSelector("text=TURN 1/6");
}

// P1が p1Idx、P2が p2Idx を選択 → ターンフロー完了（waitSelで終状態を待機）
async function playTurn(p1Idx, p2Idx, waitSel) {
  await page.locator(".battle-command").nth(p1Idx).click();
  await page.waitForSelector(".battle-handover");
  await page.locator(".battle-handover-btn").click();
  await page.waitForSelector("text=P2の ターン！");
  await page.locator(".battle-command").nth(p2Idx).click();
  await page.waitForSelector(waitSel.selector, { hasText: waitSel.hasText, timeout: 15000 });
}

// P2のたおれ目隠し画面のサブテキスト（P1→P2目隠しの「せんたくは かくされているよ」と区別）
const HANDOVER_P2 = { selector: ".battle-handover-sub", hasText: "たおれたよ" };
const MODAL_P1 = { selector: ".bench-select-modal-title", hasText: "P1 の こうたい" };
const MODAL_P2 = { selector: ".bench-select-modal-title", hasText: "P2 の こうたい" };
const SELECT_P1 = { selector: ".battle-message p", hasText: "P1の ターン！" };

// 交代完了後 → SELECT_P1 の共通検証（S4: エラーなしで選択パネル復帰）
async function checkBackToSelectP1(label) {
  check(`${label}: SELECT_P1 へ復帰（P1の ターン！メッセージ）`, (await page.locator(".battle-message p").innerText()) === "P1の ターン！ こうげきする ポケモンを えらんでね！");
  check(`${label}: コマンドパネル3ボタン`, (await page.locator(".battle-command").count()) === 3);
  check(`${label}: コマンドプレイヤーラベル P1`, (await page.locator(".battle-command-player").textContent()) === "P1");
  check(`${label}: 戦闘不能なし`, (await page.locator(".battle-sprite-fainted").count()) === 0);
  check(`${label}: 目隠し画面なし`, (await page.locator(".battle-handover").count()) === 0);
  check(`${label}: モーダルなし`, (await page.locator(".bench-select-modal").count()) === 0);
}

// ====================== S1: P2のみたおれる ======================
// P1: [T004, T001, T002, T005, T006, T007] / P2: [T004, T003, T001, T005, T006, T007]
// P1はT004(spd5)を選択、P2はT003(spd1)を選択 → P1先攻
// P1のT004がP2のT004をKO（80 dmg）。P2のT003の反撃（38 dmg）ではP1のT004(80HP)は耐える。
console.log("\n=== S1: P2のみたおれる → 目隠し → P2モーダル ===");
await startBattle([5, 2, 3, 6, 7, 8], [5, 4, 2, 6, 7, 8]);
await playTurn(0, 1, HANDOVER_P2);
check("S1: 目隠し画面表示（P2控え交代）", (await page.locator(".battle-handover").count()) === 1);
check(
  "S1: 目隠しタイトル「P2に スマホを わたしてね！」",
  (await page.locator(".battle-handover-title").innerText()) === "P2に スマホを わたしてね！"
);
check(
  "S1: 目隠しサブ「P2の ポケモンが たおれたよ！ ひかえから えらんでね」",
  (await page.locator(".battle-handover-sub").innerText()) === "P2の ポケモンが たおれたよ！ ひかえから えらんでね"
);
check(
  "S1: 目隠しボタン「P2 こうたい じゅんび OK！」",
  (await page.locator(".battle-handover-btn").innerText()) === "P2 こうたい じゅんび OK！"
);
const btnBg = await page.locator(".battle-handover-btn").evaluate((el) => getComputedStyle(el).backgroundColor);
check("S1: 目隠しボタンのP2赤アクセント (#d82828)", btnBg === "rgb(216, 40, 40)");
check("S1: P2側戦闘不能1体（T004）", (await page.locator(".battle-row-p2 .battle-sprite-fainted").count()) === 1);
check("S1: P1側戦闘不能なし", (await page.locator(".battle-row-p1 .battle-sprite-fainted").count()) === 0);
check(
  "S1: 目隠し時のメッセージ「P2の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！」",
  (await page.locator(".battle-message p").innerText()) === "P2の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！"
);
await page.screenshot({ path: "/tmp/opencode/shot_s1_handover.png" });

// ボタン押下 → P2控え選択モーダル
await page.locator(".battle-handover-btn").click();
await page.waitForSelector(MODAL_P2.selector, { hasText: "P2 の こうたい", timeout: 5000 });
check("S1: P2控え選択モーダル表示（P2 ヘッダー）", (await page.locator(".bench-select-modal").count()) === 1);
check(
  "S1: P2モーダルヘッダーはP2色クラス",
  (await page.locator(".bench-select-modal-header").getAttribute("class"))?.includes("bench-select-modal-header-p2") === true
);
check("S1: P2モーダルに控え3体", (await page.locator(".bench-select-modal-row").count()) === 3);
const benchNames = await page.locator(".bench-select-modal-name").allTextContents();
check(
  "S1: P2控えは [T005, T006, T007]",
  JSON.stringify(benchNames) === JSON.stringify(["テストポケモン5", "テストポケモン6", "テストポケモン7"])
);
check(
  "S1: モーダル時のメッセージ「P2の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！」",
  (await page.locator(".battle-message p").innerText()) === "P2の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！"
);
await page.screenshot({ path: "/tmp/opencode/shot_s1_modal.png" });

// 控え0体（T005）を選択 → 交代完了 → SELECT_P1
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(SELECT_P1.selector, { timeout: 5000 });
await checkBackToSelectP1("S1");
check("S1: P2ひかえが 2 になった", (await page.getByText("P2ひかえ: 2").count()) === 1);
check(
  "S1: P2フィールドにT005が入れ替わり（T004枠に復帰）",
  (await page.locator(".battle-row-p2 .battle-name").first().innerText()) === "テストポケモン5"
);
await page.screenshot({ path: "/tmp/opencode/shot_s1_select_p1.png" });

// ====================== S2: P1+P2 同一ターンでたおれる ======================
// P1: [T004, T001, T002, T005, T006, T007] / P2: [T004, T003, T001, T005, T006, T007]
// ターン1: P1はT001(spd2)、P2はT004(spd5) → P2先攻。P2のT004がP1のT004をKO（80）。
//          P1のT001の反撃（52 dmg）でP2のT004は生存（28HP）。→ P1のみたおれ → P1交代 → SELECT_P1
// ターン2: P1はT005(spd2)、P2はT001(spd2) → 同速 → P2先攻（確定ランダム0.95）。
//          P2のT001がP1のT002(24HP)をKO（47 dmg）、P1のT005がP2のT004(28HP)をKO（49 dmg）→ P1+P2 両方たおれ
//          → P1交代（2回）完了 → P2目隠し画面 → P2交代 → SELECT_P1
console.log("\n=== S2: P1+P2 同一ターンでたおれる → P1交代 → P2目隠し ===");
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");
await startBattle([5, 2, 3, 6, 7, 8], [5, 4, 2, 6, 7, 8]);

// ターン1
await playTurn(1, 0, MODAL_P1);
check("S2-T1: P1のみたおれ → P1控え選択モーダル", (await page.locator(".bench-select-modal").count()) === 1);
check("S2-T1: P2側戦闘不能なし", (await page.locator(".battle-row-p2 .battle-sprite-fainted").count()) === 0);
check("S2-T1: P1側戦闘不能1体", (await page.locator(".battle-row-p1 .battle-sprite-fainted").count()) === 1);
check("S2-T1: P1モーダルに控え3体", (await page.locator(".bench-select-modal-row").count()) === 3);
// P1控え0体（T005）を選択 → P1交代完了 → P2たおれなし → SELECT_P1
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(SELECT_P1.selector, { timeout: 5000 });
await checkBackToSelectP1("S2-T1");
check("S2-T1: P1ひかえが 2 になった", (await page.getByText("P1ひかえ: 2").count()) === 1);
check("S2-T1: P1フィールドにT005が入った", (await page.locator(".battle-row-p1 .battle-name").first().innerText()) === "テストポケモン5");

// ターン2（P2のT004は疲労2で選択不可、P1のT001も疲労2）
// P1はT005(spd2)、P2はT001(spd2) → 同速 → P2先攻（確定ランダム0.95）
// P2のT001がP1のT002(24HP)をKO（47 dmg）、P1のT005がP2のT004(28HP)をKO（49 dmg）
await playTurn(0, 2, MODAL_P1);
check("S2-T2: P1+P2 両方たおれ → P1控え選択モーダル", (await page.locator(".bench-select-modal").count()) === 1);
check(
  "S2-T2: P1モーダル（P1 の こうたい）がP2目隠しより前に表示",
  (await page.locator(".bench-select-modal-title").innerText()) === "P1 の こうたい"
);
check("S2-T2: P1側戦闘不能1体（T002）", (await page.locator(".battle-row-p1 .battle-sprite-fainted").count()) === 1);
check("S2-T2: P2側戦闘不能1体（T004）", (await page.locator(".battle-row-p2 .battle-sprite-fainted").count()) === 1);
check("S2-T2: P1モーダルに控え2体（T006, T007）", (await page.locator(".bench-select-modal-row").count()) === 2);
// P1控え0体（T006）を選択 → P1交代完了 → P2たおれあり → 目隠し画面へ
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(HANDOVER_P2.selector, { hasText: HANDOVER_P2.hasText, timeout: 5000 });
check("S2-T2: P1交代完了 → P2目隠し画面へ自動遷移", (await page.locator(".battle-handover").count()) === 1);
check("S2-T2: 目隠しサブ「たおれたよ」", (await page.locator(".battle-handover-sub").innerText()) === "P2の ポケモンが たおれたよ！ ひかえから えらんでね");
await page.screenshot({ path: "/tmp/opencode/shot_s2_handover.png" });
// ボタン → P2モーダル → 控え0体（T005）選択 → SELECT_P1
await page.locator(".battle-handover-btn").click();
await page.waitForSelector(MODAL_P2.selector, { hasText: "P2 の こうたい", timeout: 5000 });
check("S2-T2: P2モーダルに控え3体", (await page.locator(".bench-select-modal-row").count()) === 3);
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(SELECT_P1.selector, { timeout: 5000 });
await checkBackToSelectP1("S2-T2");
check("S2-T2: P2ひかえが 2 になった", (await page.getByText("P2ひかえ: 2").count()) === 1);
await page.screenshot({ path: "/tmp/opencode/shot_s2_select_p1.png" });

// ====================== S3: P2が2体同時たおれる ======================
// P1: [T004, T001, T002, T005, T006, T007] / P2: [T004, T004, T003, T005, T006, T007]
// P1はT004(spd5)、P2はT003(spd1) → P1先攻。P1のT004がP2のT004×2を同時KO（各80 dmg）。
// → P2たおれ2体 → 目隠し1回 → モーダル → 交代 → （たおれ残）モーダル → 交代 → SELECT_P1
console.log("\n=== S3: P2が2体同時たおれる → 目隠し1回 → モーダル2回 ===");
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");
await startBattle([5, 2, 3, 6, 7, 8], [5, 5, 4, 6, 7, 8]);
await playTurn(0, 2, HANDOVER_P2);
check("S3: P2側戦闘不能2体", (await page.locator(".battle-row-p2 .battle-sprite-fainted").count()) === 2);
check("S3: P1側戦闘不能なし", (await page.locator(".battle-row-p1 .battle-sprite-fainted").count()) === 0);
check("S3: 目隠し画面1回（1枠）", (await page.locator(".battle-handover").count()) === 1);
check(
  "S3: 目隠しボタン「P2 こうたい じゅんび OK！」",
  (await page.locator(".battle-handover-btn").innerText()) === "P2 こうたい じゅんび OK！"
);
await page.screenshot({ path: "/tmp/opencode/shot_s3_handover.png" });

// ボタン → P2モーダル（3体）
await page.locator(".battle-handover-btn").click();
await page.waitForSelector(MODAL_P2.selector, { hasText: "P2 の こうたい", timeout: 5000 });
check("S3: 1回目のP2モーダル（控え3体）", (await page.locator(".bench-select-modal-row").count()) === 3);
// 控え0体（T005）を選択 → たおれまだ1体残る → モーダル継続（目隠しを挟まない）
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(MODAL_P2.selector, { hasText: "P2 の こうたい", timeout: 5000 });
check("S3: 2回目のP2モーダルに遷移（まだREPLACE_P2）", (await page.locator(".bench-select-modal").count()) === 1);
check("S3: 2回目は目隠し画面を挟まない", (await page.locator(".battle-handover").count()) === 0);
check("S3: 2回目は控え2体（T006, T007）", (await page.locator(".bench-select-modal-row").count()) === 2);
check(
  "S3: 1回目交代後のメッセージ「P2 は テストポケモン5 を くりだした！」",
  (await page.locator(".battle-message p").innerText()) === "P2 は テストポケモン5 を くりだした！"
);
check(
  "S3: P2フィールドのたおれ枠にT005が入った",
  (await page.locator(".battle-row-p2 .battle-name").first().innerText()) === "テストポケモン5"
);
// 控え0体（T006）を選択 → たおれなし → SELECT_P1
await page.locator(".bench-select-modal-row").nth(0).click();
await page.waitForSelector(SELECT_P1.selector, { timeout: 5000 });
await checkBackToSelectP1("S3");
check("S3: P2ひかえが 1 になった", (await page.getByText("P2ひかえ: 1").count()) === 1);
check(
  "S3: P2フィールドは [T005, T006, T003]",
  JSON.stringify(await page.locator(".battle-row-p2 .battle-name").allTextContents()) ===
    JSON.stringify(["テストポケモン5", "テストポケモン6", "テストポケモン3"])
);
await page.screenshot({ path: "/tmp/opencode/shot_s3_select_p1.png" });

// ====================== 全体エラーチェック ======================
console.log("\n=== エラーチェック ===");
if (errors.length) {
  console.log("Console/page errors:");
  errors.forEach((e) => console.log("  " + e));
  fail++;
} else {
  check("GLOBAL: コンソール/ページエラーなし", true);
}

await browser.close();
server.kill();
await sleep(300);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
