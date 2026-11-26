export default function TitleScreen({ onStart }) {
  return (
    <div className="window">
      <div className="window-title">POKE BATTLE</div>
      <p className="window-subtitle">
        2人で1つのスマホ、
        <br />
        1戦！
      </p>
      <button className="btn btn-primary" onClick={onStart}>
        バトル スタート
      </button>
    </div>
  );
}
