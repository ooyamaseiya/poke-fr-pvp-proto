import { useState } from "react";
import { LEAD_COUNT, POKEMON_MASTER } from "../data/pokemonMaster.js";
import "./BattleScreen.css";

// 開発中、props が未定義でもクラッシュしないためのダミーフォールバック
// (POKEMON_MASTER の先頭3体を先発3体として使う)
const FALLBACK_TEAM = POKEMON_MASTER.slice(0, LEAD_COUNT);

// props を受けて先発3体の配列に正規化（未定義・空配列はフォールバック）
function normalizeTeam(team) {
  if (!Array.isArray(team) || team.length === 0) return FALLBACK_TEAM;
  return team.slice(0, LEAD_COUNT);
}

// フィールド上の状態を初期化（Step 2-3b）
// 各ポケモンに currentHp / isFainted を付与した可変データとする
function makeField(team) {
  return team.map((p) => ({
    ...p,
    currentHp: p.maxHp,
    isFainted: false,
  }));
}

// ダメージ計算（純粋関数：Step 2-3b）
// 攻撃側1体 → 防御側1体のダメージを計算する
export function calculateDamage(attacker, defender) {
  const base = Math.floor(attacker.atk * 0.65 - defender.def * 0.25);
  const variance = 0.9 + Math.random() * 0.2; // 0.9〜1.1倍の乱数
  return Math.max(15, Math.floor(base * variance)); // 最低保証 15 ダメージ
}

// 全体攻撃の適用：相手の生存ポケモン全員にダメージ（下限0、0なら戦闘不能）
function applyDamageToField(attacker, field) {
  return field.map((p) => {
    if (p.isFainted) return p;
    const dmg = calculateDamage(attacker, p);
    const nextHp = Math.max(0, p.currentHp - dmg);
    return { ...p, currentHp: nextHp, isFainted: nextHp <= 0 };
  });
}

// 待機関数（非同期フェーズの自動進行用）
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ブラインド選択のターンフェーズ（Step 2-2）+ すばやさ判定結果（Step 2-3a）
// + 攻撃実行・テスト終了（Step 2-3b）
const PHASE_SELECT_P1 = "SELECT_P1";
const PHASE_HANDOVER_TO_P2 = "HANDOVER_TO_P2";
const PHASE_SELECT_P2 = "SELECT_P2";
const PHASE_SPEED_RESULT = "SPEED_RESULT";
const PHASE_EXEC_FIRST = "EXEC_FIRST";
const PHASE_EXEC_SECOND = "EXEC_SECOND";
const PHASE_TEST_END = "TEST_END";

// すばやさ比較による先攻・後攻の決定（純粋関数：Step 2-3a）
// 同速の場合はランダムで先攻を決め、isTie = true を返す。
function determineTurnOrder(p1Pokemon, p2Pokemon) {
  if (p1Pokemon.spd > p2Pokemon.spd) {
    return { first: "P1", second: "P2", isTie: false };
  }
  if (p2Pokemon.spd > p1Pokemon.spd) {
    return { first: "P2", second: "P1", isTie: false };
  }
  const first = Math.random() < 0.5 ? "P1" : "P2";
  return {
    first,
    second: first === "P1" ? "P2" : "P1",
    isTie: true,
  };
}

// HPバーの色（残りHP割合に応じて：>50%緑 / 21〜50%黄 / 20%以下赤）
function hpBarColor(p) {
  const ratio = p.currentHp / p.maxHp;
  if (ratio > 0.5) return "#30B830";
  if (ratio >= 0.21) return "#F8C028";
  return "#E83030";
}

// バトル画面（Step 2-1：見た目のUIレイアウト + Step 2-2：P1選択→目隠し→P2選択→確認の画面遷移
// + Step 2-3a：先攻・後攻の決定 + Step 2-3b：全体攻撃のダメージ計算・HPバー更新・戦闘不能判定）
// P1 / P2 の先発3体が上下で向かい合う、ポケモン金銀風の画面。
export default function BattleScreen({ p1Team, p2Team, onBack }) {
  const p1 = normalizeTeam(p1Team);
  const p2 = normalizeTeam(p2Team);
  // フィールド上のHP状態（バトル中に更新される：Step 2-3b）
  const [p1Field, setP1Field] = useState(() => makeField(p1));
  const [p2Field, setP2Field] = useState(() => makeField(p2));
  const [turnPhase, setTurnPhase] = useState(PHASE_SELECT_P1);
  const [p1SelectedIndex, setP1SelectedIndex] = useState(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState(null);
  // 先攻・後攻の判定結果（Step 2-3a：P2選択後に決定）
  const [turnOrder, setTurnOrder] = useState(null);
  // 攻撃実行・テスト終了フェーズのメッセージ（Step 2-3b）
  const [message, setMessage] = useState("");

  // P1が選んだ：インデックス保存 → 即座に目隠し画面へ
  const selectP1 = (i) => {
    setP1SelectedIndex(i);
    setTurnPhase(PHASE_HANDOVER_TO_P2);
  };

  // P2が選んだ：インデックス保存 → すばやさ比較で先攻・後攻を決定 → 結果表示 → 攻撃フロー開始
  const selectP2 = (i) => {
    setP2SelectedIndex(i);
    const result = determineTurnOrder(p1Field[p1SelectedIndex], p2Field[i]);
    setTurnOrder(result);
    setTurnPhase(PHASE_SPEED_RESULT);
    runTurnFlow(result, p1Field, p2Field, p1SelectedIndex, i);
  };

  // 攻撃実行フロー（Step 2-3b：自動進行）
  // SPEED_RESULT → EXEC_FIRST → EXEC_SECOND → ターン終了（選択リセット/TEST_END）
  const runTurnFlow = async (order, p1F0, p2F0, p1Sel, p2Sel) => {
    // 非同期処理中に stale state の HP を読んでしまうのを防ぐため、ローカルコピーを管理
    let p1F = p1F0;
    let p2F = p2F0;

    // 1. SPEED_RESULT：判定メッセージを表示中（約1200ms待機）
    await wait(1200);

    // 2. 先攻の攻撃実行（EXEC_FIRST）
    const firstPlayer = order.first;
    const secondPlayer = order.second;
    const firstPokemon = firstPlayer === "P1" ? p1F[p1Sel] : p2F[p2Sel];

    setTurnPhase(PHASE_EXEC_FIRST);
    setMessage(
      `P${firstPlayer === "P1" ? "1" : "2"} の ${firstPokemon.name} の ${firstPokemon.moveName}！`
    );
    await wait(1000);

    // 相手フィールドの生存ポケモン全員にダメージを適用
    if (secondPlayer === "P1") {
      p1F = applyDamageToField(firstPokemon, p1F);
      setP1Field(p1F);
    } else {
      p2F = applyDamageToField(firstPokemon, p2F);
      setP2Field(p2F);
    }
    setMessage("あいての ポケモンたちに ダメージ！");
    await wait(1200);

    // 3. 後攻の攻撃実行（EXEC_SECOND）
    setTurnPhase(PHASE_EXEC_SECOND);
    // 先攻の攻撃による最新のHP状態に基づいて戦闘不能をチェック
    const secondPokemon =
      secondPlayer === "P1" ? p1F[p1Sel] : p2F[p2Sel];

    if (secondPokemon.isFainted || secondPokemon.currentHp <= 0) {
      // たおれている：攻撃をキャンセル
      setMessage(`${secondPokemon.name} は たおれて こうげきできない！`);
      await wait(1200);
    } else {
      setMessage(
        `P${secondPlayer === "P1" ? "1" : "2"} の ${secondPokemon.name} の ${secondPokemon.moveName}！`
      );
      await wait(1000);

      // 先攻と同様に相手フィールドの生存ポケモン全員にダメージを適用
      if (firstPlayer === "P1") {
        p1F = applyDamageToField(secondPokemon, p1F);
        setP1Field(p1F);
      } else {
        p2F = applyDamageToField(secondPokemon, p2F);
        setP2Field(p2F);
      }
      setMessage("あいての ポケモンたちに ダメージ！");
      await wait(1200);
    }

    // 4. ターン終了・次の選択へ
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);

    // どちらかの先発3体が全員戦闘不能ならテスト終了
    if (p1F.every((p) => p.isFainted) || p2F.every((p) => p.isFainted)) {
      setTurnPhase(PHASE_TEST_END);
      setMessage("せんぱつ 3たいが ぜんめつした！ リセットしてね");
    } else {
      setTurnPhase(PHASE_SELECT_P1);
    }
  };

  // リセット：両選択と判定結果を null に戻し、P1選択から再開
  const resetSelection = () => {
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);
    setTurnPhase(PHASE_SELECT_P1);
  };

  // HPリセット（テスト用）：全員のHPを全回復し、最初からやり直す
  const resetAll = () => {
    setP1Field(makeField(p1));
    setP2Field(makeField(p2));
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);
    setTurnPhase(PHASE_SELECT_P1);
  };

  const p1Selected = p1SelectedIndex !== null ? p1Field[p1SelectedIndex] : null;
  const p2Selected = p2SelectedIndex !== null ? p2Field[p2SelectedIndex] : null;

  // メッセージウィンドウのテキスト（フェーズごとに切替）
  let displayMessage;
  if (turnPhase === PHASE_EXEC_FIRST || turnPhase === PHASE_EXEC_SECOND || turnPhase === PHASE_TEST_END) {
    displayMessage = message;
  } else if (turnPhase === PHASE_SELECT_P1) {
    displayMessage = "P1の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SELECT_P2) {
    displayMessage = "P2の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SPEED_RESULT && turnOrder) {
    const firstPokemon =
      turnOrder.first === "P1" ? p1Selected : p2Selected;
    if (turnOrder.isTie) {
      displayMessage = `すばやさが おなじ(▲${p1Selected?.spd})！ ランダムで せんこうは ${turnOrder.first} の ${firstPokemon?.name} に きまった！`;
    } else {
      displayMessage = `P1(▲${p1Selected?.spd}) vs P2(▲${p2Selected?.spd})！ せんこうは ${turnOrder.first} の ${firstPokemon?.name}！`;
    }
  } else {
    displayMessage = "";
  }

  // コマンドパネルで表示するチーム（P1ターンなら p1、P2ターンなら p2）
  const activeTeam = turnPhase === PHASE_SELECT_P1 ? p1Field : p2Field;
  const isP1Turn = turnPhase === PHASE_SELECT_P1;

  return (
    <div className="battle-screen">
      {/* ① ヘッダーバー */}
      <header className="battle-header">
        <span className="battle-turn">TURN 1/6</span>
        <div className="battle-header-right">
          <span className="battle-score">P1 0 - 0 P2</span>
          <button className="battle-reset-hp" onClick={resetAll} title="テスト用：全HP回復して最初からやり直す">
            HPリセット
          </button>
          <button className="battle-back" onClick={onBack}>
            もどる
          </button>
        </div>
      </header>

      {/* ② バトルフィールド（P2 上段 / P1 下段） */}
      <section className="battle-field">
        {/* 上段：相手（P2） */}
        <div className="battle-row battle-row-p2">
          {p2Field.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className={`battle-card ${
                turnPhase === PHASE_SPEED_RESULT && i === p2SelectedIndex
                  ? "battle-card-selected battle-card-selected-p2"
                  : ""
              }`}
            >
              <div className="battle-status">
                <span className="battle-name">{p.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{
                      width: `${Math.round((p.currentHp / p.maxHp) * 100)}%`,
                      background: hpBarColor(p),
                    }}
                  />
                </div>
              </div>
              <img
                className={`pixel-img battle-sprite battle-sprite-front ${
                  p.isFainted ? "battle-sprite-fainted" : ""
                }`}
                src={p.sprites.front}
                alt={p.name}
              />
              {/* すばやさ判定結果バッジ：先攻「1st せんこう」/ 後攻「2nd こうこう」 */}
              {turnPhase === PHASE_SPEED_RESULT && i === p2SelectedIndex && (
                <span
                  className={`battle-order-badge ${
                    turnOrder.first === "P2"
                      ? "battle-order-badge-first"
                      : "battle-order-badge-second"
                  }`}
                >
                  {turnOrder.first === "P2" ? "1st せんこう" : "2nd こうこう"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 中央：対戦の距離感（うっすら中央線） */}
        <div className="battle-center" aria-hidden="true" />

        {/* 下段：自分（P1） */}
        <div className="battle-row battle-row-p1">
          {p1Field.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className={`battle-card ${
                turnPhase === PHASE_SPEED_RESULT && i === p1SelectedIndex
                  ? "battle-card-selected battle-card-selected-p1"
                  : ""
              }`}
            >
              <img
                className={`pixel-img battle-sprite battle-sprite-back ${
                  p.isFainted ? "battle-sprite-fainted" : ""
                }`}
                src={p.sprites.back}
                alt={p.name}
              />
              <div className="battle-status">
                <span className="battle-name">{p.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{
                      width: `${Math.round((p.currentHp / p.maxHp) * 100)}%`,
                      background: hpBarColor(p),
                    }}
                  />
                </div>
                <span className="battle-hp">
                  {p.currentHp}/{p.maxHp}
                </span>
              </div>
              {/* すばやさ判定結果バッジ：先攻「1st せんこう」/ 後攻「2nd こうこう」 */}
              {turnPhase === PHASE_SPEED_RESULT && i === p1SelectedIndex && (
                <span
                  className={`battle-order-badge ${
                    turnOrder.first === "P1"
                      ? "battle-order-badge-first"
                      : "battle-order-badge-second"
                  }`}
                >
                  {turnOrder.first === "P1" ? "1st せんこう" : "2nd こうこう"}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ③ メッセージウィンドウ */}
      <div className="battle-message">
        <p>{displayMessage}</p>
      </div>

      {/* ④ コマンド・選択パネル（目隠し画面中は非表示） */}
      {turnPhase !== PHASE_HANDOVER_TO_P2 && (
        <section
          className={`battle-commands ${
            isP1Turn
              ? "battle-commands-p1"
              : turnPhase === PHASE_SELECT_P2
              ? "battle-commands-p2"
              : ""
          }`}
        >
          {isP1Turn || turnPhase === PHASE_SELECT_P2 ? (
            <>
              <div className="battle-command-label">
                <span
                  className={`battle-command-player ${
                    isP1Turn
                      ? "battle-command-player-p1"
                      : "battle-command-player-p2"
                  }`}
                >
                  {isP1Turn ? "P1" : "P2"}
                </span>
                <span className="battle-command-label-text">の えらび</span>
              </div>
              <div className="battle-command-grid">
                {activeTeam.map((p, i) => (
                  <button
                    key={`${p.id}-${i}`}
                    className="battle-command"
                    disabled={p.isFainted}
                    onClick={() => (isP1Turn ? selectP1(i) : selectP2(i))}
                    aria-label={`${p.name} を選択`}
                  >
                    <span className="battle-command-name">{p.name}</span>
                    {p.isFainted && (
                      <span className="battle-command-fainted">ひんし</span>
                    )}
                    <span className="battle-command-move">{p.moveName}</span>
                    <span
                      className="battle-command-speed"
                      aria-label={`すばやさ${p.spd}段階`}
                    >
                      {"▲".repeat(p.spd)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : turnPhase === PHASE_TEST_END ? (
            <button className="battle-reset" onClick={resetAll}>
              もういちど えらぶ（HPリセット）
            </button>
          ) : turnPhase === PHASE_SPEED_RESULT ? (
            <button className="battle-reset" onClick={resetSelection}>
              もういちど えらぶ（リセット）
            </button>
          ) : (
            <p className="battle-commands-waiting">……</p>
          )}
        </section>
      )}

      {/* ⑤ 目隠し（手渡し）オーバーレイ：P1の選択を隠してP2へ */}
      {turnPhase === PHASE_HANDOVER_TO_P2 && (
        <div className="battle-handover">
          <div className="battle-handover-window">
            <div className="battle-handover-title">P2に スマホを わたしてね！</div>
            <p className="battle-handover-sub">P1の せんたくは かくされているよ</p>
            <button
              className="battle-handover-btn"
              onClick={() => setTurnPhase(PHASE_SELECT_P2)}
            >
              P2 じゅんび OK！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
