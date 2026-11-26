import { chromium } from "playwright";
import { spawn } from "node:child_process";

// 疲労状態（2ターンクールタイム + 💦マーク + 選択制限 + 詰み防止）の E2E 検証（Step 2-3c）
//
// マスターデータ（src/data/pokemonMaster.js のインデックス順）：
//   0 グラードン   HP180 atk110 def95  spd3
//   1 ディアルガ   HP180 atk110 def100 spd5
//   2 テストポケモン1 HP120 atk90  def70  spd2
//   3 テストポケモン2 HP100 atk120 def55  spd4
//   4 テストポケモン3 HP150 atk70  def100 spd1   <- T3
//   5 テストポケモン4 HP80  atk130 def40  spd5   <- T4（弱体・高攻撃）
//   6 テストポケモン5 HP160 atk85  def110 spd2   <- T5
//   7 テストポケモン6 HP90  atk100 def60  spd3
//   8 テストポケモン7 HP110 atk95  def80  spd3
//   9 テストポケモン8 HP140 atk75  def90  spd4   <- T8

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

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

// ===== エントリー =====
async function playEntryP1(cards) {
  await page.getByText("バトル スタート").click();
  await page.waitForSelector("text=プレイヤー1 の選び方");
  for (const i of cards) {
    await page.locator(".pokemon-card").nth(i).click();
  }
  await page.getByText("これで けつい！").click();
}

async function playEntryP2(cards) {
  await page.waitForSelector("text=プレイヤー2 の選び方", { timeout: 10000 });
  for (const i of cards) {
    await page.locator(".pokemon-card").nth(i).click();
  }
  await page.getByText("これで けつい！").click();
}

async function startBattle(p1Cards, p2Cards) {
  await playEntryP1(p1Cards);
  await playEntryP2(p2Cards);
  await page.waitForSelector("text=TURN 1/6");
  await page.waitForSelector("text=P1の ターン！");
}

// ===== 1ターン（P1選択→手渡し→P2選択→攻撃フロー→SELECT_P1 復帰）=====
async function playTurn(p1i, p2i) {
  await page.locator(".battle-command").nth(p1i).click();
  await page.waitForSelector(".battle-handover");
  await page.locator(".battle-handover-btn").click();
  await page.waitForSelector("text=P2の ターン！");
  await page.locator(".battle-command").nth(p2i).click();
  // ターン終了後、SELECT_P1 に戻るまで待つ（攻撃フロー約5.6秒）
  await page.waitForSelector("text=P1の ターン！", { timeout: 20000 });
}

// ===== 補助：P1/P2 のカード i の疲労バッジ情報 =====
async function getCardFatigue(row, i) {
  const card = page.locator(`.battle-row-${row} .battle-card`).nth(i);
  const badge = card.locator(".battle-fatigue-badge");
  const count = await badge.count();
  const text = count > 0 ? (await badge.first().innerText()) : null;
  const img = card.locator(".battle-sprite");
  const fatiguedClass = (await img.getAttribute("class")).includes("battle-sprite-fatigued");
  const faintedClass = (await img.getAttribute("class")).includes("battle-sprite-fainted");
  return { badge: text, hasBadge: count > 0, fatigued: fatiguedClass, fainted: faintedClass };
}

// ===== 補助：P1/P2 のコマンドボタン i の状態 =====
async function getCommandState(row, i) {
  // SELECT_P1 なら p1Field、SELECT_P2 なら p2Field が表示される。ここでは常に SELECT_P1 呼び出し。
  const btn = page.locator(".battle-command").nth(i);
  const disabled = await btn.isDisabled();
  const fainted = await btn.locator(".battle-command-fainted").first().innerText().catch(() => null);
  const fatigued = await btn.locator(".battle-command-fatigued").first().innerText().catch(() => null);
  const name = await btn.locator(".battle-command-name").first().innerText().catch(() => null);
  return { disabled, fainted, fatigued, name };
}

// ====================== シーン1：4ターン疲労サイクル（全3体生存） ======================
console.log("\n=== シーン1：4ターン疲労サイクル ===");
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=バトル スタート");

// P1/P2 ともに [T3(4), T8(9), T5(6)] + 3体。全4ターン生存保証（最大累積ダメージ < 全HP）。
await startBattle([4, 9, 6, 0, 1, 2], [4, 9, 6, 0, 1, 2]);

// Turn 1：P1=T3(0), P2=T3(0)
await playTurn(0, 0);
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  check("S1-T1: T3 が疲労バッジ💦2", c3.hasBadge && c3.badge === "💦2");
  check("S1-T1: T3 ボタン disabled", t3.disabled === true);
  check("S1-T1: T3 ボタン「あと2ターン」", t3.fatigued === "💦 ひろう（あと2ターン）");
  check("S1-T1: T3 立ち絵に明度ダウン", c3.fatigued === true);
  check("S1-T1: T8 は選択可能", t8.disabled === false && t8.fatigued === null);
  check("S1-T1: T5 は選択可能", t5.disabled === false && t5.fatigued === null);
  // P2 側も確認
  const c3p2 = await getCardFatigue("p2", 0);
  check("S1-T1: P2のT3 に💦2バッジ", c3p2.hasBadge && c3p2.badge === "💦2");
}
await page.screenshot({ path: "/tmp/opencode/fatigue_t1.png" });

// Turn 2：P1=T8(1), P2=T8(1)（T3は疲労なので選べない）
{
  const t3 = await getCommandState("p1", 0);
  check("S1-T2前置き: T3 は選択不可（疲労2）", t3.disabled === true);
}
await playTurn(1, 1);
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  const c8 = await getCardFatigue("p1", 1);
  check("S1-T2: T3 は疲労（あと1ターン）", t3.disabled === true && t3.fatigued === "💦 ひろう（あと1ターン）");
  check("S1-T2: T3 バッジ💦1", c3.hasBadge && c3.badge === "💦1");
  check("S1-T2: T8 は疲労（あと2ターン）", t8.disabled === true && t8.fatigued === "💦 ひろう（あと2ターン）");
  check("S1-T2: T8 バッジ💦2", c8.hasBadge && c8.badge === "💦2");
  check("S1-T2: T5 は選択可能（3体目）", t5.disabled === false && t5.fatigued === null);
}
await page.screenshot({ path: "/tmp/opencode/fatigue_t2.png" });

// Turn 3：P1=T5(2), P2=T5(2)（T3・T8は疲労、3体目のT5を使う必要がある）
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  check("S1-T3前置き: T3(疲労1)とT8(疲労2)は選択不可", t3.disabled === true && t8.disabled === true);
  const t5 = await getCommandState("p1", 2);
  check("S1-T3前置き: T5 は選択可能（3体目を使う）", t5.disabled === false);
}
await playTurn(2, 2);
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  const c8 = await getCardFatigue("p1", 1);
  const c5 = await getCardFatigue("p1", 2);
  check("S1-T3: T3 の💦バッジが消え選択可能", t3.disabled === false && t3.fatigued === null && !c3.hasBadge);
  check("S1-T3: T3 立ち絵の明度ダウン解除", c3.fatigued === false);
  check("S1-T3: T8 は疲労（あと1ターン）", t8.disabled === true && t8.fatigued === "💦 ひろう（あと1ターン）");
  check("S1-T3: T8 バッジ💦1", c8.hasBadge && c8.badge === "💦1");
  check("S1-T3: T5 は疲労（あと2ターン）", t5.disabled === true && t5.fatigued === "💦 ひろう（あと2ターン）");
  check("S1-T3: T5 バッジ💦2", c5.hasBadge && c5.badge === "💦2");
}
await page.screenshot({ path: "/tmp/opencode/fatigue_t3.png" });

// Turn 4：P1=T3(0)（疲労解除で再度選択可能）, P2=T3(0)
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  check("S1-T4前置き: T3 が選択可能（ターン4で回復）", t3.disabled === false);
  // T8はT2に攻撃（疲労2）→T3で減算（→1）→T4開始時はまだ疲労1
  check("S1-T4前置き: T8 は疲労（あと1ターン）", t8.disabled === true && t8.fatigued === "💦 ひろう（あと1ターン）");
  check("S1-T4前置き: T5 は疲労（あと2ターン）", t5.disabled === true);
}
await playTurn(0, 0);
{
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  check("S1-T4: T3 が疲労（あと2ターン）に戻る", t3.disabled === true && t3.fatigued === "💦 ひろう（あと2ターン）");
  check("S1-T4: T3 バッジ💦2", c3.hasBadge && c3.badge === "💦2");
  check("S1-T4: T8 は選択可能", t8.disabled === false);
  check("S1-T4: T5 は疲労（あと1ターン）", t5.disabled === true && t5.fatigued === "💦 ひろう（あと1ターン）");
}
await page.screenshot({ path: "/tmp/opencode/fatigue_t4.png" });

// ===== HPリセットで疲労もゼロ化 =====
{
  await page.getByText("HPリセット").click();
  await page.waitForSelector("text=P1の ターン！");
  const t3 = await getCommandState("p1", 0);
  const t8 = await getCommandState("p1", 1);
  const t5 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  check("S1-RESET: T3 が選択可能（疲労0化）", t3.disabled === false && t3.fatigued === null);
  check("S1-RESET: T8 が選択可能", t8.disabled === false);
  check("S1-RESET: T5 が選択可能", t5.disabled === false);
  check("S1-RESET: T3 の💦バッジが消える", !c3.hasBadge);
}

// もどる → タイトルへ
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");

// ====================== シーン2：詰み防止ルール（生存2体以下） ======================
console.log("\n=== シーン2：詰み防止ルール（生存2体以下） ===");
// P1 = [T3(4), T5(6), T4(5)] / P2 = [T4(5), T0(0), T1(1)]
// T4(HP80) は P2の高攻撃でターン2までに必ず戦闘不能。生存2体(T3,T5)全員疲労中が
// 起きるはずだが、詰み防止ルールで T3 が 0(選択可能) にされる。
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=バトル スタート");
await startBattle([4, 6, 5, 0, 1, 2], [5, 0, 1, 2, 3, 4]);

// Turn 1：P1=T3(0), P2=T4(0)
await playTurn(0, 0);
{
  const t3 = await getCommandState("p1", 0);
  check("S2-T1: T3 は疲労（あと2ターン）", t3.disabled === true && t3.fatigued === "💦 ひろう（あと2ターン）");
}

// Turn 2：P1=T5(1), P2=T0(1)。T4 がこのターンに戦闘不能。
await playTurn(1, 1);
{
  const t3 = await getCommandState("p1", 0);
  const t5 = await getCommandState("p1", 1);
  const t4 = await getCommandState("p1", 2);
  const c3 = await getCardFatigue("p1", 0);
  const c4 = await getCardFatigue("p1", 2);
  check("S2-T2: T4 が戦闘不能（ひんし）", t4.disabled === true && t4.fainted === "ひんし");
  check("S2-T2: T4 バッジなし（戦闘不能優先）", !c4.hasBadge);
  // 詰み防止による結果：T3 は 0(選択可能)、T5 は 1(疲労)
  check("S2-T2: 詰み防止で T3 が選択可能", t3.disabled === false && t3.fatigued === null);
  check("S2-T2: T3 の💦バッジなし", !c3.hasBadge);
  check("S2-T2: T5 は疲労（あと1ターン）", t5.disabled === true && t5.fatigued === "💦 ひろう（あと1ターン）");
  // 最低1体は必ず選択可能（詰みの防止）
  const any = [t3, t5, t4].filter((b) => b.disabled === false);
  check("S2-T2: 生存ポケモンで最低1体は選択可能", any.length >= 1);
}
await page.screenshot({ path: "/tmp/opencode/fatigue_softlock_t2.png" });

// もどる → タイトルへ
await page.getByText("もどる").click();
await page.waitForSelector("text=バトル スタート");

await browser.close();
server.kill();
await sleep(300);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (errors.length) {
  console.log("Console/page errors:");
  errors.forEach((e) => console.log("  " + e));
  fail++;
}
process.exit(fail === 0 ? 0 : 1);
