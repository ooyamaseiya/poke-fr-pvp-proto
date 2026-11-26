# 指示書：Step 2-4a-1 控え選択モーダルUI（独立コンポーネント）の作成

あなたはレトロゲーム（ゲームボーイカラー・ポケットモンスター金銀世代）のUI/UXデザイナー兼フロントエンドエンジニアです。
戦闘不能時の交代処理に備えて、まずは**控えポケモンを選択するためのモーダルUIコンポーネント（`BenchSelectModal`）だけを新規作成**してください。

## 0. 最重要ルール（スコープ厳守・既存ファイル編集禁止）

エージェントの作業範囲を最小限に保つため、以下のルールを厳守してください。

- **既存ファイルの変更は禁止：** `App.jsx`、`BattleScreen.jsx`、`BattleScreen.css` など、すでにあるファイルは**一切編集しないでください**。
- **バトルロジックの実装は禁止：** 交代のState更新、戦闘不能判定、目隠し画面との連携は、次のステップで行います。今回は**「受け取った配列を金銀風に表示し、タップされたらコールバックを呼ぶだけの見た目コンポーネント」**のみを作成してください。

## 1. 作成するファイル

既存のプロジェクト構成（`src/` 直下または `src/components/`）に合わせて、以下の2ファイル（CSSを分ける場合）を新規作成してください。
※プロジェクトがTypeScript（`.tsx`）の場合は拡張子を `.tsx` にして適切な型定義を付けてください。

1. `src/BenchSelectModal.jsx`（または `src/components/BenchSelectModal.jsx`）
2. `src/BenchSelectModal.css`（または `src/components/BenchSelectModal.css`）

## 2. コンポーネントのインターフェース（Props仕様）

`BenchSelectModal` は以下のPropsを受け取る純粋なUIコンポーネントとして実装してください。

```javascript
// Propsの仕様
{
  (isOpen, // boolean: false の場合は null を返して非表示にする
    playerLabel, // string: "P1" または "P2"
    benchPokemons, // Array: 控えポケモンの配列（各要素は id, name, maxHp, spd, moveName, sprites: { front } を持つ）
    onSelect); // function: (index) => void  選ばれた控えポケモンの配列インデックスを親へ通知する
}
```

## 3. UI・デザイン要件（金銀風・スマホ縦画面最適化）

- **オーバーレイ（背景）：**
  - 画面全体を覆う固定レイヤー（`position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); z-index: 100;`）。
  - Flexboxで中央にモーダル本体を配置する。
- **モーダル本体（金銀風ウィンドウ）：**
  - 幅はスマホ画面に収まるサイズ（`width: 90%; max-width: 380px;`）。
  - 背景 `#F8F8F8`、文字・枠線 `#181818`、フォントは `DotGothic16`。
  - 太めの黒枠（`border: 4px solid #181818;`）＋内側の影で金銀風の二重枠を再現する。
- **ヘッダーエリア：**
  - `playerLabel` に応じてアクセントカラーを切り替える（`"P1"` なら青 `#2860D8`、`"P2"` なら赤 `#D82828`）。
  - 見出し：`[playerLabel] の こうたい`
  - サブテキスト：`つぎに だす ポケモンを えらんでね！`
- **控えポケモン選択リスト（最大3体表示）：**
  - `benchPokemons` を縦並びの大きなタップボタン（`<button type="button">`）として一覧表示する。
  - 各ボタン内に以下を横並びでコンパクトに表示する：
    1. 左側：立ち絵（`pokemon.sprites.front` / サイズ `48px × 48px` 程度 / **`image-rendering: pixelated;`** 必須）
    2. 中央：ポケモン名 ＋ 技名（小さめ文字）
    3. 右側：`HP {pokemon.maxHp}` と すばやさ段階（例：`▲▲▲` のように `spd` の数だけ `▲` を表示）
  - ボタン押下時に `onSelect(index)` を実行する。
  - ホバー／アクティブ時に枠色や背景が少し変わるフィードバックをつける。
- **空配列時のフォールバック：**
  - `benchPokemons` が空（または未定義）の場合は、`ひかえの ポケモンが いません` と表示する。

## 4. 実行・完了手順

1. `BenchSelectModal` のコンポーネントファイルとCSSファイルを作成する。
2. 既存ファイル（`BattleScreen.jsx` 等）が変更されていないことを確認する。
3. 構文エラーやビルドエラーがないか（`npm run build` 等で）確認し、問題なければ即座に完了報告を行う。
