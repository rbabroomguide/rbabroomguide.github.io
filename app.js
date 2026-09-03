/* RBAB Room Guide — Rixos Bab Al Bahr
   Reads RBAB_DATA (from data.js) and renders a building- and floor-tabbed,
   interactive room guide with filtering, a coverage dashboard, a feature
   glossary, dark mode, and recently-viewed rooms. */

const TYPE_COLOR = {
  KGA: "var(--c-kga)", KGAOV: "var(--c-kgaov)", KGE: "var(--c-kge)", KGEOV: "var(--c-kgeov)",
  TWA: "var(--c-twa)", TWAOV: "var(--c-twaov)", SKA: "var(--c-ska)", SKB: "var(--c-skb)",
  SKC: "var(--c-skc)", SKD: "var(--c-skd)", SKP: "var(--c-skp)", SXA: "var(--c-sxa)", PI: "var(--c-pi)",
};

// Feature code meanings, confirmed against the hotel's official Opera code list.
const GLOSSARY = {
  BAL:    { label: "Balcony", conf: "high" },
  NBA:    { label: "No Balcony", conf: "high" },
  S:      { label: "Small Balcony", conf: "high" },
  KGB:    { label: "King Bed", conf: "high" },
  TWB:    { label: "Twin Bed", conf: "high" },
  BBE:    { label: "Bunk Bed", conf: "high" },
  SOF:    { label: "Sofa Cum Bed", conf: "high" },
  "1EXBED": { label: "1 Extra Bed Space in Room", conf: "high" },
  "2EXBED": { label: "2 Extra Bed Space in Room", conf: "high" },
  GAR:    { label: "Garden View", conf: "high" },
  GRD:    { label: "Ground Floor", conf: "high" },
  POO:    { label: "Pool View", conf: "high" },
  BEA:    { label: "Beach View", conf: "high" },
  ROA:    { label: "Road View", conf: "high" },
  CAV:    { label: "Car Park View", conf: "high" },
  MAN:    { label: "Main Entrance View", conf: "high" },
  COS:    { label: "Corniche Sea View", conf: "high" },
  TER:    { label: "Terrace", conf: "high" },
  NSM:    { label: "Non-Smoking", conf: "high" },
  HCA:    { label: "Disabled Room (Handicap Accessible)", conf: "high" },
  INT:    { label: "Interconnecting Room", conf: "high" },
  KTC:    { label: "Kitchenette", conf: "high" },
  COR:    { label: "Corner Room", conf: "high" },
  SA:     { label: "Small Room, No Extra Bed Space", conf: "high" },
  ZMR:    { label: "Zumroud (building reference)", conf: "high" },
  AMJ:    { label: "Amwaj (building reference)", conf: "high" },
  MRM:    { label: "Marmar (building reference)", conf: "high" },
  "1ST": { label: "First Floor", conf: "high" }, "2ND": { label: "Second Floor", conf: "high" },
  "3RD": { label: "Third Floor", conf: "high" }, "4TH": { label: "Fourth Floor", conf: "high" },
  "5TH": { label: "Fifth Floor", conf: "high" }, "6TH": { label: "Sixth Floor", conf: "high" },
  "7TH": { label: "Seventh Floor", conf: "high" }, "8TH": { label: "Eighth Floor", conf: "high" },
};

const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

let currentBuilding = null;
let currentFloor = null;
let activeRoom = null;
let filters = { types: new Set(), codes: new Set(), connectOnly: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function typeColor(type) { return TYPE_COLOR[type] || "var(--c-pi)"; }

// Normalize inconsistent capitalization/spacing straight from the sheet
function titleCase(str) {
  if (!str) return "";
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.toLowerCase().split(" ").map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function imgPath(building, roomNum) { return `images/${building}/${roomNum}.jpg`; }
function thumbPath(building, roomNum) { return `thumbs/${building}/${roomNum}.jpg`; }
function buildingData(key) { return RBAB_DATA.buildings[key]; }

function findRoomAnyBuilding(roomNum) {
  for (const bkey of RBAB_DATA.buildingOrder) {
    const b = buildingData(bkey);
    if (b.rooms[String(roomNum)]) return { building: bkey, room: b.rooms[String(roomNum)] };
  }
  return null;
}

/* ================= Theme ================= */
function initTheme() {
  const saved = localStorage.getItem("rbab-theme");
  const theme = saved || "light";
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("rbab-theme", next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = $("#themeToggle");
  if (!btn) return;
  btn.innerHTML = theme === "dark"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
}

/* ================= Recently viewed ================= */
function getRecent() {
  try { return JSON.parse(localStorage.getItem("rbab-recent") || "[]"); } catch (e) { return []; }
}
function addRecent(bkey, roomNum) {
  let recent = getRecent().filter((r) => !(r.b === bkey && r.r === roomNum));
  recent.unshift({ b: bkey, r: roomNum });
  recent = recent.slice(0, 8);
  localStorage.setItem("rbab-recent", JSON.stringify(recent));
}
function renderRecent() {
  const recent = getRecent();
  const wrap = $("#recentWrap");
  if (!recent.length) { wrap.innerHTML = ""; return; }
  let html = `<div class="recent-label">Recently viewed</div><div class="recent-strip">`;
  recent.forEach((r) => {
    const b = buildingData(r.b);
    if (!b || !b.rooms[String(r.r)]) return;
    html += `<button class="rchip" data-b="${r.b}" data-r="${r.r}">${r.r}</button>`;
  });
  html += `</div>`;
  wrap.innerHTML = html;
  $$(".rchip", wrap).forEach((btn) => {
    btn.addEventListener("click", () => showDetail(btn.dataset.b, Number(btn.dataset.r)));
  });
}

/* ================= Building / floor tabs ================= */
function buildBuildingTabs() {
  const wrap = $("#buildingTabs");
  wrap.innerHTML = "";
  RBAB_DATA.buildingOrder.forEach((key) => {
    const b = buildingData(key);
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.dataset.building = key;
    btn.addEventListener("click", () => selectBuilding(key));
    wrap.appendChild(btn);
  });
}

function selectBuilding(key) {
  currentBuilding = key;
  $$("#buildingTabs button").forEach((b) => b.classList.toggle("active", b.dataset.building === key));
  buildFloorTabs();
  selectFloor(buildingData(key).floorOrder[0]);
}

function buildFloorTabs() {
  const b = buildingData(currentBuilding);
  const wrap = $("#floorTabs");
  wrap.innerHTML = "";

  b.floorOrder.forEach((key) => {
    const f = b.floors[key];
    const btn = document.createElement("button");
    btn.textContent = f.label;
    btn.dataset.floor = key;
    btn.addEventListener("click", () => selectFloor(key));
    wrap.appendChild(btn);
  });
}

function selectFloor(key) {
  currentFloor = key;
  filters = { types: new Set(), codes: new Set(), connectOnly: false };
  $$("#floorTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.floor === key));
  renderFloor(key);
  clearDetail();
}

function stepFloor(delta) {
  const b = buildingData(currentBuilding);
  const idx = b.floorOrder.indexOf(currentFloor);
  const next = idx + delta;
  if (next >= 0 && next < b.floorOrder.length) selectFloor(b.floorOrder[next]);
}

/* ================= Grid rendering ================= */
function roomsForFloor(bkey, fkey) {
  return Object.values(buildingData(bkey).rooms).filter((r) => r.floor === fkey);
}

function renderFloor(key) {
  const grid = $("#grid");
  grid.classList.add("transitioning");
  renderFloorContent(key);
  requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.remove("transitioning")));
}

function renderFloorContent(key) {
  const b = buildingData(currentBuilding);
  const f = b.floors[key];
  const rooms = roomsForFloor(currentBuilding, key);

  $("#floorTitle").textContent = f.label;
  $("#roomCount").textContent = rooms.length;
  const withConnect = rooms.filter((r) => r.connecting != null).length;
  $("#connectCount").textContent = withConnect;
  const noPhoto = rooms.filter((r) => !r.hasPhoto && r.type !== "PI").length;
  const photoStat = $("#photoStat");
  if (noPhoto > 0) { $("#noPhotoCount").textContent = noPhoto; photoStat.style.display = ""; }
  else { photoStat.style.display = "none"; }

  const grid = $("#grid");
  grid.innerHTML = "";
  const tileSize = isTouch ? 48 : 62;
  grid.style.gridTemplateColumns = `repeat(${f.cols}, ${tileSize}px)`;
  grid.style.gridTemplateRows = `repeat(${f.rows}, ${tileSize}px)`;

  rooms.forEach((r) => {
    const tile = document.createElement("div");
    tile.className = "tile room-tile";
    tile.dataset.room = r.room;
    tile.style.gridColumn = r.col + 1;
    tile.style.gridRow = r.row + 1;

    if (r.hasPhoto) {
      tile.classList.add("has-thumb");
      tile.style.backgroundImage = `linear-gradient(to bottom, rgba(20,15,10,0.18), rgba(20,15,10,0.62)), url(${thumbPath(currentBuilding, r.room)})`;
      tile.innerHTML = `<span class="type-dot" style="background:${typeColor(r.type)}"></span><div class="rnum">${r.room}</div><div class="rtype">${r.type}</div>`;
    } else {
      tile.style.background = typeColor(r.type);
      tile.classList.add("no-photo");
      tile.innerHTML = `<div class="rnum">${r.room}</div><div class="rtype">${r.type}</div>`;
    }

    if (r.connecting != null) tile.classList.add("link-badge");
    attachRoomEvents(tile, r.room);
    grid.appendChild(tile);
  });

  f.facilities.forEach((fac) => {
    const tile = document.createElement("div");
    tile.className = "tile facility";
    if (fac.label === "Atrium") tile.classList.add("atrium");
    tile.style.gridColumn = fac.col + 1;
    tile.style.gridRow = fac.row + 1;
    tile.textContent = fac.label;
    grid.appendChild(tile);
  });

  buildLegend(rooms);
  buildFilterBar(rooms);
}

function attachRoomEvents(tile, roomNum) {
  if (!isTouch) tile.addEventListener("mouseenter", () => showDetail(currentBuilding, roomNum));
  tile.addEventListener("click", () => {
    if (isTouch && activeRoom === roomNum) clearDetail();
    else showDetail(currentBuilding, roomNum);
  });
}

/* ================= Building overview (all buildings, modal) ================= */
function openOverview() {
  let html = "";
  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    const allRooms = Object.values(b.rooms);
    const guestRooms = allRooms.filter((r) => r.type !== "PI");
    const withPhoto = guestRooms.filter((r) => r.hasPhoto).length;
    const pct = Math.round((withPhoto / guestRooms.length) * 100);
    const withConnect = allRooms.filter((r) => r.connecting != null).length;

    const typeCounts = {};
    guestRooms.forEach((r) => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
    const maxCount = Math.max(...Object.values(typeCounts));

    html += `<div class="ov-building-block">
      <h3 class="ov-building-heading">${b.label}</h3>
      <div class="overview-stats">
        <div class="ov-stat-card"><div class="ov-num">${allRooms.length}</div><div class="ov-label">Total Rooms</div></div>
        <div class="ov-stat-card"><div class="ov-num">${b.floorOrder.length}</div><div class="ov-label">Floors</div></div>
        <div class="ov-stat-card"><div class="ov-num">${withConnect}</div><div class="ov-label">Interconnecting</div></div>
        <div class="ov-stat-card"><div class="ov-num">${pct}%</div><div class="ov-label">Photo Coverage</div></div>
      </div>

      <div class="ov-type-bars">`;
    Object.entries(typeCounts).sort((a, b2) => b2[1] - a[1]).forEach(([t, count]) => {
      html += `<div class="ov-type-row">
        <span class="ov-type-label">${t}</span>
        <span class="ov-type-track"><span class="ov-type-fill" style="width:${(count / maxCount) * 100}%; background:${typeColor(t)}"></span></span>
        <span class="ov-type-count">${count}</span>
      </div>`;
    });
    html += `</div><div class="ov-floor-list">`;

    b.floorOrder.forEach((fkey) => {
      const f = b.floors[fkey];
      const floorRooms = allRooms.filter((r) => r.floor === fkey);
      const floorGuestRooms = floorRooms.filter((r) => r.type !== "PI");
      const floorPhoto = floorGuestRooms.filter((r) => r.hasPhoto).length;
      const floorPct = floorGuestRooms.length ? Math.round((floorPhoto / floorGuestRooms.length) * 100) : 100;
      html += `<div class="ov-floor-card" data-building="${bkey}" data-floor="${fkey}">
        <span class="ov-floor-name">${f.label}</span>
        <span class="ov-floor-bar"><span class="ov-floor-fill" style="width:${floorPct}%"></span></span>
        <span class="ov-floor-stat">${floorRooms.length} rooms · ${floorPct}% photographed</span>
        <span class="ov-floor-arrow">→</span>
      </div>`;
    });
    html += `</div></div>`;
  });

  const wrap = $("#overviewBody");
  wrap.innerHTML = html;
  $$(".ov-floor-card", wrap).forEach((card) => {
    card.addEventListener("click", () => {
      closeOverview();
      selectBuilding(card.dataset.building);
      selectFloor(card.dataset.floor);
    });
  });

  $("#overviewModal").classList.add("show");
}
function closeOverview() { $("#overviewModal").classList.remove("show"); }


/* ================= Legend ================= */
function buildLegend(rooms) {
  const types = Array.from(new Set(rooms.map((r) => r.type))).sort();
  const legend = $("#legend");
  legend.innerHTML = "";
  types.forEach((t) => {
    const sample = rooms.find((r) => r.type === t);
    const label = titleCase(sample ? sample.description : t);
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<span class="swatch" style="background:${typeColor(t)}"></span>${t} — ${label}`;
    legend.appendChild(item);
  });
  legend.insertAdjacentHTML("beforeend", `
    <div class="item"><span class="swatch" style="background:var(--c-facility)"></span>Elevator</div>
    <div class="item"><span class="swatch" style="background:var(--c-atrium)"></span>Atrium</div>
    <div class="item"><span class="swatch" style="background:var(--gold-accent)"></span>Interconnecting room</div>
  `);
}

/* ================= Filter bar ================= */
function buildFilterBar(rooms) {
  const bar = $("#filterBar");
  bar.innerHTML = "";

  const types = Array.from(new Set(rooms.map((r) => r.type))).sort();
  types.forEach((t) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.textContent = t;
    chip.addEventListener("click", () => {
      if (filters.types.has(t)) filters.types.delete(t); else filters.types.add(t);
      chip.classList.toggle("active");
      applyFilters();
    });
    bar.appendChild(chip);
  });

  const sep1 = document.createElement("div");
  sep1.className = "filter-sep";
  bar.appendChild(sep1);

  const codes = Array.from(new Set(rooms.flatMap((r) => r.codes))).sort();
  codes.forEach((c) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.textContent = c;
    chip.title = GLOSSARY[c] ? GLOSSARY[c].label : "Meaning not yet confirmed";
    chip.addEventListener("click", () => {
      if (filters.codes.has(c)) filters.codes.delete(c); else filters.codes.add(c);
      chip.classList.toggle("active");
      applyFilters();
    });
    bar.appendChild(chip);
  });

  const sep2 = document.createElement("div");
  sep2.className = "filter-sep";
  bar.appendChild(sep2);

  const connChip = document.createElement("button");
  connChip.className = "filter-chip";
  connChip.textContent = "Interconnecting only";
  connChip.addEventListener("click", () => {
    filters.connectOnly = !filters.connectOnly;
    connChip.classList.toggle("active");
    applyFilters();
  });
  bar.appendChild(connChip);

  const clear = document.createElement("button");
  clear.className = "filter-clear";
  clear.textContent = "Clear filters";
  clear.style.display = "none";
  clear.addEventListener("click", () => {
    filters = { types: new Set(), codes: new Set(), connectOnly: false };
    buildFilterBar(rooms);
    applyFilters();
  });
  bar.appendChild(clear);

  const count = document.createElement("span");
  count.className = "filter-match-count";
  count.id = "filterMatchCount";
  bar.appendChild(count);

  applyFilters();
}

function filtersActive() {
  return filters.types.size || filters.codes.size || filters.connectOnly;
}

function roomMatchesFilters(r) {
  if (filters.types.size && !filters.types.has(r.type)) return false;
  if (filters.codes.size) {
    for (const c of filters.codes) { if (!r.codes.includes(c)) return false; }
  }
  if (filters.connectOnly && r.connecting == null) return false;
  return true;
}

function applyFilters() {
  const rooms = roomsForFloor(currentBuilding, currentFloor);
  const active = filtersActive();
  let matchCount = 0;

  rooms.forEach((r) => {
    const tile = $(`.tile.room-tile[data-room="${r.room}"]`);
    if (!tile) return;
    const match = roomMatchesFilters(r);
    tile.classList.toggle("filtered-out", active && !match);
    if (match) matchCount++;
  });

  const clearBtn = $(".filter-clear", $("#filterBar"));
  const countEl = $("#filterMatchCount");
  if (clearBtn) clearBtn.style.display = active ? "" : "none";
  if (countEl) countEl.textContent = active ? `${matchCount} of ${rooms.length} match` : "";

  renderCrossBuildingPanel(active);
}

/* ================= Cross-building matches ================= */
function renderCrossBuildingPanel(active) {
  const panel = $("#crossPanel");
  if (!active) { panel.style.display = "none"; return; }
  panel.style.display = "";

  const otherBuildings = RBAB_DATA.buildingOrder.filter((b) => b !== currentBuilding);
  let html = "";
  let totalMatches = 0;

  otherBuildings.forEach((bkey) => {
    const b = buildingData(bkey);
    const matches = Object.values(b.rooms)
      .filter(roomMatchesFilters)
      .sort((a, c) => a.room - c.room);
    totalMatches += matches.length;
    html += `<div class="cross-group">
      <div class="cross-group-label">${b.label} <span class="cnt">(${matches.length})</span></div>
      <div class="cross-list">`;
    if (matches.length) {
      matches.forEach((r) => {
        html += `<span class="cross-chip" data-b="${bkey}" data-r="${r.room}">${r.room}</span>`;
      });
    } else {
      html += `<span class="cross-empty">No matches</span>`;
    }
    html += `</div></div>`;
  });

  $("#crossBody").innerHTML = html;

  $$(".cross-chip", $("#crossBody")).forEach((chip) => {
    const bkey = chip.dataset.b;
    const rnum = chip.dataset.r;
    const room = buildingData(bkey).rooms[rnum];

    chip.addEventListener("click", () => showDetail(bkey, Number(rnum)));

    if (room.hasPhoto) {
      chip.addEventListener("mouseenter", () => {
        const hp = $("#hoverPreview");
        $("#hpImg").src = thumbPath(bkey, rnum);
        hp.classList.add("show");
      });
      chip.addEventListener("mousemove", (e) => {
        const hp = $("#hoverPreview");
        let left = e.clientX + 16;
        let top = e.clientY + 16;
        if (left + 200 > window.innerWidth) left = e.clientX - 216;
        if (top + 113 > window.innerHeight) top = e.clientY - 129;
        hp.style.left = left + "px";
        hp.style.top = top + "px";
      });
      chip.addEventListener("mouseleave", () => {
        $("#hoverPreview").classList.remove("show");
      });
    }
  });
}

/* ================= Detail panel ================= */
function clearDetail() {
  activeRoom = null;
  $("#detailEmpty").style.display = "flex";
  $("#detailRoom").classList.remove("show");
  $$(".tile.room-tile").forEach((t) => t.classList.remove("active", "linked", "dim"));
  renderRecent();
}

function showDetail(bkey, roomNum) {
  const b = buildingData(bkey);
  const room = b.rooms[String(roomNum)];
  if (!room) return;
  activeRoom = roomNum;
  addRecent(bkey, roomNum);

  if (bkey !== currentBuilding) {
    currentBuilding = bkey;
    $$("#buildingTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.building === bkey));
    buildFloorTabs();
  }
  if (room.floor !== currentFloor) {
    currentFloor = room.floor;
    filters = { types: new Set(), codes: new Set(), connectOnly: false };
    $$("#floorTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.floor === room.floor));
    renderFloor(room.floor);
  }

  $("#detailEmpty").style.display = "none";
  $("#detailRoom").classList.add("show");

  const label = titleCase(room.description) || room.type;
  $("#dRoomNum").textContent = room.room;
  const pill = $("#dTypePill");
  pill.textContent = room.type;
  pill.style.background = typeColor(room.type);
  $("#dDesc").textContent = label;

  const photoFrame = $("#dPhoto");
  if (room.hasPhoto) {
    photoFrame.classList.add("skeleton");
    photoFrame.innerHTML = `<img src="${imgPath(bkey, room.room)}" alt="View from room ${room.room}">`;
    const imgEl = $("#dPhoto img");
    imgEl.addEventListener("load", () => { imgEl.classList.add("loaded"); photoFrame.classList.remove("skeleton"); });
    imgEl.addEventListener("click", () => openLightbox(imgPath(bkey, room.room), `Room ${room.room} — view`));
  } else {
    photoFrame.classList.remove("skeleton");
    photoFrame.innerHTML = `<div class="no-img">
      <svg class="no-img-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l18 18M10.5 5H17a2 2 0 0 1 2 2v9.5M3 7v10a2 2 0 0 0 2 2h11.5"/><circle cx="12" cy="13" r="3.2"/></svg><br>
      No photo available yet<br>for room ${room.room}</div>`;
  }

  const tagsWrap = $("#dTags");
  tagsWrap.innerHTML = "";
  if (room.codes && room.codes.length) {
    room.codes.forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tag.title = GLOSSARY[c] ? `${GLOSSARY[c].label}${GLOSSARY[c].conf === "low" ? " (unconfirmed)" : ""}` : "Meaning not yet confirmed";
      tagsWrap.appendChild(tag);
    });
  } else {
    tagsWrap.innerHTML = `<div class="no-codes">No feature codes listed for this room.</div>`;
  }

  const connectWrap = $("#dConnect");
  if (room.connecting != null) {
    const other = b.rooms[String(room.connecting)];
    connectWrap.innerHTML = `<div class="connect-title">🔗 Interconnecting with Room ${room.connecting}</div>`;
    const card = document.createElement("div");
    card.className = "connect-room-card";
    const otherLabel = other ? titleCase(other.description) : "";
    card.innerHTML = `
      <div class="cphoto">${
        other && other.hasPhoto
          ? `<img src="${imgPath(bkey, other.room)}" alt="View from room ${other.room}">`
          : `<div class="thumb-empty">No photo available yet</div>`
      }</div>
      <div class="cmeta">
        <div><strong>Room ${room.connecting}</strong><br><span class="ctype">${other ? `${other.type} — ${otherLabel}` : ""}</span></div>
        <span class="go">View room →</span>
      </div>`;
    if (other && other.hasPhoto) {
      card.querySelector(".cphoto img").addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(imgPath(bkey, other.room), `Room ${other.room} — view`);
      });
    }
    card.querySelector(".cmeta").addEventListener("click", () => showDetail(bkey, room.connecting));
    connectWrap.appendChild(card);
  } else {
    connectWrap.innerHTML = `<div class="no-connect">This room is not interconnecting.</div>`;
  }

  highlightConnections(room);
  renderRecent();
}

function highlightConnections(room) {
  $$(".tile.room-tile").forEach((t) => {
    const rn = Number(t.dataset.room);
    t.classList.remove("active", "linked", "dim");
    if (rn === room.room) t.classList.add("active");
    else if (room.connecting != null && rn === room.connecting) t.classList.add("linked");
    else t.classList.add("dim");
  });
}

/* ================= Lightbox ================= */
function openLightbox(src, caption) {
  $("#lbImg").src = src;
  $("#lbCaption").textContent = caption || "";
  $("#lightbox").classList.add("show");
}
function closeLightbox() { $("#lightbox").classList.remove("show"); }

/* ================= Coverage dashboard ================= */
function openDashboard() {
  const wrap = $("#dashBody");
  let html = "";
  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    // PI (Posting Interface) rooms are non-guest-facing and never get a photo,
    // so they're excluded from coverage tracking entirely.
    const rooms = Object.values(b.rooms).filter((r) => r.type !== "PI");
    const withPhoto = rooms.filter((r) => r.hasPhoto).length;
    const pct = Math.round((withPhoto / rooms.length) * 100);
    html += `<div class="dash-building">
      <h3>${b.label} <span class="pct">${withPhoto} / ${rooms.length} rooms photographed (${pct}%)</span></h3>
      <div class="dash-bar"><div class="dash-bar-fill" style="width:${pct}%"></div></div>`;
    b.floorOrder.forEach((fkey) => {
      const f = b.floors[fkey];
      const floorRooms = rooms.filter((r) => r.floor === fkey);
      if (!floorRooms.length) return;
      const missing = floorRooms.filter((r) => !r.hasPhoto).map((r) => r.room).sort((a, c) => a - c);
      html += `<div class="dash-floor-row">
        <span><b>${f.label}</b> — ${floorRooms.length - missing.length}/${floorRooms.length}</span>
        <span class="missing-list">${missing.length ? missing.join(", ") : "complete"}</span>
      </div>`;
    });
    html += `</div>`;
  });
  wrap.innerHTML = html;
  $("#dashboardModal").classList.add("show");
}
function closeDashboard() { $("#dashboardModal").classList.remove("show"); }

/* ================= Glossary ================= */
function openGlossary() {
  const wrap = $("#glossBody");
  const rows = Object.entries(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0]));
  let html = `<table class="gloss-table"><thead><tr><th>Code</th><th>Meaning</th><th>Confidence</th></tr></thead><tbody>`;
  rows.forEach(([code, info]) => {
    const badgeClass = info.conf === "high" ? "conf-high" : info.conf === "med" ? "conf-med" : "conf-low";
    const badgeLabel = info.conf === "high" ? "Confirmed" : info.conf === "med" ? "Likely" : "Unconfirmed";
    html += `<tr><td><code>${code}</code></td><td>${info.label}</td><td><span class="conf-badge ${badgeClass}">${badgeLabel}</span></td></tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
  $("#glossaryModal").classList.add("show");
}
function closeGlossary() { $("#glossaryModal").classList.remove("show"); }

/* ================= Search (global, live dropdown) ================= */
function allRoomsFlat() {
  const out = [];
  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    Object.values(b.rooms).forEach((r) => out.push({ building: bkey, buildingLabel: b.label, room: r }));
  });
  return out;
}

let searchHighlight = -1;

function setupSearch() {
  const input = $("#searchInput");
  const dropdown = $("#searchDropdown");
  const allRooms = allRoomsFlat();

  function renderResults(matches) {
    searchHighlight = -1;
    if (!matches.length) {
      dropdown.innerHTML = `<div class="sd-empty">No matching room</div>`;
    } else {
      dropdown.innerHTML = matches.slice(0, 8).map((m, i) => `
        <div class="sd-item" data-idx="${i}" data-b="${m.building}" data-r="${m.room.room}">
          <span class="sd-room">${m.room.room}</span>
          <span class="sd-meta">${m.buildingLabel} · ${m.room.type}</span>
        </div>`).join("");
      $$(".sd-item", dropdown).forEach((el) => {
        el.addEventListener("click", () => {
          showDetail(el.dataset.b, Number(el.dataset.r));
          input.value = "";
          dropdown.classList.remove("show");
          input.blur();
        });
      });
    }
    dropdown.classList.add("show");
  }

  input.addEventListener("input", () => {
    const val = input.value.trim();
    if (!val) { dropdown.classList.remove("show"); return; }
    const matches = allRooms.filter((m) => String(m.room.room).startsWith(val));
    renderResults(matches);
  });

  input.addEventListener("keydown", (e) => {
    const items = $$(".sd-item", dropdown);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchHighlight = Math.min(searchHighlight + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle("hl", i === searchHighlight));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchHighlight = Math.max(searchHighlight - 1, 0);
      items.forEach((it, i) => it.classList.toggle("hl", i === searchHighlight));
    } else if (e.key === "Enter") {
      if (searchHighlight >= 0 && items[searchHighlight]) {
        items[searchHighlight].click();
      } else {
        const found = findRoomAnyBuilding(input.value.trim());
        if (found) { showDetail(found.building, found.room.room); input.value = ""; dropdown.classList.remove("show"); input.blur(); }
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      dropdown.classList.remove("show");
      input.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!$("#searchWrap").contains(e.target)) dropdown.classList.remove("show");
  });
}

/* ================= Keyboard shortcuts ================= */
function setupShortcuts() {
  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

    if (e.key === "Escape") {
      if ($("#tourOverlay").classList.contains("show")) endTour();
      else if ($("#lightbox").classList.contains("show")) closeLightbox();
      else if ($("#overviewModal").classList.contains("show")) closeOverview();
      else if ($("#dashboardModal").classList.contains("show")) closeDashboard();
      else if ($("#glossaryModal").classList.contains("show")) closeGlossary();
      else if (typing) document.activeElement.blur();
      else clearDetail();
      return;
    }
    if (typing) return;

    if (e.key === "/") { e.preventDefault(); $("#searchInput").focus(); }
    else if (e.key === "d" || e.key === "D") { toggleTheme(); }
    else if (e.key === "ArrowLeft") { stepFloor(-1); }
    else if (e.key === "ArrowRight") { stepFloor(1); }
  });
}

/* ================= Auth gate =================
   Client-side only: this deters casual link-sharing, it does not secure the
   photos or data, which remain reachable at their direct URLs regardless. */
const AUTH_USER = "RBABFRONT";
const AUTH_PASS = "RoomGuide@@2026$$";

function isAuthed() {
  return localStorage.getItem("rbab-auth") === "ok";
}

function setupAuthGate() {
  const form = $("#authForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#authUser").value.trim();
    const p = $("#authPass").value;
    if (u === AUTH_USER && p === AUTH_PASS) {
      localStorage.setItem("rbab-auth", "ok");
      $("#authGate").classList.add("hidden");
      $("#mainApp").style.display = "";
      initApp();
    } else {
      $("#authError").classList.add("show");
    }
  });
}

/* ================= First-visit tour ================= */
const TOUR_STEPS = [
  { sel: "#buildingTabs", title: "Switch buildings", text: "Jump between Zumroud, Amwaj, and Marmar here." },
  { sel: "#floorTabs", title: "Pick a floor", text: "Each building's floors are listed here." },
  { sel: "#filterBar", title: "Filter the floor", text: "Isolate a room type or feature, or show only interconnecting rooms — matches in other buildings show up in the sidebar too." },
  { sel: "#searchWrap", title: "Jump to any room", text: "Type a room number from any building to go straight to it." },
  { sel: "#overviewBtn", title: "All-buildings overview", text: "Room counts, type breakdown, and coverage for all three buildings at a glance." },
  { sel: "#dashboardBtn", title: "Coverage dashboard", text: "See exactly which rooms still need a photo, floor by floor." },
  { sel: "#glossaryBtn", title: "Feature glossary", text: "Every Opera feature code, decoded." },
];
let tourIdx = 0;

function positionTour() {
  const step = TOUR_STEPS[tourIdx];
  const target = document.querySelector(step.sel);
  if (!target) { nextTourStep(); return; }
  const rect = target.getBoundingClientRect();
  const pad = 6;
  const hl = $("#tourHighlight");
  hl.style.left = (rect.left - pad) + "px";
  hl.style.top = (rect.top - pad) + "px";
  hl.style.width = (rect.width + pad * 2) + "px";
  hl.style.height = (rect.height + pad * 2) + "px";

  const card = $("#tourCard");
  $("#tourStepLabel").textContent = `Step ${tourIdx + 1} of ${TOUR_STEPS.length}`;
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  $("#tourNext").textContent = tourIdx === TOUR_STEPS.length - 1 ? "Done" : "Next";

  const cardWidth = isTouch ? 240 : 280;
  let top = rect.bottom + 16;
  let left = Math.min(Math.max(rect.left, 10), window.innerWidth - cardWidth - 10);
  if (top + 140 > window.innerHeight) top = Math.max(rect.top - 160, 10);
  card.style.top = top + "px";
  card.style.left = left + "px";
}

function nextTourStep() {
  tourIdx++;
  if (tourIdx >= TOUR_STEPS.length) { endTour(); return; }
  positionTour();
}

function startTour() {
  tourIdx = 0;
  $("#tourOverlay").classList.add("show");
  positionTour();
}

function endTour() {
  $("#tourOverlay").classList.remove("show");
  localStorage.setItem("rbab-tour-seen", "yes");
}

/* ================= Init ================= */
function initApp() {
  initTheme();
  if (isTouch) $("#detailHint").innerHTML = "Tap a room on the plan<br>to see its view and features.";
  buildBuildingTabs();
  setupSearch();
  setupShortcuts();

  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#overviewBtn").addEventListener("click", openOverview);
  $("#dashboardBtn").addEventListener("click", openDashboard);
  $("#glossaryBtn").addEventListener("click", openGlossary);
  $("#overviewModal").addEventListener("click", (e) => { if (e.target.id === "overviewModal") closeOverview(); });
  $("#dashboardModal").addEventListener("click", (e) => { if (e.target.id === "dashboardModal") closeDashboard(); });
  $("#glossaryModal").addEventListener("click", (e) => { if (e.target.id === "glossaryModal") closeGlossary(); });
  $("#overviewClose").addEventListener("click", closeOverview);
  $("#dashboardClose").addEventListener("click", closeDashboard);
  $("#glossaryClose").addEventListener("click", closeGlossary);
  $("#lightbox").addEventListener("click", closeLightbox);

  $("#tourBtn").addEventListener("click", startTour);
  $("#tourNext").addEventListener("click", nextTourStep);
  $("#tourSkip").addEventListener("click", endTour);
  window.addEventListener("resize", () => {
    if ($("#tourOverlay").classList.contains("show")) positionTour();
  });

  selectBuilding(RBAB_DATA.buildingOrder[0]);
  renderRecent();

  if (!localStorage.getItem("rbab-tour-seen")) {
    setTimeout(startTour, 500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (isAuthed()) {
    $("#authGate").classList.add("hidden");
    $("#mainApp").style.display = "";
    initApp();
  } else {
    setupAuthGate();
  }
});
