# Web-Shake Showdown

스마트폰의 기울기 센서를 컨트롤러로 사용하는 실시간 WebSocket 게임입니다. React/Vite 프런트엔드와 Express/Socket.IO 백엔드를 한 Node.js 서비스에서 제공합니다.

## 요구 사항

- Node.js 20.19 이상(배포 설정은 Node.js 22.22.2로 고정)
- npm
- 스마트폰 센서 권한을 위한 HTTPS

## 로컬 개발

터미널 1:

```sh
cd backend
npm ci
npm start
```

터미널 2:

```sh
cd frontend
npm ci
npm run dev
```

Vite가 표시한 HTTPS 주소를 호스트 화면에서 엽니다. 백엔드 Socket.IO 요청은 개발 프록시를 통해 `localhost:3001`로 전달됩니다.

## 프로덕션 실행

프런트엔드를 먼저 빌드한 뒤 백엔드를 시작합니다.

```sh
npm ci --prefix frontend
npm run build --prefix frontend
npm ci --omit=dev --prefix backend
npm start --prefix backend
```

백엔드는 `frontend/dist`를 정적 파일로 제공하며 `/join` 같은 클라이언트 라우트는 `index.html`로 폴백합니다. 기본 포트는 `3001`이고, 배포 환경에서는 `PORT`를 사용합니다. 헬스체크는 `/health`입니다.

## Render 배포

루트의 `render.yaml`로 프런트엔드와 Socket.IO 서버를 단일 Web Service에 배포합니다.

1. 변경 사항을 GitHub 원격 저장소에 push합니다.
2. Render 대시보드에서 **New > Blueprint**를 선택합니다.
3. 이 저장소를 연결하고 `render.yaml` Blueprint를 적용합니다.
4. 배포가 끝나면 Render가 발급한 HTTPS URL의 `/`를 PC에서 엽니다.
5. 화면의 QR 코드를 스마트폰으로 스캔하고 센서 권한을 허용합니다.

Render는 WebSocket을 지원하므로 별도 프록시 설정은 필요하지 않습니다. 무료 Web Service는 15분간 요청이 없으면 중지될 수 있어 첫 접속이 느릴 수 있습니다.

## 배포 시 제약

- 방과 플레이어 상태는 백엔드 메모리에 저장됩니다. 인스턴스 재시작이나 재배포 시 진행 중인 방이 사라집니다.
- 여러 인스턴스로 확장하면 같은 방의 사용자가 서로 다른 인스턴스에 연결될 수 있습니다. 현재는 반드시 인스턴스 1개로 운영해야 합니다. 확장이 필요하면 Socket.IO Redis 어댑터와 공유 상태 저장소를 추가해야 합니다.
- `frontend/public/audio/boywithuke-toxic.mp3`를 공개 배포하기 전에 음원 배포 권한을 확인해야 합니다.
- 운영 트래픽이 있다면 무료 인스턴스 대신 상시 실행 플랜을 권장합니다.

## 검증

```sh
npm test --prefix backend
node --test frontend/test/*.test.js
npm run lint --prefix frontend
npm run build --prefix frontend
```
