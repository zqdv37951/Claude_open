# Claude Usage Bar — 設定與排錯記錄

`~/ClaudeUsageBar/claude_usage_bar.py` 是一個 macOS 選單列小工具,讀取
Claude Code 存在 macOS Keychain(`Claude Code-credentials`)裡的 OAuth
token,呼叫 Anthropic 內部的 `api/oauth/usage` 端點,顯示目前的
5 小時 / 7 天用量。透過 `com.paul.claudeusagebar.plist` 這個 launchd
LaunchAgent 設定成登入時自動啟動。

## 安裝方式

```bash
mkdir -p ~/ClaudeUsageBar
cp claude-usage-bar/claude_usage_bar.py ~/ClaudeUsageBar/
cp claude-usage-bar/com.paul.claudeusagebar.plist ~/Library/LaunchAgents/

# 安裝依賴（用你平常執行 python3 的那個環境，見下方「常見問題 1」）
pip3 install rumps requests

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.paul.claudeusagebar.plist
launchctl list | grep claudeusagebar
```

## 修改設定後重新載入

```bash
launchctl bootout gui/$(id -u)/com.paul.claudeusagebar
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.paul.claudeusagebar.plist
launchctl kickstart -k gui/$(id -u)/com.paul.claudeusagebar
```

## 排錯記錄(2026-08-13)

### 問題:選單列圖示看起來正常,但重開機/登出後就消失

用 `launchctl list | grep claudeusagebar` 檢查,PID 欄位是 `-`、結束碼是
`1`,代表 launchd 管理的那份其實**啟動失敗**;但 `pgrep -fla
claude_usage_bar` 卻看得到一個正在跑的行程。兩者矛盾,代表選單列上看到
的圖示其實是**手動在 Terminal 執行留下來的殘留行程**,不是 launchd 啟
動的。

### 根本原因:plist 指定的 python 跟裝套件的 python 不是同一個

檢查 `.err` log:

```
ModuleNotFoundError: No module named 'rumps'
```

原本 plist 的 `ProgramArguments` 寫的是 `/usr/bin/python3`(macOS 系統
內建 Python),但 `pip3 install rumps requests` 當初是裝在 **pyenv 管理
的 Python**(`~/.pyenv/versions/3.12.0/`)裡。launchd 啟動時用系統
Python,自然找不到 `rumps`,啟動即失敗;手動在 Terminal 執行時因為
shell 已經套用 pyenv 的 PATH,才會正常。

### 修法:plist 改指向 pyenv 的 shim

```bash
sed -i '' 's#/usr/bin/python3#/Users/aston/.pyenv/shims/python3#' \
  ~/Library/LaunchAgents/com.paul.claudeusagebar.plist
```

用 **shim**(`~/.pyenv/shims/python3`)而不是寫死某個版本號的路徑
(`~/.pyenv/versions/3.12.0/bin/python3`),是因為 shim 會依照 pyenv 當下
的版本設定動態解析,以後升級 pyenv 版本不需要再改 plist。

驗證方式:清空 `.err`、`kickstart -k` 重新觸發,`launchctl list` 的 PID
欄位要變成實際數字(不再是 `-`),`.err` 不應該再寫入新的錯誤。

### 問題 2:好一陣子沒開 `claude` CLI 之後會跳出 HTTP 429

一開始誤以為是刷新頻率太高被限流,但實際觀察到的規律是:**只要當天有
正常使用過 `claude` CLI,就不會 429;放著幾天沒開才會 429**,跟刷新頻
率(`POLL_SECONDS = 300`,5 分鐘一次)沒有直接關係。

### 根本原因:accessToken 過期沒有被自動刷新

Keychain 裡 `Claude Code-credentials` 存的 `claudeAiOauth` 物件除了
`accessToken`,還有 `expiresAt`(毫秒 epoch)、`refreshToken`、
`refreshTokenExpiresAt` 等欄位。**Claude Code CLI 本身在使用時會自動
用 refreshToken 換發新的 accessToken**,但這支選單列小工具原本只是單
純讀 `accessToken` 直接拿去打 API,從來不會主動刷新。

太久沒開 `claude` CLI 時,Keychain 裡的 `accessToken` 就會過期。用過
期 token 打 `api/oauth/usage`,伺服器端似乎把「重複用失效憑證打 API」
視為濫用行為,直接回 `429` 擋下來,而不是預期中乾淨的 `401`。

驗證欄位是否存在、格式是否為毫秒:

```bash
security find-generic-password -s "Claude Code-credentials" -w \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['claudeAiOauth']; \
                print({k:v for k,v in d.items() if k not in ('accessToken','refreshToken')})"
```

輸出範例:

```
{'expiresAt': 1786658321749, 'refreshTokenExpiresAt': 1788584253749,
 'scopes': [...], 'subscriptionType': 'pro', 'rateLimitTier': 'default_claude_ai'}
```

### 修法:主動偵測過期 + 429 時 backoff(治本 + 治標)

`claude_usage_bar.py` 目前的版本(見同資料夾)包含兩層防護:

1. **打 API 前先檢查 `expiresAt`**:如果已過期,直接顯示
   「登入 token 已過期,請在 Terminal 打開一次 `claude` 讓它刷新登入」,
   不會拿一個已知會失敗的 token 硬打 API —— 這是治本,直接避免觸發
   429。
2. **萬一還是撞到 429**(例如 `expiresAt` 欄位讀取失敗、或伺服器端其
   他原因限流):讀取回應的 `Retry-After` header(沒有就預設冷卻 15
   分鐘),在冷卻期間跳過自動刷新的計時器,不會繼續每 5 分鐘重複打一
   次已知會被擋的請求 —— 這是治標,避免持續觸發限流保護。

## 根本預防:每天定期保鮮 Claude Code 登入 session

上面「主動偵測過期 + 429 backoff」只是優雅處理過期,並不能真的防止過期。
要從源頭防止,需要定期讓 `claude` CLI 本身跑一次會實際觸發認證的動作,
借助它內建的 refreshToken 換發機制(不重新實作 Anthropic 未公開的
OAuth refresh 端點)。

### 排查過程:確認哪個指令能真正觸發刷新

`claude auth status` 一開始看起來像是專門檢查登入狀態的指令,實測前後
比對 `expiresAt` 完全沒變,證實它**只是讀取顯示,不會刷新**:

```bash
security find-generic-password -s "Claude Code-credentials" -w \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['claudeAiOauth']['expiresAt'])"
claude auth status
security find-generic-password -s "Claude Code-credentials" -w \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['claudeAiOauth']['expiresAt'])"
# 前後兩次數字一樣 → auth status 不會刷新
```

改用真正會發出認證請求的極簡短 print 模式呼叫:

```bash
claude -p "ping" --output-format text
```

這個指令走的是真正需要認證的 API 路徑(拿到 `pong` 回應代表認證成功),
只要當下 token 已經過期,這次呼叫就會觸發刷新;如果 token 還沒過期,則
單純正常回應,不會有任何副作用。耗用量僅一次極短對話,可忽略不計。

### 排程設定

用 `which claude` 找到執行檔絕對路徑(跟前面 python 的坑一樣,`launchd`
不會套用 shell 裡的 PATH):

```bash
which claude
# /Users/aston/.local/bin/claude
```

見 [`../claude-usage-bar/com.aston.claude-keepalive.plist`](../claude-usage-bar/com.aston.claude-keepalive.plist),
用 `StartInterval`(而非 `StartCalendarInterval`)設定成**只要電腦是醒
著的,每 4 小時(14400 秒)執行一次**:

```xml
<key>StartInterval</key>
<integer>14400</integer>
<key>RunAtLoad</key>
<true/>
```

`StartInterval` 跟 `dailyEXE` 用的 `StartCalendarInterval` 不同,不會主
動把睡眠中的電腦喚醒;如果排定執行的時間點電腦剛好在睡覺,`launchd` 會
在電腦醒來後立刻補跑一次,之後繼續照 4 小時間隔算,不需要額外設定
`pmset` 喚醒排程。加上 `RunAtLoad`,每次登入時也會立刻跑一次。

```bash
cp claude-usage-bar/com.aston.claude-keepalive.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aston.claude-keepalive.plist
launchctl list | grep claude-keepalive
```

驗證:

```bash
launchctl kickstart -k gui/$(id -u)/com.aston.claude-keepalive
sleep 3
cat ~/Library/Logs/claude-keepalive/claude-keepalive.log   # 應該看到 "pong"
launchctl list | grep claude-keepalive                     # 結束碼應該是 0
```

## 常見問題

**1. `pip3 install` 應該裝在哪個 Python 環境?**

跟 plist 裡 `ProgramArguments` 指定的 python 要是同一個。如果你用
pyenv,先確認目前生效的版本:

```bash
pyenv version
~/.pyenv/shims/python3 -m pip install rumps requests
```

**2. 如何確認目前是 launchd 啟動的,而不是手動殘留的行程?**

```bash
launchctl list | grep claudeusagebar   # PID 欄位要是數字，不是 -
ps -p <PID> -o pid,command             # 確認執行路徑跟 plist 裡寫的一致
```

**3. Keychain 權限對話框**

第一次執行時 macOS 會跳出「是否允許 xxx 存取 Claude Code-credentials」
的對話框,選「永遠允許」,否則背景執行時每次都會被擋下來要求授權。
