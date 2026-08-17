#!/usr/bin/env python3
"""
Claude Usage Bar
=================

A tiny macOS menu bar widget that shows your Claude.ai / Claude Code
usage (5-hour session limit and 7-day weekly limit) at a glance.

How it works
------------
Claude Code (the CLI you already have installed and logged in) stores
an OAuth access token in the macOS Keychain under the service name
"Claude Code-credentials". This script reads that token (the same way
Claude Code itself does) and calls Anthropic's own
`https://api.anthropic.com/api/oauth/usage` endpoint with it - the
same endpoint Claude Code uses internally to power its own usage
display.

This is NOT an official Anthropic product and is not endorsed by
Anthropic. The endpoint is undocumented and could change or stop
working at any time. No data is sent anywhere except to
api.anthropic.com; nothing is logged or stored by this script beyond
what's already in your local Keychain.

Requirements
------------
    pip3 install rumps requests

Run
---
    python3 claude_usage_bar.py

To quit: click the menu bar icon and choose "結束", or in Terminal
run `pkill -f claude_usage_bar.py` from another tab (Ctrl+C often
doesn't interrupt the Cocoa event loop this app runs on).

See ../docs/claude-usage-bar-setup.md in this repo for how to set it
up to start automatically via launchd, plus the troubleshooting
history behind the checks below.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import requests
import rumps

API_URL_USAGE = "https://api.anthropic.com/api/oauth/usage"
KEYCHAIN_SERVICE = "Claude Code-credentials"
POLL_SECONDS = 300  # 5 minutes
DEFAULT_429_BACKOFF_SECONDS = 900  # 遇到 429 且沒有 Retry-After 時，預設冷卻 15 分鐘
USER_AGENT = "claude-code/2.1.85"

# Which field's percentage is shown on the menu bar icon itself
# (the dropdown always shows all of them).
MENU_BAR_BADGE_FIELD = "five_hour"


def read_credentials() -> Optional[dict]:
    """讀取完整的 Keychain 憑證(包含 accessToken 與 expiresAt)。

    第一次執行時，macOS 會跳出對話框詢問是否允許存取
    "Claude Code-credentials" 這個 Keychain 項目，選「永遠允許」
    才能在背景持續刷新。
    """
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return None
        raw = result.stdout.strip()
        if not raw:
            return None
        creds = json.loads(raw)
        return creds.get("claudeAiOauth")
    except Exception:
        return None


def fetch_usage() -> dict[str, Any]:
    creds = read_credentials()
    if not creds or not creds.get("accessToken"):
        return {"error": "找不到 Claude Code 登入資訊，請先在 Terminal 執行 `claude` 並登入一次。"}

    # 主動檢查 token 是否過期，過期就不要硬打 API。
    #
    # 這支小工具只是單純從 Keychain 讀 accessToken 直接拿去用，從來
    # 不會像 Claude Code CLI 本身那樣自動用 refreshToken 換一組新的。
    # 太久沒開 `claude` CLI 時，Keychain 裡的 accessToken 會過期，
    # 用過期 token 連續打 API 觀察到的現象是 HTTP 429（而不是預期的
    # 401）——服務端似乎把「重複用失效憑證打 API」當成濫用行為擋下來。
    # 詳見 ../docs/claude-usage-bar-setup.md 的排錯記錄。
    expires_at = creds.get("expiresAt")
    if expires_at:
        try:
            expires_dt = datetime.fromtimestamp(int(expires_at) / 1000, tz=timezone.utc)
            if datetime.now(timezone.utc) >= expires_dt:
                return {
                    "error": "登入 token 已過期（太久沒開 claude CLI，未自動刷新）。"
                             "請在 Terminal 打開一次 `claude` 讓它刷新登入，稍後會自動恢復。",
                }
        except Exception:
            pass  # 解析失敗就照舊往下打，不要因為這個而整個掛掉

    token = creds["accessToken"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "anthropic-beta": "oauth-2025-04-20",
    }
    try:
        resp = requests.get(API_URL_USAGE, headers=headers, timeout=10)
        if resp.status_code == 401:
            return {"error": "登入已過期，請在 Terminal 執行 `claude` 重新登入。"}
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            try:
                wait_seconds = int(retry_after) if retry_after else DEFAULT_429_BACKOFF_SECONDS
            except ValueError:
                wait_seconds = DEFAULT_429_BACKOFF_SECONDS
            return {"error": "HTTP 錯誤 429（請求太頻繁，已暫停自動刷新）", "retry_after_seconds": wait_seconds}
        resp.raise_for_status()
        return resp.json()
    except requests.ConnectionError:
        return {"error": "無法連線到 api.anthropic.com"}
    except requests.HTTPError as e:
        return {"error": f"HTTP 錯誤 {e.response.status_code if e.response is not None else '?'}"}
    except Exception as e:
        return {"error": f"未知錯誤：{e}"}


def format_reset(resets_at: Optional[str]) -> str:
    if not resets_at:
        return ""
    try:
        dt = datetime.fromisoformat(resets_at.replace("Z", "+00:00"))
        local = dt.astimezone()
        now = datetime.now(timezone.utc).astimezone()
        delta = local - now
        if delta.total_seconds() <= 0:
            return "即將重置"
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes = remainder // 60
        if hours >= 24:
            days = hours // 24
            hours = hours % 24
            return f"{days}天{hours}小時後重置 ({local.strftime('%m/%d %H:%M')})"
        if hours > 0:
            return f"{hours}小時{minutes}分後重置 ({local.strftime('%H:%M')})"
        return f"{minutes}分後重置 ({local.strftime('%H:%M')})"
    except Exception:
        return ""


def dot_for(pct: float) -> str:
    if pct >= 80:
        return "🔴"
    if pct >= 50:
        return "🟡"
    return "🟢"


# Known/likely field names in the usage response, in the order they
# should appear in the dropdown (5-hour first). The exact response
# shape of the (undocumented) oauth/usage endpoint isn't publicly
# documented, so this is intentionally defensive: unrecognised fields
# are simply skipped instead of crashing, and everything is visible
# via "顯示原始資料" if something looks off.
FIELDS = [
    ("five_hour", "5 小時額度"),
    ("seven_day", "7 天額度"),
    ("seven_day_sonnet", "7 天 Sonnet"),
    ("seven_day_opus", "7 天 Opus"),
]


class ClaudeUsageBarApp(rumps.App):
    def __init__(self):
        # quit_button=None: we add our own "結束" item below instead of
        # relying on rumps' automatic one, since we rebuild the whole
        # menu on every refresh.
        super().__init__("Claude", title="⏳", quit_button=None)
        self._last_raw: dict[str, Any] = {}
        self._backoff_until: Optional[datetime] = None
        self._set_detail_items([rumps.MenuItem("讀取中…")])
        self.timer = rumps.Timer(self.tick, POLL_SECONDS)
        self.timer.start()
        self.refresh(None)

    def tick(self, _sender):
        # 還在 429 冷卻期就跳過這次自動刷新，避免一直重複被限流
        if self._backoff_until and datetime.now(timezone.utc) < self._backoff_until:
            return
        self.refresh(None)

    def refresh(self, _sender):
        data = fetch_usage()
        self._last_raw = data
        if "retry_after_seconds" in data:
            self._backoff_until = datetime.now(timezone.utc) + timedelta(seconds=data["retry_after_seconds"])
        else:
            self._backoff_until = None
        self._render(data)

    def show_raw(self, _sender):
        rumps.alert(
            title="Claude Usage - 原始資料",
            message=json.dumps(self._last_raw, indent=2, ensure_ascii=False),
        )

    def _render(self, data: dict[str, Any]):
        if "error" in data:
            self.title = "⚠️"
            self._set_detail_items([rumps.MenuItem(data["error"])])
            return

        found = []
        badge_pct = None

        for key, label in FIELDS:
            block = data.get(key)
            if not block:
                continue
            pct = block.get("utilization")
            if pct is None:
                continue
            pct = float(pct)
            reset_txt = format_reset(block.get("resets_at"))
            found.append((label, pct, reset_txt))
            if key == MENU_BAR_BADGE_FIELD:
                badge_pct = pct

        if not found:
            self.title = "⚠️"
            self._set_detail_items([rumps.MenuItem("沒有讀到已知的額度欄位，點「顯示原始資料」查看")])
            return

        # Menu bar badge always reflects the 5-hour quota specifically
        # (falls back to the highest usage found if that field is
        # missing from the response for some reason).
        if badge_pct is None:
            badge_pct = max(pct for _, pct, _ in found)
        self.title = f"{dot_for(badge_pct)} {badge_pct:.0f}%"

        items = []
        for label, pct, reset_txt in found:
            line = f"{dot_for(pct)} {label}：{pct:.0f}%"
            items.append(rumps.MenuItem(line))
            if reset_txt:
                items.append(rumps.MenuItem(f"    {reset_txt}"))
        items.append(rumps.MenuItem(f"更新於 {datetime.now().strftime('%H:%M:%S')}"))
        self._set_detail_items(items)

    def _set_detail_items(self, items: list):
        # Rebuild the menu from scratch every time: dynamic usage lines
        # on top, then a separator, then the fixed action items
        # (including Quit, since quit_button=None means rumps won't
        # add one for us).
        self.menu.clear()
        for it in items:
            self.menu.add(it)
        self.menu.add(None)
        self.menu.add(rumps.MenuItem("立即整理", callback=self.refresh))
        self.menu.add(rumps.MenuItem("顯示原始資料", callback=self.show_raw))
        self.menu.add(None)
        self.menu.add(rumps.MenuItem("結束", callback=rumps.quit_application))


if __name__ == "__main__":
    ClaudeUsageBarApp().run()
