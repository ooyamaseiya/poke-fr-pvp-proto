import React from 'react';
import { POKEMON_MASTER } from '../data/pokemonMaster';

/**
 * EntryScreen Component for selecting 6 Pokémon (P1 or P2)
 */
export default function EntryScreen({ 
  playerColor, // '#2860D8' or '#D82828'
  selectedTeam, 
  onSelectPokemon, 
  onRemovePokemon, 
  onRandomize, 
  onConfirm, 
  isComplete 
}) {

  const handleSlotClick = (index) => {
    if (selectedTeam[index]) {
      onRemovePokemon(index);
    } else {
      // Just a placeholder: this logic is handled by selecting from the list below.
      // But we need to know WHICH pokemon they want to add if they click an empty slot? 
      // Usually, clicking an empty slot might just select nothing or maybe something in "quick" mode.
      // For now let's assume you MUST pick from the list below into a specific (empty) slot.
    }
  };

  const handlePokemonClick = (pokemonId) => {
    onSelectPokemon(pokemonId);
  };

  return (
    <div className="entry-screen" style={{ '--accent-color': playerColor }}>
      {/* 1. Selection Slots */}
      <section className="selection-section">
        <h2 className="section-title">チーム えらび</h2>
        <div className="slots-container">
          <p className="label">【 先発 】</p>
          <div className="slots-row">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className={`slot ${selectedTeam[idx] ? 'filled' : ''}`} onClick={() => handleSlotClick(idx)}>
                {selectedTeam[idx] && (
                  <div className="slot-content">
                    <img src={selectedTeam[idx].sprites.front} alt={selectedTeam[idx].name} />
                    <span>{selectedTeam[idx].name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="label" style={{ marginTop: '10px' }}>【 控え 】</p>
          <div className="slots-row">
            {[3, 4, 5].map((idx) => (
              <div key={idx} className={`slot ${selectedTeam[idx] ? 'filled' : ''}`} onClick={() => handleSlotClick(idx)}>
                {selectedTeam[idx] && (
                  <div className="slot-content">
                    <img src={selectedTeam[idx].sprites.front} alt={selectedTeam[idx].name} />
                    <span>{selectedTeam[idx].name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Pokemon List */}
      <section className="list-section">
        <div className="list-header">
          <h3>ポケモン いちらん</h3>
          <button onClick={onRandomize} className="action-btn secondary">ランダムで6たい えらぶ</button>
        </div>
        <div className="pokemon-grid">
          {POKEMON_MASTER.map((pkmn) => (
            <div key={pkmn.id} className="pokemon-card" onClick={() => handlePokemonClick(pkmn)}>
              <img src={pkmn.sprites.front} alt={pkmn.name} />
              <div className="pkmn-info">
                <span className="name">{pkmn.name}</span>
                <span className="stats">HP:{pkmn.maxHp} / ⚡{Array(pkmn.spd).fill('▲').join('')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Footer Actions */}
      <footer className="entry-footer">
        <button 
          className={`confirm-btn ${!isComplete ? 'disabled' : ''}`} 
          onClick={onConfirm}
          disabled={!isComplete}
        >
          これで けってい！
        </button>
      </footer>
    </div>
  );
}
