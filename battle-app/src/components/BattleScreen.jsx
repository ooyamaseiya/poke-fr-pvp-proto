import React from 'react';
import './BattleScreen.css';

const BattleScreen = ({ p1TeamInitial = [], p2TeamInitial = [], onRestart }) => {
  // --- Data Fallback Logic ---
  // Ensure we have at least 3 pokemon to show in each row as per requirement, even if not passed yet.
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

  // Using first 3 from each as requested in step 2-1 instruction.
  const p1Team = getPokemonData(p1TeamInitial);
  const p2Team = getPokemonData(p2TeamInitial);

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
        <div className="enemy-area grid-layout">
          {p2Team.map((pkmn, idx) => (
            <div key={`p2-${idx}`} className="pokemon-card enemy-card">
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
          ))}
        </div>

        <div className="battle-middle"></div>

        {/* Bottom: Player (P1) Area */}
        <div className="player-area grid-layout">
           {p1Team.map((pkmn, idx) => (
            <div key={`p1-${idx}`} className="pokemon-card player-card">
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
          ))}
        </div>
      </main>

      {/* ③ Message Window (Double Border) */}
      <footer className="message-window">
        <div className="double-border-container">
           <p className="message-text">P1の ターン！ こうげきする ポケモンを えらんでね！</p>
        </div>
      </footer>

      {/* ④ Command Panel */}
      <section className="command-panel">
        <div className="command-options">
          {p1Team.map((pkmn, idx) => (
            <button 
              key={`cmd-${idx}`} 
              className="cmd-btn" 
              onClick={() => console.log(`Selected: ${pkmn.name}`)}
            >
              <span className="cmd-name">{pkmn.name}</span>
              <span className="cmd-move">{pkmn.moveName || 'こうげき'}</span>
              <span className="cmd-speed">▲{pkmn.spd || 3}▲</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BattleScreen;
