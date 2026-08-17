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
├── claude-usage-bar/
│   ├── claude_usage_bar.py                 # Claude 用量選單列小工具原始碼
│   ├── com.paul.claudeusagebar.plist       # 對應的 launchd 設定
│   └── com.aston.claude-keepalive.plist    # 每日保鮮 Claude 登入 session 的排程
└── docs/
    ├── dailyexe-troubleshooting.md         # dailyEXE 排錯完整記錄
    ├── live-caption-shortcut-setup.md      # 即時字幕快捷鍵設定教學
    └── claude-usage-bar-setup.md           # ClaudeUsageBar 設定與排錯記錄
```

## launchd/com.aston.dailyexe.plist

`/Users/aston/dailyexe_program/dailyEXE` 的每日自動執行排程,固定於每天
**09:00** 觸發,執行時透過 `caffeinate -i` 防止電腦在執行期間進入睡眠。

執行檔與 log 路徑刻意放在 `~/dailyexe_program/`、`~/Library/Logs/dailyexe/`
而不是 `~/Documents/`,原因見下方 `docs/dailyexe-troubleshooting.md` —— 
macOS 對 launchd 背景行程存取 `~/Documents`/`~/Desktop`/`~/Downloads` 有
靜默的 TCC 拒絕,搬出來是一勞永逸的解法。

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
- 手動啟動與即時測試 dailyEXE 的方式(`kickstart -k`、`tail -f` 等)
- **根本原因**:launchd 背景行程存取 `~/Documents` 被 TCC 靜默拒絕,
  以及用 `env -i` 驗證問題出在 TCC 而非環境變數的技巧
- **永久解法**:把執行檔與 log 路徑搬出 `~/Documents`
- 換新機器時重新建立這套排程的完整步驟指南

## applescript/live-caption-toggle.applescript + docs/live-caption-shortcut-setup.md

透過「自動操作」(Automator)快速操作 + AppleScript 一鍵切換 macOS 即時字
幕(輔助使用 > ライブキャプション)開關,並綁定鍵盤快捷鍵(目前為
`⌥1`)。腳本原始碼存於 `applescript/`,建立步驟、`.workflow` 存放位置
(`~/Library/Services/LiveCaption2.workflow`)與快捷鍵設定方式詳見
`docs/live-caption-shortcut-setup.md`。

## claude-usage-bar/ + docs/claude-usage-bar-setup.md

macOS 選單列小工具,顯示 Claude Code 的 5 小時 / 7 天用量,登入時透過
`com.paul.claudeusagebar.plist` 自動啟動。排錯記錄涵蓋兩個曾經踩到的坑:

- launchd 指定的 python 跟實際裝套件(`rumps`/`requests`)的 python 不是
  同一個(系統 Python vs pyenv),導致啟動即失敗且沒有選單列圖示
- 太久沒開 `claude` CLI 時,Keychain 裡的 OAuth token 會過期,拿過期
  token 打用量 API 會被伺服器當成濫用擋成 `HTTP 429`,而非預期的
  `401`;程式已加上主動偵測過期 + 429 backoff 的防護
- **根本預防**:`com.aston.claude-keepalive.plist` 用 `StartInterval`
  設定成只要電腦醒著,每 4 小時自動執行一次 `claude -p "ping"`,借助
  CLI 內建的 refreshToken 換發機制保持登入 session 新鮮,防止 token
  過期導致 429(不會主動喚醒睡眠中的電腦,醒來後補跑)

詳見 `docs/claude-usage-bar-setup.md`。
