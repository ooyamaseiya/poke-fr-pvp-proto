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

// ブラインド選択のターンフェーズ（Step 2-2）
const PHASE_SELECT_P1 = "SELECT_P1";
const PHASE_HANDOVER_TO_P2 = "HANDOVER_TO_P2";
const PHASE_SELECT_P2 = "SELECT_P2";
const PHASE_CONFIRM_SELECTION = "CONFIRM_SELECTION";

// バトル画面（Step 2-1：見た目のUIレイアウト + Step 2-2：P1選択→目隠し→P2選択→確認の画面遷移）
// P1 / P2 の先発3体が上下で向かい合う、ポケモン金銀風の画面。
export default function BattleScreen({ p1Team, p2Team, onBack }) {
  const p1 = normalizeTeam(p1Team);
  const p2 = normalizeTeam(p2Team);
  const [turnPhase, setTurnPhase] = useState(PHASE_SELECT_P1);
  const [p1SelectedIndex, setP1SelectedIndex] = useState(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState(null);

  // P1が選んだ：インデックス保存 → 即座に目隠し画面へ
  const selectP1 = (i) => {
    setP1SelectedIndex(i);
    setTurnPhase(PHASE_HANDOVER_TO_P2);
  };

  // P2が選んだ：インデックス保存 → 選択結果確認へ
  const selectP2 = (i) => {
    setP2SelectedIndex(i);
    setTurnPhase(PHASE_CONFIRM_SELECTION);
  };

  // リセット：両選択を null に戻し、P1選択から再開
  const resetSelection = () => {
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
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
  } else if (turnPhase === PHASE_CONFIRM_SELECTION) {
    message = `P1は ${p1Selected?.name}！ P2は ${p2Selected?.name}を えらんだ！`;
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
                turnPhase === PHASE_CONFIRM_SELECTION && i === p2SelectedIndex
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
                turnPhase === PHASE_CONFIRM_SELECTION && i === p1SelectedIndex
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
