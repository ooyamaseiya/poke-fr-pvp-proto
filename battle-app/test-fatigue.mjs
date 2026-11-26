// 疲労状態純粋関数のユニットテスト（Step 2-3c）
// Vite の SSR モジュールローダーで BattleScreen.jsx を読み込み、
// updateFatigue / preventSoftlock を直接検証する。
import { createServer } from "vite";

const server = await createServer({
  root: "/workspaces/poke-fr-pvp-proto/battle-app",
  logLevel: "silent",
  server: { middlewareMode: true },
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

const mod = await server.ssrLoadModule("/src/components/BattleScreen.jsx");
const { updateFatigue, preventSoftlock } = mod;

// フィールドのテスト用生成関数
function mk(name, { hp = 100, maxHp = 100, isFainted = false, fatigue = 0 } = {}) {
  return { name, currentHp: hp, maxHp, isFainted, fatigueTurns: fatigue };
}

// --- updateFatigue: 基本ルール ---
{
  // 攻撃していないポケモンは減算、攻撃したポケモンは 2 にセット
  const field = [mk("A", { fatigue: 2 }), mk("B", { fatigue: 1 }), mk("C", { fatigue: 0 })];
  const out = updateFatigue(field, new Set([0]));
  check("updateFatigue: 攻撃者(0)は fatigue=2", out[0].fatigueTurns === 2);
  check("updateFatigue: 非攻撃者(1) 1->0", out[1].fatigueTurns === 0);
  check("updateFatigue: 非攻撃者(2) 0->0", out[2].fatigueTurns === 0);
}
{
  // 減算の下限は 0
  const field = [mk("A", { fatigue: 0 }), mk("B", { fatigue: 1 })];
  const out = updateFatigue(field, new Set([]));
  check("updateFatigue: 非攻撃者 1->0 (下限0)", out[1].fatigueTurns === 0);
  check("updateFatigue: 0 は 0 のまま", out[0].fatigueTurns === 0);
}
{
  // 攻撃者が既に疲労中だった場合も 2 にリセット（選択可能だった前提なので本来0だが、安全に2）
  const field = [mk("A", { fatigue: 1 }), mk("B", { fatigue: 0 })];
  const out = updateFatigue(field, new Set([0]));
  check("updateFatigue: 攻撃者は必ず2にセット", out[0].fatigueTurns === 2);
}

// --- preventSoftlock: 詰み防止ルール ---
{
  // 生存ポケモン全員が疲労中 → minFatigue を差し引き、最も近いものが0になる
  const field = [mk("A", { fatigue: 1 }), mk("B", { fatigue: 2 })];
  const out = preventSoftlock(field);
  check("preventSoftlock: 生存2体全員疲労 → 1体は0", out.some((p) => p.fatigueTurns === 0));
  check("preventSoftlock: min=1 を差し引く (1->0, 2->1)", out[0].fatigueTurns === 0 && out[1].fatigueTurns === 1);
}
{
  // 生存ポケモンの一部が疲労0なら変換なし
  const field = [mk("A", { fatigue: 1 }), mk("B", { fatigue: 2 }), mk("C", { fatigue: 0 })];
  const out = preventSoftlock(field);
  check("preventSoftlock: 一部健康なら不変", out[0].fatigueTurns === 1 && out[1].fatigueTurns === 2 && out[2].fatigueTurns === 0);
}
{
  // 戦闘不能ポケモンは除外（minFatigue に含まれない）
  const field = [mk("A", { isFainted: true, fatigue: 0 }), mk("B", { fatigue: 2 }), mk("C", { fatigue: 1 })];
  const out = preventSoftlock(field);
  check("preventSoftlock: 戦闘不能は除外され、生存2体は全員疲労→最小0", out[1].fatigueTurns === 1 && out[2].fatigueTurns === 0);
}
{
  // 生存ポケモンが1体もない（全員戦闘不能）なら不変
  const field = [mk("A", { isFainted: true, fatigue: 2 }), mk("B", { isFainted: true, fatigue: 1 })];
  const out = preventSoftlock(field);
  check("preventSoftlock: 生存なしは不変", out[0].fatigueTurns === 2 && out[1].fatigueTurns === 1);
}
{
  // 生存1体だけ、かつ疲労中 → minFatigue=その値 → 0 になり選択可能
  const field = [mk("A", { fatigue: 2 })];
  const out = preventSoftlock(field);
  check("preventSoftlock: 生存1体疲労 → 0（選択可能）", out[0].fatigueTurns === 0);
}

// --- updateFatigue の総合（減算+付与+詰み防止が連携）---
{
  // 生存2体、攻撃者が1体。前のターン攻撃者(2)と攻撃済み(0)。
  // T: A(疲労2, 非攻撃), B(疲労0, 攻撃)
  // 減算: A 2->1, B は攻撃 → 2
  // 詰み防止: 生存 A=1, B=2 → 全員疲労 → min=1 → A=0, B=1
  const field = [mk("A", { fatigue: 2 }), mk("B", { fatigue: 0 })];
  const out = updateFatigue(field, new Set([1]));
  check("updateFatigue+softlock: A(2,非攻)->0", out[0].fatigueTurns === 0);
  check("updateFatigue+softlock: B(0,攻)->1", out[1].fatigueTurns === 1);
  check("updateFatigue+softlock: 最低1体は選択可能", out.some((p) => p.fatigueTurns === 0));
}

await server.close();

console.log(`\n=== UNIT RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
