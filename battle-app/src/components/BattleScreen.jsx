import React, { useState, useEffect } from 'react';
import './BattleScreen.css';

const PHASES = { 
  SELECT_P1: 'SELECT_P1', 
  HANDOVER: 'HANDOVER', 
  SELECT_P2: 'SELECT_P2', 
  ANIMATING: 'ANIMATING', 
  RESULT: 'RESULT' 
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function BattleScreen({ p1TeamInitial, p2TeamInitial, onRestart }) {
    // --- State ---
    const [phase, setPhase] = useState(PHASES.SELECT_P1);
    const [turn, setTurn] = useState(1);
    const maxTurns = 6;

    const [p1Team, setP1Team] = useState([]);
    const [p2Team, setP2Team] = useState([]);
    const [message, setMessage] = useState('バトル はじまる！');
    const [isShaking, setIsShaking] = useState({ side: null, index: null }); 

    // Tracking selection for current turn's attacks
    const [selectedIdx1, setSelectedIdx1] = useState(null);
    const [selectedIdx2, setSelectedIdx2] = useState(null);

    useEffect(() => {
        setP1Team(p1TeamInitial.map(p => ({ ...p, currentHp: p.maxHp, cooldown: false })));
        setP2Team(p2TeamInitial.map(p => ({ ...p, currentHp: p.maxHp, cooldown: false })));
    }, [p1TeamInitial, p2TeamInitial]);

    const typeWriter = async (text) => {
        setMessage('');
        for (let i = 0; i < text.length; i++) { await new Promise(r => setTimeout(r, 35)); setMessage(prev => prev + text[i]); }
    };

    // --- Core Logic Helpers ---
    const calculateDamage = (atkPower, defStat) => Math.floor(Math.max(10, atkPower * 0.6 - defStat * 0.2) * (0.85 + Math.random() * 0.3));

    // Check and refill bench if pokemon fainted
    const handleRefills = (team) => {
        let updatedTeam = JSON.parse(JSON.stringify(team));
        for (let i=0; i<3; i++) {
            if (updatedTeam[i].currentHp <= 0 && !updatedTeam.hasOwnProperty('fainted')) { // Simple check for this implementation...
                // We'll do it in the main loop to avoid complexity.
            }
        }
    };

    const runTurnSequence = async () => {
        setPhase(PHASES.ANIMATING);
        await wait(1000);

        let wP1 = JSON.parse(JSON.stringify(p1Team));
        let wP2 = JSON.parse(JSON.stringify(p2Team));
    };
}
