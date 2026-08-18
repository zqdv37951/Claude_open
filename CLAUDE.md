# 專案筆記

## GitHub Pages 已啟用

這個 repo（`zqdv37951/Claude_open`）已經開啟 GitHub Pages，從 `main` 分支根目錄部署，網址前綴固定是：

```
https://zqdv37951.github.io/Claude_open/<repo 內路徑，非 ASCII 字元需 URL-encode>
```

push 到 `main` 後會自動重新部署。

**當使用者要某個檔案的「網址」時，預設給這個 GitHub Pages 網址**（把檔案在 repo 裡的路徑接在後面、正確 URL-encode），不要主動給 Artifact 連結或其他代理服務（如 htmlpreview.github.io）。

只有使用者明確說「用 artifacts」或「用 claude 公開網址」時，才改用 Artifact 工具發布連結。

（附注：這個沙盒環境的出站網路政策會擋掉 `*.github.io`，無法在這裡用 curl 驗證連結是否正常，這是環境限制、不代表連結有問題；照樣把網址給使用者，讓他們自己開瀏覽器確認即可。）
