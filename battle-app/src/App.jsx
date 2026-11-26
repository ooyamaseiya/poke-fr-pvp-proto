import { useState, useCallback } from "react";
import TitleScreen from "./components/TitleScreen.jsx";
import EntryScreen from "./components/EntryScreen.jsx";
import HandoverScreen from "./components/HandoverScreen.jsx";
import BattleScreen from "./components/BattleScreen.jsx";

// ゲームフェーズ（画面遷移）の管理
// TITLE -> ENTRY_P1 -> HANDOVER_TO_P2 -> ENTRY_P2 -> BATTLE
export default function App() {
  const [phase, setPhase] = useState("TITLE");
  const [p1Team, setP1Team] = useState([]);
  const [p2Team, setP2Team] = useState([]);

  const startGame = useCallback(() => {
    setP1Team([]);
    setP2Team([]);
    setPhase("ENTRY_P1");
  }, []);

  const confirmP1 = useCallback((team) => {
    setP1Team(team);
    setPhase("HANDOVER_TO_P2");
  }, []);

  const handleHandover = useCallback(() => {
    setPhase("ENTRY_P2");
  }, []);

  const confirmP2 = useCallback((team) => {
    setP2Team(team);
    setPhase("BATTLE");
  }, []);

  const backToTitle = useCallback(() => {
    setPhase("TITLE");
  }, []);

  let screen;
  switch (phase) {
    case "TITLE":
      screen = <TitleScreen onStart={startGame} />;
      break;
    case "ENTRY_P1":
      screen = (
        <EntryScreen
          player={1}
          playerColor="#2860d8"
          selected={p1Team}
          onConfirm={confirmP1}
        />
      );
      break;
    case "HANDOVER_TO_P2":
      screen = <HandoverScreen onContinue={handleHandover} />;
      break;
    case "ENTRY_P2":
      screen = (
        <EntryScreen
          player={2}
          playerColor="#d82828"
          selected={p2Team}
          onConfirm={confirmP2}
        />
      );
      break;
    case "BATTLE":
      screen = (
        <BattleScreen p1Team={p1Team} p2Team={p2Team} onBack={backToTitle} />
      );
      break;
    default:
      screen = null;
  }

  return (
    <div className={`app-shell ${phase === "BATTLE" ? "app-shell-battle" : ""}`}>
      {screen}
    </div>
  );
}
