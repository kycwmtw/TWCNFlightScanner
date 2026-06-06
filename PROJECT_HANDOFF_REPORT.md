# TWCNFlightScanner Project Handoff Report

更新日期：2026-06-07

## 1. 專案概述

TWCNFlightScanner 是一個查詢台灣往返中國大陸、香港、澳門直飛航線的網頁工具。專案目前以 2026 夏季班表為資料範圍，涵蓋有效日期 2026-03-29 至 2026-10-24。

目前網站目標是讓使用者用手機直向瀏覽時，可以快速查詢航班、篩選航空公司/機場/城市/飛行日，並看到每筆航班的查核狀態與來源。

公開網址：

https://kycwmtw.github.io/TWCNFlightScanner/

GitHub repository：

https://github.com/kycwmtw/TWCNFlightScanner

## 2. 目前 Git 狀態

本機 `main` 已與 `origin/main` 同步。

最新 commit：

```text
75e5888 Verify BR MU FM flight schedules
```

這個 commit 已成功推上 GitHub。

## 3. 目前資料狀態

資料庫檔案：

```text
tw_cn_hk_mo_routes.sqlite
```

目前總航班筆數：

```text
101
```

航空公司分布：

```text
AE  10
BR  20
CI  43
FM   5
MU  23
```

查核狀態：

```text
verified      101
needs_review    0
```

目前仍有一個「航線完整性」提醒：

```text
NCH-TPE
```

原因：資料中有 `MU2047 NCH-TPE`，但目前沒有相反方向 `TPE-NCH`。這不是單筆航班待複核，而是資料庫自動檢查航線雙向完整性的提醒。

## 4. 資料來源與查核狀態

目前資料來源包括：

- 華航 2026 夏季班表 PDF：CI / AE
- 長榮官方時刻表頁面，加 FlightMapper / Flight.info 交叉查核：BR
- 東航台灣官方班表 PDF，加公開班表頁交叉查核：MU / FM

最近一次重要資料更新：

- BR 原本 19 筆，更新後 20 筆。
- 補上 `BR715 PEK-TPE 週一/週五 20:45-23:55`。
- 修正 `BR711 PVG-TPE` 為 `13:15-15:15`。
- 修正 `BR830 MFM-KHH` 為 `11:45-13:15`。
- 修正 `BR867` 機型為 `789`。
- MU / FM 原本標為 `needs_review`，已根據來源改為 `verified`。

## 5. 專案檔案結構

主要資料建置：

```text
build_routes.py
tw_cn_hk_mo_routes.sqlite
routes.csv
routes.xlsx
```

靜態資料匯出：

```text
export_static.py
web/data/flights.json
web/data/options.json
web/data/health.json
```

本機 API / 靜態伺服器：

```text
server.py
```

目前網頁：

```text
web/index.html
web/styles.css
web/app.js
```

GitHub Pages 自動部署：

```text
.github/workflows/pages.yml
```

注意：repo 根目錄目前也有 `index.html`、`styles.css`、`app.js`、`data/*` 等檔案。GitHub Pages workflow 實際部署的是 `web/` 資料夾，因此接手改版時應優先修改 `web/` 內的檔案。

## 6. 網頁目前功能

目前已完成：

- 手機直向優先的單頁查詢工具。
- 搜尋欄可搜尋班號、航空公司、機場代碼、城市、機型。
- 可依航空公司、出發機場、抵達機場、城市/地區、飛行日篩選。
- 可依起飛時間、航空公司、航線排序。
- 可切換全部 / 已查核 / 待複核。
- 航班以卡片呈現。
- 點擊航班卡片可展開詳細資料。
- 詳細資料包含有效日期、機型、原始飛行日、資料來源、來源連結、備註。
- 資料概覽抽屜可顯示總筆數、航空公司分布、查核狀態、航線完整性。
- 支援兩種資料模式：
  - 本機 API：`server.py` 讀 SQLite。
  - GitHub Pages 靜態模式：讀 `web/data/*.json`。

## 7. API 與 JSON 格式

本機 API：

```text
GET /api/flights
GET /api/options
GET /api/health
```

GitHub Pages 靜態資料：

```text
web/data/flights.json
web/data/options.json
web/data/health.json
```

`flights.json` 外層格式：

```json
{
  "flights": []
}
```

單筆航班欄位：

```text
id
airline
flight_number
departure_airport
arrival_airport
city_region
flight_days
flight_days_raw
departure_time
arrival_time
valid_from
valid_to
aircraft
source
source_url
verification_status
notes
```

## 8. 發布流程

一般資料更新流程：

```bash
cd "/Users/kycwmtw/Documents/台陸航線整理"

python3 build_routes.py
python3 export_static.py

git add .
git commit -m "Update flight schedules"
git push
```

如果遇到遠端有新版本：

```bash
git pull --rebase
git push
```

GitHub Pages workflow 會在 push 到 `main` 後自動部署 `web/` 資料夾。

GitHub token 若重新產生，需要 classic token 並勾選：

```text
repo
workflow
```

## 9. 目前問題與接手重點

最重要的接手任務是重新設計網頁 UI。使用者已明確表示目前頁面太醜，需要大幅改善視覺與手機體驗。

目前 UI 問題：

- 整體視覺太像原生 HTML 表單，缺少產品感。
- 首屏沒有足夠清楚的資訊層級。
- 按鈕、篩選器、卡片質感不足。
- 資料概覽入口使用 `i` 字元，不夠直覺，建議改成圖示按鈕。
- 「待複核」目前資料為 0 筆，但 UI 仍保留該 tab；可以保留以支援未來資料更新，也可以重新設計成狀態篩選。
- 手機版需要更像真正的航班查詢工具，而不是資料表包成卡片。

建議 DeepSeek 優先處理：

1. 重新設計 `web/index.html`、`web/styles.css`、`web/app.js` 的前端外觀。
2. 保留既有資料檔與欄位，不要改 SQLite schema。
3. 保留 `web/data/*.json` 讀取邏輯，確保 GitHub Pages 可用。
4. 首頁直接是查詢工具，不要做 landing page。
5. 手機直向優先，桌面只是適配，不是主要情境。
6. 航班卡片應更清楚呈現：
   - 班號
   - 航線
   - 起降時間
   - 飛行日
   - 航空公司
   - 查核狀態
7. 詳情展開區保留來源連結，避免使用者無法追溯資料。
8. 資料概覽可改成更漂亮的 bottom sheet 或獨立 tab。
9. 加入空狀態、讀取狀態、錯誤狀態的視覺設計。
10. 做 390px 手機寬度檢查，避免文字重疊或橫向捲動。

## 10. 不建議改動的部分

除非要重構資料流程，否則不建議先動：

```text
build_routes.py
tw_cn_hk_mo_routes.sqlite
routes.csv
routes.xlsx
export_static.py
server.py
```

DeepSeek 若只接手網頁設計，應集中修改：

```text
web/index.html
web/styles.css
web/app.js
```

## 11. README 注意事項

目前 `README.md` 的 Build Status 仍可能保留舊狀態，提到 100 筆航班與 47 筆 needs_review。這已經不是最新資料。

最新狀態應為：

```text
總航班 101 筆
verified 101 筆
needs_review 0 筆
```

建議接手時順便更新 README，避免公開文件與網站資料不一致。

## 12. 給接手者的簡短結論

這個專案的資料底層已可用，GitHub Pages 也已經能部署。下一階段重點不是資料庫，而是把目前陽春的手機查詢頁改成真正好看、好用、清楚可信的航班查詢工具。

請優先改 `web/` 前端，不要破壞 `web/data/*.json` 的資料讀取合約。
