/* app.js — NCHU 課表（掃 QR / 貼 JSON 匯入）*/

// ====== 基本工具 ======
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** 依 day(1..5) / slot(1..N) 取格子 */
function getCell(day, slot) {
    return document.querySelector(`.cell[data-day="${day}"][data-slot="${slot}"]`);
}

/** 把文字塞到格子（若已有內容就合併） */
function fillCell(day, slot, text) {
    const cell = getCell(day, slot);
    if (!cell) return;
    const now = cell.innerText.trim();
    cell.innerText = now ? now + '\n' + text : text;
}

/** 清空整張表（可選） */
function clearTable() {
    $$(".cell").forEach(c => (c.innerText = ""));
}

// ====== 解析 NCHU JSON ======
/**
 * 嘗試從任意字串擷取 JSON：可能是
 * - 直接就是 JSON 字串
 * - URL 參數裡帶 JSON（找 [] 或 {} 區塊）
 */
function extractJson(text) {
    // 已經是 JSON 陣列/物件
    const t = text.trim();
    if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}")))
        return t;

    // data: 或 http…?q=... 之類：嘗試找出第一個 [ 開頭到最後一個 ] 結尾
    const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return m ? m[0] : null;
}

/** 把 NCHU JSON 匯入 timetable */
function importNCHUFromJsonString(jsonString) {
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch {
        alert("JSON 解析失敗，請確認內容是否完整。");
        return;
    }

    // NCHU 的格式：前兩筆通常是 meta（學年/學期與學號），其餘是課程
    const courses = Array.isArray(data) ? data.slice(2) : [];
    if (!courses.length) {
        alert("沒有找到課程資料。");
        return;
    }

    // 逐科目：w = 星期(1~5)、s = 節次陣列
    courses.forEach(c => {
        const name = c.n || "";      // 課名
        const code = c.m || "";      // 科目代碼
        const room = c.e || "";      // 教室
        const d = c.d || {};
        const w = Number(d.w);       // 1..5
        const slots = Array.isArray(d.s) ? d.s : [];

        const text = `${name}\n(${code})\n${room}`;
        slots.forEach(slot => {
            const s = Number(slot);
            if (Number.isFinite(w) && Number.isFinite(s)) {
                fillCell(w, s, text);
            }
        });
    });

    alert("課表已匯入完成！");
}

// ====== 掃描相關（BarcodeDetector / 檔案備援 / 手動貼上） ======
const btnScan = $("#btn-scan");
const btnPaste = $("#btn-paste");
const fileInput = $("#qr-file");

// 建立 BarcodeDetector（若可用）
const canBarcode = "BarcodeDetector" in window;
let detector = null;
if (canBarcode) {
    try {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
    } catch { }
}

// 掃描流程（鏡頭）
async function startScan() {
    if (!detector) {
        // 沒有原生掃描器，退而求其次用圖片上傳
        fileInput.click();
        return;
    }

    let stream;
    let video;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        video = document.createElement("video");
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();

        const rafLoop = async () => {
            if (video.readyState >= 2) {
                const bitmaps = await detector.detect(video);
                if (bitmaps && bitmaps.length) {
                    stopStream(stream);
                    const raw = bitmaps[0].rawValue || bitmaps[0].rawValueText || "";
                    handleScannedText(raw);
                    return;
                }
            }
            requestAnimationFrame(rafLoop);
        };
        rafLoop();
        alert("鏡頭已開啟，對準 QR Code～");
    } catch (err) {
        console.error(err);
        alert("無法開啟相機，改用『從圖片匯入』吧。");
        fileInput.click();
    }
}

function stopStream(stream) {
    try {
        stream.getTracks().forEach(t => t.stop());
    } catch { }
}

/** 得到掃描字串 → 擷取 JSON → 匯入 */
function handleScannedText(text) {
    console.log("[QR raw]", text);
    const tryDecoded = (() => {
        try { return decodeURIComponent(text); } catch { return text; }
    })();

    const jsonChunk =
        extractJson(tryDecoded) ||
        extractJson(text);

    if (!jsonChunk) {
        alert("無法解析此 QR 內容（已輸出到 console）。");
        console.log("raw content:", text);
        return;
    }

    importNCHUFromJsonString(jsonChunk);
}

// 從圖片檔解析（iOS/Safari 很好用）
fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 優先用 BarcodeDetector（靜態圖）
    if (detector) {
        const bmp = await createImageBitmap(file);
        try {
            const rs = await detector.detect(bmp);
            if (rs && rs.length) {
                const raw = rs[0].rawValue || rs[0].rawValueText || "";
                handleScannedText(raw);
                fileInput.value = "";
                return;
            }
        } catch { }
    }

    // 最保險：用第三方解碼器（若真的需要可再加，先提示）
    alert("無法從圖片讀出 QR。請再試一次或改用『手動貼上 JSON』。");
    fileInput.value = "";
});

// 手動貼 JSON 匯入
function manualPaste() {
    const txt = prompt("把 NCHU 產生的 JSON 直接貼上：");
    if (!txt) return;
    const chunk = extractJson(txt.trim());
    if (!chunk) {
        alert("沒有找到有效 JSON。");
        return;
    }
    importNCHUFromJsonString(chunk);
}

// 綁定 UI
btnScan?.addEventListener("click", startScan);
btnPaste?.addEventListener("click", manualPaste);

// ====== 可選：清表按鈕（若 index.html 有） ======
$("#btn-clear")?.addEventListener("click", () => {
    if (confirm("確定清空整張課表？")) clearTable();
});
