import { useState } from "react";
import { POKEMON_MASTER, TEAM_SIZE, LEAD_COUNT } from "../data/pokemonMaster.js";

// 6体エントリー画面（P1 / P2 共用）
// 将来、ステップB（カメラOCR読み取り）に差し替えやすいよう独立コンポーネント。
export default function EntryScreen({
  player,
  playerColor,
  selected,
  onConfirm,
}) {
  const [team, setTeam] = useState(selected);

  const isComplete = team.length === TEAM_SIZE;

  const addPokemon = (pokemon) => {
    setTeam((t) => (t.length < TEAM_SIZE ? [...t, pokemon] : t));
  };

  const removePokemon = (index) => {
    setTeam((t) => t.filter((_, i) => i !== index));
  };

  const randomSelect = () => {
    const shuffled = [...POKEMON_MASTER].sort(() => Math.random() - 0.5);
    setTeam(shuffled.slice(0, TEAM_SIZE));
  };

  return (
    <div className="window">
      <div className="window-title">
        プレイヤー{player} の選び方
      </div>
      <p className="window-subtitle">
        ポケモンのカードをタップして追加する（重複もOK）
      </p>

      {/* 上部：選出スロット（6枠） */}
      <div className="slot-grid">
        {Array.from({ length: TEAM_SIZE }).map((_, i) => {
          const slotPokemon = team[i];
          const label = i < LEAD_COUNT ? "先発" : "控え";
          return (
            <button
              key={slotPokemon ? `${slotPokemon.id}-${i}` : `empty-${i}`}
              className={`slot ${slotPokemon ? "slot-filled" : "slot-empty"}`}
              onClick={() => slotPokemon && removePokemon(i)}
              aria-label={slotPokemon ? `${slotPokemon.name} を削除` : "空枠"}
            >
              <span className="slot-label">{label}</span>
              {slotPokemon ? (
                <>
                  <img
                    className="pixel-img slot-img"
                    src={slotPokemon.sprites.front}
                    alt={slotPokemon.name}
                  />
                  <span className="slot-name">{slotPokemon.name}</span>
                </>
              ) : (
                <span className="slot-placeholder">空</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 中部：テスト用ポケモン一覧（タップで追加） */}
      <div className="pokemon-grid">
        {POKEMON_MASTER.map((p) => (
          <button
            key={p.id}
            className="pokemon-card"
            onClick={() => addPokemon(p)}
            disabled={isComplete}
            aria-label={`${p.name} を追加`}
          >
            <img
              className="pixel-img pokemon-img"
              src={p.sprites.front}
              alt={p.name}
            />
            <span className="pokemon-name">{p.name}</span>
            <span className="pokemon-meta">
              HP {p.maxHp}{" "}
              <span className="speed-arrows" aria-label={`すばやさ${p.spd}段階`}>
                {"▲".repeat(p.spd)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* 下部：決定ボタン */}
      <div className="entry-footer">
        <button className="btn" onClick={randomSelect} disabled={isComplete}>
          ランダムで6たい えらぶ
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onConfirm(team)}
          disabled={!isComplete}
        >
          これで けつい！
        </button>
      </div>
    </div>
  );
}
