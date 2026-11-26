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

// バトル画面（Step 2-1：見た目のUIレイアウトのみ）
// P1 / P2 の先発3体が上下で向かい合う、ポケモン金銀風の画面。
export default function BattleScreen({ p1Team, p2Team, onBack }) {
  const p1 = normalizeTeam(p1Team);
  const p2 = normalizeTeam(p2Team);
  const [selected, setSelected] = useState(null);

  const pick = (i) => {
    // バトル進行はしない（見た目だけ）。押したボタンを強調し、ログに出す。
    setSelected(selected === i ? null : i);
    console.log("selected pokemon:", p1[i]?.name);
  };

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
            <div key={`${p.id}-${i}`} className="battle-card">
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
            <div key={`${p.id}-${i}`} className="battle-card">
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
        <p>P1の ターン！ こうげきする ポケモンを えらんでね！</p>
      </div>

      {/* ④ コマンド・選択パネル */}
      <section className="battle-commands">
        {p1.map((p, i) => (
          <button
            key={`${p.id}-${i}`}
            className={`battle-command ${selected === i ? "battle-command-active" : ""}`}
            onClick={() => pick(i)}
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
      </section>
    </div>
  );
}
