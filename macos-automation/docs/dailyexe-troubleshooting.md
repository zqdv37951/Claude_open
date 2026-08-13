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

## 手動啟動與測試

若你想在不等到排程時間時立刻測試或手動觸發 dailyEXE，可以用下面步驟：

1) 直接在終端機以相同使用者身分執行可執行檔（可觀察 stdout/err 與回傳碼）：

```bash
/Users/aston/Documents/program/dailyEXE >> /Users/aston/Documents/program/dailyEXE.log 2>> /Users/aston/Documents/program/dailyEXE.err
echo "exit code: $?"
```

- 這會把標準輸出與錯誤輸出分別附加到 log/err 檔案，並印出程序結束碼，方便確認是否與 launchd 執行時的錯誤一致。
- 注意直接在終端執行會使用使用者互動環境（PATH、HOME、環境變數等）。若要模擬 launchd 的環境，請在執行前清理或顯式設定所需的環境變數。

2) 使用 launchctl 直接觸發（啟用已載入的 agent）：

```bash
# 建議先確認 agent 是否已 bootstrap
launchctl list | grep com.aston.dailyexe

# 立即啟動（不改動 plist）：
launchctl kickstart -k gui/$(id -u)/com.aston.dailyexe
# 或嘗試較舊語法：
launchctl start com.aston.dailyexe
```

- `kickstart -k` 會強制重新啟動該 label（如果 already loaded 會 kill 並 restart），適合測試 run 及重現 launchd 執行流程。
- 如果 agent 尚未載入，請先用 `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist` 載入，再用上面指令觸發。

3) 即時觀察 log：

```bash
tail -f /Users/aston/Documents/program/dailyEXE.log /Users/aston/Documents/program/dailyEXE.err
```

4) 檢查 launchctl list 的狀態碼與 PID：

```bash
launchctl list | grep com.aston.dailyexe
# 若有顯示 PID，代表正在執行；若顯示負號和一個狀態碼，表示最後一次執行的 exit status
```

5) 若在 launchd 背景執行時出現與終端執行不同的行為，請注意：
- launchd 的 PATH 與環境可能不同，建議在 plist 中指定絕對路徑或在啟動前由腳本設置必要環境變數。
- 若 binary 因 `com.apple.quarantine` 被隔離，直接在終端執行雙擊會跳出授權對話，但 launchd 無法顯示 UI，需手動移除 quarantine（見上方 xattr 指令）。

## 根本原因確認與永久解法(2026-08-13)

09:00 + 自動喚醒設定後,排程仍然沒有觸發,進一步排查後找到真正原因。

### 根本原因:launchd 背景行程對 ~/Documents 等資料夾的靜默 TCC 拒絕

macOS 對背景行程(由 `launchd` 直接呼叫,而非從 Terminal / Finder 手動執行)
存取 `~/Documents`、`~/Desktop`、`~/Downloads` 有額外的隱私保護
(TCC,Transparency, Consent, and Control),而且**不會跳出授權對話框**,
是靜默拒絕。手動在 Terminal 執行之所以正常,是因為該行程繼承了 Terminal
已經被系統授權的權限 —— 這個繼承關係掩蓋了問題,一開始容易誤判成排程
設定錯誤(對應前面的 exit code 78)。

### 關鍵驗證技巧:用 `env -i` 模擬 launchd 的最小環境

```bash
env -i /usr/bin/caffeinate -i /Users/aston/Documents/program/dailyEXE
```

`env -i` 清空環境變數,模擬 launchd 啟動時的最小環境,但因為執行的行程
仍然是 Terminal 的子行程,所以**騙不過 TCC 權限檢查**(還是能正常存取
`~/Documents`)。這證明問題不是環境變數(PATH/HOME)造成的,而是專屬於
「由 launchd 而非使用者互動 App 啟動」這件事本身觸發的 TCC 限制 ——
是判斷出真正原因的轉折點。

排查過程中也曾懷疑過、但依序排除的方向:

1. 排程時間(9:13 → 9:00)本身有問題 —— 用 `launchctl print` 確認排程
   設定正確,排除。
2. 環境變數(PATH/HOME)造成執行失敗 —— 用 `env -i` 測試排除(見上)。
3. `launchctl list` 顯示的 exit code(如 78/`EX_CONFIG`)是關鍵線索,
   但光看代碼不夠,必須搭配「log 檔案是否真的有更新」一起判斷,才能
   分辨是「程式跑了但失敗」還是「根本沒跑起來」。

### 永久解法:把執行檔與 log 路徑搬出 ~/Documents

```bash
mkdir -p ~/Library/Logs/dailyexe
mkdir -p ~/dailyexe_program
cp /Users/aston/Documents/program/dailyEXE ~/dailyexe_program/
chmod +x ~/dailyexe_program/dailyEXE
```

`~/Library/Logs/`、`~/dailyexe_program/` 這類位置不受 TCC 特別管制,
搬過去後不需要每次系統更新後重新手動授權,是一勞永逸的做法(相對地,
若想保留原本 `~/Documents` 底下的路徑,也可以到「系統設定 > 隱私權與
安全性 > 完整磁碟取用權限」手動加 `/usr/bin/caffeinate`,但這個授權
常常在重新開機或系統更新後失效,不如搬家穩定)。

plist 對應調整為(見 [`../launchd/com.aston.dailyexe.plist`](../launchd/com.aston.dailyexe.plist)):

```xml
<key>ProgramArguments</key>
<array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>/Users/aston/dailyexe_program/dailyEXE</string>
</array>
<key>StandardOutPath</key>
<string>/Users/aston/Library/Logs/dailyexe/dailyEXE.log</string>
<key>StandardErrorPath</key>
<string>/Users/aston/Library/Logs/dailyexe/dailyEXE.err</string>
```

改完後 bootout + bootstrap 重新載入,再用 `kickstart -k` 立刻手動觸發驗證:

```bash
launchctl bootout gui/$(id -u)/com.aston.dailyexe
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
launchctl kickstart -k gui/$(id -u)/com.aston.dailyexe
sleep 30
tail -30 ~/Library/Logs/dailyexe/dailyEXE.log
launchctl list | grep dailyexe
```

### 驗證結果

2026-08-13 10:51 手動觸發測試,log 完整寫入、五個任務(Money Forward、
KENPOS Ticket、taobao 簽到、Tepco 自動登入、巴哈姆特)全部執行完畢,
`launchctl list` 顯示退出碼變成 **`0`**,總耗時約 27 秒,確認搬家後排程
恢復正常。

## 重新建立 dailyEXE 排程指南

若要重新建立這套排程(例如換新機器),照下面順序做可以一次到位,不用
再走一次除錯:

1. **執行檔與 log 路徑,一開始就避開 `Documents`/`Desktop`/`Downloads`**
   —— 放 `~/dailyexe_program/`(或 `/usr/local/var/dailyexe/`),log 放
   `~/Library/Logs/dailyexe/`。這是這次踩到的坑,直接跳過。

2. **寫 plist 時一次把該有的欄位補齊**:`Label`(唯一識別)、
   `ProgramArguments`(`caffeinate -i` + 執行檔路徑)、
   `StartCalendarInterval`(`Hour`/`Minute`)、`StandardOutPath`、
   `StandardErrorPath`。視情況可加 `EnvironmentVariables`
   (`HOME`、完整 `PATH`)防患未然 —— 這次證實不是環境變數問題,但補上
   無害。

3. **放到 `~/Library/LaunchAgents/` 後先用 `plutil` 驗證格式**,避免手動
   編輯打錯字或缺 tag 導致 bootstrap 失敗:

   ```bash
   plutil -lint ~/Library/LaunchAgents/com.aston.dailyexe.plist
   ```

4. **bootstrap 載入**:

   ```bash
   launchctl bootout gui/$(id -u)/com.aston.dailyexe 2>/dev/null
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
   ```

5. **立刻手動觸發一次驗證,不要等到隔天早上才發現問題**:

   ```bash
   launchctl kickstart -k gui/$(id -u)/com.aston.dailyexe
   sleep 30
   tail -30 ~/Library/Logs/dailyexe/dailyEXE.log
   launchctl list | grep dailyexe   # 確認退出碼是 0
   ```

6. **確認 Chrome 自動化權限**:「系統設定 > 隱私權與安全性 > 自動化」,
   檢查 `caffeinate`/`dailyEXE` 對 Google Chrome 的控制權限有沒有被授權
   (即使這次沒踩到,搬新環境時容易重新觸發權限詢問)。

7. **若需要準時喚醒電腦,設定 `pmset`**:

   ```bash
   sudo pmset repeat wakeorpoweron MTWRFSU HH:MM:00
   ```

   時間設在排程時間前 2 分鐘左右,留緩衝讓系統完全清醒。

8. **隔天早上排程時間後,再檢查一次真正自動觸發的結果**:

   ```bash
   cat ~/Library/Logs/dailyexe/dailyEXE.log | tail -5
   launchctl list | grep dailyexe
   ```

   第 5 步的手動測試只能證明「程式本身沒問題」,不能證明「排程真的會
   自動觸發」,兩者都要驗證過才算完整建置好。

## 待確認事項

- [x] `dailyEXE.err` / `dailyEXE.log` 實際內容 —— 已於 2026-08-13 取得,
      確認根本原因是 TCC 對 launchd 背景行程存取 `~/Documents` 的靜默
      拒絕,而非隔離標記
- [ ] `xattr -l` 是否真的列出 `com.apple.quarantine`(根本原因已確認
      為 TCC 權限問題,此項不影響結論,暫不追查)
- [x] 調整為 09:00 + 自動喚醒後,是否穩定觸發 —— 搬出 `~/Documents`
      後 2026-08-13 手動觸發測試通過(退出碼 0),隔天 09:00 自動觸發
      結果待補
