// マスターデータ（テスト用）
// 既存アセットが 0383(グラードン) / 0483(ディアルガ) のみのため、
// 指示通り両者の画像を流用して最低6〜10体分のテストデータを用意する。
// 将来、実際のポケモンデータが揃ったらこちらを差し替える。

export const POKEMON_MASTER = [
  {
    id: "0383",
    name: "グラードン",
    type: "じめん",
    maxHp: 180,
    atk: 110,
    def: 95,
    spd: 3, // すばやすさ段階（1〜5：フレンダの矢印数）
    moveName: "だんがいのつるぎ",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "0483",
    name: "ディアルガ",
    type: "ひんしゅう",
    maxHp: 180,
    atk: 110,
    def: 100,
    spd: 5,
    moveName: "ダイアウール",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png",
    },
  },
  {
    id: "T001",
    name: "テストポケモン1",
    type: "いけい",
    maxHp: 120,
    atk: 90,
    def: 70,
    spd: 2,
    moveName: "イワヤブ",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "T002",
    name: "テストポケモン2",
    type: "むす",
    maxHp: 100,
    atk: 120,
    def: 55,
    spd: 4,
    moveName: "かまあき",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png",
    },
  },
  {
    id: "T003",
    name: "テストポケモン3",
    type: "ほし",
    maxHp: 150,
    atk: 70,
    def: 100,
    spd: 1,
    moveName: "にわあひ",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "T004",
    name: "テストポケモン4",
    type: "いち",
    maxHp: 80,
    atk: 130,
    def: 40,
    spd: 5,
    moveName: "ふぶき",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png",
    },
  },
  {
    id: "T005",
    name: "テストポケモン5",
    type: "ぞく",
    maxHp: 160,
    atk: 85,
    def: 110,
    spd: 2,
    moveName: "かべおろし",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "T006",
    name: "テストポケモン6",
    type: "かた",
    maxHp: 90,
    atk: 100,
    def: 60,
    spd: 3,
    moveName: "でんげきつは",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png",
    },
  },
  {
    id: "T007",
    name: "テストポケモン7",
    type: "ほえん",
    maxHp: 110,
    atk: 95,
    def: 80,
    spd: 3,
    moveName: "おはるはな",
    sprites: {
      front: "/assets/0383_front.png",
      back: "/assets/0383_back.png",
    },
  },
  {
    id: "T008",
    name: "テストポケモン8",
    type: "いけい",
    maxHp: 140,
    atk: 75,
    def: 90,
    spd: 4,
    moveName: "かまのつな",
    sprites: {
      front: "/assets/0483_front.png",
      back: "/assets/0483_back.png",
    },
  },
];

export const TEAM_SIZE = 6;
export const LEAD_COUNT = 3;
