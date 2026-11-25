import { test, expect } from '@playwright/test';

/**
 * このテストは BattleScreen コンポーネントに直接到達するための
 * デバッグ用ショートカットです。
 */
test('navigate to BattleScreen for debugging', async ({ page }) => {
  // 1. アプリケーションの起動（ベースURLへ遷移）
  await page.goto('/');

  // --- P1 (Player 1) の設定プロセス ---
  // タイトル画面 -> Entry Screen (P1) へ進むためのボタンをクリック
  const startBtn = page.getByRole('button', { name: 'バトル スタート' });
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // P1のチームをランダムで6体選ぶ
  const randomizeP1Btn = page.getByRole('button', { name: 'ランダムで6たい えらぶ' });
  await expect(randomizeP1Btn).toBeVisible();
  await randomizeP1Btn.click();

  // チーム決定ボタンが有効になるのを待ってクリック
  const confirmP1Btn = page.getByRole('button', { name: 'これで けってい！' });
  await expect(confirmP1Btn).toBeEnabled();
  await confirmP1Btn.click();

  // --- ハンドオーバー画面 (Handover Screen) ---
  // P2へスマホを渡す案内が出るのを待って「次へ」をクリック
  const nextBtn = page.getByRole('button', { name: '次へ' });
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();

  // --- P2 (Player 2) の設定プロセス ---
  // P2のチームをランダムで6体選ぶ
  const randomizeP2Btn = page.getByRole('button', { name: 'ランダムで6たい えらぶ' });
  await expect(randomizeP2Btn).toBeVisible();
  await randomizeP2Btn.click();

  // チーム決定ボタンが有効になるのを待ってクリック
  const confirmP2Btn = page.getByRole('button', { name: 'これで けってい！' });
  await expect(confirmP2Btn).toBeEnabled();
  await confirmP2Btn.click();

  // --- バトル準備完了画面 (Battle Summary) ---
  // 「バトル 開始！」ボタンをクリックして実際のバトルへ進む
  const battleStartBtn = page.getByRole('button', { name: 'バトル 開始！' });
  await expect(battleStartBtn).toBeVisible();
  await battleStartBtn.click();

  // --- BattleScreen に到達 ---
  console.log('Reached Battle Screen!');
});
