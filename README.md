# BELL v26-stable

카드 획득과 벨 행동이 `INVALID_ACTION`으로 막히는 문제를 수정한 버전입니다.

## 핵심 수정

- `takeOpenCard()`를 정상 작동하던 v24 원본으로 완전 복원
- `drawDeckCard()`를 정상 작동하던 v24 원본으로 완전 복원
- Firebase `lastAction`에 카드 객체를 저장하지 않음
- 카드 이동 애니메이션은 이전/현재 손패 차이로 카드 정보를 계산
- 오픈 카드·더미·벨 중복 클릭 방지
- 요청 처리 중 세 행동 버튼 임시 잠금
- 처리 완료 후 실시간 방 상태에 따라 버튼 자동 복구
- 기존 v25 기능 유지:
  - 3/5라운드
  - 승점제
  - 잘못 벨 -2
  - 나가기 확인
  - 이탈 플레이어 턴 스킵
  - 내 차례 효과음
  - 카드 이동 연출
  - 카드 쓱 효과음
  - BGM ON/OFF
  - 마지막 5초 효과음
  - 결과 카드 색상+숫자

## 적용

```powershell
git add .
git commit -m "v26 카드 행동 로직 안정화"
git push
```

서비스 워커 캐시:
`bell-game-v26-stable-actions`
