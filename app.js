/* =======================
   常數與 DOM
======================= */
const DAYS = ["星期一", "星期二", "星期三", "星期四", "星期五"];
const TIME_SLOTS = [
    "08:10\n09:00", "09:10\n10:00", "10:10\n11:00", "11:10\n12:00",
    "13:10\n14:00", "14:10\n15:00", "15:10\n16:00", "16:10\n17:00",
    "17:10\n18:00", "18:20\n19:10", "19:15\n20:05", "20:10\n21:00", "21:05\n21:55"
];

const gridEl = document.getElementById("grid");
const btnScan = document.getElementById("btnScan");
const btnClear = document.getElementById("btnClear");

// Modal + Scanner
const modal = document.getElementById("qrModal");
const video = document.getElementById("cam");
const canvas = document.getElementById("qrCanvas");
const hint = document.getElementById("qrHint");
const btnCapture = document.getElementById("btnCapture");
const btnClose = document.getElementById("btnClose");
const btnPick = document.getElementById("btnPick");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");

let mediaStream = null;

/* =======================
   畫課表表格（空白格線）
======================= */
function buildEmptyGrid() {
    gridEl.innerHTML = "";

    // 標題列
    const header = document.createElement("div");
    header.className = "row";
    let hc = document.createElement("div");
    hc.className = "cell header"; hc.textContent = "時間";
    header.appendChild(hc);
    DAYS.forEach(d => {
        let h = document.createElement("div");
        h.className = "cell header"; h.textContent = d;
        header.appendChild(h);
    });
    gridEl.appendChild(header);

    // 時段列
    TIME_SLOTS.forEach((t, r) => {
        const row = document.createElement("div");
        row.className = "row";

        const tc = document.createElement("div");
        tc.className = "cell time";
        tc.textContent = t; // 使用 CSS white-space: pre-line 顯示換行
        row.appendChild(tc);

        for (let d = 0; d < DAYS.length; d++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.d = d;
            row.appendChild(cell);
        }
        gridEl.appendChild(row);
    });
}

// 清空格子課程（保留格線）
function clearGridCourses() {
    gridEl.querySelectorAll(".cell:not(.header):not(.time)").forEach(c => c.innerHTML = "");
}

// 把課程資料塞入格子
function renderTimetable(list) {
    clearGridCourses();
    if (!Array.isArray(list)) return;

    list.forEach(item => {
        const d = (item.w ?? item.week ?? 1) - 1;    // 1..5 -> 0..4
        const slots = item.s || item.slots || [];
        if (d < 0 || d > 4 || !Array.isArray(slots)) return;

        slots.forEach(s => {
            const cell = gridEl.querySelector(`.cell[data-d="${d}"][data-r="${s - 1}"]`);
            if (!cell) return;

            const card = document.createElement("div");
            card.className = "course-card";
            const name = document.createElement("div");
            name.className = "course-name";
            name.textContent = item.n || item.name || "(未命名課程)";
            const meta = document.createElement("div");
            meta.className = "course-meta";
            const code = item.m || item.code || "";
            const room = item.e || item.room || "";
            meta.textContent = [code, room].filter(Boolean).join("・");
            card.appendChild(name);
            card.appendChild(meta);
            cell.appendChild(card);
        });
    });
}

/* =======================
   儲存 / 清空
======================= */
function saveData(data) { localStorage.setItem("timetableData", JSON.stringify(data ?? [])); }
function loadData() {
    try {
        const raw = localStorage.getItem("timetableData");
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}
function clearAll() {
    localStorage.removeItem("timetableData");
    buildEmptyGrid();   // 重新建立表格
}

/* =======================
   QR 解析 & 匯入
======================= */
function tryParseSchedule(text) {
    // 有些學校 QR 會帶一串文字 + JSON，我們抓第一個 '[' 開始到最後一個 ']'。
    try {
        let payload = text.trim();
        const l = payload.indexOf("[");
        const r = payload.lastIndexOf("]");
        if (l !== -1 && r !== -1 && r > l) {
            payload = payload.slice(l, r + 1);
        }
        const data = JSON.parse(payload);
        if (Array.isArray(data)) return data;
    } catch { }
    throw new Error("無法解析此 QR 內容");
}

function handleDecodedText(text) {
    try {
        const list = tryParseSchedule(text);
        renderTimetable(list);
        saveData(list);
        alert("已匯入課程！");
        closeScanner();
    } catch (e) {
        console.error(e);
        alert("無法解析此 QR 內容，已列印在 console");
    }
}

/* =======================
   相機 / 上傳圖片
======================= */
async function openScanner() {
    modal.classList.remove("hidden");
    hint.style.display = "none";
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = mediaStream;
        await video.play();
    } catch (err) {
        console.warn("相機無法啟用：", err);
        hint.style.display = "block";
    }
}

function closeScanner() {
    modal.classList.add("hidden");
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    video.srcObject = null;
}

function captureAndDecode() {
    if (!video.videoWidth) {
        alert("相機尚未就緒，請稍後再試或使用『上傳圖片』");
        return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height);
    if (code && code.data) {
        handleDecodedText(code.data);
    } else {
        alert("未辨識到 QR，請調整距離/光線再試。");
    }
}

fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileName.textContent = file.name;
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) { handleDecodedText(code.data); }
        else { alert("圖片中未辨識到 QR"); }
    };
    img.onerror = () => alert("圖片載入失敗");
    img.src = URL.createObjectURL(file);
});

/* =======================
   綁定事件
======================= */
window.onload = () => {
    buildEmptyGrid();                       // 建立空白格線
    const saved = loadData();               // 若本機有資料才載入
    if (saved && Array.isArray(saved) && saved.length) {
        renderTimetable(saved);
    }
};

btnScan.addEventListener("click", openScanner);
btnClose.addEventListener("click", closeScanner);
btnCapture.addEventListener("click", captureAndDecode);
btnClear.addEventListener("click", () => {
    if (confirm("確定要清空本機的課程資料嗎？")) {
        clearAll();
    }
});
