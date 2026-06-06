/* ============================================
   TWCNFlightScanner – App Logic (unchanged data contracts)
   ============================================ */

const DAY_NAMES = { Mon: "週一", Tue: "週二", Wed: "週三", Thu: "週四", Fri: "週五", Sat: "週六", Sun: "週日" };
const STATUS_LABELS = { verified: "已查核", needs_review: "待複核" };

const state = {
  q: "",
  airline: "",
  departure_airport: "",
  arrival_airport: "",
  city_region: "",
  day: "",
  verification_status: "",
  sort: "departure_time",
};

const dom = {
  searchInput:   document.getElementById("searchInput"),
  sortSelect:    document.getElementById("sortSelect"),
  summaryRow:    document.getElementById("summaryRow"),
  results:       document.getElementById("results"),
  template:      document.getElementById("flightTemplate"),
  filterSheet:   document.getElementById("filterSheet"),
  overviewSheet: document.getElementById("overviewSheet"),
  overviewContent: document.getElementById("overviewContent"),
  filterBtn:     document.getElementById("filterBtn"),
  closeFilters:  document.getElementById("closeFilters"),
  closeOverview: document.getElementById("closeOverview"),
  resetFilters:  document.getElementById("resetFilters"),
  airlineFilter: document.getElementById("airlineFilter"),
  departureFilter: document.getElementById("departureFilter"),
  arrivalFilter:  document.getElementById("arrivalFilter"),
  cityFilter:    document.getElementById("cityFilter"),
  dayFilter:     document.getElementById("dayFilter"),
  filterChips:   document.getElementById("filterChips"),
  overviewToggle: document.getElementById("overviewToggle"),
  tabs:          [...document.querySelectorAll(".status-tabs .tab")],
};

const dataStore = { mode: "api", flights: null, health: null };

/* ---- Utilities ---- */
function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escAttr(s) { return esc(String(s)); }

function fmtDays(raw) {
  return raw.split(",").filter(Boolean).map(d => DAY_NAMES[d] || d).join("、");
}

function cmpFields(a, b, fields) {
  for (const f of fields) {
    const r = String(a[f] || "").localeCompare(String(b[f] || ""));
    if (r) return r;
  }
  return 0;
}

/* ---- State → query string ---- */
function paramsFromState() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v) p.set(k, v);
  }
  return p;
}

/* ---- Data fetching ---- */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWithFallback(apiUrl, staticUrl) {
  if (dataStore.mode === "static") return fetchJson(staticUrl);
  try {
    return await fetchJson(apiUrl);
  } catch {
    dataStore.mode = "static";
    return fetchJson(staticUrl);
  }
}

/* ---- Options ---- */
async function loadOptions() {
  const opts = await fetchWithFallback("/api/options", "data/options.json");
  setSelect(dom.airlineFilter, opts.airlines, "全部航空公司");
  setSelect(dom.departureFilter, opts.airports, "全部出發機場");
  setSelect(dom.arrivalFilter, opts.airports, "全部抵達機場");
  setSelect(dom.cityFilter, opts.cities, "全部城市/地區");
  setSelect(dom.dayFilter, opts.days, "全部飛行日", (i) => i.value, (i) => i.label);
}

function setSelect(el, items, label, getVal, getLbl) {
  el.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = label;
  el.append(opt);
  for (const item of items) {
    const o = document.createElement("option");
    o.value = getVal ? getVal(item) : item;
    o.textContent = getLbl ? getLbl(item) : item;
    el.append(o);
  }
}

/* ---- Flights ---- */
async function loadFlights() {
  dom.results.innerHTML = '<div class="state-msg"><span class="state-msg-icon">🔍</span>查詢中…</div>';

  let data;
  if (dataStore.mode === "static") {
    data = { flights: await getStaticFlights() };
    data.flights = filterStatic(data.flights);
  } else {
    data = await fetchWithFallback(`/api/flights?${paramsFromState()}`, "data/flights.json");
    if (dataStore.mode === "static") {
      data.flights = filterStatic(data.flights);
    }
  }

  renderSummary(data.flights);
  renderFlights(data.flights);
}

async function getStaticFlights() {
  if (!dataStore.flights) {
    const data = await fetchJson("data/flights.json");
    dataStore.flights = data.flights;
  }
  return dataStore.flights;
}

function filterStatic(flights) {
  const q = state.q.toLowerCase();
  let out = flights.filter(f => {
    if (state.airline && f.airline !== state.airline) return false;
    if (state.departure_airport && f.departure_airport !== state.departure_airport) return false;
    if (state.arrival_airport && f.arrival_airport !== state.arrival_airport) return false;
    if (state.city_region && f.city_region !== state.city_region) return false;
    if (state.day && !f.flight_days.includes(state.day)) return false;
    if (state.verification_status && f.verification_status !== state.verification_status) return false;
    if (!q) return true;
    return [f.flight_number, f.airline, f.departure_airport, f.arrival_airport, f.city_region, f.aircraft || ""]
      .some(v => v.toLowerCase().includes(q));
  });

  if (state.sort === "airline") return out.sort((a, b) => cmpFields(a, b, ["airline", "flight_number", "departure_time"]));
  if (state.sort === "route") return out.sort((a, b) => cmpFields(a, b, ["departure_airport", "arrival_airport", "departure_time"]));
  return out.sort((a, b) => cmpFields(a, b, ["departure_time", "airline", "flight_number"]));
}

/* ---- Render ---- */
function renderSummary(flights) {
  const v = flights.filter(f => f.verification_status === "verified").length;
  const n = flights.filter(f => f.verification_status === "needs_review").length;
  const pills = [`${flights.length} 班`];
  if (v) pills.push(`已查核 ${v}`);
  if (n) pills.push(`待複核 ${n}`);
  if (state.airline) pills.push(state.airline);
  if (state.departure_airport) pills.push(`出發 ${state.departure_airport}`);
  if (state.arrival_airport) pills.push(`抵達 ${state.arrival_airport}`);
  if (state.city_region) pills.push(state.city_region);
  if (state.day) pills.push(DAY_NAMES[state.day]);

  dom.summaryRow.innerHTML = pills.map(t => `<span class="summary-pill">${esc(t)}</span>`).join("");
}

function renderFlights(flights) {
  dom.results.innerHTML = "";

  if (!flights.length) {
    const msg = state.q || state.airline || state.departure_airport || state.arrival_airport || state.city_region || state.day
      ? '<div class="state-msg"><span class="state-msg-icon">📭</span>找不到符合條件的航班<br><span class="highlight">試著放寬篩選或搜尋其他關鍵字</span></div>'
      : '<div class="state-msg"><span class="state-msg-icon">✈️</span>尚無航班資料<br><span class="highlight">請確認資料庫已匯入</span></div>';
    dom.results.innerHTML = msg;
    return;
  }

  for (const f of flights) {
    const card = dom.template.content.firstElementChild.cloneNode(true);

    card.querySelector(".flight-code").textContent = f.flight_number;

    const badge = card.querySelector(".status-badge");
    badge.textContent = STATUS_LABELS[f.verification_status] || f.verification_status;
    badge.classList.add(f.verification_status);

    card.querySelector(".route-point--dep .route-airport").textContent = f.departure_airport;
    card.querySelector(".route-point--dep .route-time").textContent = f.departure_time;
    card.querySelector(".route-point--arr .route-airport").textContent = f.arrival_airport;
    card.querySelector(".route-point--arr .route-time").textContent = f.arrival_time;

    card.querySelector(".card-meta").innerHTML = [
      `<strong>${esc(f.airline)}</strong>`,
      esc(f.city_region),
      fmtDays(f.flight_days),
    ].join('<span class="meta-dot">·</span>');

    const detail = card.querySelector(".card-detail");
    detail.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">有效日期</span><span class="detail-value">${esc(f.valid_from)} – ${esc(f.valid_to)}</span></div>
        <div class="detail-item"><span class="detail-label">機型</span><span class="detail-value">${esc(f.aircraft || "未提供")}</span></div>
        <div class="detail-item"><span class="detail-label">原始飛行日</span><span class="detail-value">${esc(f.flight_days_raw)}</span></div>
        <div class="detail-item"><span class="detail-label">資料來源</span><span class="detail-value">${esc(f.source)}</span></div>
        <div class="detail-item span-2"><span class="detail-label">來源連結</span><span class="detail-value"><a href="${escAttr(f.source_url)}" target="_blank" rel="noreferrer">查看原始資料 →</a></span></div>
        ${f.notes ? `<div class="detail-item span-2"><span class="detail-label">備註</span><span class="detail-value">${esc(f.notes)}</span></div>` : ""}
      </div>`;

    card.querySelector(".card-main").addEventListener("click", () => {
      detail.hidden = !detail.hidden;
    });

    dom.results.append(card);
  }
}

/* ---- Overview ---- */
async function loadOverview() {
  dom.overviewContent.innerHTML = '<div class="state-msg"><span class="state-msg-icon">⏳</span>讀取中…</div>';
  const h = await fetchWithFallback("/api/health", "data/health.json");
  const issues = h.route_integrity_checks.filter(r => r.status !== "ok");
  const airlineIssues = (h.airline_route_integrity_checks || []).filter(r => r.status !== "ok");

  dom.overviewContent.innerHTML = `
    <div class="overview-card">
      <h3>總覽</h3>
      <dl class="stat-list">
        <div class="stat-row"><dt>資料庫</dt><dd>${esc(h.database)}</dd></div>
        <div class="stat-row"><dt>航班總數</dt><dd>${h.total_flights}</dd></div>
      </dl>
    </div>
    <div class="overview-card">
      <h3>航空公司分布</h3>
      <dl class="stat-list">
        ${h.airline_counts.map(r => statRow(r.airline, r.count)).join("")}
      </dl>
    </div>
    <div class="overview-card">
      <h3>查核狀態</h3>
      <dl class="stat-list">
        ${h.status_counts.map(r => statRow(STATUS_LABELS[r.status] || r.status, r.count)).join("")}
      </dl>
    </div>
    <div class="overview-card${issues.length ? " overview-card--warn" : ""}">
      <h3>航線完整性</h3>
      <dl class="stat-list">
        ${issues.length ? issues.map(r => statRow(r.route_pair, "⚠ 待確認")).join("") : statRow("所有航線對", "✓ 雙向完整")}
      </dl>
    </div>
    <div class="overview-card${airlineIssues.length ? " overview-card--warn" : ""}">
      <h3>航空公司完整性</h3>
      <dl class="stat-list">
        ${
          airlineIssues.length
            ? airlineIssues.map(r => statRow(`${r.airline} ${r.route_pair}`, "⚠ 待確認")).join("")
            : statRow("所有航空公司航線對", "✓ 雙向完整")
        }
      </dl>
    </div>`;
}

function statRow(label, value) {
  return `<div class="stat-row"><dt>${esc(String(label))}</dt><dd>${esc(String(value))}</dd></div>`;
}

/* ---- Sheets ---- */
function openSheet(s) { s.classList.add("open"); s.setAttribute("aria-hidden", "false"); }
function closeSheet(s) { s.classList.remove("open"); s.setAttribute("aria-hidden", "true"); }

/* ---- Active Filter Chips ---- */
function updateFilterChips() {
  const items = [
    { key: "airline", value: state.airline, label: state.airline },
    { key: "departure_airport", value: state.departure_airport, label: `出發 ${state.departure_airport}` },
    { key: "arrival_airport", value: state.arrival_airport, label: `抵達 ${state.arrival_airport}` },
    { key: "city_region", value: state.city_region, label: state.city_region },
    { key: "day", value: state.day, label: state.day ? DAY_NAMES[state.day] : "" },
  ].filter(i => i.value);

  let html = '<button class="chip active" data-chip="all">全部</button>';
  for (const item of items) {
    html += `<span class="active-filter-tag">${esc(item.label)}<button data-remove="${item.key}" aria-label="移除 ${esc(item.label)}">&times;</button></span>`;
  }
  dom.filterChips.innerHTML = html;

  // Bind remove buttons
  dom.filterChips.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.dataset.remove;
      state[key] = "";
      syncFiltersToState();
      loadFlights();
      updateFilterChips();
    });
  });
}

function syncFiltersToState() {
  dom.airlineFilter.value = state.airline;
  dom.departureFilter.value = state.departure_airport;
  dom.arrivalFilter.value = state.arrival_airport;
  dom.cityFilter.value = state.city_region;
  dom.dayFilter.value = state.day;
}

/* ---- Events ---- */
function bindEvents() {
  // Search
  dom.searchInput.addEventListener("input", debounce(e => {
    state.q = e.target.value.trim();
    loadFlights();
    updateFilterChips();
  }));

  // Sort
  dom.sortSelect.addEventListener("change", e => {
    state.sort = e.target.value;
    loadFlights();
  });

  // Status tabs
  dom.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      dom.tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.verification_status = tab.dataset.status;
      loadFlights();
    });
  });

  // Filter selects
  const bindings = [
    [dom.airlineFilter, "airline"],
    [dom.departureFilter, "departure_airport"],
    [dom.arrivalFilter, "arrival_airport"],
    [dom.cityFilter, "city_region"],
    [dom.dayFilter, "day"],
  ];
  for (const [el, key] of bindings) {
    el.addEventListener("change", e => {
      state[key] = e.target.value;
      loadFlights();
      updateFilterChips();
    });
  }

  // Sheets
  dom.filterBtn.addEventListener("click", () => openSheet(dom.filterSheet));
  dom.closeFilters.addEventListener("click", () => closeSheet(dom.filterSheet));
  dom.overviewToggle.addEventListener("click", async () => { openSheet(dom.overviewSheet); await loadOverview(); });
  dom.closeOverview.addEventListener("click", () => closeSheet(dom.overviewSheet));

  // Click backdrop to close
  [dom.filterSheet, dom.overviewSheet].forEach(s => {
    s.addEventListener("click", e => { if (e.target === s) closeSheet(s); });
  });

  // Reset filters
  dom.resetFilters.addEventListener("click", () => {
    Object.assign(state, { airline: "", departure_airport: "", arrival_airport: "", city_region: "", day: "" });
    bindings.forEach(([el]) => { el.value = ""; });
    loadFlights();
    updateFilterChips();
  });
}

/* ---- Init ---- */
async function init() {
  bindEvents();
  await loadOptions();
  await loadFlights();
  updateFilterChips();
}

init().catch(err => {
  dom.results.innerHTML = `<div class="state-msg"><span class="state-msg-icon">⚠️</span>載入失敗<br><span class="highlight">${esc(err.message)}</span></div>`;
});
