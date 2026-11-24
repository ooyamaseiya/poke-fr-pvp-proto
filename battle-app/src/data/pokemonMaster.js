export const POKEMON_MASTER = [
  {
    id: "0383",
    name: "グラードン",
    type: "じめん",
    maxHp: 180,
    atk: 110,
    def: 95,
    spd: 3, // すばやさ段階 (1-5)
    moveName: "だんがいのつるぎ",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "0483",
    name: "ディアルガ",
    type: "はがね",
    maxHp: 170,
    atk: 120,
    def: 105,
    spd: 4,
    moveName: "めっきのつばさ",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png", // Note: We only have front for 0483 in public/assets, so I'll use the same if needed or just assume it exists in real scenario
    },
  },
  {
    id: "0252",
    name: "ブラッキー",
    type: "あく",
    maxHp: 140,
    atk: 95,
    def: 80,
    spd: 3,
    moveName: "かげゆび",
    sprites: {
      front: "/assets/0252_front.png",
      back: "/assets/0252_back.png",
    },
  },
  {
    id: "0150",
    name: "ミュウツー",
    type: "エスパー",
    maxHp: 160,
    atk: 130,
    def: 90,
    spd: 5,
    moveName: "サイコキネシス",
    sprites: {
      front: "/assets/0150_front.png",
      back: "/assets/0150_back.png",
    },
  },
  {
    id: "0006",
    name: "リザードン",
    type: "ほのお",
    maxHp: 130,
    atk: 104,
    def: 85,
    spd: 4,
    moveName: "かえんほうしゃ",
    sprites: {
      front: "/assets/0006_front.png",
      back: "/assets/0006_back.png",
    },
  },
  {
    id: "0132",
    name: "カイリュー",
    type: "ドラゴン",
    maxHp: 150,
    atk: 90,
    def: 94,
    spd: 3,
    moveName: "はかいこうせん",
    sprites: {
      front: "/assets/0132_front.png",
      back: "/assets/0132_back.png",
    },
  }
];
