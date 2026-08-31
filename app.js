/* RBAB Room Guide — Rixos Bab Al Bahr
   Reads RBAB_DATA (from data.js) and renders a building- and floor-tabbed,
   interactive room guide. */

const TYPE_COLOR = {
  KGA:   "var(--c-kga)",
  KGAOV: "var(--c-kgaov)",
  KGE:   "var(--c-kge)",
  KGEOV: "var(--c-kgeov)",
  TWA:   "var(--c-twa)",
  TWAOV: "var(--c-twaov)",
  SKA:   "var(--c-ska)",
  SKB:   "var(--c-skb)",
  SKC:   "var(--c-skc)",
  SKD:   "var(--c-skd)",
  SKP:   "var(--c-skp)",
  SXA:   "var(--c-sxa)",
  PI:    "var(--c-pi)",
};

const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

let currentBuilding = null;
let currentFloor = null;
let activeRoom = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function typeColor(type) {
  return TYPE_COLOR[type] || "var(--c-pi)";
}

// Normalize inconsistent capitalization/spacing straight from the sheet
// (e.g. "DELUXE KING GARDEN" / "Deluxe King  Garden" -> "Deluxe King Garden")
function titleCase(str) {
  if (!str) return "";
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function imgPath(building, roomNum) {
  return `images/${building}/${roomNum}.jpg`;
}

function buildingData(key) {
  return RBAB_DATA.buildings[key];
}

function findRoomAnyBuilding(roomNum) {
  for (const bkey of RBAB_DATA.buildingOrder) {
    const b = buildingData(bkey);
    if (b.rooms[String(roomNum)]) {
      return { building: bkey, room: b.rooms[String(roomNum)] };
    }
  }
  return null;
}

/* ---------------- Building tabs ---------------- */
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
  const b = buildingData(key);
  selectFloor(b.floorOrder[0]);
}

/* ---------------- Floor tabs ---------------- */
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
  $$("#floorTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.floor === key));
  renderFloor(key);
  clearDetail();
}

/* ---------------- Grid rendering ---------------- */
function roomsForFloor(bkey, fkey) {
  const b = buildingData(bkey);
  return Object.values(b.rooms).filter((r) => r.floor === fkey);
}

function renderFloor(key) {
  const b = buildingData(currentBuilding);
  const f = b.floors[key];
  const rooms = roomsForFloor(currentBuilding, key);

  $("#floorTitle").textContent = f.label;
  $("#roomCount").textContent = rooms.length;
  const withConnect = rooms.filter((r) => r.connecting !== null && r.connecting !== undefined).length;
  $("#connectCount").textContent = withConnect;
  const noPhoto = rooms.filter((r) => !r.hasPhoto).length;
  const photoStat = $("#photoStat");
  if (noPhoto > 0) {
    $("#noPhotoCount").textContent = noPhoto;
    photoStat.style.display = "";
  } else {
    photoStat.style.display = "none";
  }

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
    tile.style.background = typeColor(r.type);
    if (!r.hasPhoto) tile.classList.add("no-photo");

    tile.innerHTML = `<div class="rnum">${r.room}</div><div class="rtype">${r.type}</div>`;

    if (r.connecting !== null && r.connecting !== undefined) {
      tile.classList.add("link-badge");
    }

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
}

function attachRoomEvents(tile, roomNum) {
  if (!isTouch) {
    tile.addEventListener("mouseenter", () => showDetail(currentBuilding, roomNum));
  }
  tile.addEventListener("click", () => {
    if (isTouch && activeRoom === roomNum) {
      clearDetail();
    } else {
      showDetail(currentBuilding, roomNum);
    }
  });
}

/* ---------------- Legend ---------------- */
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
  const facItem = document.createElement("div");
  facItem.className = "item";
  facItem.innerHTML = `<span class="swatch" style="background:var(--c-facility)"></span>Elevator`;
  legend.appendChild(facItem);
  const atrItem = document.createElement("div");
  atrItem.className = "item";
  atrItem.innerHTML = `<span class="swatch" style="background:var(--c-atrium)"></span>Atrium`;
  legend.appendChild(atrItem);
  const linkItem = document.createElement("div");
  linkItem.className = "item";
  linkItem.innerHTML = `<span class="swatch" style="background:var(--link-gold)"></span>Interconnecting room</span>`;
  legend.appendChild(linkItem);
}

/* ---------------- Detail panel ---------------- */
function clearDetail() {
  activeRoom = null;
  $("#detailEmpty").style.display = "flex";
  $("#detailRoom").classList.remove("show");
  $$(".tile.room-tile").forEach((t) => {
    t.classList.remove("active", "linked", "dim");
  });
}

function showDetail(bkey, roomNum) {
  const b = buildingData(bkey);
  const room = b.rooms[String(roomNum)];
  if (!room) return;
  activeRoom = roomNum;

  // switch building/floor if needed (e.g. jumping via search or a connecting-room card)
  if (bkey !== currentBuilding) {
    currentBuilding = bkey;
    $$("#buildingTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.building === bkey));
    buildFloorTabs();
  }
  if (room.floor !== currentFloor) {
    currentFloor = room.floor;
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
    photoFrame.innerHTML = `<img src="${imgPath(bkey, room.room)}" alt="View from room ${room.room}">`;
    $("#dPhoto img").addEventListener("click", () => openLightbox(imgPath(bkey, room.room), `Room ${room.room} — view`));
  } else {
    photoFrame.innerHTML = `<div class="no-img">No photo available yet<br>for room ${room.room}</div>`;
  }

  const tagsWrap = $("#dTags");
  tagsWrap.innerHTML = "";
  if (room.codes && room.codes.length) {
    room.codes.forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tagsWrap.appendChild(tag);
    });
  } else {
    tagsWrap.innerHTML = `<div class="no-codes">No feature codes listed for this room.</div>`;
  }

  const connectWrap = $("#dConnect");
  if (room.connecting !== null && room.connecting !== undefined) {
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
        <div>
          <strong>Room ${room.connecting}</strong><br>
          <span class="ctype">${other ? `${other.type} — ${otherLabel}` : ""}</span>
        </div>
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
}

function highlightConnections(room) {
  $$(".tile.room-tile").forEach((t) => {
    const rn = Number(t.dataset.room);
    t.classList.remove("active", "linked", "dim");
    if (rn === room.room) {
      t.classList.add("active");
    } else if (room.connecting !== null && room.connecting !== undefined && rn === room.connecting) {
      t.classList.add("linked");
    } else {
      t.classList.add("dim");
    }
  });
}

/* ---------------- Lightbox ---------------- */
function openLightbox(src, caption) {
  const lb = $("#lightbox");
  $("#lbImg").src = src;
  $("#lbCaption").textContent = caption || "";
  lb.classList.add("show");
}

function closeLightbox() {
  $("#lightbox").classList.remove("show");
}

/* ---------------- Search (global across all buildings) ---------------- */
function setupSearch() {
  const input = $("#searchInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = input.value.trim();
      const found = findRoomAnyBuilding(val);
      if (found) {
        showDetail(found.building, found.room.room);
        input.value = "";
        input.blur();
      }
    }
  });
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (isTouch) {
    $("#detailHint").innerHTML = "Tap a room on the plan<br>to see its view and features.";
  }
  buildBuildingTabs();
  setupSearch();
  const lb = $("#lightbox");
  lb.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
  selectBuilding(RBAB_DATA.buildingOrder[0]);
});
