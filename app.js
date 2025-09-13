/*********************
 * 常數與全域狀態
 *********************/
const TIMES = [
    "08:10-09:00", "09:10-10:00", "10:10-11:00", "11:10-12:00",
    "13:10-14:00", "14:10-15:00", "15:10-16:00", "16:10-17:00",
    "17:10-18:00", "18:20-19:10", "19:15-20:05", "20:10-21:00", "21:05-21:55"
];
// 顯示到第幾節（索引從 0 起算；6 = 顯示 0..5，也就是 08:10 ~ 16:00）
const VISIBLE_SLOTS = 6;
const WEEKS = [1, 2, 3, 4, 5];
const STORAGE_KEY = "nchu-schedule-v1";

let schedule = loadSchedule(); // 結構：{ "1-0":[{name,teacher,room}, ...], ... }

/*********************
 * DOM
 *********************/
const tableWrap = document.getElementById("tableWrap");
const btnScan = document.getElementById("btnScan");
const btnClear = document.getElementById("btnClear");

// 掃描器
const scanner = document.getElementById("scanner");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const btnCloseScan = document.getElementById("btnCloseScan");
const btnCapture = document.getElementById("btnCapture");
const btnUpload = document.getElementById("btnUpload");
const filePicker = document.getElementById("filePicker");
const camHint = document.getElementById("camHint");
let mediaStream = null;

// 確認匯入對話框
const confirmModal = document.getElementById("confirmModal");
const confirmContent = document.getElementById("confirmContent");
const btnCloseConfirm = document.getElementById("btnCloseConfirm");
const btnCancelImport = document.getElementById("btnCancelImport");
const btnImport = document.getElementById("btnImport");
let _pendingParsedJSON = null; // 暫存解析後 JSON（等待按下匯入）

/*********************
 * 啟動：建立表格骨架 → 渲染
 *********************/
buildGridSkeleton();
render();

btnScan.addEventListener("click", openScanner);
btnClear.addEventListener("click", onClear);
btnCloseScan.addEventListener("click", closeScanner);
btnCapture.addEventListener("click", captureAndDecode);
btnUpload.addEventListener("click", () => filePicker.click());
filePicker.addEventListener("change", onImagePicked);

btnCloseConfirm.addEventListener("click", () => hideConfirm());
btnCancelImport.addEventListener("click", () => hideConfirm());
btnImport.addEventListener("click", () => {
    if (!_pendingParsedJSON) return;
    // 將 pending JSON 寫入課表
    importNchuArray(_pendingParsedJSON);
    saveSchedule();
    render();
    hideConfirm();
    closeScanner();
    alert("匯入完成！");
    _pendingParsedJSON = null;
});

/*********************
 * 表格骨架（時間＋星期）
 *********************/
function buildGridSkeleton() {
    // 保留表頭六格，其餘清空重建
    const heads = Array.from(tableWrap.querySelectorAll(".grid.head")).map(n => n.outerHTML).join("");
    tableWrap.innerHTML = heads;

    for (let slot = 0; slot < VISIBLE_SLOTS; slot++) {
        // 時間欄
        const t = document.createElement("div");
        t.className = "grid time";
        t.textContent = TIMES[slot] || "";
        tableWrap.appendChild(t);

        // 星期一～五空格
        for (let w of WEEKS) {
            const cell = document.createElement("div");
            cell.className = "grid cell";
            cell.dataset.week = String(w);
            cell.dataset.slot = String(slot);
            tableWrap.appendChild(cell);
        }
    }
}

/*********************
 * 渲染：把 schedule 填入格子
 *********************/
function render() {
    // 清空所有格子課程內容（保留格線）
    tableWrap.querySelectorAll(".grid.cell").forEach(cell => cell.innerHTML = "");

    Object.keys(schedule).forEach(key => {
        const list = schedule[key];
        if (!Array.isArray(list)) return;

        const [week, slot] = key.split("-").map(n => parseInt(n, 10));
        if (slot >= VISIBLE_SLOTS) return; // 超出顯示的節次就先不畫

        const cell = tableWrap.querySelector(`.grid.cell[data-week="${week}"][data-slot="${slot}"]`);
        if (!cell) return;

        list.forEach(course => {
            const div = document.createElement("div");
            div.className = "course-card";
            div.innerHTML = `
        <div class="c-title">${escapeHTML(course.name || "")}</div>
        <div class="c-meta">${escapeHTML(course.teacher || "")}${course.teacher && course.room ? " ・ " : ""}${escapeHTML(course.room || "")}</div>
      `;
            cell.appendChild(div);
        });
    });
}

/*********************
 * LocalStorage
 *********************/
function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {}; // 首次：空物件 → 空白課表
    } catch { return {}; }
}
function saveSchedule() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

/*********************
 * 清空
 *********************/
function onClear() {
    if (!confirm("確定要清空本機課表？")) return;
    schedule = {};
    saveSchedule();
    render();
}

/*********************
 * 掃描器（相機＋上傳）
 *********************/
async function openScanner() {
    scanner.classList.remove("hidden");
    camHint.textContent = "";
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false
        });
        video.srcObject = mediaStream;
        await video.play();
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
    } catch (err) {
        camHint.textContent = "相機無法啟用（可能未授權，或非 Safari / https）。請改用「上傳含 QR 圖片」。";
    }
}
function closeScanner() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    video.srcObject = null;
    scanner.classList.add("hidden");
}

/*********************
 * 拍照 → jsQR 解碼
 *********************/
function captureAndDecode() {
    if (!video.videoWidth) {
        alert("相機尚未就緒，或無法啟用。");
        return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });

    if (!code || !code.data) {
        alert("無法解析 QR，請對準並重試。");
        return;
    }
    handleQrText(code.data);
}

/*********************
 * 上傳圖片 → jsQR 解碼
 *********************/
function onImagePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const imgEl = new Image();
        imgEl.onload = () => {
            canvas.width = imgEl.width;
            canvas.height = imgEl.height;
            ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (!code || !code.data) {
                alert("無法解析 QR 圖片。");
                return;
            }
            handleQrText(code.data);
        };
        imgEl.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
}

/*********************
 * 掃描後 → 顯示確認視窗 → 解析 → 匯入
 *********************/
function handleQrText(text) {
    const cleaned = text.trim();
    // 嘗試 JSON pretty print
    let pretty = cleaned;
    let parsed = null;

    try {
        const maybeDecoded = decodeURIComponentSafe(cleaned);
        parsed = JSON.parse(maybeDecoded);
    } catch {
        try { parsed = JSON.parse(cleaned); } catch { }
    }

    if (parsed) {
        try {
            pretty = JSON.stringify(parsed, null, 2);
            _pendingParsedJSON = parsed; // 暫存，等待使用者按「匯入」
        } catch {
            _pendingParsedJSON = null;
        }
    } else {
        // 不是 JSON：仍然顯示原文，提示使用者
        _pendingParsedJSON = null;
    }

    showConfirm(pretty, !!parsed);
}

/*********************
 * 確認視窗
 *********************/
function showConfirm(contentText, isJson) {
    confirmContent.textContent = contentText;
    confirmModal.classList.remove("hidden");

    // 可匯入 = 已解析成 JSON；否則只能取消
    btnImport.disabled = !isJson;
    btnImport.title = isJson ? "" : "無法解析為 JSON，請檢查內容格式";
}
function hideConfirm() {
    confirmModal.classList.add("hidden");
    confirmContent.textContent = "";
    _pendingParsedJSON = null;
}

/*********************
 * 將中興 JSON 陣列轉成內部結構
 * 期望格式：
 * [
 *  {"m":"6810","n":"行動通訊","e":"EE207","d":{"w":2,"s":[2,3,4]}},
 *  ...
 * ]
 * d.w：1..5（星期一..五）；d.s：節次（1 起算）
 *********************/
function importNchuArray(arr) {
    if (!Array.isArray(arr)) {
        alert("QR 內容不是期望的課程清單（陣列）。");
        return;
    }
    const next = {};
    arr.forEach(item => {
        const name = item?.n || item?.name || "";
        const teacher = item?.teacher || ""; // 若 QR 無此欄位，可保持空白
        const room = item?.e || item?.room || "";
        const d = item?.d || {};
        const w = parseInt(d?.w, 10);           // 1..5
        const slots = Array.isArray(d?.s) ? d.s : [];
        if (!w || !slots.length) return;

        slots.forEach(s1 => {
            const slot0 = Number(s1) - 1;         // 轉 0-based
            const key = `${w}-${slot0}`;
            if (!next[key]) next[key] = [];
            next[key].push({ name, teacher, room });
        });
    });
    schedule = next;
}

/*********************
 * 小工具
 *********************/
function decodeURIComponentSafe(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}
function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
