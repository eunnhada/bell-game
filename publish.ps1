param(
  [string]$Message = "BELL 게임 업데이트"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "BELL 게임 배포를 시작합니다." -ForegroundColor Yellow
Write-Host ""

git add .
git commit -m $Message

if ($LASTEXITCODE -ne 0) {
  Write-Host "새로 커밋할 변경사항이 없거나 커밋에 실패했습니다." -ForegroundColor DarkYellow
}

git push origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "GitHub 업로드 완료!" -ForegroundColor Green
  Write-Host "잠시 후 GitHub Pages에 자동 반영됩니다."
} else {
  Write-Host ""
  Write-Host "업로드에 실패했습니다. 터미널 오류를 확인하세요." -ForegroundColor Red
}
