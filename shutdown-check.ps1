Start-Sleep -Seconds 5
shutdown.exe /s /f /t 0
Start-Sleep -Seconds 15
if (Test-Connection -ComputerName $env:COMPUTERNAME -Count 1 -Quiet -ErrorAction SilentlyContinue) {
  shutdown.exe /s /f /t 0
}
