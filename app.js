// 課程資料（用開始時間比對，例如 "08:10"）
const courses = [
    { name: "行動通訊", day: 2, time: "08:10", room: "EE207" },
    { name: "隨機程序", day: 3, time: "10:10", room: "EE207" },
    { name: "通訊研討", day: 4, time: "13:10", room: "EE108" },
    { name: "影像處理", day: 4, time: "15:10", room: "EE204" },
    { name: "數位通訊", day: 5, time: "10:10", room: "EE207" },
    { name: "通訊工程專題", day: 5, time: "15:10", room: "EE106" }
];

// 左側時間欄位顯示（你之前的格式：以「\n」分隔上下兩個時間）
const times = [
    "08:10\\n09:00",
    "09:10\\n10:00",
    "10:10\\n11:00",
    "11:10\\n12:00",
    "13:10\\n14:00",
    "14:10\\n15:00",
    "15:10\\n16:00",
    "16:10\\n17:00"
];

// 建立課表
function renderTable() {
    const container = document.getElementById("timetable");
    const table = document.createElement("table");

    // 表頭
    const headerRow = document.createElement("tr");

    const thEmpty = document.createElement("th");
    thEmpty.className = "time";
    thEmpty.textContent = "";               // 左上角空白
    headerRow.appendChild(thEmpty);

    ["一", "二", "三", "四", "五"].forEach(d => {
        const th = document.createElement("th");
        th.textContent = `週${d}`;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // 時間列
    times.forEach(t => {
        const row = document.createElement("tr");

        // 左側時間顯示：把 \n 轉成 <br>
        const th = document.createElement("th");
        th.className = "time";
        th.innerHTML = String(t).replaceAll("\\n", "<br>");
        row.appendChild(th);

        // 用開始時間（\n 左邊）來比對課程
        const startTime = String(t).split("\\n")[0];

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
