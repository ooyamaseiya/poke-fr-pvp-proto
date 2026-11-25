import BattleScreen from "./components/BattleScreen";
import { useState } from "react";
import "./App.css";
import EntryScreen from "./components/EntryScreen";
import { POKEMON_MASTER } from "./data/pokemonMaster";

// --- Constants & Initial Data ---
const PHASES = {
  TITLE: "TITLE",
  ENTRY_P1: "ENTRY_P1",
  HANDOVER_TO_P2: "HANDOVER_TO_P2",
  ENTRY_P2: "ENTRY_P2",
  BATTLE: "BATTLE",
  ACTUAL_BATTLE: "ACTUAL_BATTLE",
};

const P1_COLOR = "#2860D8"; // 青
const P2_COLOR = "#D82828"; // 赤

export default function App() {
  // --- State Management ---
  const [phase, setPhase] = useState(PHASES.TITLE);
  const [p1Team, setP1Team] = useState([]);
  const [p2Team, setP2Team] = useState([]);

  // Helper to select a pokemon into the team for P1 or P2
  const handleSelectPokemon = (pokemon) => {
    if (phase === PHASES.ENTRY_P1 && p1Team.length < 6) {
      setP1Team((prev) => [...prev, pokemon]);
    } else if (phase === PHASES.ENTRY_P2 && p2Team.length < 6) {
      setP2Team((prev) => [...prev, pokemon]);
    }
  };

  const handleRemovePokemon = (index) => {
    if (phase === PHASES.ENTRY_P1) {
      setP1Team((prev) => prev.filter((_, i) => i !== index));
    } else if (phase === PHASES.ENTRY_P2) {
      setP2Team((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleRandomize = () => {
    if (p1Team.length < 6 && phase === PHASES.ENTRY_P1) {
      // Just fill up to 6 for demo simplicity if not already full
    }

    const shuffled = [...POKEMON_MASTER].sort(() => 0.5 - Math.random());
    let selected = [];
    for (let i = 0; i < 6 && i < shuffled.length; i++) {
      selected.push(shuffled[i]);
    }

    if (phase === PHASES.ENTRY_P1) setP1Team(selected);
    else if (phase === PHASES.ENTRY_P2) setP2Team(selected);
  };

  const handleConfirm = () => {
    if (phase === PHASES.ENTRY_P1) {
      setPhase(PHASES.HANDOVER_TO_P2);
    } else if (phase === PHASES.ENTRY_P2) {
      setPhase(PHASES.BATTLE);
    }
  };

  // --- Views ---

  const renderTitle = () => (
    <div className="title-screen">
      <h1>ポケモン PvP</h1>
      <button
        className="start-btn action-btn"
        onClick={() => setPhase(PHASES.ENTRY_P1)}
      >
        バトル スタート
      </button>
    </div>
  );

  const renderHandover = () => (
    <div className="handover-screen">
      <div className="window handover-message">
        P2に <br /> スマホを 渡してね！
      </div>
      <button
        onClick={() => setPhase(PHASES.ENTRY_P2)}
        style={{ marginTop: "20px" }}
      >
        次へ
      </button>
    </div>
  );

  const renderBattleSummary = () => (
    <div className="battle-summary">
      <h2>バトル 準備完了！</h2>
      <div
        className="teams-preview"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <div>
          <h3>P1 Team</h3>
          <ul>
            {p1Team.map((pkmn, i) => (
              <li key={i}>{pkmn.name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>P2 Team</h3>
          <ul>
            {p2Team.map((pkmn, i) => (
              <li key={i}>{pkmn.name}</li>
            ))}
          </ul>
        </div>
      </div>
      <button
        className="action-btn"
        onClick={() => setPhase(PHASES.ACTUAL_BATTLE)}
      >
        バトル 開始！
      </button>
    </div>
  );

  return (
    <div className="game-container">
      {phase === PHASES.TITLE && renderTitle()}

      {phase === PHASES.ENTRY_P1 && (
        <EntryScreen
          playerColor={P1_COLOR}
          selectedTeam={p1Team}
          onSelectPokemon={handleSelectPokemon}
          onRemovePokemon={handleRemovePokemon}
          onRandomize={handleRandomize}
          onConfirm={handleConfirm}
          isComplete={p1Team.length === 6}
        />
      )}

      {phase === PHASES.HANDOVER_TO_P2 && renderHandover()}

      {phase === PHASES.ENTRY_P2 && (
        <EntryScreen
          playerColor={P2_COLOR}
          selectedTeam={p2Team}
          onSelectPokemon={handleSelectPokemon}
          onRemovePokemon={handleRemovePokemon}
          onRandomize={handleRandomize}
          onConfirm={handleConfirm}
          isComplete={p2Team.length === 6}
        />
      )}

      {phase === PHASES.BATTLE && renderBattleSummary()}
      {phase === PHASES.ACTUAL_BATTLE && (
        <BattleScreen 
          p1TeamInitial={p1Team} 
          p2TeamInitial={p2Team} 
          onRestart={() => {
            setPhase(PHASES.TITLE);
            setP1Team([]);
            setP2Team([]);
          }} 
        />
      )}
    </div>
  );
}