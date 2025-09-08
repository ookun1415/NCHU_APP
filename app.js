const courses = [
    { name: "行動通訊", day: 2, time: "08:10", room: "EE207" },
    { name: "隨機程序", day: 3, time: "10:10", room: "EE207" },
    { name: "通訊研討", day: 4, time: "13:10", room: "EE108" },
    { name: "影像處理", day: 4, time: "15:10", room: "EE204" },
    { name: "數位通訊", day: 5, time: "10:10", room: "EE207" },
    { name: "通訊工程專題", day: 5, time: "15:10", room: "EE106" }
];

// 直接用兩段字串定義（上課開始、結束）
const times = [
    ["08:10", "09:00"],
    ["09:10", "10:00"],
    ["10:10", "11:00"],
    ["11:10", "12:00"],
    ["13:10", "14:00"],
    ["14:10", "15:00"],
    ["15:10", "16:00"],
    ["16:10", "17:00"]
];

function renderTable() {
    const container = document.getElementById("timetable");
    const table = document.createElement("table");

    // 表頭
    const headerRow = document.createElement("tr");
    const thEmpty = document.createElement("th");
    thEmpty.className = "time";
    headerRow.appendChild(thEmpty);

    ["一", "二", "三", "四", "五"].forEach(d => {
        const th = document.createElement("th");
        th.textContent = `星期${d}`;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // 每列
    times.forEach(([start, end]) => {
        const row = document.createElement("tr");

        // 左邊時間：強制換行
        const th = document.createElement("th");
        th.className = "time";
        th.innerHTML = `${start}<br>${end}`;
        row.appendChild(th);

        for (let day = 1; day <= 5; day++) {
            const td = document.createElement("td");
            const course = courses.find(c => c.day === day && c.time === start);
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
