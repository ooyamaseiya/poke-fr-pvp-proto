# 指示書：Step 2-4a-3 P2（プレイヤー2）の控え交代と目隠し画面の追加

あなたはレトロゲーム（ゲームボーイカラー・ポケットモンスター金銀世代）のフロントエンドエンジニアです。
Step 2-4a-2で実装したP1の控え交代ロジックをベースに、**P2（プレイヤー2）の控え交代と、交代前のスマホ受け渡し用目隠し画面**を `BattleScreen` に追加してください。

## 0. 最重要ルール（スコープ厳守）

既存の動作を壊さず確実に完了させるため、以下のルールを厳守してください。

- **変更対象ファイル：** 原則として `BattleScreen.jsx`（または `.tsx`）のみを編集してください（スタイル微調整が必要な場合のみ `BattleScreen.css` への追記を許可）。`App.jsx` や `BenchSelectModal` は**編集禁止**です。
- **既存ロジックの維持：** すばやさ判定・ダメージ計算・2ターン疲労（`💦`）・P1の交代ロジックは書き直さず、最小限の追記でP2対応を組み込んでください。
- **未実装機能の禁止：** 6ターン制限・正式な勝敗判定・リザルト画面・斬撃エフェクトは**まだ実装しないでください**（次のステップで実装します）。

## 1. 追加するStateとフェーズ（`BattleScreen.jsx`）

1. **P2の控えStateを追加：**
   - Part 1から受け取っている `p2Team` の後半3体を使って、`p2Bench` Stateを初期化する。
   - 例：`const [p2Bench, setP2Bench] = useState(() => (p2Team || []).slice(3, 6));`
2. **`turnPhase` に2つのフェーズを追加：**
   - `'HANDOVER_REPLACE_P2'`：P2が交代を選ぶ前の目隠し画面（「P2にスマホを渡してね！」）
   - `'REPLACE_P2'`：P2が `BenchSelectModal` で控えを選ぶフェーズ

## 2. P2交代チェックの差し込みルール

P1の交代と同じ判定を、以下の**2つのタイミング**で実行してください（重複を避けるため、ヘルパー関数 `proceedAfterP1Replace(latestP2Field, latestP2Bench)` のようにまとめると安全です）。

- **タイミング①：** 攻撃終了後のチェックで、P1の交代が不要だったとき
  - ※ReactのState更新遅延によるバグを防ぐため、必ず攻撃計算直後の最新配列（`updatedP2Field`）と `p2Bench` を渡して判定すること。
- **タイミング②：** `handleSelectP1Bench` でP1の交代がすべて完了したとき
  - ※このタイミングでは現在の `p2Field` と `p2Bench` を使って判定する。

### 分岐ロジック

- 最新の `p2Field` に `isFainted === true` のポケモンが1体以上おり、**かつ** `p2Bench.length > 0` の場合：
  - `turnPhase` を **`'HANDOVER_REPLACE_P2'`** にセットする（いきなりモーダルを出さず、まず目隠し画面を挟む）。
- 上記に当てはまらない場合：
  - これまで通り選択状態をリセットし、次のターン（`'SELECT_P1'`、または全滅時のテスト終了）へ進む。

## 3. 交代用目隠し画面（`'HANDOVER_REPLACE_P2'`）の実装

既存の `HANDOVER_TO_P2`（攻撃選択前の目隠し画面）と同じレトロウィンドウの見た目・CSSクラスを流用して表示してください。

- **表示内容：**
  - タイトル：`P2に スマホを わたしてね！`
  - 補足テキスト：`P2の ポケモンが たおれたよ！ ひかえから えらんでね`
  - 決定ボタン：`P2 こうたい じゅんび OK！`（P2カラーの赤 `#D82828` をアクセントに使用）
- **ボタン押下時：**
  - `turnPhase` を `'REPLACE_P2'` へ切り替える。
  - メッセージを `P2の ポケモンが たおれた！ つぎに だす ポケモンを えらんでね！` に更新する。

## 4. `BenchSelectModal` のP2対応と `handleSelectP2Bench`

既存のP1用 `BenchSelectModal` はそのまま残し、並べてP2用の `BenchSelectModal` を配置してください（P1側のコードを触らないため安全です）。

```jsx
<BenchSelectModal
  isOpen={turnPhase === "REPLACE_P2"}
  playerLabel="P2"
  benchPokemons={p2Bench}
  onSelect={handleSelectP2Bench}
/>
```

### `handleSelectP2Bench(benchIndex)` の実装手順

P1の `handleSelectP1Bench` と同じ手順で実装する。

1. **交代先スロットの特定：**
   - 現在の `p2Field` から、最初に見つかった `isFainted === true` のインデックス（`faintedIndex`）を探す。見つからなければ何もしない。
2. **フィールドの入れ替え：**
   - `p2Bench[benchIndex]` を元に、元気な状態のバトル用ポケモンオブジェクトを作成する（`currentHp: maxHp`, `isFainted: false`, `fatigueTurns: 0`）。
   - `p2Field` のコピーの `faintedIndex` 位置を上書きした `nextP2Field` を作る。
3. **控えリストからの削除：**
   - `p2Bench` から `benchIndex` 番目の要素を取り除いた `nextP2Bench` を作る。
4. **State更新とメッセージ表示：**
   - `setP2Field(nextP2Field)`、`setP2Bench(nextP2Bench)` を実行する。
   - メッセージを `P2 は [選んだポケモン名] を くりだした！` に更新する。
5. **複数体同時ダウンの継続判定：**
   - `nextP2Field` にまだ `isFainted === true` の枠が残っており、**かつ** `nextP2Bench.length > 0` の場合：
     - `turnPhase` は **`'REPLACE_P2'` のまま**にする（2体目の交代時は目隠し画面を挟まず連続で選べるようにする）。
   - それ以外（P2の交代がすべて完了した）場合：
     - 選択状態（`p1SelectedIndex`, `p2SelectedIndex`, `turnOrder` 等）をリセットし、`turnPhase` を `'SELECT_P1'` へ戻して次のターンを開始する。

## 5. リセットボタン連動と確認用表示

- **リセットボタンの連動：** 既存のテスト用リセットボタン押下時に、`p2Bench` も `(p2Team || []).slice(3, 6)` の初期状態に戻すこと。
- **控え残数の表示（任意）：** P1の控え残数表示がある場合は、合わせて `P2ひかえ: {p2Bench.length}` も表示する。

## 6. 実行・確認手順

1. `BattleScreen.jsx` を最小限の差分で更新する。
2. ビルド・起動し、以下の4点を確認して即座に完了報告を行うこと。
   - P2のポケモンだけが倒れたターン終了時、`HANDOVER_REPLACE_P2`（目隠し画面）が表示され、ボタンを押すとP2用の `BenchSelectModal` が開くこと。
   - P1とP2の両方が同じターンに倒れた場合、P1の交代完了後に自動で `HANDOVER_REPLACE_P2` へ移り、続けてP2の交代ができること。
   - P2のポケモンが2体同時に倒れた場合、目隠し画面を1回だけ挟んだあと、モーダルで連続2回交代できること。
   - 交代完了後、エラーなく次のターン（`SELECT_P1`）へ進めること。
