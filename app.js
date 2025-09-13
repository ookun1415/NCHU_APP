/* ====== 常數與工具 ====== */
const STORAGE_KEY = 'nchu:schedule:v2';

const TIME_SLOTS = [
    { slot: 1, label: '08:10–09:00' },
    { slot: 2, label: '09:10–10:00' },
    { slot: 3, label: '10:10–11:00' },
    { slot: 4, label: '11:10–12:00' },
    { slot: 5, label: '13:10–14:00' },
    { slot: 6, label: '14:10–15:00' },
];

const W_NAMES = ['', '一', '二', '三', '四', '五'];

/* ====== 儲存/載入 ====== */
function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('loadSchedule error', e);
        return [];
    }
}
function saveSchedule(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
}
function clearSchedule() {
    localStorage.removeItem(STORAGE_KEY);
}

/* ====== 建表 + 渲染 ====== */
function buildGrid() {
    const tbody = document.getElementById('grid-body');
    tbody.innerHTML = '';
    TIME_SLOTS.forEach(ts => {
        const tr = document.createElement('tr');

        const timeTd = document.createElement('td');
        timeTd.className = 'time-cell';
        timeTd.textContent = ts.label;
        tr.appendChild(timeTd);

        // 5 天
        for (let w = 1; w <= 5; w++) {
            const td = document.createElement('td');
            td.id = `cell-w${w}-s${ts.slot}`; // 這個 id 會被渲染器使用
            td.innerHTML = `<div class="slot"></div>`;
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });
}

function renderTable() {
    // 先清空所有 cell 內容
    TIME_SLOTS.forEach(ts => {
        for (let w = 1; w <= 5; w++) {
            const cell = document.getElementById(`cell-w${w}-s${ts.slot}`);
            if (cell) cell.querySelector('.slot').innerHTML = '';
        }
    });

    const list = loadSchedule();
    let placed = 0;

    list.forEach(it => {
        const { w, s, n, c, e } = it;
        if (!w || !Array.isArray(s)) return;

        s.forEach(slot => {
            const cell = document.getElementById(`cell-w${w}-s${slot}`);
            if (!cell) return;

            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerHTML = `
        <div style="font-weight:700">${n}</div>
        <div style="font-size:12px;color:#9ac7ff">${c}・${e}</div>
      `;
            cell.querySelector('.slot').appendChild(chip);
            placed++;
        });
    });

    console.log('[render] items:', list.length, 'chips placed:', placed);
}

/* ====== 掃描：開相機、擷取影像、解析 ====== */
const modal = document.getElementById('modal');
const camWrap = document.getElementById('camWrap');
const btnScan = document.getElementById('btnScan');
const btnClose = document.getElementById('btnClose');
const btnShoot = document.getElementById('btnShoot');
const fileInput = document.getElementById('fileInput');
const confirmPane = document.getElementById('confirmPane');
const scanPane = document.getElementById('scanPane');
const preview = document.getElementById('preview');
const btnImport = document.getElementById('btnImport');
const btnBack = document.getElementById('btnBack');

let stream = null, videoEl = null, canvasEl = null;
let pendingObjects = []; // 標準化後的物件陣列（展平）

function openModal() {
    modal.style.display = 'flex';
}
function closeModal() {
    stopCamera();
    modal.style.display = 'none';
}

async function startCamera() {
    stopCamera();
    videoEl = document.createElement('video');
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;

    canvasEl = document.createElement('canvas');

    camWrap.innerHTML = '';
    camWrap.appendChild(videoEl);

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoEl.srcObject = stream;
        await videoEl.play();
    } catch (err) {
        console.warn('camera error', err);
        alert('相機無法啟用（可能未授權或瀏覽器不支援）。可改用「上傳圖片」辦法。');
    }
}
function stopCamera() {
    try {
        if (stream) stream.getTracks().forEach(t => t.stop());
    } catch (_) { }
    stream = null;
    if (videoEl) { try { videoEl.pause(); } catch (_) { } }
    videoEl = null;
    canvasEl = null;
}

function drawFrameToCanvas() {
    if (!videoEl || !canvasEl) return null;
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) return null;

    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

function decodeToTextFromImageData(imgData) {
    if (!imgData) return null;
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
    return code?.data || null;
}

async function decodeFromFile(file) {
    const bitmap = await createImageBitmap(file);
    const cvs = document.createElement('canvas');
    cvs.width = bitmap.width; cvs.height = bitmap.height;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
    return decodeToTextFromImageData(imgData);
}

/* ====== 匯入流程 ====== */
function normalizeScanned(text) {
    // text 可能是整包 JSON 或含雜訊，先嘗試抓第一個 [...]/{...} 陣列
    let arr = null;

    try {
        // 直接就是陣列
        const j = JSON.parse(text);
        arr = j;
    } catch (_) {
        // 嘗試用正則擷取第一段 [ ... ]
        const m = text.match(/\[[\s\S]*\]/);
        if (m) {
            try { arr = JSON.parse(m[0]); } catch (_) { }
        }
    }

    if (!Array.isArray(arr)) throw new Error('無法解析為陣列');

    // 展平成 cell 用的物件：{ w, s, n, c, e }
    const flattened = [];
    for (const item of arr) {
        if (!item || !item.d) continue;
        const { n = '', c = '', e = '', m = '' } = item;
        for (const d of item.d) {
            const w = Number(d.w);
            const s = Array.isArray(d.s) ? d.s.map(Number).filter(v => v >= 1 && v <= TIME_SLOTS.length) : [];
            if (!w || !s.length) continue;
            flattened.push({ w, s, n, c, e, m });
        }
    }
    return flattened;
}

/* ====== 綁定事件 ====== */
btnScan.addEventListener('click', async () => {
    openModal();
    scanPane.style.display = '';
    confirmPane.style.display = 'none';
    document.getElementById('modalTitle').textContent = '掃描 QR Code';
    await startCamera();
});

btnClose.addEventListener('click', closeModal);

btnShoot.addEventListener('click', () => {
    const imgData = drawFrameToCanvas();
    const txt = decodeToTextFromImageData(imgData);
    if (!txt) {
        alert('無法解析此 QR，請再試一次，或改用「上傳圖片」。');
        return;
    }
    try {
        pendingObjects = normalizeScanned(txt);
        preview.textContent = JSON.stringify(pendingObjects, null, 2);
        console.log('[scan] parsed items:', pendingObjects.length);
        scanPane.style.display = 'none';
        confirmPane.style.display = '';
        document.getElementById('modalTitle').textContent = '確認匯入課表';
        stopCamera();
    } catch (err) {
        console.warn(err);
        alert('解析內容失敗，請再試一次。');
    }
});

fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
        const txt = await decodeFromFile(f);
        if (!txt) { alert('無法從圖片解析 QR'); return; }
        pendingObjects = normalizeScanned(txt);
        preview.textContent = JSON.stringify(pendingObjects, null, 2);
        console.log('[scan:file] parsed items:', pendingObjects.length);
        scanPane.style.display = 'none';
        confirmPane.style.display = '';
        document.getElementById('modalTitle').textContent = '確認匯入課表';
        stopCamera();
    } catch (err) {
        console.warn(err);
        alert('解析圖片失敗');
    }
});

btnBack.addEventListener('click', () => {
    confirmPane.style.display = 'none';
    scanPane.style.display = '';
    document.getElementById('modalTitle').textContent = '掃描 QR Code';
    startCamera();
});

btnImport.addEventListener('click', () => {
    if (!pendingObjects?.length) {
        alert('沒有可匯入的內容');
        return;
    }
    // 直接儲存覆蓋
    saveSchedule(pendingObjects);
    renderTable();
    alert('匯入完成！');
    closeModal();
});

/* 清空 */
document.getElementById('btnClear').addEventListener('click', () => {
    if (confirm('確定要清空？此動作會刪除本機的課表資料。')) {
        clearSchedule();
        renderTable();
    }
});

/* ====== 初始 ====== */
buildGrid();       // 產生表格骨架（有格線、空白）
renderTable();     // 如果本機已有資料就會填上，第一次進來會是空白
