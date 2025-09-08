// ===== 全域狀態 =====
let state = {
    semester: "114-1",
    note: "",
    cells: []
};

// ===== 課表維度 =====
const DAYS = ['星期一', '星期二', '星期三', '星期四', '星期五'];
const ROW_LABELS = [
    "08:10\n|\n09:00",
    "09:10\n|\n10:00",
    "10:10\n|\n11:00",
    "11:10\n|\n12:00",
    "13:10\n|\n14:00",
    "14:10\n|\n15:00",
    "15:10\n|\n16:00",
    "16:10\n|\n17:00",
    "17:10\n|\n18:00",
    "18:20\n|\n19:10",
    "19:15\n|\n20:05",
    "20:10\n|\n21:00",
    "21:05\n|\n21:55"
];
const rowCount = ROW_LABELS.length;
const colCount = DAYS.length;

// ===== DOM =====
const grid = document.getElementById('grid');
const importDlg = document.getElementById('importDlg');
const importTxt = document.getElementById('importTxt');

// ===== 工具 =====
const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.innerText = text;
    return e;
};
const save = () => localStorage.setItem('schedule', JSON.stringify(state));
const load = () => {
    const raw = localStorage.getItem('schedule');
    if (raw) state = JSON.parse(raw);
    if (!state.cells.length) {
        state.cells = Array.from({ length: rowCount }, () => Array(colCount).fill(''));
    }
};
load();

// ===== 繪製表格 =====
function build() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `56px repeat(${colCount},1fr)`;

    // 標題列
    grid.appendChild(el('div', 'th', '星期/節次'));
    for (const d of DAYS) grid.appendChild(el('div', 'th', d));

    // 時間+課表
    for (let r = 0; r < rowCount; r++) {
        const timeCell = el('div', 'td time', ROW_LABELS[r]);
        timeCell.style.whiteSpace = 'pre-line';
        grid.appendChild(timeCell);
        for (let c = 0; c < colCount; c++) {
            const cell = el('div', 'td cell', state.cells[r][c]);
            cell.dataset.r = r; cell.dataset.c = c;
            cell.onclick = editCell;
            grid.appendChild(cell);
        }
    }
}

// ===== 編輯格子 =====
function editCell(e) {
    const r = +this.dataset.r, c = +this.dataset.c;
    const txt = prompt("輸入課程內容：", state.cells[r][c]);
    if (txt !== null) {
        state.cells[r][c] = txt;
        save(); build();
    }
}

// ===== 按鈕動作 =====
document.getElementById('btnAdd').onclick = () => {
    alert("請點選表格格子以編輯。");
};
document.getElementById('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "schedule.json";
    a.click();
};
document.getElementById('btnImport').onclick = () => {
    importTxt.value = '';
    importDlg.showModal();
};
document.getElementById('btnImportOk').onclick = () => {
    try {
        const j = JSON.parse(importTxt.value);
        if (Array.isArray(j.cells)) {
            state = j; save(); build(); importDlg.close();
        } else alert("格式錯誤");
    } catch { alert("解析失敗"); }
};
document.getElementById('btnImportCancel').onclick = () => importDlg.close();
document.getElementById('btnClear').onclick = () => {
    if (confirm("確定清空？")) {
        state.cells = Array.from({ length: rowCount }, () => Array(colCount).fill(''));
        save(); build();
    }
};

// ===== QR 掃描 =====
const scanDlg = document.getElementById('scanDlg');
const scanVideo = document.getElementById('scanVideo');
let scanStream = null, scanTimer = null;

document.getElementById('btnScan').addEventListener('click', startScan);
document.getElementById('btnScanClose').addEventListener('click', stopScan);

async function startScan() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('相機需要 HTTPS（建議部署 GitHub Pages）');
        return;
    }
    try {
        scanDlg.showModal();
        scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scanVideo.srcObject = scanStream;
        await scanVideo.play();
        loopScan();
    } catch (err) { console.error(err); alert('打不開相機'); stopScan(); }
}
function stopScan() {
    if (scanTimer) cancelAnimationFrame(scanTimer);
    if (scanStream) scanStream.getTracks().forEach(t => t.stop());
    scanDlg.close();
}
function loopScan() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const tick = () => {
        if (!scanVideo.videoWidth) { scanTimer = requestAnimationFrame(tick); return; }
        canvas.width = scanVideo.videoWidth;
        canvas.height = scanVideo.videoHeight;
        ctx.drawImage(scanVideo, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) { handleQrPayload(code.data.trim()); stopScan(); return; }
        scanTimer = requestAnimationFrame(tick);
    };
    tick();
}
async function handleQrPayload(text) {
    console.log("QR內容:", text);
    try {
        if (/^https?:\/\//i.test(text)) {
            const res = await fetch(text); const body = await res.text();
            if (!tryImportAsAppJSON(body) && !tryImportAsCSV(body)) alert("無法解析 URL 內容");
            return;
        }
        if (tryImportAsAppJSON(text)) return;
        if (tryImportAsCSV(text)) return;
        alert("無法解析此 QR 內容，已列印在 console");
    } catch (err) { console.error(err); alert("解析失敗"); }
}
function tryImportAsAppJSON(raw) {
    try {
        const j = JSON.parse(raw);
        if (Array.isArray(j.cells)) {
            state = { ...state, ...j }; save(); build(); alert("已從 JSON 匯入課表"); return true;
        }
    } catch { }
    return false;
}
function tryImportAsCSV(raw) {
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return false;
    const sep = raw.includes(',') ? ',' : '\t';
    const slots = ROW_LABELS.map(s => {
        const p = s.split('\n'); return { start: p[0], end: p[p.length - 1] };
    });
    const rowByTime = {}; slots.forEach((s, i) => rowByTime[s.start] = i);
    let ok = false;
    for (const ln of lines) {
        const arr = ln.split(sep); if (arr.length < 4) continue;
        const day = +arr[0], beg = arr[1].trim(), fin = arr[2].trim(), txt = arr.slice(3).join(sep);
        if (!day || !rowByTime[beg]) continue;
        const rStart = rowByTime[beg]; let rEnd = rStart;
        for (let i = rStart; i < slots.length; i++) { if (slots[i].end === fin) { rEnd = i; break; } }
        const c = day - 1;
        for (let r = rStart; r <= rEnd && c >= 0 && c < colCount; r++) { state.cells[r][c] = txt; ok = true; }
    }
    if (ok) { save(); build(); alert("已從 CSV 匯入"); }
    return ok;
}

// ===== 啟動 =====
build();
