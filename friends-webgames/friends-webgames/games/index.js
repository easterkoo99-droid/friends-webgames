'use strict';
/**
 * 게임 목록. 새 게임을 추가하려면
 *  1) games/내게임.js 를 만들고 (spyfall.js 를 참고)
 *  2) 아래 배열에 한 줄을 더하고
 *  3) public/games/내게임.js 를 만들어 화면을 그려요.
 * 대기실에 게임 카드가 자동으로 나타나요.
 */
module.exports = [
  require('./spyfall'),
  require('./village'),
  require('./letter'),
];
