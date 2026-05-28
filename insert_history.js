/* insert_history.js - สคริปต์สำหรับ Insert ข้อมูลย้อนหลัง 13-19 ก.พ. 2026 */

const mysql = require("mysql2");

// 1. ตั้งค่า Database (ตรวจสอบ Port ให้ตรงกับเครื่องคุณ)
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "emm",
  port: 3307,
});

db.connect((err) => {
  if (err) {
    console.error("❌ เชื่อมต่อ DB ไม่ได้:", err);
    return;
  }
  console.log("✅ เชื่อมต่อสำเร็จ! กำลังเริ่ม Insert ข้อมูลย้อนหลัง...");
  runHistoryInsert();
});

// ฟังก์ชันสุ่มตัวเลข
function r(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

async function runHistoryInsert() {
  // กำหนดช่วงวันที่: เริ่ม 13 ก.พ. ถึง 19 ก.พ. 2026
  const startDate = new Date("2026-02-13T10:00:00");
  const endDate = new Date("2026-02-19T10:00:00");

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    console.log(
      `⏳ กำลัง Insert ข้อมูลวันที่: ${currentDate.toLocaleDateString()}`,
    );

    // เตรียมข้อมูลชุดประวัติศาสตร์สำหรับ Bangkok
    const val_bkk = {
      site: "bangkok",
      topic: "bangkok/a",
      pm_out: r(15, 40),
      pm_in1: r(12, 25),
      temp: r(26, 29),
      humi: r(50, 55),
      power: r(85, 95),
      pf: 0.9,
      hasIndoor2: false,
    };

    // เตรียมข้อมูลชุดประวัติศาสตร์สำหรับ Chiangmai
    const val_cnx = {
      site: "chiangmai",
      topic: "chiangmai/a",
      pm_out: r(90, 160),
      pm_in1: r(45, 70),
      temp: r(31, 36),
      humi: r(42, 48),
      power: r(25, 45),
      pf: 1.0,
      hasIndoor2: true,
    };

    // ยิงข้อมูลเข้า DB โดยใช้เวลาของวันที่ในลูป
    await insertToDB(new Date(currentDate), val_bkk);
    await insertToDB(new Date(currentDate), val_cnx);

    // เลื่อนวันที่ไปวันถัดไป
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("✨ Insert ข้อมูลย้อนหลังเสร็จสิ้นครบ 7 วัน!");
  db.end(); // ปิดการเชื่อมต่อ
}

function insertToDB(timestamp, d) {
  return new Promise((resolve, reject) => {
    const pm_in2 = d.hasIndoor2 ? r(d.pm_in1 - 5, d.pm_in1 + 5) : null;
    const temp_in2 = d.hasIndoor2 ? d.temp : null;
    const humi_in2 = d.hasIndoor2 ? d.humi : null;

    const json = JSON.stringify({
      load: { pf_total: d.pf, active_power_total: d.power },
    });

    const sql = `INSERT INTO telemetry 
      (site, channel, topic, ts_utc, 
       load_pf_total, load_active_power_total, 
       indoor1_pm25, indoor1_temp, indoor1_humi, 
       indoor2_pm25, indoor2_temp, indoor2_humi, 
       outdoor_pm25, outdoor_temp, outdoor_humi, 
       payload_json) 
      VALUES 
      (?, 'a', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      d.site,
      d.topic,
      timestamp,
      d.pf,
      d.power,
      d.pm_in1,
      d.temp,
      d.humi,
      pm_in2,
      temp_in2,
      humi_in2,
      d.pm_out,
      d.temp,
      d.humi,
      json,
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error(`❌ Error ${d.site}:`, err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
