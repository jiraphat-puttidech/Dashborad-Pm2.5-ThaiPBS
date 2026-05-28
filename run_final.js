const mysql = require("mysql2");

// ตั้งค่า Database
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
  console.log("✅ เชื่อมต่อสำเร็จ! เริ่มยิงข้อมูลคู่ขนาน...");
  startLoop();
});

// ฟังก์ชันสุ่มเลข
function r(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function startLoop() {
  setInterval(() => {
    // 1. สร้างเวลาเดียวกัน (Shared Timestamp)
    const now = new Date(); // ใช้ตัวแปรนี้ร่วมกัน เพื่อให้เวลาเท่ากันเป๊ะ

    // --- เตรียมข้อมูล Bangkok ---
    const val_bkk = {
      site: "bangkok",
      topic: "bangkok/a",
      pm_out: r(10, 150),
      pm_in1: r(10, 50),
      temp: r(25, 40),
      humi: r(50, 60),
      power: r(80, 100),
      pf: 0.9,
      hasIndoor2: false, // Bangkok ไม่มี Indoor2 (ตามรูป)
    };

    // --- เตรียมข้อมูล Chiangmai ---
    const val_cnx = {
      site: "chiangmai",
      topic: "chiangmai/a",
      pm_out: r(80, 150),
      pm_in1: r(40, 60),
      temp: r(30, 35),
      humi: r(40, 50),
      power: r(20, 40),
      pf: 1.0,
      hasIndoor2: true, // Chiangmai มี Indoor2 (ตามรูป)
    };

    // 2. ยิง SQL เข้าไปพร้อมกัน (ไม่ต้องรอ setTimeout)
    insertToDB(now, val_bkk);
    insertToDB(now, val_cnx);

    console.log(`⏰ ส่งข้อมูลรอบเวลา: ${now.toLocaleTimeString()} (ส่งคู่)`);
  }, 60000); // ทำทุก 5 วินาที
}

function insertToDB(timestamp, d) {
  // จัดการค่า Indoor 2
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

  // ใส่ timestamp ที่ส่งเข้ามา (เพื่อให้เวลาเท่ากันเป๊ะ)
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
    if (err) console.error(`❌ Error ${d.site}:`, err.message);
  });
}
