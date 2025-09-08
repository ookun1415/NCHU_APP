// 課程資料（以「開始時間」比對，例如 "08:10"）
const courses = [
    { name: "行動通訊", day: 2, time: "08:10", room: "EE207" },
    { name: "隨機程序", day: 3, time: "10:10", room: "EE207" },
    { name: "通訊研討", day: 4, time: "13:10", room: "EE108" },
    { name: "影像處理", day: 4, time: "15:10", room: "EE204" },
    { name: "數位通訊", day: 5, time: "10:10", room: "EE207" },
    { name: "通訊工程專題", day: 5, time: "15:10", room: "EE106" }
];

// 左欄時間：資料可能是「真的換行」或「字面 \n」都會處理
const times = [
    "08:10\n09:00",
    "09:10\n10:00",
    "10:10\n11:00",
    "11:10\n12:00",
    "13:10\n14:00",
    "14:10\n15:00",
    "15:10\n16:00",
    "16:10\n17:00"
];

// 把字面 "\n" 轉成真正換行字元
function toRealNewline(str) {
    return String(str).replace(/\\n/g, "\n");
}

// 從時間字串擷取開始時間（支援字面 \n 或真正換行）
function getStartTime(str) {
    const s = String(str);
    const parts = s.split(/\\n|\n/); // 同時支援兩種分隔
    return parts[0] || s;           // 取左邊（開始時間）
}

// 建立課表
function renderTable() {
    const container = document.getElementById("timetable");
    const table = document.createElement("table");

    // 表頭
    const headerRow = document.createElement("tr");
    const thEmpty = document.createElement("th");
    thEmpty.className = "time";
    thEmpty.textContent = ""; // 左上角空白
    headerRow.appendChild(thEmpty);

    ["一", "二", "三", "四", "五"].forEach(d => {
        const th = document.createElement("th");
        th.textContent = `週${d}`;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // 每列
    times.forEach(t => {
        const row = document.createElement("tr");

        // 左側時間：用 textContent + 把 \n 轉成真正換行；配合 CSS white-space: pre-line
        const th = document.createElement("th");
        th.className = "time";
        th.textContent = toRealNewline(t);
        row.appendChild(th);

        // 開始時間（用於找課）
        const startTime = getStartTime(t);

        for (let day = 1; day <= 5; day++) {
            const td = document.createElement("td");

            const course = courses.find(c => c.day === day && c.time === startTime);
            if (course) {
                td.innerHTML = `<b>${course.name}</b><br>${course.room}`;
            }

            row.appendChild(td);
        }

        table.appendChild(row);
    });

    container.innerHTML = "";
    container.appendChild(table);
}

renderTable();
