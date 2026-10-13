(() => {
  "use strict";

  const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10, label: "Easy" },
    medium: { rows: 16, cols: 16, mines: 40, label: "Medium" },
    difficult: { rows: 16, cols: 30, mines: 99, label: "Difficult" },
  };

  const DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  const SEGMENTS = {
    0: "abcdef",
    1: "bc",
    2: "abdeg",
    3: "abcdg",
    4: "bcfg",
    5: "acdfg",
    6: "acdefg",
    7: "abc",
    8: "abcdefg",
    9: "abcdfg",
    "-": "g",
  };

  const STORAGE_KEY = "minesweeper-best-times";
  const FACE_LABEL = {
    smile: "New game",
    oh: "New game",
    dead: "You lost. New game",
    cool: "You won. New game",
  };

  const boardEl = document.getElementById("board");
  const smiley = document.getElementById("smiley");
  const faceUse = document.getElementById("face-use");
  const mineReadout = document.getElementById("mine-readout");
  const timeReadout = document.getElementById("time-readout");
  const live = document.getElementById("live");
  const recordCopy = document.getElementById("record-copy");
  const recordName = document.getElementById("record-name");
  const recordForm = document.getElementById("record-form");

  const menus = [
    { btn: document.getElementById("game-menu-btn"), pop: document.getElementById("game-menu") },
    { btn: document.getElementById("help-menu-btn"), pop: document.getElementById("help-menu") },
  ];

  let difficulty = "easy";
  let marks = true;
  let rows = 9;
  let cols = 9;
  let mineCount = 10;
  let board = [];
  let cellEls = [];
  let minesPlaced = false;
  let status = "ready";
  let elapsed = 0;
  let startTime = 0;
  let timerId = 0;
  let bestTimes = loadStore();

  let leftDown = false;
  let rightDown = false;
  let middleDown = false;
  let chording = false;
  let hover = null;
  let smileyArmed = false;

  function loadStore() {
    const empty = { easy: null, medium: null, difficult: null, difficulty: "easy", marks: true };
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data || typeof data !== "object") return empty;
      for (const key of ["easy", "medium", "difficult"]) {
        const rec = data[key];
        if (
          rec &&
          Number.isInteger(rec.time) &&
          rec.time >= 0 &&
          rec.time <= 999 &&
          typeof rec.name === "string"
        ) {
          empty[key] = { time: rec.time, name: rec.name.slice(0, 32) };
        }
      }
      if (DIFFICULTIES[data.difficulty]) empty.difficulty = data.difficulty;
      if (typeof data.marks === "boolean") empty.marks = data.marks;
      return empty;
    } catch {
      return empty;
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        easy: bestTimes.easy,
        medium: bestTimes.medium,
        difficult: bestTimes.difficult,
        difficulty,
        marks,
      }));
    } catch {
      /* Private mode and file pages can refuse storage. The game still plays. */
    }
  }

  function createBoard() {
    board = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          mine: false,
          revealed: false,
          mark: "none",
          adjacent: 0,
          exploded: false,
          wrong: false,
        });
      }
      board.push(row);
    }
  }

  function forEachNeighbor(r, c, fn) {
    for (let i = 0; i < DIRS.length; i++) {
      const nr = r + DIRS[i][0];
      const nc = c + DIRS[i][1];
      if (nr >= 0 && nc >= 0 && nr < rows && nc < cols) fn(nr, nc);
    }
  }

  function placeMines(safeR, safeC) {
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        cell.mine = false;
        cell.adjacent = 0;
        if (r !== safeR || c !== safeC) candidates.push(cell);
      }
    }
    const count = Math.min(mineCount, candidates.length);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (candidates.length - i));
      const swap = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = swap;
      candidates[i].mine = true;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].mine) continue;
        forEachNeighbor(r, c, (nr, nc) => {
          board[nr][nc].adjacent += 1;
        });
      }
    }
    minesPlaced = true;
  }

  function revealFrom(r, c) {
    const stack = [[r, c]];
    let exploded = false;
    while (stack.length) {
      const pos = stack.pop();
      const y = pos[0];
      const x = pos[1];
      if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
      const cell = board[y][x];
      if (cell.revealed || cell.mark === "flag") continue;
      cell.revealed = true;
      if (cell.mine) {
        cell.exploded = true;
        exploded = true;
        continue;
      }
      if (cell.adjacent === 0) {
        forEachNeighbor(y, x, (nr, nc) => stack.push([nr, nc]));
      }
    }
    return exploded;
  }

  function isWin() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (!cell.mine && !cell.revealed) return false;
      }
    }
    return true;
  }

  function flagCount() {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mark === "flag") n += 1;
      }
    }
    return n;
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
  }

  function tick() {
    const next = Math.min(999, Math.floor((Date.now() - startTime) / 1000));
    if (next !== elapsed) {
      elapsed = next;
      paintReadout(timeReadout, elapsed, `Time ${elapsed} seconds`);
      if (elapsed >= 999) stopTimer();
    }
  }

  function startTimer() {
    stopTimer();
    startTime = Date.now();
    elapsed = 0;
    paintReadout(timeReadout, 0, "Time 0 seconds");
    timerId = setInterval(tick, 100);
  }

  function announce(text) {
    live.textContent = "";
    live.textContent = text;
  }

  function lose() {
    status = "lost";
    stopTimer();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.mine && cell.mark !== "flag") cell.revealed = true;
        else if (!cell.mine && cell.mark === "flag") cell.wrong = true;
      }
    }
    paintAll();
    paintMineCount();
    setFace("dead");
    announce("You hit a mine.");
  }

  function win() {
    status = "won";
    stopTimer();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) board[r][c].mark = "flag";
      }
    }
    paintAll();
    paintMineCount();
    setFace("cool");
    announce("You win.");
    const prev = bestTimes[difficulty];
    if (!prev || elapsed < prev.time) openRecord();
  }

  function finishOpen(exploded) {
    if (exploded) {
      lose();
      return;
    }
    if (isWin()) win();
    else {
      paintAll();
      paintMineCount();
      restoreFace();
    }
  }

  function ensureMines(r, c) {
    if (minesPlaced) return;
    placeMines(r, c);
    status = "playing";
    startTimer();
  }

  function primaryClick(r, c) {
    if (status === "won" || status === "lost") return;
    const cell = board[r][c];
    if (cell.revealed || cell.mark === "flag") return;
    ensureMines(r, c);
    finishOpen(revealFrom(r, c));
  }

  function chord(r, c) {
    if (status === "won" || status === "lost") return;
    const cell = board[r][c];
    if (!cell.revealed) return;
    let flags = 0;
    const targets = [];
    forEachNeighbor(r, c, (nr, nc) => {
      const neighbor = board[nr][nc];
      if (neighbor.mark === "flag") flags += 1;
      else if (!neighbor.revealed) targets.push([nr, nc]);
    });
    if (flags !== cell.adjacent) return;
    let exploded = false;
    for (let i = 0; i < targets.length; i++) {
      if (revealFrom(targets[i][0], targets[i][1])) exploded = true;
    }
    finishOpen(exploded);
  }

  function cycleMark(r, c) {
    if (status === "won" || status === "lost") return;
    const cell = board[r][c];
    if (cell.revealed) return;
    if (cell.mark === "none") cell.mark = "flag";
    else if (cell.mark === "flag") cell.mark = marks ? "question" : "none";
    else cell.mark = "none";
    paintCell(r, c);
    paintMineCount();
  }

  function icon(id) {
    return `<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  function contentFor(cell) {
    if (cell.wrong) return `${icon("icon-mine")}<span class="cross"></span>`;
    if (!cell.revealed) {
      if (cell.mark === "flag") return icon("icon-flag");
      if (cell.mark === "question") return '<span class="q">?</span>';
      return "";
    }
    if (cell.mine) return icon("icon-mine");
    if (cell.adjacent > 0) return `<span class="n n${cell.adjacent}">${cell.adjacent}</span>`;
    return "";
  }

  function visualKey(cell) {
    return [
      cell.revealed ? "1" : "0",
      cell.mine ? "1" : "0",
      cell.mark,
      cell.adjacent,
      cell.exploded ? "1" : "0",
      cell.wrong ? "1" : "0",
    ].join(":");
  }

  function ariaFor(cell, r, c) {
    const where = `row ${r + 1}, column ${c + 1}`;
    if (cell.wrong) return `Wrong flag, ${where}`;
    if (!cell.revealed) {
      if (cell.mark === "flag") return `Flagged, ${where}`;
      if (cell.mark === "question") return `Questioned, ${where}`;
      return `Hidden, ${where}`;
    }
    if (cell.mine) return `Mine, ${where}`;
    if (cell.adjacent === 0) return `Empty, ${where}`;
    return `${cell.adjacent}, ${where}`;
  }

  function paintCell(r, c) {
    const cell = board[r][c];
    const el = cellEls[r][c];
    const wasPressed = el.classList.contains("pressed");
    el.className = "cell";
    if (cell.exploded) el.classList.add("exploded");
    else if (cell.revealed || cell.wrong) el.classList.add("revealed");
    if (cell.wrong) el.classList.add("wrong");
    if (wasPressed && !cell.revealed && cell.mark !== "flag") el.classList.add("pressed");
    const key = visualKey(cell);
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      el.innerHTML = contentFor(cell);
    }
    el.setAttribute("aria-label", ariaFor(cell, r, c));
  }

  function paintAll() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) paintCell(r, c);
    }
  }

  function buildCells() {
    boardEl.style.setProperty("--cols", String(cols));
    boardEl.style.setProperty("--rows", String(rows));
    boardEl.replaceChildren();
    cellEls = [];
    for (let r = 0; r < rows; r++) {
      const rowEls = [];
      for (let c = 0; c < cols; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        boardEl.appendChild(btn);
        rowEls.push(btn);
      }
      cellEls.push(rowEls);
    }
    paintAll();
  }

  function formatCounter(n) {
    if (n > 999) n = 999;
    if (n < -99) n = -99;
    if (n < 0) return `-${String(Math.abs(n)).padStart(2, "0")}`;
    return String(n).padStart(3, "0");
  }

  function paintReadout(root, value, label) {
    const text = typeof value === "number" ? formatCounter(value) : value;
    const digits = root.querySelectorAll(".digit");
    for (let i = 0; i < digits.length; i++) {
      const on = SEGMENTS[text[i]] || "";
      const segs = digits[i].querySelectorAll(".seg");
      for (let s = 0; s < segs.length; s++) {
        const name = segs[s].dataset.seg;
        segs[s].classList.toggle("on", on.includes(name));
      }
    }
    root.setAttribute("aria-label", label);
  }

  function paintMineCount() {
    const left = mineCount - flagCount();
    paintReadout(mineReadout, left, `Mines remaining ${left}`);
  }

  function makeReadout(root) {
    root.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const digit = document.createElement("div");
      digit.className = "digit";
      for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
        const seg = document.createElement("span");
        const axis = name === "a" || name === "d" || name === "g" ? "h" : "v";
        seg.className = `seg seg-${name} ${axis}`;
        seg.dataset.seg = name;
        digit.appendChild(seg);
      }
      root.appendChild(digit);
    }
  }

  function setFace(name) {
    const href = `#face-${name}`;
    faceUse.setAttribute("href", href);
    smiley.setAttribute("aria-label", FACE_LABEL[name]);
  }

  function restoreFace() {
    if ((leftDown || middleDown || chording) && (status === "ready" || status === "playing")) {
      setFace("oh");
      return;
    }
    if (status === "won") setFace("cool");
    else if (status === "lost") setFace("dead");
    else setFace("smile");
  }

  function clearPressed() {
    const pressed = boardEl.querySelectorAll(".cell.pressed");
    for (let i = 0; i < pressed.length; i++) pressed[i].classList.remove("pressed");
  }

  function showPressed(coords) {
    clearPressed();
    for (let i = 0; i < coords.length; i++) {
      const r = coords[i][0];
      const c = coords[i][1];
      const cell = board[r][c];
      if (cell.revealed || cell.mark === "flag") continue;
      cellEls[r][c].classList.add("pressed");
    }
  }

  function refreshPress() {
    if (status === "won" || status === "lost" || !hover) {
      clearPressed();
      return;
    }
    if (chording) {
      const coords = [[hover.r, hover.c]];
      forEachNeighbor(hover.r, hover.c, (nr, nc) => coords.push([nr, nc]));
      showPressed(coords);
      return;
    }
    if (leftDown) showPressed([[hover.r, hover.c]]);
    else clearPressed();
  }

  function cellFromEvent(event) {
    const el = event.target.closest(".cell");
    if (!el || !boardEl.contains(el)) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
  }

  function buttonsDown() {
    return leftDown || rightDown || middleDown;
  }

  function onBoardMouseDown(event) {
    if (event.button === 1) event.preventDefault();
    if (status === "won" || status === "lost") return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    if (event.button === 0) leftDown = true;
    else if (event.button === 2) rightDown = true;
    else if (event.button === 1) middleDown = true;
    else return;
    hover = cell;
    if (event.button === 1 || (leftDown && rightDown)) chording = true;
    refreshPress();
    restoreFace();
  }

  function onBoardMouseOver(event) {
    if (!buttonsDown()) return;
    hover = cellFromEvent(event);
    refreshPress();
  }

  function onBoardMouseOut(event) {
    if (boardEl.contains(event.relatedTarget)) return;
    hover = null;
    refreshPress();
  }

  function onDocumentMouseUp(event) {
    const tracked =
      (event.button === 0 && leftDown) ||
      (event.button === 2 && rightDown) ||
      (event.button === 1 && middleDown);
    if (!tracked) return;

    if (event.button === 0) leftDown = false;
    if (event.button === 2) rightDown = false;
    if (event.button === 1) middleDown = false;

    const pos = hover;
    const wasChord = chording;
    clearPressed();

    if (event.button === 2 && !wasChord && !leftDown && pos) cycleMark(pos.r, pos.c);

    if (wasChord && !buttonsDown()) {
      chording = false;
      if (pos) {
        const cell = board[pos.r][pos.c];
        if (cell.revealed) chord(pos.r, pos.c);
        else primaryClick(pos.r, pos.c);
      }
    } else if (event.button === 0 && !wasChord && pos) {
      primaryClick(pos.r, pos.c);
    } else if (event.button === 1 && pos) {
      const cell = board[pos.r][pos.c];
      if (cell.revealed) chord(pos.r, pos.c);
      else primaryClick(pos.r, pos.c);
    }

    if (!buttonsDown()) {
      hover = null;
      chording = false;
      clearPressed();
    } else {
      refreshPress();
    }
    restoreFace();
  }

  function onBoardClick(event) {
    if (event.detail !== 0) return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    primaryClick(cell.r, cell.c);
  }

  function updateMenuChecks() {
    const items = document.querySelectorAll("[data-difficulty]");
    for (let i = 0; i < items.length; i++) {
      const on = items[i].dataset.difficulty === difficulty;
      items[i].querySelector(".tick").hidden = !on;
    }
    document.getElementById("marks-tick").hidden = !marks;
  }

  function closeMenus() {
    for (let i = 0; i < menus.length; i++) {
      menus[i].pop.hidden = true;
      menus[i].btn.setAttribute("aria-expanded", "false");
    }
  }

  function toggleMenu(menu) {
    const open = menu.pop.hidden;
    closeMenus();
    if (open) {
      menu.pop.hidden = false;
      menu.btn.setAttribute("aria-expanded", "true");
    }
  }

  function overlayOpen() {
    return (
      !document.getElementById("about-overlay").hidden ||
      !document.getElementById("record-overlay").hidden ||
      !document.getElementById("best-overlay").hidden
    );
  }

  function fillBestDialog() {
    for (const key of ["easy", "medium", "difficult"]) {
      const rec = bestTimes[key];
      document.getElementById(`time-${key}`).textContent = rec ? String(rec.time).padStart(3, "0") : "999";
      document.getElementById(`name-${key}`).textContent = rec ? rec.name : "Anonymous";
    }
  }

  function openAbout() {
    closeMenus();
    document.getElementById("about-overlay").hidden = false;
    document.getElementById("about-ok").focus();
  }

  function openBest() {
    closeMenus();
    fillBestDialog();
    document.getElementById("best-overlay").hidden = false;
    document.getElementById("best-ok").focus();
  }

  function openRecord() {
    const spec = DIFFICULTIES[difficulty];
    recordCopy.textContent = `You have the fastest time for ${spec.label}: ${elapsed} second${elapsed === 1 ? "" : "s"}.`;
    recordName.value = bestTimes[difficulty] ? bestTimes[difficulty].name : "";
    document.getElementById("record-overlay").hidden = false;
    recordName.focus();
    recordName.select();
  }

  function closeOverlay(id) {
    document.getElementById(id).hidden = true;
  }

  function commitRecord(name) {
    const trimmed = name.trim().slice(0, 32);
    bestTimes[difficulty] = { time: elapsed, name: trimmed || "Anonymous" };
    saveStore();
    closeOverlay("record-overlay");
    openBest();
  }

  function newGame() {
    const spec = DIFFICULTIES[difficulty];
    rows = spec.rows;
    cols = spec.cols;
    mineCount = spec.mines;
    stopTimer();
    elapsed = 0;
    minesPlaced = false;
    status = "ready";
    leftDown = false;
    rightDown = false;
    middleDown = false;
    chording = false;
    hover = null;
    createBoard();
    buildCells();
    paintMineCount();
    paintReadout(timeReadout, 0, "Time 0 seconds");
    setFace("smile");
    updateMenuChecks();
    saveStore();
    announce(`${spec.label} game. ${mineCount} mines.`);
  }

  function onMenuAction(action, button) {
    if (action === "new") newGame();
    else if (action === "difficulty") {
      difficulty = button.dataset.difficulty;
      newGame();
    } else if (action === "marks") {
      marks = !marks;
      updateMenuChecks();
      saveStore();
    } else if (action === "best") openBest();
    else if (action === "about") openAbout();
    closeMenus();
  }

  smiley.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    smileyArmed = true;
    smiley.classList.add("down");
  });

  smiley.addEventListener("mouseup", () => {
    if (!smileyArmed) return;
    smileyArmed = false;
    smiley.classList.remove("down");
    newGame();
  });

  smiley.addEventListener("mouseleave", () => {
    smileyArmed = false;
    smiley.classList.remove("down");
  });

  boardEl.addEventListener("mousedown", onBoardMouseDown);
  boardEl.addEventListener("mouseover", onBoardMouseOver);
  boardEl.addEventListener("mouseout", onBoardMouseOut);
  boardEl.addEventListener("click", onBoardClick);
  boardEl.addEventListener("contextmenu", (event) => event.preventDefault());
  boardEl.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  document.addEventListener("mouseup", onDocumentMouseUp);
  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".board") || event.target.closest(".smiley")) event.preventDefault();
  });

  for (let i = 0; i < menus.length; i++) {
    const menu = menus[i];
    menu.btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(menu);
    });
    menu.pop.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      onMenuAction(button.dataset.action, button);
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu")) closeMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenus();
      if (!document.getElementById("record-overlay").hidden) {
        commitRecord(recordName.value);
        return;
      }
      closeOverlay("about-overlay");
      closeOverlay("best-overlay");
      return;
    }
    if (event.key === "F2" && !overlayOpen() && document.activeElement !== recordName) {
      event.preventDefault();
      closeMenus();
      newGame();
    }
  });

  document.getElementById("about-ok").addEventListener("click", () => closeOverlay("about-overlay"));
  document.getElementById("best-ok").addEventListener("click", () => closeOverlay("best-overlay"));
  document.getElementById("best-reset").addEventListener("click", () => {
    bestTimes.easy = null;
    bestTimes.medium = null;
    bestTimes.difficult = null;
    saveStore();
    fillBestDialog();
  });
  recordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    commitRecord(recordName.value);
  });

  for (const overlay of [
    document.getElementById("about-overlay"),
    document.getElementById("record-overlay"),
    document.getElementById("best-overlay"),
  ]) {
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) {
        if (overlay.id === "record-overlay") commitRecord(recordName.value);
        overlay.hidden = true;
      }
    });
  }

  window.addEventListener("blur", () => {
    leftDown = false;
    rightDown = false;
    middleDown = false;
    chording = false;
    hover = null;
    smileyArmed = false;
    smiley.classList.remove("down");
    clearPressed();
    restoreFace();
  });

  makeReadout(mineReadout);
  makeReadout(timeReadout);
  difficulty = bestTimes.difficulty;
  marks = bestTimes.marks;
  newGame();
})();
