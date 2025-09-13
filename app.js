/*********************
 * 常數與全域狀態
 *********************/
const TIMES = [
    "08:10-09:00", "09:10-10:00", "10:10-11:00", "11:10-12:00",
    "13:10-14:00", "14:10-15:00", "15:10-16:00", "16:10-17:00",
    "17:10-18:00", "18:20-19:10", "19:15-20:05", "20:10-21:00", "21:05-21:55"
];
const VISIBLE_SLOTS = TIMES.length; // 顯示所有節次
const WEEKS = [1, 2, 3, 4, 5];
const STORAGE_KEY = "nchu-schedule-v1";

let schedule = loadSchedule(); // { "1-0":[{name,teacher,room}, ...], ... }

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
let _pendingParsedJSON = null;

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
    const { placed, ignored, maxSlot } = importNchuFlexible(_pendingParsedJSON);
    saveSchedule();
    render();
    hideConfirm();
    closeScanner();

    let msg = `匯入完成！放入 ${placed} 筆`;
    if (ignored) msg += `，忽略 ${ignored} 筆（結構不符或超出星期/節次）`;
    if (maxSlot >= VISIBLE_SLOTS) {
        msg += `。\n注意：資料包含第 ${maxSlot + 1} 節，但目前畫面只顯示 ${VISIBLE_SLOTS} 節，可調整 app.js 的 TIMES/顯示節數。`;
    }
    alert(msg);
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
    console.log("[QR raw]", cleaned);

    // 嘗試 JSON 解析（支援 URL-encoded）
    let parsed = null;
    try {
        parsed = JSON.parse(decodeURIComponentSafe(cleaned));
    } catch {
        try { parsed = JSON.parse(cleaned); } catch { }
    }

    // 顯示確認視窗（若能解析就美化）
    if (parsed) {
        _pendingParsedJSON = parsed;
        const pretty = JSON.stringify(parsed, null, 2);
        showConfirm(pretty, true);
    } else {
        _pendingParsedJSON = null;
        showConfirm(cleaned, false); // 不是 JSON 也讓使用者看見原文
    }
}

/*********************
 * 確認視窗
 *********************/
function showConfirm(contentText, isJson) {
    confirmContent.textContent = contentText;
    confirmModal.classList.remove("hidden");
    const btnImport = document.getElementById("btnImport");
    btnImport.disabled = !isJson;
    btnImport.title = isJson ? "" : "不是有效 JSON，無法匯入";
}
function hideConfirm() {
    confirmModal.classList.add("hidden");
    confirmContent.textContent = "";
    _pendingParsedJSON = null;
}

/*********************
 * 通用：把不同格式的 NCHU 課表轉成內部 schedule
 *********************/
function importNchuFlexible(source) {
    // 1) 支援 { courses:[...] } 或直接陣列
    const arr = Array.isArray(source) ? source
        : (Array.isArray(source?.courses) ? source.courses : null);
    if (!arr) {
        console.warn("[import] 非陣列/無 courses，給的資料：", source);
        return { placed: 0, ignored: 0, maxSlot: -1 };
    }

    const next = {};
    let placed = 0, ignored = 0, maxSlot = -1;

    arr.forEach((raw, idx) => {
        // 名稱/教師/教室（盡量取到）
        const name = raw?.n || raw?.name || raw?.title || "";
        const teacher = raw?.t || raw?.teacher || "";
        const room = raw?.e || raw?.room || raw?.loc || "";

        // 星期
        const w = normalizeWeek(raw);
        // 節次列表（0-based）
        const slotList0 = normalizeSlots(raw);

        if (!w || !slotList0.length) {
            ignored++;
            console.log(`[import] 忽略第 ${idx} 筆：星期或節次無效`, raw);
            return;
        }

        slotList0.forEach(s0 => {
            maxSlot = Math.max(maxSlot, s0);
            const key = `${w}-${s0}`;
            if (!next[key]) next[key] = [];
            next[key].push({ name, teacher, room });
            placed++;
        });
    });

    schedule = next;
    console.log(`[import] 放入 ${placed} 筆，忽略 ${ignored} 筆；最大節索引 s0=${maxSlot}`);
    return { placed, ignored, maxSlot };
}

/* 解析星期：支援 d.w、w、week（1..5） */
function normalizeWeek(raw) {
    const d = raw?.d || {};
    const w = Number(raw?.w ?? raw?.week ?? d?.w);
    if (Number.isFinite(w) && w >= 1 && w <= 5) return w;
    return 0;
}

/* 解析節次：支援
   - d.s / s: [2,3,4] 或 [1,2,3]（自動認 1-based → 0-based）
   - d.r: [2,4]（區間）
   - periods: "2-4" / "3" */
function normalizeSlots(raw) {
    const d = raw?.d || {};
    let slots = [];

    // 1) 陣列 s
    let arr = raw?.s || d?.s;
    if (Array.isArray(arr) && arr.length) {
        slots = arr.map(Number).filter(n => Number.isFinite(n));
    }

    // 2) 區間 r: [start, end]
    if (!slots.length && Array.isArray(d?.r) && d.r.length === 2) {
        const start = Number(d.r[0]), end = Number(d.r[1]);
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
            for (let p = start; p <= end; p++) slots.push(p);
        }
    }

    // 3) periods: "2-4" 或 "3"
    if (!slots.length && typeof raw?.periods === "string") {
        const m = raw.periods.match(/^(\d+)\s*-\s*(\d+)$/);
        if (m) {
            const a = Number(m[1]), b = Number(m[2]);
            if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
                for (let p = a; p <= b; p++) slots.push(p);
            }
        } else {
            const one = Number(raw.periods);
            if (Number.isFinite(one)) slots.push(one);
        }
    }

    // 0-based 調整：如果最小值 >=1，就當作 1-based
    if (slots.length) {
        const min = Math.min(...slots);
        const zeroBased = min >= 1 ? slots.map(x => x - 1) : slots; // 已是 0-based 就不動
        // 範圍過濾（避免超出 TIMES）
        return zeroBased.filter(s0 => s0 >= 0 && s0 < TIMES.length);
    }

    return [];
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
