import { useState } from "react";
import { LEAD_COUNT, POKEMON_MASTER } from "../data/pokemonMaster.js";
import BenchSelectModal from "./BenchSelectModal.jsx";
import "./BattleScreen.css";

// 開発中、props が未定義でもクラッシュしないためのダミーフォールバック
// (POKEMON_MASTER の先頭3体を先発3体として使う)
const FALLBACK_TEAM = POKEMON_MASTER.slice(0, LEAD_COUNT);

// props を受けて先発3体の配列に正規化（未定義・空配列はフォールバック）
function normalizeTeam(team) {
  if (!Array.isArray(team) || team.length === 0) return FALLBACK_TEAM;
  return team.slice(0, LEAD_COUNT);
}

// フィールド上の状態を初期化（Step 2-3b）
// 各ポケモンに currentHp / isFainted / fatigueTurns を付与した可変データとする
function makeField(team) {
  return team.map((p) => ({
    ...p,
    currentHp: p.maxHp,
    isFainted: false,
    fatigueTurns: 0, // 0 = 元気（選択可能）、1〜2 = 疲労状態（選択不可）
  }));
}

// ダメージ計算（純粋関数：Step 2-3b）
// 攻撃側1体 → 防御側1体のダメージを計算する
export function calculateDamage(attacker, defender) {
  const base = Math.floor(attacker.atk * 0.65 - defender.def * 0.25);
  const variance = 0.9 + Math.random() * 0.2; // 0.9〜1.1倍の乱数
  return Math.max(15, Math.floor(base * variance)); // 最低保証 15 ダメージ
}

// 全体攻撃の適用：相手の生存ポケモン全員にダメージ（下限0、0なら戦闘不能）
function applyDamageToField(attacker, field) {
  return field.map((p) => {
    if (p.isFainted) return p;
    const dmg = calculateDamage(attacker, p);
    const nextHp = Math.max(0, p.currentHp - dmg);
    return { ...p, currentHp: nextHp, isFainted: nextHp <= 0 };
  });
}

// 詰み防止ルール（Step 2-3c）：
// 生存ポケモンが1体以上いるのに、生存ポケモン全員が fatigueTurns > 0 なら、
// 生存ポケモンの中で最小の fatigueTurns (minFatigue) を全生存ポケモンに差し引き、
// 最も回復が近いポケモンを 0（選択可能）にする。
// 戦闘不能のポケモンは対象から除外する（除外しないと minFatigue=0 で効果がなくなる）。
export function preventSoftlock(field) {
  const survivors = field.filter((p) => !p.isFainted);
  if (survivors.length === 0) return field;
  if (!survivors.every((p) => p.fatigueTurns > 0)) return field;
  const minFatigue = Math.min(...survivors.map((p) => p.fatigueTurns));
  return field.map((p) =>
    p.isFainted
      ? p
      : { ...p, fatigueTurns: Math.max(0, p.fatigueTurns - minFatigue) }
  );
}

// 疲労状態の更新（Step 2-3c）：ターン終了時に呼ばれる
// field: フィールド配列, attacked: このターンに実際に攻撃したポケモンのインデックス集合
//   1. 攻撃していないポケモンの疲労を減らす（>0 のとき -1、下限0）
//   2. 攻撃したポケモンに疲労を付与（fatigueTurns = 2）
//   3. 詰み防止ルールを適用
export function updateFatigue(field, attacked) {
  const decremented = field.map((p, i) => {
    const wasAttacker = attacked.has(i);
    let fatigue = p.fatigueTurns;
    // 1. 攻撃していないポケモンだけ減らす
    if (!wasAttacker && fatigue > 0) fatigue = Math.max(0, fatigue - 1);
    // 2. 攻撃したポケモンは 2 にセット
    if (wasAttacker) fatigue = 2;
    return { ...p, fatigueTurns: fatigue };
  });
  // 3. 詰み防止
  return preventSoftlock(decremented);
}

// 待機関数（非同期フェーズの自動進行用）
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ブラインド選択のターンフェーズ（Step 2-2）+ すばやさ判定結果（Step 2-3a）
// + 攻撃実行・テスト終了（Step 2-3b）
const PHASE_SELECT_P1 = "SELECT_P1";
const PHASE_HANDOVER_TO_P2 = "HANDOVER_TO_P2";
const PHASE_SELECT_P2 = "SELECT_P2";
const PHASE_SPEED_RESULT = "SPEED_RESULT";
const PHASE_EXEC_FIRST = "EXEC_FIRST";
const PHASE_EXEC_SECOND = "EXEC_SECOND";
const PHASE_REPLACE_P1 = "REPLACE_P1"; // P1の控え選択中（Step 2-4a-2）
const PHASE_TEST_END = "TEST_END";

// すばやさ比較による先攻・後攻の決定（純粋関数：Step 2-3a）
// 同速の場合はランダムで先攻を決め、isTie = true を返す。
function determineTurnOrder(p1Pokemon, p2Pokemon) {
  if (p1Pokemon.spd > p2Pokemon.spd) {
    return { first: "P1", second: "P2", isTie: false };
  }
  if (p2Pokemon.spd > p1Pokemon.spd) {
    return { first: "P2", second: "P1", isTie: false };
  }
  const first = Math.random() < 0.5 ? "P1" : "P2";
  return {
    first,
    second: first === "P1" ? "P2" : "P1",
    isTie: true,
  };
}

// HPバーの色（残りHP割合に応じて：>50%緑 / 21〜50%黄 / 20%以下赤）
function hpBarColor(p) {
  const ratio = p.currentHp / p.maxHp;
  if (ratio > 0.5) return "#30B830";
  if (ratio >= 0.21) return "#F8C028";
  return "#E83030";
}

// バトル画面（Step 2-1：見た目のUIレイアウト + Step 2-2：P1選択→目隠し→P2選択→確認の画面遷移
// + Step 2-3a：先攻・後攻の決定 + Step 2-3b：全体攻撃のダメージ計算・HPバー更新・戦闘不能判定）
// P1 / P2 の先発3体が上下で向かい合う、ポケモン金銀風の画面。
export default function BattleScreen({ p1Team, p2Team, onBack }) {
  const p1 = normalizeTeam(p1Team);
  const p2 = normalizeTeam(p2Team);
  // フィールド上のHP状態（バトル中に更新される：Step 2-3b）
  const [p1Field, setP1Field] = useState(() => makeField(p1));
  const [p2Field, setP2Field] = useState(() => makeField(p2));
  // P1の控え（p1Teamの後半3体：Step 2-4a-2）。propsが未定義でもクラッシュしないよう安全に取得
  const [p1Bench, setP1Bench] = useState(() => (p1Team || []).slice(3, 6));
  const [turnPhase, setTurnPhase] = useState(PHASE_SELECT_P1);
  const [p1SelectedIndex, setP1SelectedIndex] = useState(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState(null);
  // 先攻・後攻の判定結果（Step 2-3a：P2選択後に決定）
  const [turnOrder, setTurnOrder] = useState(null);
  // 攻撃実行・テスト終了フェーズのメッセージ（Step 2-3b）
  const [message, setMessage] = useState("");

  // P1が選んだ：インデックス保存 → 即座に目隠し画面へ
  const selectP1 = (i) => {
    setP1SelectedIndex(i);
    setTurnPhase(PHASE_HANDOVER_TO_P2);
  };

  // P2が選んだ：インデックス保存 → すばやさ比較で先攻・後攻を決定 → 結果表示 → 攻撃フロー開始
  const selectP2 = (i) => {
    setP2SelectedIndex(i);
    const result = determineTurnOrder(p1Field[p1SelectedIndex], p2Field[i]);
    setTurnOrder(result);
    setTurnPhase(PHASE_SPEED_RESULT);
    runTurnFlow(result, p1Field, p2Field, p1SelectedIndex, i);
  };

  // 攻撃実行フロー（Step 2-3b：自動進行）
  // SPEED_RESULT → EXEC_FIRST → EXEC_SECOND → ターン終了（選択リセット/TEST_END）
  const runTurnFlow = async (order, p1F0, p2F0, p1Sel, p2Sel) => {
    // 非同期処理中に stale state の HP を読んでしまうのを防ぐため、ローカルコピーを管理
    let p1F = p1F0;
    let p2F = p2F0;
    // このターンに実際に攻撃を実行したポケモンのインデックス（P1側 / P2側）
    const p1Attacked = new Set();
    const p2Attacked = new Set();

    // 1. SPEED_RESULT：判定メッセージを表示中（約1200ms待機）
    await wait(1200);

    // 2. 先攻の攻撃実行（EXEC_FIRST）
    const firstPlayer = order.first;
    const secondPlayer = order.second;
    const firstPokemon = firstPlayer === "P1" ? p1F[p1Sel] : p2F[p2Sel];

    // 先攻は必ず攻撃を実行する
    if (firstPlayer === "P1") p1Attacked.add(p1Sel);
    else p2Attacked.add(p2Sel);

    setTurnPhase(PHASE_EXEC_FIRST);
    setMessage(
      `P${firstPlayer === "P1" ? "1" : "2"} の ${firstPokemon.name} の ${firstPokemon.moveName}！`
    );
    await wait(1000);

    // 相手フィールドの生存ポケモン全員にダメージを適用
    if (secondPlayer === "P1") {
      p1F = applyDamageToField(firstPokemon, p1F);
      setP1Field(p1F);
    } else {
      p2F = applyDamageToField(firstPokemon, p2F);
      setP2Field(p2F);
    }
    setMessage("あいての ポケモンたちに ダメージ！");
    await wait(1200);

    // 3. 後攻の攻撃実行（EXEC_SECOND）
    setTurnPhase(PHASE_EXEC_SECOND);
    // 先攻の攻撃による最新のHP状態に基づいて戦闘不能をチェック
    const secondPokemon =
      secondPlayer === "P1" ? p1F[p1Sel] : p2F[p2Sel];

    if (secondPokemon.isFainted || secondPokemon.currentHp <= 0) {
      // たおれている：攻撃をキャンセル
      setMessage(`${secondPokemon.name} は たおれて こうげきできない！`);
      await wait(1200);
    } else {
      // 後攻は実際にかける（攻撃実行のポケモンにマークする）
      if (secondPlayer === "P1") p1Attacked.add(p1Sel);
      else p2Attacked.add(p2Sel);
      setMessage(
        `P${secondPlayer === "P1" ? "1" : "2"} の ${secondPokemon.name} の ${secondPokemon.moveName}！`
      );
      await wait(1000);

      // 先攻と同様に相手フィールドの生存ポケモン全員にダメージを適用
      if (firstPlayer === "P1") {
        p1F = applyDamageToField(secondPokemon, p1F);
        setP1Field(p1F);
      } else {
        p2F = applyDamageToField(secondPokemon, p2F);
        setP2Field(p2F);
      }
      setMessage("あいての ポケモンたちに ダメージ！");
      await wait(1200);
    }

    // 4. ターン終了・次の選択へ
    // 疲労状態の更新（Step 2-3c）：減算 → 攻撃者に付与 → 詰み防止
    p1F = updateFatigue(p1F, p1Attacked);
    p2F = updateFatigue(p2F, p2Attacked);
    setP1Field(p1F);
    setP2Field(p2F);

    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);

    // P1交代チェック（Step 2-4a-2）：攻撃計算直後の最新状態（p1F）で判定する
    if (p1F.some((p) => p.isFainted) && p1Bench.length > 0) {
      setTurnPhase(PHASE_REPLACE_P1);
      setMessage("P1の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！");
    } else if (p1F.every((p) => p.isFainted) || p2F.every((p) => p.isFainted)) {
      // どちらかの先発3体が全員戦闘不能ならテスト終了
      setTurnPhase(PHASE_TEST_END);
      setMessage("せんぱつ 3たいが ぜんめつした！ リセットしてね");
    } else {
      setTurnPhase(PHASE_SELECT_P1);
    }
  };

  // P1控えの選択（Step 2-4a-2）：倒れた枠に控えを打ち替え、控えリストから削除
  const handleSelectP1Bench = (benchIndex) => {
    // 1. 交代先スロットの特定：最初の戦闘不能枠をを探す
    const faintedIndex = p1Field.findIndex((p) => p.isFainted);
    if (faintedIndex === -1) return;

    // 2. フィールドの入れ替え：控えから元気なバトル用ポケモンを生成
    const benchPokemon = p1Bench[benchIndex];
    const freshPokemon = {
      ...benchPokemon,
      currentHp: benchPokemon.maxHp,
      isFainted: false,
      fatigueTurns: 0,
    };
    const nextP1Field = p1Field.map((p, i) =>
      i === faintedIndex ? freshPokemon : p
    );

    // 3. 控えリストからの削除
    const nextP1Bench = p1Bench.filter((_, i) => i !== benchIndex);

    // 4. State更新とメッセージ表示
    setP1Field(nextP1Field);
    setP1Bench(nextP1Bench);
    setMessage(`P1 は ${benchPokemon.name} を くりだした！`);

    // 5. 複数体同時ダウンの継続判定
    if (nextP1Field.some((p) => p.isFainted) && nextP1Bench.length > 0) {
      // 交代が完了していない：次の交代モーダルを表示し続ける
      setTurnPhase(PHASE_REPLACE_P1);
    } else {
      // P1の交代がすべて完了：選択状態をリセットして次のターンへ
      setP1SelectedIndex(null);
      setP2SelectedIndex(null);
      setTurnOrder(null);
      setTurnPhase(PHASE_SELECT_P1);
    }
  };

  // リセット：両選択と判定結果を null に戻し、P1選択から再開
  const resetSelection = () => {
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);
    setTurnPhase(PHASE_SELECT_P1);
  };

  // HPリセット（テスト用）：全員のHPを全回復し、最初からやり直す
  const resetAll = () => {
    setP1Field(makeField(p1));
    setP2Field(makeField(p2));
    setP1Bench((p1Team || []).slice(3, 6));
    setP1SelectedIndex(null);
    setP2SelectedIndex(null);
    setTurnOrder(null);
    setTurnPhase(PHASE_SELECT_P1);
  };

  const p1Selected = p1SelectedIndex !== null ? p1Field[p1SelectedIndex] : null;
  const p2Selected = p2SelectedIndex !== null ? p2Field[p2SelectedIndex] : null;

  // メッセージウィンドウのテキスト（フェーズごとに切替）
  let displayMessage;
  if (
    turnPhase === PHASE_EXEC_FIRST ||
    turnPhase === PHASE_EXEC_SECOND ||
    turnPhase === PHASE_REPLACE_P1 ||
    turnPhase === PHASE_TEST_END
  ) {
    displayMessage = message;
  } else if (turnPhase === PHASE_SELECT_P1) {
    displayMessage = "P1の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SELECT_P2) {
    displayMessage = "P2の ターン！ こうげきする ポケモンを えらんでね！";
  } else if (turnPhase === PHASE_SPEED_RESULT && turnOrder) {
    const firstPokemon =
      turnOrder.first === "P1" ? p1Selected : p2Selected;
    if (turnOrder.isTie) {
      displayMessage = `すばやさが おなじ(▲${p1Selected?.spd})！ ランダムで せんこうは ${turnOrder.first} の ${firstPokemon?.name} に きまった！`;
    } else {
      displayMessage = `P1(▲${p1Selected?.spd}) vs P2(▲${p2Selected?.spd})！ せんこうは ${turnOrder.first} の ${firstPokemon?.name}！`;
    }
  } else {
    displayMessage = "";
  }

  // コマンドパネルで表示するチーム（P1ターンなら p1、P2ターンなら p2）
  const activeTeam = turnPhase === PHASE_SELECT_P1 ? p1Field : p2Field;
  const isP1Turn = turnPhase === PHASE_SELECT_P1;

  return (
    <div className="battle-screen">
      {/* ① ヘッダーバー */}
      <header className="battle-header">
        <span className="battle-turn">TURN 1/6</span>
        <div className="battle-header-right">
          <span className="battle-score">P1 0 - 0 P2</span>
          <span className="battle-bench-count" title="P1の控え残数">
            P1ひかえ: {p1Bench.length}
          </span>
          <button className="battle-reset-hp" onClick={resetAll} title="テスト用：全HP回復して最初からやり直す">
            HPリセット
          </button>
          <button className="battle-back" onClick={onBack}>
            もどる
          </button>
        </div>
      </header>

      {/* ② バトルフィールド（P2 上段 / P1 下段） */}
      <section className="battle-field">
        {/* 上段：相手（P2） */}
        <div className="battle-row battle-row-p2">
          {p2Field.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className={`battle-card ${
                turnPhase === PHASE_SPEED_RESULT && i === p2SelectedIndex
                  ? "battle-card-selected battle-card-selected-p2"
                  : ""
              }`}
            >
              <div className="battle-status">
                <span className="battle-name">{p.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{
                      width: `${Math.round((p.currentHp / p.maxHp) * 100)}%`,
                      background: hpBarColor(p),
                    }}
                  />
                </div>
              </div>
              {/* 疲労状態：立ち絵コンテナ（position:relative）の左上に 💦 マークをオーバーレイ表示（Step 2-3c） */}
              <div className="battle-sprite-wrap">
                <img
                  className={`pixel-img battle-sprite battle-sprite-front ${
                    p.isFainted
                      ? "battle-sprite-fainted"
                      : p.fatigueTurns > 0
                      ? "battle-sprite-fatigued"
                      : ""
                  }`}
                  src={p.sprites.front}
                  alt={p.name}
                />
                {p.fatigueTurns > 0 && !p.isFainted && (
                  <span
                    className="battle-fatigue-badge"
                    title={`疲労中（あと${p.fatigueTurns}ターン）`}
                  >
                    💦{p.fatigueTurns}
                  </span>
                )}
              </div>
              {/* すばやさ判定結果バッジ：先攻「1st せんこう」/ 後攻「2nd こうこう」 */}
              {turnPhase === PHASE_SPEED_RESULT && i === p2SelectedIndex && (
                <span
                  className={`battle-order-badge ${
                    turnOrder.first === "P2"
                      ? "battle-order-badge-first"
                      : "battle-order-badge-second"
                  }`}
                >
                  {turnOrder.first === "P2" ? "1st せんこう" : "2nd こうこう"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 中央：対戦の距離感（うっすら中央線） */}
        <div className="battle-center" aria-hidden="true" />

        {/* 下段：自分（P1） */}
        <div className="battle-row battle-row-p1">
          {p1Field.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className={`battle-card ${
                turnPhase === PHASE_SPEED_RESULT && i === p1SelectedIndex
                  ? "battle-card-selected battle-card-selected-p1"
                  : ""
              }`}
            >
              {/* 疲労状態：立ち絵コンテナ（position:relative）の左上に 💦 マークをオーバーレイ表示（Step 2-3c） */}
              <div className="battle-sprite-wrap">
                <img
                  className={`pixel-img battle-sprite battle-sprite-back ${
                    p.isFainted
                      ? "battle-sprite-fainted"
                      : p.fatigueTurns > 0
                      ? "battle-sprite-fatigued"
                      : ""
                  }`}
                  src={p.sprites.back}
                  alt={p.name}
                />
                {p.fatigueTurns > 0 && !p.isFainted && (
                  <span
                    className="battle-fatigue-badge"
                    title={`疲労中（あと${p.fatigueTurns}ターン）`}
                  >
                    💦{p.fatigueTurns}
                  </span>
                )}
              </div>
              <div className="battle-status">
                <span className="battle-name">{p.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{
                      width: `${Math.round((p.currentHp / p.maxHp) * 100)}%`,
                      background: hpBarColor(p),
                    }}
                  />
                </div>
                <span className="battle-hp">
                  {p.currentHp}/{p.maxHp}
                </span>
              </div>
              {/* すばやさ判定結果バッジ：先攻「1st せんこう」/ 後攻「2nd こうこう」 */}
              {turnPhase === PHASE_SPEED_RESULT && i === p1SelectedIndex && (
                <span
                  className={`battle-order-badge ${
                    turnOrder.first === "P1"
                      ? "battle-order-badge-first"
                      : "battle-order-badge-second"
                  }`}
                >
                  {turnOrder.first === "P1" ? "1st せんこう" : "2nd こうこう"}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ③ メッセージウィンドウ */}
      <div className="battle-message">
        <p>{displayMessage}</p>
      </div>

      {/* ④ コマンド・選択パネル（目隠し画面中は非表示） */}
      {turnPhase !== PHASE_HANDOVER_TO_P2 && (
        <section
          className={`battle-commands ${
            isP1Turn
              ? "battle-commands-p1"
              : turnPhase === PHASE_SELECT_P2
              ? "battle-commands-p2"
              : ""
          }`}
        >
          {isP1Turn || turnPhase === PHASE_SELECT_P2 ? (
            <>
              <div className="battle-command-label">
                <span
                  className={`battle-command-player ${
                    isP1Turn
                      ? "battle-command-player-p1"
                      : "battle-command-player-p2"
                  }`}
                >
                  {isP1Turn ? "P1" : "P2"}
                </span>
                <span className="battle-command-label-text">の えらび</span>
              </div>
              <div className="battle-command-grid">
                {activeTeam.map((p, i) => (
                  <button
                    key={`${p.id}-${i}`}
                    className="battle-command"
                    disabled={p.isFainted || p.fatigueTurns > 0}
                    onClick={() => (isP1Turn ? selectP1(i) : selectP2(i))}
                    aria-label={`${p.name} を選択`}
                  >
                    <span className="battle-command-name">{p.name}</span>
                    {p.isFainted ? (
                      <span className="battle-command-fainted">ひんし</span>
                    ) : p.fatigueTurns > 0 ? (
                      <span className="battle-command-fatigued">
                        💦 ひろう（あと{p.fatigueTurns}ターン）
                      </span>
                    ) : null}
                    <span className="battle-command-move">{p.moveName}</span>
                    <span
                      className="battle-command-speed"
                      aria-label={`すばやさ${p.spd}段階`}
                    >
                      {"▲".repeat(p.spd)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : turnPhase === PHASE_TEST_END ? (
            <button className="battle-reset" onClick={resetAll}>
              もういちど えらぶ（HPリセット）
            </button>
          ) : turnPhase === PHASE_SPEED_RESULT ? (
            <button className="battle-reset" onClick={resetSelection}>
              もういちど えらぶ（リセット）
            </button>
          ) : (
            <p className="battle-commands-waiting">……</p>
          )}
        </section>
      )}

      {/* ⑤ 目隠し（手渡し）オーバーレイ：P1の選択を隠してP2へ */}
      {turnPhase === PHASE_HANDOVER_TO_P2 && (
        <div className="battle-handover">
          <div className="battle-handover-window">
            <div className="battle-handover-title">P2に スマホを わたしてね！</div>
            <p className="battle-handover-sub">P1の せんたくは かくされているよ</p>
            <button
              className="battle-handover-btn"
              onClick={() => setTurnPhase(PHASE_SELECT_P2)}
            >
              P2 じゅんび OK！
            </button>
          </div>
        </div>
      )}

      {/* ⑥ P1控え選択モーダル（Step 2-4a-2） */}
      <BenchSelectModal
        isOpen={turnPhase === PHASE_REPLACE_P1}
        playerLabel="P1"
        benchPokemons={p1Bench}
        onSelect={handleSelectP1Bench}
      />
    </div>
  );
}
