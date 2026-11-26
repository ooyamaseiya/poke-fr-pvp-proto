import "./BenchSelectModal.css";

// 控え選択モーダル（Step 2-4a-1：独立UIコンポーネント）
// 見たみのみ：受け取った benchPokemons を金銀風に表示し、
// タップされた控えポケモンの配列インデックスを onSelect に通知するだけ。
// 状態更新・戦闘不能判定・目隠し画面との連携は親コンポーネントの責任。
export default function BenchSelectModal({
  isOpen,
  playerLabel,
  benchPokemons,
  onSelect,
}) {
  if (!isOpen) return null;

  // 控えは最大3体表示
  const bench = Array.isArray(benchPokemons)
    ? benchPokemons.slice(0, 3)
    : [];

  return (
    <div className="bench-select-modal">
      <div className="bench-select-modal-window">
        <header
          className={`bench-select-modal-header bench-select-modal-header-${
            (playerLabel || "").toLowerCase()
          }`}
        >
          <h1 className="bench-select-modal-title">
            {playerLabel} の こうたい
          </h1>
          <p className="bench-select-modal-sub">
            つぎに だす ポケモンを えらんでね！
          </p>
        </header>

        {bench.length > 0 ? (
          <div className="bench-select-modal-list">
            {bench.map((pokemon, index) => (
              <button
                key={`${pokemon.id}-${index}`}
                type="button"
                className="bench-select-modal-row"
                onClick={() => onSelect?.(index)}
                aria-label={`${pokemon.name} を選択`}
              >
                <img
                  className="bench-select-modal-sprite"
                  src={pokemon.sprites?.front}
                  alt={pokemon.name}
                />
                <span className="bench-select-modal-info">
                  <span className="bench-select-modal-name">
                    {pokemon.name}
                  </span>
                  <span className="bench-select-modal-move">
                    {pokemon.moveName}
                  </span>
                </span>
                <span className="bench-select-modal-stats">
                  <span className="bench-select-modal-hp">
                    HP {pokemon.maxHp}
                  </span>
                  <span
                    className="bench-select-modal-speed"
                    aria-label={`すばやさ${pokemon.spd}段階`}
                  >
                    {"▲".repeat(pokemon.spd)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="bench-select-modal-empty">
            ひかえの ポケモンが いません
          </p>
        )}
      </div>
    </div>
  );
}
