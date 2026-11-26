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

// 現在HP（battleロジック未実装のため、maxHp の満タン）
function currentHp(p) {
  return p.hp ?? p.maxHp;
}

// ブラインド選択のターンフェーズ（Step 2-2）+ すばやさ判定結果（Step 2-3a）
const PHASE_SELECT_P1 = "SELECT_P1";
const PHASE_HANDOVER_TO_P2 = "HANDOVER_TO_P2";
const PHASE_SELECT_P2 = "SELECT_P2";
const PHASE_SPEED_RESULT = "SPEED_RESULT";

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

// バトル画面（Step 2-1：見た目のUIレイアウト + Step 2-2：P1選択→目隠し→P2選択→確認の画面遷移）
// P1 / P2 の先発3体が上下で向かい合う、ポケモン金銀風の画面。
export default function BattleScreen({ p1Team, p2Team, onBack }) {
  const p1 = normalizeTeam(p1Team);
  const p2 = normalizeTeam(p2Team);
  const [turnPhase, setTurnPhase] = useState(PHASE_SELECT_P1);
  const [p1SelectedIndex, setP1SelectedIndex] = useState(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState(null);
  // 先攻・後攻の判定結果（Step 2-3a：P2選択後に決定）
  const [turnOrder, setTurnOrder] = useState(null);

  // P1が選んだ：インデックス保存 → 即座に目隠し画面へ
  const selectP1 = (i) => {
    setP1SelectedIndex(i);
    setTurnPhase(PHASE_HANDOVER_TO_P2);
  };

  // P2が選んだ：インデックス保存 → すばやさ比較で先攻・後攻を決定 → 結果表示へ
  const selectP2 = (i) => {
    setP2SelectedIndex(i);
    const result = determineTurnOrder(p1[p1SelectedIndex], p2[i]);
    setTurnOrder(result);
    setTurnPhase(PHASE_SPEED_RESULT);
  };

  // リセット：両選択と判定結果を null に戻し、P1選択から再開
  const resetSelection = () => {
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);
    setTurnPhase(PHASE_SELECT_P1);
  };

  const p1Selected = p1SelectedIndex !== null ? p1[p1SelectedIndex] : null;
  const p2Selected = p2SelectedIndex !== null ? p2[p2SelectedIndex] : null;

  // メッセージウィンドウのテキスト（フェーズごとに切替）
  let message;
  if (turnPhase === PHASE_SELECT_P1) {
    message = "P1の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SELECT_P2) {
    message = "P2の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SPEED_RESULT && turnOrder) {
    const firstPokemon =
      turnOrder.first === "P1" ? p1Selected : p2Selected;
    if (turnOrder.isTie) {
      message = `すばやさが おなじ(▲${p1Selected?.spd})！ ランダムで せんこうは ${turnOrder.first} の ${firstPokemon?.name} に きまった！`;
    } else {
      message = `P1(▲${p1Selected?.spd}) vs P2(▲${p2Selected?.spd})！ せんこうは ${turnOrder.first} の ${firstPokemon?.name}！`;
    }
  } else {
    message = "";
  }

  // コマンドパネルで表示するチーム（P1ターンなら p1、P2ターンなら p2）
  const activeTeam = turnPhase === PHASE_SELECT_P1 ? p1 : p2;
  const isP1Turn = turnPhase === PHASE_SELECT_P1;

  return (
    <div className="battle-screen">
      {/* ① ヘッダーバー */}
      <header className="battle-header">
        <span className="battle-turn">TURN 1/6</span>
        <div className="battle-header-right">
          <span className="battle-score">P1 0 - 0 P2</span>
          <button className="battle-back" onClick={onBack}>
            もどる
          </button>
        </div>
      </header>

      {/* ② バトルフィールド（P2 上段 / P1 下段） */}
      <section className="battle-field">
        {/* 上段：相手（P2） */}
        <div className="battle-row battle-row-p2">
          {p2.map((p, i) => (
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
                    style={{ width: `${Math.round((currentHp(p) / p.maxHp) * 100)}%` }}
                  />
                </div>
              </div>
              <img
                className="pixel-img battle-sprite battle-sprite-front"
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
          {p1.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className={`battle-card ${
                turnPhase === PHASE_SPEED_RESULT && i === p1SelectedIndex
                  ? "battle-card-selected battle-card-selected-p1"
                  : ""
              }`}
            >
              <img
                className="pixel-img battle-sprite battle-sprite-back"
                src={p.sprites.back}
                alt={p.name}
              />
              <div className="battle-status">
                <span className="battle-name">{p.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${Math.round((currentHp(p) / p.maxHp) * 100)}%` }}
                  />
                </div>
                <span className="battle-hp">
                  {currentHp(p)}/{p.maxHp}
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
        <p>{message}</p>
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
                    onClick={() => (isP1Turn ? selectP1(i) : selectP2(i))}
                    aria-label={`${p.name} を選択`}
                  >
                    <span className="battle-command-name">{p.name}</span>
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
          ) : (
            <button className="battle-reset" onClick={resetSelection}>
              もういちど えらぶ（リセット）
            </button>
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
