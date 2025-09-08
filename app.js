// ====== 課表顯示設定 ======
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

// ====== 從 localStorage 載入 ======
function loadSchedule() {
    try {
        return JSON.parse(localStorage.getItem("schedule") || "[]");
    } catch {
        return [];
    }
}

// ====== 繪製課表 ======
function renderTable() {
    const table = document.getElementById("timetable");
    table.innerHTML = "";

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
        tdTime.innerHTML = `<span class="line">${start}</span><span class="line">${end}</span>`;
        tr.appendChild(tdTime);

        for (let day = 1; day <= 5; day++) {
            const td = document.createElement("td");

            // 找出該時段課程
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
    table.appendChild(tbl);
}

// ====== 啟動 ======
renderTable();
