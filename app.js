/* ====== 基本資料 ====== */
const DAYS = ["星期一", "星期二", "星期三", "星期四", "星期五"];
const TIME_SLOTS = [
    "08:10\n09:00", "09:10\n10:00", "10:10\n11:00", "11:10\n12:00",
    "13:10\n14:00", "14:10\n15:00", "15:10\n16:00", "16:10\n17:00",
    "17:10\n18:00", "18:20\n19:10", "19:15\n20:05", "20:10\n21:00", "21:05\n21:55"
];
// dom
const gridEl = document.getElementById("grid");
const btnScan = document.getElementById("btnScan");
const btnClear = document.getElementById("btnClear");

// scanner dom
const modal = document.getElementById("qrModal");
const video = document.getElementById("cam");
const canvas = document.getElementById("qrCanvas");
const hint = document.getElementById("qrHint");
const btnCapture = document.getElementById("btnCapture");
const btnClose = document.getElementById("btnClose");
const btnPick = document.getElementById("btnPick");
const fileInput = document.getElementById("fileInput");

let mediaStream = null;

/* ====== 畫課表 ====== */
function buildEmptyGrid() {
    const headerRow = document.createElement("div");
    headerRow.className = "row";
    // 左上角空白
    let c = document.createElement("div"); c.className = "cell header"; c.textContent = "時間"; headerRow.appendChild(c);
    DAYS.forEach(d => {
        const h = document.createElement("div");
        h.className = "cell header"; h.textContent = d;
        headerRow.appendChild(h);
    });
    gridEl.appendChild(headerRow);

    TIME_SLOTS.forEach((t, r) => {
        const row = document.createElement("div");
        row.className = "row";

        const tc = document.createElement("div");
        tc.className = "cell time"; tc.textContent = t;
        row.appendChild(tc);

        for (let d = 0; d < DAYS.length; d++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.r = r; cell.dataset.d = d;
            row.appendChild(cell);
        }
        gridEl.appendChild(row);
    });
}

function clearGridCourses() {
    // 清掉每格內的課程卡片
    gridEl.querySelectorAll(".cell:not(.time):not(.header)").forEach(c => c.innerHTML = "");
}

function renderTimetable(courseList) {
    // courseList: [{w:<1~5>, s:[<slotIndex>...], n:課名, m:科目代碼, c:??, e:教室...}]
    clearGridCourses();
    if (!Array.isArray(courseList)) return;

    courseList.forEach(item => {
        const dayIdx = (item.w ?? item.week ?? 1) - 1; // 1-5 -> 0-4
        const slots = item.s || item.slots || [];
        if (dayIdx < 0 || dayIdx > 4 || !Array.isArray(slots)) return;

        slots.forEach(slot => {
            const cell = gridEl.querySelector(`.cell[data-d="${dayIdx}"][data-r="${slot - 1}"]`);
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

/* ====== 儲存／清空 ====== */
function saveData(data) {
    localStorage.setItem("timetableData", JSON.stringify(data ?? []));
}

function loadData() {
    const raw = localStorage.getItem("timetableData");
    if (!raw) return null;
    try { return JSON.parse(raw) } catch { return null }
}

function clearAll() {
    clearGridCourses();
    localStorage.removeItem("timetableData");
    // 也不使用 firstVisit 旗標（永遠空白模式）
}

/* ====== QR 解析（BarcodeDetector / 影像上傳） ====== */
async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        video.srcObject = mediaStream;
        await video.play();
        hint.textContent = "把 QR 放在畫面中央，對焦後自動辨識";
    } catch (err) {
        hint.innerHTML = "相機無法啟用（可能未授權，或非 Safari）。<br>請用 Safari 開啟，並允許相機；或直接上傳含 QR 的圖片辨識。";
    }
}

async function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (video.srcObject) { video.srcObject = null }
    video.pause();
}

function openModal() {
    modal.classList.add("open");
    startCamera();
}
async function closeModal() {
    await stopCamera();
    modal.classList.remove("open");
}

async function scanOnceFromVideo() {
    // 使用 BarcodeDetector（可用時）
    if ('BarcodeDetector' in window) {
        try {
            const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
            const bitmap = await createImageBitmap(video);
            const codes = await detector.detect(bitmap);
            bitmap.close();
            if (codes && codes.length) {
                return codes[0].rawValue;
            }
        } catch { }
    }
    // 從拍照的截圖檔來掃描（交給 capture 實作）
    return null;
}

function dataURLFromVideo() {
    const w = video.videoWidth || 1280, h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/png");
}

// 解析圖片（使用 BarcodeDetector 解析 ImageBitmap）
async function decodeFromDataURL(dataURL) {
    if (!('BarcodeDetector' in window)) return null;
    const res = await fetch(dataURL);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    try {
        const det = new window.BarcodeDetector({ formats: ["qr_code"] });
        const list = await det.detect(bmp);
        bmp.close();
        if (list && list.length) return list[0].rawValue;
    } catch { }
    return null;
}

async function handleQRRawString(raw) {
    // 預期 raw 是 JSON 字串（學校 QR 內容）
    try {
        const parsed = JSON.parse(raw);
        // 允許是 Array（直接是多筆）
        let courses = [];
        if (Array.isArray(parsed)) {
            courses = parsed;
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.courses)) {
            courses = parsed.courses;
        } else {
            // 單一物件
            courses = [parsed];
        }
        renderTimetable(courses);
        saveData(courses);
        await closeModal();
        alert("課表已匯入！");
    } catch (e) {
        console.error("無法解析 QR 內容：", raw);
        alert("無法解析此 QR 內容（已印在 console）");
    }
}

/* ====== 事件 ====== */
// 永遠空白（不載入 localStorage）
window.onload = () => {
    gridEl.innerHTML = "";
    buildEmptyGrid();
    // 不自動載入任何資料
};

// 掃描按鈕
btnScan.addEventListener("click", openModal);
btnClose.addEventListener("click", closeModal);

// 拍照辨識
btnCapture.addEventListener("click", async () => {
    // 先嘗試直接從 video 影像偵測（部分瀏覽器支援）
    const live = await scanOnceFromVideo();
    if (live) {
        await handleQRRawString(live);
        return;
    }
    // 截圖 -> 解析
    const dataURL = dataURLFromVideo();
    const decoded = await decodeFromDataURL(dataURL);
    if (decoded) {
        await handleQRRawString(decoded);
    } else {
        alert("辨識失敗，請再試一次或改用『上傳圖片』");
    }
});

// 上傳圖片 fallback
btnPick.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataURL = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(file);
    });
    const decoded = await decodeFromDataURL(dataURL);
    if (decoded) {
        await handleQRRawString(decoded);
    } else {
        alert("辨識失敗，請換張清晰的 QR 圖片");
    }
});

// 清空
btnClear.addEventListener("click", () => {
    if (!confirm("確定清空課表？")) return;
    clearAll();
    alert("已清空！");
});
