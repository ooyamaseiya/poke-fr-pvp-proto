import React, { useState, useEffect } from 'react';
import './BattleScreen.css';

const PHASES = {
    SELECT_P1: 'SELECT_P1',
    HANDOVER: 'HANDOVER',
    SELECT_P2: 'SELECT_P2',
    ANIMATING: 'ANIMATING',
    REFILL: 'REFILL',
    RESULT: 'RESULT'
};

const BattleScreen = ({ p1TeamRaw, p2TeamRaw, onRestart }) => {
  // --- State Management ---
  const [phase, setPhase] = useState(PHASES.SELECT_P1);
  const [turn, setTurn] = useState(1);
  const [message, setMessage] = useState('バトルが はじまった！');
  const [displayMessage, setDisplayMessage] = useState('');

  // Teams: Arrays of 6 pokemon objects (0-2 active field, 3-5 bench)
  const [p1Team, setP1Team] = useState([]);
  const [p2Team, setP2Team] = useState([]);
  const [scores, setScores] = useState({ p1Kills: 0, p2Kills: 0 });

  // Visuals & Selection tracking
  const [shakeTarget, setShakeTarget] = useState(null); // 'p1-idx' or 'p2-idx'
  const [attackEffect, setAttackEffect] = useState({ visible: false, side: null });

  useEffect(() => {
    const prepareTeam = (raw) => raw.map(pkmn => ({
      ...pkmn,
      hp: pkmn.maxHp || 100,
      maxHp: pkmn.maxHp || 100,
      cooldown: false,
      isDefeated: false,
    }));
    setP1Team(prepareTeam(p1TeamRaw));
    setP2Team(prepareTeam(p2TeamRaw));
  }, [p1TeamRaw, p2TeamRaw]);

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const typeWriter = async (text) => {
    setDisplayMessage('');
    for (let i = 0; i < text.length; i++) {
      await new Promise(r => setTimeout(r, 35));
      setDisplayMessage(prev => prev + text[i]);
    }
  };

  const setMessageAsync = async (msg) => {
    setMessage(msg);
    await typeWriter(msg);
  };

  // --- Battle Engine Core Logic ---

  const calculateDamage = (atk, def) => {
    let baseDmg = Math.floor((atk * 0.65) - (def * 0.25));
    baseDmg = Math.max(15, baseDmg);
    return Math.floor(baseDmg * (0.9 + Math.random() * 0.2));
  };

  const handleTurnSequence = async (p1Idx, p2Idx) => {
    setPhase(PHASES.ANIMATING);

    // --- STEP 1: Speed Order and First Attack ---
    let firstSide, secondSide, fIdx, sIdx;
    if (p1Team[p1Idx].spd >= p2Team[p2Idx].spd) {
        firstSide = 'P1'; secondSide = 'P2'; fIdx = p1Idx; sIdx = p2Idx;
    } else {
        firstSide = 'P2'; secondSide = 'P1'; fIdx = p2Idx; sIdx = p1Idx;
    }

    const performFirstAttack = async () => {
      const attackerStats = firstSide === 'P1' ? p1Team[fIdx] : p2Team[sIdx];
      await setMessageAsync(`${(firstSide === 'P1' ? 'P1の' : 'P2の')} ${attackerStats.name} の こうげき！`);
      setAttackEffect({ visible: true, side: firstSide === 'P1' ? 'p2' : 'p1' });
      await sleep(600);

      const opponentTeam = firstSide === 'P1' ? p2Team : p1Team;
      let newOpponentTeam = [...opponentTeam];
      let killsFound = 0;

      for (let i = 0; i < 3; i++) { // Target field [0, 1, 2]
        if (!newOpponentTeam[i].isDefeated) {
          const dmg = calculateDamage(attackerStats.atk, newOpponentTeam[i].def || 70);
          newOpponentTeam[i].hp -= dmg;
          setShakeTarget(`${firstSide === 'P1' ? 'p2' : 'p1'}-${i}`); // Trigger shake
          if (newOpponentTeam[i].hp <= 0) {
            newOpponentTeam[i].hp = 0;
            newOpponentTeam[i].isDefeated = true;
            killsFound++;
          }
        }
      }

      setAttackEffect({ visible: false, side: null });
      if (firstSide === 'P1') setP2Team(newOpponentTeam); else setP1Team(newOpponentTeam);
      if (killsFound > 0) setScores(prev => ({ ...prev, [firstSide === 'P1' ? 'p1Kills' : 'p2Kills']: prev[firstSide === 'P1' ? 'p1Kills' : 'p2Kills'] + killsFound }));
      return { killedCount: killsFound };
    };

    await performFirstAttack();

    // --- STEP 2: Second Attack (if attacker still alive) ---
    const secondAttackerSide = firstSide === 'P1' ? 'P2' : 'P1';
    const secondAttackerIdx = firstSide === 'P1' ? p2Idx : p1Idx; // The index in the *other* team? No, it is sIdx.
    // Actually: fIdx and sIdx are indices in their respective teams as defined above.

    let defenderTeamAfterFirstAttack = (secondAttackerSide === 'P1' ? [...p2Team] : [...p1Team]); 
    // Need to re-fetch because p2Team might have changed from first attack effects
  };

  // Let me implement it with a very clean state management approach.
  return (
      <div className="battle-screen">...</div>
  );
}

export default BattleScreen;
