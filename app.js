/*********************
 * 常數與全域狀態
 *********************/
const TIMES = [
    "08:10-09:00", "09:10-10:00", "10:10-11:00", "11:10-12:00",
    "13:10-14:00", "14:10-15:00", "15:10-16:00", "16:10-17:00",
    "17:10-18:00", "18:20-19:10", "19:15-20:05", "20:10-21:00", "21:05-21:55"
];
// 顯示幾節就畫幾節（你目前到 16:00，可把 TIMES 截斷）
const VISIBLE_SLOTS = 6; // 08:10 ~ 16:00，想多顯示就改這個數字

const WEEKS = [1, 2, 3, 4, 5]; // 一到五
const STORAGE_KEY = "nchu-schedule-v1";

// 課程顏色（藍）
const COURSE_BG = "rgba(59,130,246,0.16)";
const COURSE_BORDER = "rgba(59,130,246,0.5)";
const COURSE_TEXT = "rgb(147,197,253)";

let schedule = loadSchedule(); // { "1-0":[{...}], "1-1":[...], ... }

/*********************
 * 元件
 *********************/
const tableWrap = document.getElementById("tableWrap");
const btnScan = document.getElementById("btnScan");
const btnClear = document.getElementById("btnClear");

// scanner
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

/*********************
 * 啟動
 *********************/
buildGridSkeleton();
render();

btnScan.addEventListener("click", openScanner);
btnClear.addEventListener("click", onClear);
btnCloseScan.addEventListener("click", closeScanner);
btnCapture.addEventListener("click", captureAndDecode);
btnUpload.addEventListener("click", () => filePicker.click());
filePicker.addEventListener("change", onImagePicked);

/*********************
 * UI：畫表格骨架（時間／星期）
 *********************/
function buildGridSkeleton() {
    // 先清空既有內容（保留表頭）
    const heads = Array.from(tableWrap.querySelectorAll(".grid.head")).map(n => n.outerHTML).join("");
    tableWrap.innerHTML = heads;

    // 逐節時間列
    for (let slot = 0; slot < VISIBLE_SLOTS; slot++) {
        // 時間欄
        const t = document.createElement("div");
        t.className = "grid time";
        t.textContent = TIMES[slot] || "";
        tableWrap.appendChild(t);

        // 一到五空格
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
 * Render：把 schedule 填到格子
 *********************/
function render() {
    // 先清空所有格子
    tableWrap.querySelectorAll(".grid.cell").forEach(cell => cell.innerHTML = "");

    // 把每個 key（week-slot）對應的課程放進去
    Object.keys(schedule).forEach(key => {
        const list = schedule[key];
        if (!Array.isArray(list)) return;

        const [week, slot] = key.split("-").map(n => parseInt(n, 10));
        // 越界（例如你只顯示 6 節）
        if (slot >= VISIBLE_SLOTS) return;

        const cell = tableWrap.querySelector(`.grid.cell[data-week="${week}"][data-slot="${slot}"]`);
        if (!cell) return;

        list.forEach(course => {
            const card = document.createElement("div");
            card.className = "course-card";
            card.style.background = COURSE_BG;
            card.style.border = `1px solid ${COURSE_BORDER}`;
            card.style.color = COURSE_TEXT;
            card.innerHTML = `
        <div class="c-title">${escapeHTML(course.name || "")}</div>
        <div class="c-meta">${escapeHTML(course.teacher || "")} ・ ${escapeHTML(course.room || "")}</div>
      `;
            cell.appendChild(card);
        });
    });
}

/*********************
 * 資料存取
 *********************/
function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {}; // 首次打開：空物件 → 畫空表
    } catch (e) {
        return {};
    }
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
 * 掃描器（相機／關閉）
 *********************/
async function openScanner() {
    scanner.classList.remove("hidden");
    camHint.textContent = "";
    try {
        // 背面鏡頭
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false
        });
        video.srcObject = mediaStream;
        await video.play();
        // 設 canvas 尺寸（依相機）：
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
    } catch (err) {
        camHint.textContent = "相機無法啟用（可能未授權，或非 Safari / https）。可改用「上傳含 QR 圖片」。";
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
 * 拍照 → Canvas → jsQR → 匯入
 *********************/
function captureAndDecode() {
    if (!video.videoWidth) {
        alert("相機尚未就緒，或無法啟用。");
        return;
    }
    // 把目前畫面畫進 canvas
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
 * 上傳圖片 → 解析 → 匯入
 *********************/
function onImagePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const imgEl = new Image();
        imgEl.onload = () => {
            // 把圖片畫到 canvas 後解碼
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

    // reset input
    e.target.value = "";
}

/*********************
 * 解析 QR 文字 → 轉換成課表 → 存檔並渲染
 *********************/
function handleQrText(text) {
    // 有些掃描器會包在 tel: 或其他，先清一下
    const cleaned = text.trim();

    let data;
    try {
        // 有時會是 URL Encoded
        const maybeDecoded = decodeURIComponentSafe(cleaned);
        data = JSON.parse(maybeDecoded);
    } catch (e) {
        try {
            data = JSON.parse(cleaned);
        } catch (e2) {
            console.error("QR 內容：", cleaned);
            alert("無法解析此 QR 內容（不是 JSON）。已列印到 console。");
            return;
        }
    }

    // 預期中興 QR 結構：
    // [
    //   {"m":"6810","n":"行動通訊","c":"B22","e":"EE207","d":{"w":2,"s":[2,3,4]}},
    //   {"m":"6897","n":"隨機程序","c":"B22","e":"EE207","d":{"w":3,"s":[2,3,4]}},
    //   ...
    // ]
    // d.w = 1..5（星期一..五），d.s = [節索引]（從 1 開始）
    importNchuArray(data);
    saveSchedule();
    render();
    closeScanner();
    alert("匯入完成！");
}

function importNchuArray(arr) {
    if (!Array.isArray(arr)) {
        alert("QR 內容不是期望的課程清單。");
        return;
    }

    // 重置（用 QR 蓋掉目前課表）
    const next = {};

    arr.forEach(item => {
        const name = item?.n || "";
        const teacher = "";        // QR 沒固定欄位就留空（或改抓其它欄）
        const room = item?.e || ""; // 教室
        const d = item?.d || {};
        const w = parseInt(d?.w, 10);        // 1..5
        const slots = Array.isArray(d?.s) ? d.s : [];

        if (!w || !slots.length) return;

        slots.forEach(s1 => {
            const slot0 = Number(s1) - 1; // 轉 0-based
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
    try { return decodeURIComponent(s); } catch (_) { return s; }
}
function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
