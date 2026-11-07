'use strict';
const crypto = require('crypto');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자(0,O,1,I) 제외

function makeCode(existing) {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  } while (existing.has(code));
  return code;
}

const makeToken = () => crypto.randomBytes(18).toString('hex');
const makeId = () => crypto.randomBytes(4).toString('hex');

function cleanName(s) {
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
}

function cleanText(s, max = 200) {
  return String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const randInt = (min, max) => crypto.randomInt(min, max + 1); // min~max 포함
const pick = (arr) => arr[crypto.randomInt(arr.length)];

module.exports = { makeCode, makeToken, makeId, cleanName, cleanText, shuffle, randInt, pick };
