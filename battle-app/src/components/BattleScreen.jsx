import React, { useState } from 'react';
import './BattleScreen.css';

const BattleScreen = ({ p1TeamInitial = [], p2TeamInitial = [], onRestart }) => {
  // --- State for Phase Management (Step 2-2) ---
  const [turnPhase, setTurnPhase] = useState('SELECT_P1'); // 'SELECT_P1' | 'HANDOVER_TO_P2' | 'SELECT_P2' | 'CONFIRM_SELECTION'
  const [p1SelectedIndex, setP1SelectedIndex] = useState(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState(null);

  // --- Data Fallback Logic ---
  const getPokemonData = (team) => {
    if (Array.isArray(team) && team.length >= 3) return team.slice(0, 3);

    // Dummy data for development fallback/safety
    const fallbacks = [
      { name: "ピカチュウ", maxHp: 60, currentHp: 50, moveName: "でんこうせき", spd: 4 },
      { name: "フシギダネ", maxHp: 60, currentHp: 40, moveName: "しるいなび", spd: 2 },
      { name: "ヒトカゲ", maxHp: 55, currentHp: 30, moveName: "ひのやけど", spd: 3 }
    ];

    if (!Array.isArray(team)) return fallbacks;
    return team.map((p, i) => (i < 3 ? p : null)).filter(Boolean);
  };

  const p1Team = getPokemonData(p1TeamInitial);
  const p2Team = getPokemonData(p2TeamInitial);

  // --- Handlers ---
  const handleP1Select = (idx) => {
    setP1SelectedIndex(idx);
    setTurnPhase('HANDOVER_TO_P2');
  };

  const handleHandoverOK = () => {
    setTurnPhase('SELECT_P2');
  };

  const handleP2Select = (idx) => {
    setP2SelectedIndex(idx);
    setTurnPhase('CONFIRM_SELECTION');
  };

  const resetSelection = () => {
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnPhase('SELECT_P1');
  };

  return (
    <div className="battle-container">
      {/* ① Header Bar */}
      <header className="battle-header">
        <div className="turn-info">TURN 1/6</div>
        <div className="score-area">P1 0 - 0 P2</div>
        <button className="back-btn" onClick={onRestart}>もどる</button>
      </header>

      {/* ② Battle Field */}
      <main className="battle-field">
        {/* Top: Enemy (P2) Area */}
        <div className={`enemy-area grid-layout ${p2SelectedIndex !== null && turnPhase === 'CONFIRM_SELECTION' ? 'highlighted' : ''}`}>
          {p2Team.map((pkmn, idx) => {
            const isSelected = p2SelectedIndex === idx;
            return (
              <div key={`p2-${idx}`} className={`pokemon-card enemy-card ${isSelected && turnPhase === 'CONFIRM_SELECTION' ? 'selected-highlight' : ''}`}>
                <div className="status-bar-mini">
                  <span className="name">{pkmn.name}</span>
                  <div className="hp-container">
                    <div 
                      className="hp-fill" 
                      style={{ width: `${(pkmn.currentHp / pkmn.maxHp) * 100}%` }}
                    ></div>
                    <span className="hp-text">{pkmn.currentHp}/{pkmn.maxHp}</span>
                  </div>
                </div>
                <img 
                  src={pkmn.sprites?.front || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${80 + idx}.png`} 
                  alt={pkmn.name} 
                  className="sprite-front" 
                  onError={(e) => e.target.src = 'https://via.placeholder.com/96x96?text=?'}
                />
              </div>
            );
          })}
        </div>

        <div className="battle-middle"></div>

        {/* Bottom: Player (P1) Area */}
        <div className={`player-area grid-layout ${p1SelectedIndex !== null && turnPhase === 'CONFIRM_SELECTION' ? 'highlighted' : ''}`}>
           {p1Team.map((pkmn, idx) => {
            const isSelected = p1SelectedIndex === idx;
            return (
              <div key={`p1-${idx}`} className={`pokemon-card player-card ${isSelected && turnPhase === 'CONFIRM_SELECTION' ? 'selected-highlight' : ''}`}>
                <img 
                  src={pkmn.sprites?.back || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${25 + idx}.png`} 
                  alt={pkmn.name} 
                  className="sprite-back" 
                  onError={(e) => e.target.src = 'https://via.placeholder.com/96x96?text=?'}
                />
                <div className="status-bar-mini">
                  <span className="name">{pkmn.name}</span>
                  <div className="hp-container">
                    <div 
                      className="hp-fill" 
                      style={{ width: `${(pkmn.currentHp / pkmn.maxHp) * 100}%` }}
                    ></div>
                     <span className="hp-text text-small">{pkmn.currentHp}/{pkmn.maxHp}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ③ Handover Overlay */}
      {turnPhase === 'HANDOVER_TO_P2' && (
        <div className="overlay-handover">
          <h2>P2に スマホを わたしてね！</h2>
          <p>P1の せんたくは かくされているよ</p>
          <button className="cmd-btn handover-ok" onClick={handleHandoverOK}>
            <span>P2 じゅんび OK！</span>
          </button>
        </div>
      )}

      {/* ④ Message Window */}
      <footer className="message-window">
        <div className="double-border-container">
           <p className="message-text">
             {turnPhase === 'SELECT_P1' && "P1の ターン！ こうげきする ポケモンを えらんでね！"}
             {turnPhase === 'SELECT_P2' && "P2の ターン！ こうげきする ポケモンを えらんでね！"}
             {turnPhase === 'CONFIRM_SELECTION' && (
               <span>
                 {p1Team[p1SelectedIndex]?.name}は {p1Team[p1SelectedIndex]?.name}! P2は {p2Team[p2SelectedIndex]?.name}を えらんだ!
               </span>
             )}
           </p>
        </div>
      </footer>

      {/* ⑤ Command Panel */}
      <section className="command-panel">
        <div className={`command-options ${turnPhase === 'SELECT_P1' ? 'theme-p1' : ''} ${turnPhase === 'SELECT_P2' ? 'theme-p2' : ''}`}>
          {turnPhase === 'SELECT_P1' && p1Team.map((pkmn, idx) => (
            <button 
              key={`cmd-p1-${idx}`} 
              className="cmd-btn" 
              onClick={() => handleP1Select(idx)}
            >
              <span className="cmd-name">{pkmn.name}</span>
              <span className="cmd-move">{pkmn.moveName || 'こうげき'}</span>
              <span className="cmd-speed">▲{pkmn.spd || 3}▲</span>
            </button>
          ))}

          {turnPhase === 'SELECT_P2' && p2Team.map((pkmn, idx) => (
            <button 
              key={`cmd-p2-${idx}`} 
              className="cmd-btn" 
              onClick={() => handleP2Select(idx)}
            >
              <span className="cmd-name">{pkmn.name}</span>
              <span className="cmd-move">{pkmn.moveName || 'こうげき'}</span>
              <span className="cmd-speed">▲{pkmn.spd || 3}▲</span>
            </button>
          ))}

          {turnPhase === 'CONFIRM_SELECTION' && (
            <button className="cmd-btn reset-btn" onClick={resetSelection}>
               <span>もういちど えらぶ（リセット）</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default BattleScreen;