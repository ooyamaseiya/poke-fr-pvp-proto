import { useEffect } from "react";

// P1とP2のスマホ手渡しの中継画面。
// 数秒後に自動でP2のエントリー画面へ遷移する。
export default function HandoverScreen({ onContinue }) {
  const delayMs = 2500;

  useEffect(() => {
    const timer = setTimeout(() => onContinue(), delayMs);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="window">
      <div className="window-title">手渡し</div>
      <p className="handover-message">
        P2に
        <br />
        スマホを
        <br />
        わたしてね！
      </p>
    </div>
  );
}
