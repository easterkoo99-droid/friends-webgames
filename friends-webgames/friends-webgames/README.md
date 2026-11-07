# 친구들과 웹게임 (블라인드 마켓 · 스파이폴)

Node.js + Express + Socket.IO로 만든 실시간 멀티플레이 웹게임 모음입니다.
방 상태는 서버 메모리에만 저장되므로 DB 없이 바로 배포할 수 있어요.

```
friends-webgames/
├─ server.js              서버 진입점 (정적 파일 + Socket.IO)
├─ games/
│  ├─ blindmarket.js      블라인드 마켓 서버 로직
│  ├─ spyfall.js          스파이폴 서버 로직
│  └─ util.js             공용 유틸
├─ public/
│  ├─ index.html          게임 선택 화면
│  ├─ blindmarket.html    블라인드 마켓 화면
│  └─ spyfall.html        스파이폴 화면
├─ package.json
├─ render.yaml            Render 블루프린트 (선택)
└─ .gitignore
```

## 1. 내 컴퓨터에서 실행

```bash
npm install
npm start
# http://localhost:3000
```

같은 와이파이의 다른 기기에서는 `http://내컴퓨터IP:3000` 으로 접속하면 돼요.

## 2. GitHub에 올리기

1. GitHub에서 **New repository** 로 빈 저장소를 만듭니다. (예: `friends-webgames`)
2. 이 폴더의 파일 전체를 올립니다. (`node_modules`는 제외)
   - 터미널: `git init && git add . && git commit -m "first commit" && git branch -M main && git remote add origin <저장소 주소> && git push -u origin main`
   - 터미널이 어렵다면 저장소 페이지의 **Add file → Upload files** 에 폴더 안 파일들을 드래그해도 돼요.
   - `package.json`, `server.js`가 저장소 **맨 위 경로**에 있어야 해요.

## 3. Render에 배포하기

1. [render.com](https://render.com) 에서 GitHub 계정으로 로그인합니다.
2. **New → Web Service** → 방금 만든 저장소를 연결합니다.
3. 설정값
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: `Free`
4. **Create Web Service** 를 누르면 몇 분 뒤 `https://이름.onrender.com` 주소가 생겨요.
   (`render.yaml`을 같이 올렸다면 **New → Blueprint** 로 위 설정을 자동 적용할 수도 있어요.)
5. 이후에는 GitHub에 `git push` 할 때마다 자동으로 다시 배포됩니다.

## 알아두기

- **무료 플랜은 15분 동안 접속이 없으면 서버가 잠들어요.** 다시 열면 첫 접속에 30~60초가 걸립니다. 약속 시간 전에 한 번 열어 두세요.
- 서버가 재시작/재배포되면 진행 중이던 방은 모두 사라져요. (메모리 저장)
- 새로고침이나 일시적인 끊김은 `localStorage`의 토큰(`bm_token`/`bm_room`, `spy_token`/`spy_room`)으로 같은 자리로 복귀합니다.
- 초대 링크: 블라인드 마켓 `/blindmarket.html?bm_room=코드`, 스파이폴 `/spyfall.html?spy_room=코드`

## 밸런스 조정

`games/blindmarket.js` 맨 위 `CFG`에서 시작 자금, 라운드 수, 입찰 시간 등을, `games/spyfall.js`의 `CFG`와 `LOCATIONS`에서 인원/시간/장소 목록을 바꿀 수 있어요.
