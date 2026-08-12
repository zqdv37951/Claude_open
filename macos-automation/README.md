# macOS Automation Configs

個人 Mac 上的自動化排程設定與排錯記錄,方便日後查閱、重建或移到新機器時
快速還原設定。

## 資料夾結構

```
macos-automation/
├── README.md
├── launchd/
│   └── com.aston.dailyexe.plist            # dailyEXE 每日排程設定
├── applescript/
│   └── live-caption-toggle.applescript     # 即時字幕切換腳本原始碼
└── docs/
    ├── dailyexe-troubleshooting.md         # dailyEXE 排錯完整記錄
    └── live-caption-shortcut-setup.md      # 即時字幕快捷鍵設定教學
```

## launchd/com.aston.dailyexe.plist

`/Users/aston/Documents/program/dailyEXE` 的每日自動執行排程,固定於每天
**09:00** 觸發,執行時透過 `caffeinate -i` 防止電腦在執行期間進入睡眠。

### 安裝方式

```bash
cp launchd/com.aston.dailyexe.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
launchctl list | grep dailyexe
```

### 修改設定後重新載入

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.dailyexe.plist
```

## docs/dailyexe-troubleshooting.md

完整的排錯過程記錄,涵蓋:

- 如何用 `launchctl list` 判讀排程執行狀態與結束碼
- exit code 78(`EX_CONFIG`)的意義
- macOS Gatekeeper 隔離標記(`com.apple.quarantine`)如何導致背景排程失敗
- 如何判斷電腦是否在排程時間點處於睡眠狀態
- 用 `pmset repeat wakeorpoweron` 設定自動喚醒,確保排程能準時觸發

## applescript/live-caption-toggle.applescript + docs/live-caption-shortcut-setup.md

透過「自動操作」(Automator)快速操作 + AppleScript 一鍵切換 macOS 即時字
幕(輔助使用 > ライブキャプション)開關,並綁定鍵盤快捷鍵(目前為
`⌥1`)。腳本原始碼存於 `applescript/`,建立步驟、`.workflow` 存放位置
(`~/Library/Services/LiveCaption2.workflow`)與快捷鍵設定方式詳見
`docs/live-caption-shortcut-setup.md`。

## 待補充

- `com.paul.claudeusagebar` 選單列小工具的排程設定與排錯記錄(尚在排查中)
