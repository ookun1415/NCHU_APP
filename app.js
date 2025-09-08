const DAYS = ["星期一", "星期二", "星期三", "星期四", "星期五"];
const TIME_SLOTS = [
    ["08:10", "09:00"],
    ["09:10", "10:00"],
    ["10:10", "11:00"],
    ["11:10", "12:00"],
    ["13:10", "14:00"],
    ["14:10", "15:00"],
    ["15:10", "16:00"]
];

// 載入課表
function loadSchedule() {
    try {
        return JSON.parse(localStorage.getItem("schedule") || "[]");
    } catch {
        return [];
    }
}

// 畫課表
function renderTable() {
    const container = document.getElementById("timetable");
    container.innerHTML = "";

    const tbl = document.createElement("table");
    tbl.className = "grid";

    // 表頭
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const thTime = document.createElement("th");
    thTime.className = "time-cell";
    thTime.textContent = "時間";
    headRow.appendChild(thTime);

    DAYS.forEach(d => {
        const th = document.createElement("th");
        th.textContent = d;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tbl.appendChild(thead);

    // 表身
    const tbody = document.createElement("tbody");
    const courses = loadSchedule();

    TIME_SLOTS.forEach(([start, end], slotIndex) => {
        const tr = document.createElement("tr");

        const tdTime = document.createElement("td");
        tdTime.className = "time-cell";
        tdTime.innerHTML = `<div>${start}</div><div>${end}</div>`;
        tr.appendChild(tdTime);

        for (let day = 1; day <= 5; day++) {
            const td = document.createElement("td");

            const course = courses.find(c => {
                return c.d && c.d.some(seg => seg.w === day && seg.s.includes(slotIndex));
            });

            if (course) {
                td.innerHTML = `
          <div class="course">
            <div class="name">${course.n || "未命名課程"}</div>
            <div class="meta">(${course.m || ""}) ${course.e || ""}</div>
          </div>
        `;
            }

            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    container.appendChild(tbl);
}

// 啟動時渲染課表
renderTable();

// 清空按鈕
document.getElementById("clear").addEventListener("click", () => {
    localStorage.removeItem("schedule");
    alert("✅ 課表已清空");
    renderTable();
});

// QR Modal 控制
const modal = document.getElementById("qrModal");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("cameraStatus");

// 開啟 QR
document.getElementById("scanQR").addEventListener("click", () => {
    modal.style.display = "flex";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = "❌ 瀏覽器不支援相機 API，請用 Safari 開啟。";
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
            status.textContent = "✅ 相機啟動成功，對準 QR Code 並點「拍照辨識」";
        })
        .catch(err => {
            console.error("相機啟動失敗:", err);
            status.textContent = "❌ 相機啟動失敗: " + err.name;
        });
});

// 拍照辨識
document.getElementById("captureBtn").addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code) {
        try {
            const parsed = JSON.parse(code.data);
            localStorage.setItem("schedule", JSON.stringify(parsed));
            alert("✅ 匯入成功！");
            modal.style.display = "none";
            stopCamera();
            renderTable();
        } catch (e) {
            alert("❌ QR Code 不是有效的 JSON");
        }
    } else {
        alert("❌ 無法辨識 QR Code，請再試一次");
    }
});

// 關閉 QR
document.getElementById("closeQR").addEventListener("click", () => {
    modal.style.display = "none";
    stopCamera();
});

function stopCamera() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}
