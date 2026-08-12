# dailyEXE launchd 排程排錯記錄

## 背景

`/Users/aston/Documents/program/dailyEXE` 是一個每天早上自動執行的 Mach-O 64-bit
(arm64) 執行檔,原本排定 **09:13** 執行,透過 `launchd` 的
`com.aston.dailyexe.plist` 設定。某天早上自動執行沒有觸發,以下是排查過程與
結論,留存作為之後同類問題的參考。

## 排查步驟

### 1. 確認排程是否被 launchd 載入、上次執行狀態

```bash
launchctl list | grep -i dailyexe
```

輸出格式為:`PID  最後結束狀態碼  Label`

```
- 78 com.aston.dailyexe
```

- `PID` 為 `-`:目前沒有在執行(預期行為,這是一次性排程,不是常駐程式)
- 狀態碼 `78`:對應 Unix `sysexits.h` 裡的 `EX_CONFIG`(設定錯誤),不是隨機
  崩潰,而是明確標示「設定不正確」

### 2. 檢查 plist 內容

```bash
cat ~/Library/LaunchAgents/com.aston.dailyexe.plist
```

確認 `StartCalendarInterval` 的 `Hour` / `Minute`,以及
`StandardOutPath` / `StandardErrorPath` 的 log 檔案位置。

### 3. 檢查 log 檔案

```bash
cat /Users/aston/Documents/program/dailyEXE.err
cat /Users/aston/Documents/program/dailyEXE.log
```

### 4. 檢查檔案本身型態、權限與延伸屬性

```bash
file /Users/aston/Documents/program/dailyEXE
ls -la /Users/aston/Documents/program/dailyEXE
xattr -l /Users/aston/Documents/program/dailyEXE
```

檔名結尾出現 `@` 代表帶有延伸屬性,常見情況是 macOS Gatekeeper 的隔離標記
`com.apple.quarantine`(檔案是從網路下載或非本機編譯來源)。透過 `launchd`
背景執行時沒有 UI 可以手動放行,遇到隔離標記可能直接執行失敗,而不會像
Finder 雙擊那樣跳出確認對話框。

若確認有此標記,移除即可:

```bash
xattr -d com.apple.quarantine /Users/aston/Documents/program/dailyEXE
```

### 5. 確認電腦在排程時間點是否處於睡眠狀態

```bash
pmset -g log | grep "2026-08-12 0[8-9]"
```

`launchd` 的 `StartCalendarInterval` 排程,如果電腦在排定時間當下處於睡眠
狀態,預設不會自動喚醒執行。`caffeinate -i` 只能保證「排程觸發後執行期間不
會睡著」,不能保證「排程觸發當下電腦本身是醒著的」。

## 修正措施

### 1. 調整排程時間為整點 09:00

修改 `~/Library/LaunchAgents/com.aston.dailyexe.plist` 的
`StartCalendarInterval`(見 `launchd/com.aston.dailyexe.plist`),改完後
需要 unload 再重新 load 才會生效:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
launchctl list | grep dailyexe
```

### 2. 設定系統自動喚醒,確保排程觸發時電腦是醒著的

```bash
sudo pmset repeat wakeorpoweron MTWRFSU 08:58:00
```

每天 08:58 自動喚醒電腦(比排程時間早 2 分鐘留緩衝),即使螢幕闔著、處於
睡眠狀態也會被喚醒。

## 待確認事項

- [ ] `dailyEXE.err` / `dailyEXE.log` 實際內容(尚未取得,無法 100% 確認
      exit code 78 的根本原因是隔離標記還是其他設定問題)
- [ ] `xattr -l` 是否真的列出 `com.apple.quarantine`
- [ ] 調整為 09:00 + 自動喚醒後,是否穩定觸發
