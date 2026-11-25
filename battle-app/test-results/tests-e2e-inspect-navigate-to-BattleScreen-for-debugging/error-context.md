# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/inspect.spec.ts >> navigate to BattleScreen for debugging
- Location: tests/e2e/inspect.spec.ts:7:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * このテストは BattleScreen コンポーネントに直接到達するための
  5  |  * デバッグ用ショートカットです。
  6  |  */
  7  | test('navigate to BattleScreen for debugging', async ({ page }) => {
  8  |   // 1. アプリケーションの起動（ベースURLへ遷移）
> 9  |   await page.goto('/');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  10 | 
  11 |   // --- P1 (Player 1) の設定プロセス ---
  12 |   // タイトル画面 -> Entry Screen (P1) へ進むためのボタンをクリック
  13 |   const startBtn = page.getByRole('button', { name: 'バトル スタート' });
  14 |   await expect(startBtn).toBeVisible();
  15 |   await startBtn.click();
  16 | 
  17 |   // P1のチームをランダムで6体選ぶ
  18 |   const randomizeP1Btn = page.getByRole('button', { name: 'ランダムで6たい えらぶ' });
  19 |   await expect(randomizeP1Btn).toBeVisible();
  20 |   await randomizeP1Btn.click();
  21 | 
  22 |   // チーム決定ボタンが有効になるのを待ってクリック
  23 |   const confirmP1Btn = page.getByRole('button', { name: 'これで けってい！' });
  24 |   await expect(confirmP1Btn).toBeEnabled();
  25 |   await confirmP1Btn.click();
  26 | 
  27 |   // --- ハンドオーバー画面 (Handover Screen) ---
  28 |   // P2へスマホを渡す案内が出るのを待って「次へ」をクリック
  29 |   const nextBtn = page.getByRole('button', { name: '次へ' });
  30 |   await expect(nextBtn).toBeVisible();
  31 |   await nextBtn.click();
  32 | 
  33 |   // --- P2 (Player 2) の設定プロセス ---
  34 |   // P2のチームをランダムで6体選ぶ
  35 |   const randomizeP2Btn = page.getByRole('button', { name: 'ランダムで6たい えらぶ' });
  36 |   await expect(randomizeP2Btn).toBeVisible();
  37 |   await randomizeP2Btn.click();
  38 | 
  39 |   // チーム決定ボタンが有効になるのを待ってクリック
  40 |   const confirmP2Btn = page.getByRole('button', { name: 'これで けってい！' });
  41 |   await expect(confirmP2Btn).toBeEnabled();
  42 |   await confirmP2Btn.click();
  43 | 
  44 |   // --- バトル準備完了画面 (Battle Summary) ---
  45 |   // 「バトル 開始！」ボタンをクリックして実際のバトルへ進む
  46 |   const battleStartBtn = page.getByRole('button', { name: 'バトル 開始！' });
  47 |   await expect(battleStartBtn).toBeVisible();
  48 |   await battleStartBtn.click();
  49 | 
  50 |   // --- BattleScreen に到達 ---
  51 |   console.log('Reached Battle Screen!');
  52 | });
  53 | 
```