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

const els = {
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  summaryStrip: document.querySelector("#summaryStrip"),
  results: document.querySelector("#results"),
  template: document.querySelector("#flightTemplate"),
  filterSheet: document.querySelector("#filterSheet"),
  overviewSheet: document.querySelector("#overviewSheet"),
  overviewContent: document.querySelector("#overviewContent"),
  filterToggle: document.querySelector("#filterToggle"),
  overviewToggle: document.querySelector("#overviewToggle"),
  closeFilters: document.querySelector("#closeFilters"),
  closeOverview: document.querySelector("#closeOverview"),
  resetFilters: document.querySelector("#resetFilters"),
  airlineFilter: document.querySelector("#airlineFilter"),
  departureFilter: document.querySelector("#departureFilter"),
  arrivalFilter: document.querySelector("#arrivalFilter"),
  cityFilter: document.querySelector("#cityFilter"),
  dayFilter: document.querySelector("#dayFilter"),
  tabs: [...document.querySelectorAll(".tab")],
};

const dayNames = {
  Mon: "週一",
  Tue: "週二",
  Wed: "週三",
  Thu: "週四",
  Fri: "週五",
  Sat: "週六",
  Sun: "週日",
};

const statusLabels = {
  verified: "已查核",
  needs_review: "待複核",
};

const dataStore = {
  mode: "api",
  flights: null,
  health: null,
};

function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setOptions(select, items, allLabel, getValue = (item) => item, getLabel = (item) => item) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.append(all);

  for (const item of items) {
    const option = document.createElement("option");
    option.value = getValue(item);
    option.textContent = getLabel(item);
    select.append(option);
  }
}

function paramsFromState() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value) params.set(key, value);
  }
  return params;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchWithStaticFallback(apiUrl, staticUrl) {
  if (dataStore.mode === "static") {
    return fetchJson(staticUrl);
  }

  try {
    return await fetchJson(apiUrl);
  } catch (error) {
    dataStore.mode = "static";
    return fetchJson(staticUrl);
  }
}

async function loadOptions() {
  const options = await fetchWithStaticFallback("/api/options", "data/options.json");
  setOptions(els.airlineFilter, options.airlines, "全部航空公司");
  setOptions(els.departureFilter, options.airports, "全部出發機場");
  setOptions(els.arrivalFilter, options.airports, "全部抵達機場");
  setOptions(els.cityFilter, options.cities, "全部城市/地區");
  setOptions(
    els.dayFilter,
    options.days,
    "全部飛行日",
    (item) => item.value,
    (item) => item.label
  );
}

async function loadFlights() {
  els.results.innerHTML = '<div class="empty">查詢中...</div>';
  const data =
    dataStore.mode === "static"
      ? { flights: await getStaticFlights() }
      : await fetchWithStaticFallback(`/api/flights?${paramsFromState()}`, "data/flights.json");
  if (dataStore.mode === "static" && data.flights.length && state.q) {
    data.flights = filterStaticFlights(data.flights);
  } else if (dataStore.mode === "static") {
    data.flights = filterStaticFlights(data.flights);
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

function filterStaticFlights(flights) {
  const q = state.q.toLowerCase();
  const filtered = flights.filter((flight) => {
    if (state.airline && flight.airline !== state.airline) return false;
    if (state.departure_airport && flight.departure_airport !== state.departure_airport) return false;
    if (state.arrival_airport && flight.arrival_airport !== state.arrival_airport) return false;
    if (state.city_region && flight.city_region !== state.city_region) return false;
    if (state.day && !flight.flight_days.includes(state.day)) return false;
    if (state.verification_status && flight.verification_status !== state.verification_status) return false;
    if (!q) return true;

    return [
      flight.flight_number,
      flight.airline,
      flight.departure_airport,
      flight.arrival_airport,
      flight.city_region,
      flight.aircraft || "",
    ].some((value) => value.toLowerCase().includes(q));
  });

  return filtered.sort((a, b) => {
    if (state.sort === "airline") {
      return compareFields(a, b, ["airline", "flight_number", "departure_time"]);
    }
    if (state.sort === "route") {
      return compareFields(a, b, ["departure_airport", "arrival_airport", "departure_time"]);
    }
    return compareFields(a, b, ["departure_time", "airline", "flight_number"]);
  });
}

function compareFields(a, b, fields) {
  for (const field of fields) {
    const result = String(a[field] || "").localeCompare(String(b[field] || ""));
    if (result !== 0) return result;
  }
  return 0;
}

function renderSummary(flights) {
  const verified = flights.filter((flight) => flight.verification_status === "verified").length;
  const needsReview = flights.filter((flight) => flight.verification_status === "needs_review").length;
  const active = [
    state.airline,
    state.departure_airport && `出發 ${state.departure_airport}`,
    state.arrival_airport && `抵達 ${state.arrival_airport}`,
    state.city_region,
    state.day && dayNames[state.day],
  ].filter(Boolean);

  const pills = [
    `${flights.length} 筆航班`,
    `已查核 ${verified}`,
    `待複核 ${needsReview}`,
    ...active,
  ];

  els.summaryStrip.innerHTML = pills.map((text) => `<span class="pill">${escapeHtml(text)}</span>`).join("");
}

function renderFlights(flights) {
  els.results.innerHTML = "";
  if (!flights.length) {
    els.results.innerHTML = '<div class="empty">找不到符合條件的航班</div>';
    return;
  }

  for (const flight of flights) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".flight-number").textContent = flight.flight_number;

    const badge = node.querySelector(".badge");
    badge.textContent = statusLabels[flight.verification_status] || flight.verification_status;
    badge.classList.add(flight.verification_status);

    node.querySelector(".dep").textContent = flight.departure_airport;
    node.querySelector(".arr").textContent = flight.arrival_airport;
    node.querySelector(".dep-time").textContent = flight.departure_time;
    node.querySelector(".arr-time").textContent = flight.arrival_time;
    node.querySelector(".meta-line").textContent =
      `${flight.airline} · ${flight.city_region} · ${formatDays(flight.flight_days)}`;

    const details = node.querySelector(".card-details");
    details.innerHTML = `
      <div class="detail-grid">
        <div><span>有效日期</span><strong>${escapeHtml(flight.valid_from)} 至 ${escapeHtml(flight.valid_to)}</strong></div>
        <div><span>機型</span><strong>${escapeHtml(flight.aircraft || "未提供")}</strong></div>
        <div><span>原始飛行日</span><strong>${escapeHtml(flight.flight_days_raw)}</strong></div>
        <div><span>資料來源</span><strong>${escapeHtml(flight.source)}</strong></div>
        <div><span>來源連結</span><a href="${escapeAttr(flight.source_url)}" target="_blank" rel="noreferrer">開啟來源</a></div>
        <div><span>備註</span><strong>${escapeHtml(flight.notes || "無")}</strong></div>
      </div>
    `;

    node.querySelector(".card-main").addEventListener("click", () => {
      details.hidden = !details.hidden;
    });
    els.results.append(node);
  }
}

async function loadOverview() {
  els.overviewContent.innerHTML = '<div class="empty">讀取中...</div>';
  const health = await fetchWithStaticFallback("/api/health", "data/health.json");
  const issueRoutes = health.route_integrity_checks.filter((row) => row.status !== "ok");

  els.overviewContent.innerHTML = `
    <section class="overview-block">
      <h3>總覽</h3>
      <dl class="stat-list">
        <div class="stat-row"><dt>資料庫</dt><dd><strong>${escapeHtml(health.database)}</strong></dd></div>
        <div class="stat-row"><dt>航班筆數</dt><dd><strong>${health.total_flights}</strong></dd></div>
      </dl>
    </section>
    <section class="overview-block">
      <h3>航空公司</h3>
      <dl class="stat-list">
        ${health.airline_counts.map((row) => statRow(row.airline, row.count)).join("")}
      </dl>
    </section>
    <section class="overview-block">
      <h3>查核狀態</h3>
      <dl class="stat-list">
        ${health.status_counts.map((row) => statRow(statusLabels[row.status] || row.status, row.count)).join("")}
      </dl>
    </section>
    <section class="overview-block ${issueRoutes.length ? "issue" : ""}">
      <h3>航線完整性</h3>
      <dl class="stat-list">
        ${issueRoutes.length ? issueRoutes.map((row) => statRow(row.route_pair, row.status)).join("") : statRow("所有航線對", "ok")}
      </dl>
    </section>
  `;
}

function statRow(label, value) {
  return `<div class="stat-row"><dt>${escapeHtml(String(label))}</dt><dd><strong>${escapeHtml(String(value))}</strong></dd></div>`;
}

function formatDays(days) {
  return days
    .split(",")
    .filter(Boolean)
    .map((day) => dayNames[day] || day)
    .join("、");
}

function openSheet(sheet) {
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeSheet(sheet) {
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
}

function bindEvents() {
  els.searchInput.addEventListener(
    "input",
    debounce((event) => {
      state.q = event.target.value.trim();
      loadFlights();
    })
  );

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    loadFlights();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      state.verification_status = tab.dataset.status;
      loadFlights();
    });
  });

  const filterBindings = [
    [els.airlineFilter, "airline"],
    [els.departureFilter, "departure_airport"],
    [els.arrivalFilter, "arrival_airport"],
    [els.cityFilter, "city_region"],
    [els.dayFilter, "day"],
  ];

  filterBindings.forEach(([element, key]) => {
    element.addEventListener("change", (event) => {
      state[key] = event.target.value;
      loadFlights();
    });
  });

  els.filterToggle.addEventListener("click", () => openSheet(els.filterSheet));
  els.closeFilters.addEventListener("click", () => closeSheet(els.filterSheet));
  els.overviewToggle.addEventListener("click", async () => {
    openSheet(els.overviewSheet);
    await loadOverview();
  });
  els.closeOverview.addEventListener("click", () => closeSheet(els.overviewSheet));

  els.resetFilters.addEventListener("click", () => {
    Object.assign(state, {
      airline: "",
      departure_airport: "",
      arrival_airport: "",
      city_region: "",
      day: "",
    });
    filterBindings.forEach(([element]) => {
      element.value = "";
    });
    loadFlights();
  });

  [els.filterSheet, els.overviewSheet].forEach((sheet) => {
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) closeSheet(sheet);
    });
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(String(value));
}

async function init() {
  bindEvents();
  await loadOptions();
  await loadFlights();
}

init().catch((error) => {
  els.results.innerHTML = `<div class="empty">讀取失敗：${escapeHtml(error.message)}</div>`;
});
