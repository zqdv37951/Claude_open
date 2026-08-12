-- LiveCaption2
-- 用途:切換 macOS「即時字幕」(輔助使用 > ライブキャプション)開關。
-- 存放位置與快捷鍵設定方式請見:
--   ../docs/live-caption-shortcut-setup.md

tell application "System Events"
	tell process "System Settings"
		set frontmost to true
	end tell
end tell
delay 0.2

set currentTitle to ""
tell application "System Events"
	tell process "System Settings"
		try
			set currentTitle to name of window 1
		end try
	end tell
end tell

if currentTitle does not contain "ライブキャプション" then

	open location "x-apple.systempreferences:com.apple.Accessibility-Settings.extension"

	tell application "System Events"
		tell process "System Settings"
			set frontmost to true
			repeat 15 times
				if exists window 1 then exit repeat
				delay 0.1
			end repeat
			delay 0.2

			set contentGroups to {}
			try
				set contentGroups to my findAllButtonGroups(window 1)
			end try

			set targetButton to missing value
			repeat with aGroup in contentGroups
				repeat with aButton in (buttons of aGroup)
					set foundText to ""
					try
						set foundText to (value of attribute "AXDescription" of aButton) as text
					end try
					if foundText contains "ライブキャプション" then
						set targetButton to aButton
						exit repeat
					end if
				end repeat
				if targetButton is not missing value then exit repeat
			end repeat

			if targetButton is missing value and (count of contentGroups) ≥ 2 then
				set candidateGroup to item 2 of contentGroups
				set btnList to buttons of candidateGroup
				if (count of btnList) ≥ 4 then
					set targetButton to item 4 of btnList
				end if
			end if

			if targetButton is missing value then
				return
			end if

			click targetButton
			delay 0.3
		end tell
	end tell
end if

tell application "System Events"
	tell process "System Settings"
		set allCheckboxes to my findAllCheckboxes(window 1)
		if (count of allCheckboxes) ≥ 1 then
			click (item 1 of allCheckboxes)
			delay 0.2
		end if
	end tell
end tell

on findAllButtonGroups(theParent)
	set resultList to {}
	tell application "System Events"
		try
			set childList to UI elements of theParent
		on error
			return resultList
		end try
		repeat with aChild in childList
			try
				set r to role of aChild
			on error
				set r to ""
			end try
			if r is "AXOutline" then
			else
				try
					if r is "AXGroup" and (count of (buttons of aChild)) > 0 then
						set end of resultList to aChild
					end if
				end try
				set resultList to resultList & my findAllButtonGroups(aChild)
			end if
		end repeat
	end tell
	return resultList
end findAllButtonGroups

on findAllCheckboxes(theParent)
	set resultList to {}
	tell application "System Events"
		try
			set r to role of theParent
		on error
			set r to ""
		end try
		try
			set childList to UI elements of theParent
		on error
			return resultList
		end try
		repeat with aChild in childList
			try
				set r2 to role of aChild
			on error
				set r2 to ""
			end try
			if r2 is "AXOutline" then
			else
				try
					if r2 is "AXCheckBox" then
						set end of resultList to aChild
					end if
				end try
				set resultList to resultList & my findAllCheckboxes(aChild)
			end if
		end repeat
	end tell
	return resultList
end findAllCheckboxes
