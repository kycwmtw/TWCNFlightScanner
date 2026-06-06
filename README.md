# 台灣-中國/港澳直飛航線資料庫計畫

**Summary**
建立本地 SQLite 資料庫，整理 2026-06-06 所屬現行夏季班表季，也就是 2026-03-29 至 2026-10-24，以下 6 家航空公司實際承運的台灣往返中國大陸、香港、澳門直飛航班：華航 CI、華信 AE、長榮 BR、立榮 B7、東航 MU、上航 FM。只收錄實際承運班號，不收代碼共享班號。

**Key Changes**
- 建立資料庫檔：`tw_cn_hk_mo_routes.sqlite`
- 建立匯出檔：`routes.csv`、`routes.xlsx`
- 欄位包含：航空公司、班號、出發機場、抵達機場、城市/地區、飛行日、起飛時間、抵達時間、有效起訖日、機型、資料來源、查核狀態、備註。
- 每個方向獨立一筆，例如 `TPE-PVG` 與 `PVG-TPE` 分開。
- 飛行日同時保留標準化格式與來源原文，例如 `Mon,Wed,Fri` 與 `1*3*5**`。

**Data Collection**
- 來源優先順序：
  1. 航空公司官方季節班表 PDF 或官方時刻表查詢。
  2. 航空公司子公司官方時刻表頁面。
  3. 台灣、中國大陸、香港、澳門機場官方班表，用於補漏。
  4. 第三方班表網站只做交叉比對，不作為唯一來源。
- 已確認可用來源包括：
  - [China Airlines 2026 Summer Timetable PDF](https://www.china-airlines.com/us/en/Images/timetable-20260329-20261024_tcm162-4228.pdf)，包含 CI/AE 航班資訊。
  - [Mandarin Airlines schedule page](https://www.mandarin-airlines.com/english/flight/schedule.htm)
  - [EVA Air official timetable](https://booking.evaair.com/flyeva/eva/b2c/flight-schedules.aspx?lang=en-global)，官方說明涵蓋 BR 與 B7 國際航班。
  - [China Eastern Taiwan timetable PDF](https://tw.ceair.com/newwebsite/tw/upload/China-Eastern-Airlines2018timetable.pdf)，用於 MU/FM。

**Validation**
- 每筆航班至少要有一個官方來源。
- 對 CI/AE/BR/B7/MU/FM 各自建立「來源航班數 vs 資料庫航班數」檢查表。
- 對台灣端機場與中國/港澳端目的地做雙向完整性檢查，避免只漏單向。
- 另建立「航空公司 + 航線」層級完整性檢查，避免被其他航空公司的反向航班掩蓋同一航空公司的缺漏。
- 若來源衝突，保留較保守版本並標記 `needs_review`，不自行猜測。
- 不列入任何無來源佐證的航班。

**Assumptions**
- 「現行班表」定義為 2026-03-29 至 2026-10-24 夏季班表。
- 「中國各城市」包含中國大陸、香港、澳門。
- 「班機號」只收實際承運航空的 CI、AE、BR、B7、MU、FM 航班號；不收其他航空實際承運或代碼共享班號。

**Build Status - 2026-06-07**
- 已產出 `tw_cn_hk_mo_routes.sqlite`、`routes.csv`、`routes.xlsx`。
- 目前工作集共 113 筆航班列：CI 43、AE 10、BR 32、B7 0、MU 23、FM 5。
- `verified` 81 筆：CI/AE/MU/FM 目前維持已查核。
- `needs_review` 32 筆：全部為 BR。長榮資料已補入一批缺漏方向，但仍需回到 EVA 官方查詢頁逐航線重跑確認，補完前不可宣稱 BR 已找齊。
- 整體方向完整性檢查目前只有 `NCH-TPE` 需複核。
- 航空公司層級完整性檢查目前標出 `BR TFU-TPE` 與 `MU NCH-TPE` 需複核。
- B7 在本輪未找到符合範圍的實際承運台灣-中國/港澳直飛國際航班，因此來源檢查表記為 0，不補無來源航班。

**Web Tool**
- 本機資料庫模式：執行 `PORT=8001 python3 server.py`，開啟 `http://127.0.0.1:8001`。
- 靜態公開模式：執行 `python3 export_static.py`，會產生 `web/data/flights.json`、`web/data/options.json`、`web/data/health.json`。
- 靜態模式可將整個 `web/` 資料夾發布到 GitHub Pages、Netlify 或 Vercel；手機可直接用公開網址查詢，不需要 SQLite 或 Python 服務。
- 未來更新資料時，先重新執行 `python3 build_routes.py` 產生新版 SQLite，再執行 `python3 export_static.py` 更新網頁用 JSON。

**GitHub Pages Publishing**
- 本專案已包含 `.github/workflows/pages.yml`，推送到 GitHub 的 `main` 分支後會自動發布 `web/` 靜態網頁。
- 第一次發布時，請到 GitHub repository 的 **Settings > Pages**，將來源設為 **GitHub Actions**。
- 發布完成後，網站網址通常會是 `https://<github-user>.github.io/<repository-name>/`。
- 若更新航班資料，請依序執行：
  1. `python3 build_routes.py`
  2. `python3 export_static.py`
  3. commit 並 push 到 GitHub
