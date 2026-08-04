# BELL 카드게임 Stage 9 — PWA 및 배포 편의

## 추가된 기능

- 휴대폰 홈 화면 설치
- 앱 아이콘 192×192 / 512×512
- 앱처럼 standalone 실행
- 기본 화면 파일 캐시
- 새 버전 감지 알림
- 배포용 `publish.ps1`
- 인증 사용자 전용 Firebase 규칙 예시

## 적용 방법

압축 안의 모든 파일을 기존 `BELL-GAME` 폴더에 덮어씁니다.

추가되는 파일:

- `manifest.webmanifest`
- `sw.js`
- `assets/icon-192.png`
- `assets/icon-512.png`
- `publish.ps1`
- `database.rules.production.json`

## GitHub 업데이트

```powershell
git add .
git commit -m "PWA 설치 기능 추가"
git push
```

또는:

```powershell
.\publish.ps1 -Message "PWA 설치 기능 추가"
```

## 휴대폰 설치

- Android Chrome: `홈 화면에 설치` 버튼 또는 브라우저 메뉴의 `앱 설치`
- iPhone Safari: 공유 버튼 → `홈 화면에 추가`

## 중요

실시간 멀티플레이는 Firebase 연결이 필요합니다. 오프라인 캐시는 메인 화면과 디자인 파일을 보관하는 용도입니다.

`database.rules.production.json`은 인증 사용자만 접근하도록 제한하는 기본 예시입니다.
현재 구조는 친구끼리 즐기는 버전이며 개발자 도구를 이용한 적극적인 부정행위까지 완전히 차단하는 서버 권한 구조는 아닙니다.
