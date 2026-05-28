/* Pm_dash.js - อัปเดตลูปเวลาให้รองรับครบ 5 หน้า และแก้ไขบั๊กหน้าการ์ตูนล้นกรอบ 100% */

const city = document.body.dataset.city || "bangkok";

const CONFIG = {
  mainTime: 300000,
  graphTime: 60000,
  apiURL: `https://emm.thaipbs.or.th/${city}/load_data.php?t=`,
};

let pageState = 0;
let historyData = [];
let mainRefreshTimer = null;

const levels = [
  {
    max: 15,
    label: "ดีมาก",
    color: "bg-blue-600",
    grad: "var(--lv1-blue)",
    border: "border-lv1",
    borderT: "border-t-lv1",
    text: "คุณภาพอากาศดีมาก",
    sub: "ประชาชนทุกคนสามารถทำกิจกรรมกลางแจ้งได้ตามปกติ",
  },
  {
    max: 25,
    label: "ดี",
    color: "bg-emerald-600",
    grad: "var(--lv2-green)",
    border: "border-lv2",
    borderT: "border-t-lv2",
    text: "คุณภาพอากาศดี",
    sub: "ประชาชนทั่วไป: สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ",
  },
  {
    max: 37,
    label: "ปานกลาง",
    color: "bg-yellow-500",
    grad: "var(--lv3-yellow)",
    border: "border-lv3",
    borderT: "border-t-lv3",
    text: "คุณภาพอากาศปานกลาง",
    sub: "ประชาชนทั่วไป: สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ",
  },
  {
    max: 75,
    label: "เริ่มมีผล",
    color: "bg-orange-600",
    grad: "var(--lv4-orange)",
    border: "border-lv4",
    borderT: "border-t-lv4",
    text: "เริ่มมีผลต่อสุขภาพ",
    sub: "ควรลดระยะเวลาการทำกิจกรรมกลางแจ้งที่ใช้แรงมาก",
  },
  {
    max: Infinity,
    label: "มีผลกระทบ",
    color: "bg-red-600",
    grad: "var(--lv5-red)",
    border: "border-lv5",
    borderT: "border-t-lv5",
    text: "มีผลกระทบต่อสุขภาพ",
    sub: "ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้งและใช้อุปกรณ์ป้องกัน",
  },
];

function getLevel(val) {
  return levels.find((l) => val <= l.max) || levels[levels.length - 1];
}

// 🌡️ ระดับอุณหภูมิภายในอาคาร (สำหรับประเทศไทย)
const tempLevels = [
  { max: 20, label: "เย็นมาก", color: "#3b82f6", emoji: "🥶", text: "เย็นมาก", sub: "อุณหภูมิต่ำผิดปกติ ควรตรวจสอบระบบปรับอากาศ" },
  { max: 23, label: "เย็นสบาย", color: "#06b6d4", emoji: "❄️", text: "เย็นสบาย", sub: "อุณหภูมิเหมาะสมอย่างยิ่ง สภาพแวดล้อมดีเยี่ยม" },
  { max: 25, label: "สบาย", color: "#10b981", emoji: "😊", text: "อุณหภูมิสบาย", sub: "อุณหภูมิพอดี เหมาะแก่การทำงานและพักผ่อน" },
  { max: 28, label: "ปานกลาง", color: "#eab308", emoji: "😐", text: "อุณหภูมิปานกลาง", sub: "เริ่มอุ่นขึ้น อาจปรับแอร์ลดลงเล็กน้อย" },
  { max: 32, label: "ค่อนข้างร้อน", color: "#f97316", emoji: "🥵", text: "ค่อนข้างร้อน", sub: "ควรตรวจสอบระบบปรับอากาศ อาจทำงานไม่เต็มประสิทธิภาพ" },
  { max: Infinity, label: "ร้อนมาก", color: "#ef4444", emoji: "🔥", text: "ร้อนมาก", sub: "อุณหภูมิสูงผิดปกติ ควรตรวจสอบระบบปรับอากาศโดยด่วน" },
];

function getTempLevel(val) {
  return tempLevels.find((l) => val <= l.max) || tempLevels[tempLevels.length - 1];
}

document.addEventListener("DOMContentLoaded", () => {
  setInterval(updateClock, 1000);
  updateClock();
  appLoop();
});

async function appLoop() {
  try {
    const res = await fetch(CONFIG.apiURL + Date.now());
    if (res.ok) {
      const rawData = await res.json();

      let currentData = null;

      if (Array.isArray(rawData)) {
        currentData = rawData.find(
          (d) => d.site && d.site.toLowerCase() === city.toLowerCase()
        );
      }

      // fallback กันพัง
      if (!currentData && Array.isArray(rawData) && rawData.length > 0) {
          currentData = rawData[0];
      }

      if (currentData) {
        updateMainDashboard(currentData);
        updateChiangMaiBar(currentData);

        if (currentData.history_list && Array.isArray(currentData.history_list)) {
          historyData = currentData.history_list;
        }
      }
    }
  } catch (e) {
    console.error("Fetch Error:", e);
  }

  // ⏳ ลูกเล่นหลอดโหลดเวลา (วิ่งไปทางขวาให้รู้ว่ากำลังจะเปลี่ยนหน้า)
  const bar = document.getElementById("progress-bar-fill");
  if (bar) {
    // เช็คว่าตอนนี้อยู่หน้าไหน เพื่อดึงเวลามาให้ตรงกับที่จะแสดงผล
    const timeToWait = pageState === 0 ? CONFIG.mainTime : CONFIG.graphTime;

    bar.style.transition = "none"; // รีเซ็ตหลอดให้กลับไปที่ 0 ทันที
    bar.style.width = "0%";

    // ดีเลย์นิดนึงเพื่อให้เบราว์เซอร์ล้างค่าทัน แล้วค่อยสั่งวิ่งไป 100%
    setTimeout(() => {
      bar.style.transition = `width ${timeToWait}ms linear`;
      bar.style.width = "100%";
    }, 50);
  }

  const main = document.getElementById("mainView");
  const detail = document.getElementById("detailView");
  const footerLegend = document.querySelector(".footer-legend");

  // แสดงเฉพาะหน้า main (pageState = 0) และซ่อนใน side อื่น
  if (footerLegend) {
    footerLegend.style.display = pageState === 0 ? "" : "none";
  }

  if (pageState === 0) {
    // ✨ ท่าไม้ตาย Fade นุ่มนวล: ถอดคลาสเก่าออก แล้วใส่ใหม่เพื่อบังคับให้มันเล่นแอนิเมชันใหม่
    main.classList.remove("fade-in");
    void main.offsetWidth; // สั่งให้เบราว์เซอร์รีเซ็ตการแสดงผล
    main.classList.add("fade-in");

    main.style.display = "grid";
    main.classList.remove("hidden-page");
    detail.style.display = "none";
    detail.classList.add("hidden-page");

    // 🔄 Auto-refresh ข้อมูลทุก 1 นาที (หน้า Dashboard)
if (mainRefreshTimer) clearInterval(mainRefreshTimer);

mainRefreshTimer = setInterval(async () => {
  try {
    console.log("🔄 Refreshing data for:", city);

    const res = await fetch(CONFIG.apiURL + Date.now());

    if (!res.ok) {
      console.error("❌ Fetch failed:", res.status);
      return;
    }

    const rawData = await res.json();

    if (!Array.isArray(rawData)) {
      console.warn("⚠️ Data is not array:", rawData);
      return;
    }

    // 🔥 หาข้อมูลตามจังหวัด
    let currentData = rawData.find(
      (d) => d.site && d.site.toLowerCase() === city.toLowerCase()
    );

    // 🟡 fallback (กันชื่อไม่ตรง เช่น KhonKaen vs khonkaen)
    if (!currentData && rawData.length > 0) {
      console.warn("⚠️ City not match, fallback to first item");
      currentData = rawData[0];
    }

    if (!currentData) {
      console.error("❌ No data found");
      return;
    }

    // ✅ update dashboard
    updateMainDashboard(currentData);
    updateChiangMaiBar(currentData);

    // ✅ update history
    if (
      currentData.history_list &&
      Array.isArray(currentData.history_list)
    ) {
      historyData = currentData.history_list;
    }

    // 🔍 debug
    console.log("✅ Updated:", currentData);

  } catch (error) {
    console.error("❌ Main refresh error:", error);
  }
}, 60000);

    setTimeout(() => {
      // หยุด refresh เมื่อออกจากหน้า Dashboard
      if (mainRefreshTimer) { clearInterval(mainRefreshTimer); mainRefreshTimer = null; }
      pageState = 1;
      appLoop();
    }, CONFIG.mainTime);
  } else if (pageState === 1) {
    // ✨ เฟดนุ่มนวลสำหรับหน้ากราฟ
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("outdoor");
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      pageState = 2;
      appLoop();
    }, CONFIG.graphTime);
  } else if (pageState === 2) {
    // ✨ เฟดนุ่มนวล
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("indoor");
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      pageState = 3;
      appLoop();
    }, CONFIG.graphTime);
  } else if (pageState === 3) {
    // ✨ เฟดนุ่มนวล
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("temp");
    } catch (e) {
      console.error("Temp Graph Error:", e);
    }
    setTimeout(() => {
      pageState = 4;
      appLoop();
    }, CONFIG.graphTime);
  } else if (pageState === 4) {
    // ✨ เฟดนุ่มนวล
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("power");
    } catch (e) {
      console.error("Power Graph Error:", e);
    }
    setTimeout(() => {
      pageState = 5;
      appLoop();
    }, CONFIG.graphTime);
  } else if (pageState === 5) {
    // ✨ เฟดนุ่มนวล
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("energy");
    } catch (e) {
      console.error("Energy Graph Error:", e);
    }
    setTimeout(() => {
      pageState = 6;
      appLoop();
    }, CONFIG.graphTime);
  } else {
    // ✨ เฟดนุ่มนวล
    detail.classList.remove("fade-in");
    void detail.offsetWidth;
    detail.classList.add("fade-in");

    main.style.display = "none";
    main.classList.add("hidden-page");
    detail.style.display = "flex";
    detail.classList.remove("hidden-page");
    try {
      renderGraph("carbon");
    } catch (e) {
      console.error("Carbon Graph Error:", e);
    }
    setTimeout(() => {
      pageState = 0;
      appLoop();
    }, CONFIG.graphTime);
  }
}

function renderGraph(mode) {
  const container = document.getElementById("detailView");

  let dataKey, titleText, titleIcon, themeColor, unitText;
  let isAirQuality = false;

  if (mode === "outdoor") {
    dataKey = "outdoor_pm25";
    titleText = "PM2.5 ภายนอกอาคาร";
    titleIcon = "🌆";
    themeColor = "#f97316";
    unitText = "µg/m³";
    isAirQuality = true;
  } else if (mode === "indoor") {
    dataKey = "indoor1_pm25";
    titleText = "PM2.5 ภายในอาคาร";
    titleIcon = "🏢";
    themeColor = "#10b981";
    unitText = "µg/m³";
    isAirQuality = true;
  } else if (mode === "temp") {
    dataKey = "avg_temp";
    titleText = "อุณหภูมิเฉลี่ย ภายในอาคาร";
    titleIcon = "🌡️";
    themeColor = "#f43f5e"; // จะถูก override ด้วย tempLevel หลังคำนวณค่า
    unitText = "°C";
  } else if (mode === "power") {
    dataKey = "avg_power";
    titleText = "การใช้พลังงานไฟฟ้า (Active Power)";
    titleIcon = "⚡";
    themeColor = "#3b82f6";
    unitText = "kW";
  } else if (mode === "energy") {
    dataKey = "kwh_day";
    titleText = "หน่วยไฟฟ้าที่ใช้ไป";
    titleIcon = "🔋";
    themeColor = "#6366f1";
    unitText = "หน่วย";
  } else if (mode === "carbon") {
    dataKey = "co2_day_kg";
    titleText = "Carbon Footprint (CO₂e)";
    titleIcon = "🌱";
    themeColor = "#10b981";
    unitText = "kg";
  }

  const filledHistory = [];
  const today = new Date();
  const daysTH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const found = (historyData || []).find((item) => item.date_val === dateStr);
    filledHistory.push(found ? found : { date_val: dateStr, [dataKey]: 0 });
  }

  const values = filledHistory.map((d) => Number(d[dataKey] || 0));
  const dateLabels = filledHistory.map((d) => {
    const dt = new Date(d.date_val);
    return `${daysTH[dt.getDay()]} ${dt.getDate()}`;
  });

  const lastVal = values[6];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avgVal = (values.reduce((a, b) => a + b, 0) / 7).toFixed(1);

  // 🌡️ Override สีตามระดับอุณหภูมิ
  if (mode === "temp") {
    const tLv = getTempLevel(lastVal);
    themeColor = tLv.color;
  }

  // 🔴 1. สร้างลูกไฟให้ลอยอยู่ "พื้นหลังสุด" (Background Layout) ทะลุทั่วทั้งจอ
  let globalEmberField = document.getElementById("global-ember-field");
  if (!globalEmberField) {
    // สร้างกล่องใส่ลูกไฟไว้ล่างสุดของ Body (หลังสุด)
    globalEmberField = document.createElement("div");
    globalEmberField.id = "global-ember-field";
    document.body.insertBefore(globalEmberField, document.body.firstChild);

    // ฝัง CSS ให้กล่องนี้อยู่หลังสุดและเต็มจอ
    const style = document.createElement("style");
    style.innerHTML = `
      #global-ember-field {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        overflow: hidden; pointer-events: none;
        z-index: 0; /* 🔴 ซ่อนอยู่หลังสุด */
      }
      .bg-ember {
        position: absolute;
        bottom: -100px;
        border-radius: 50%;
        filter: blur(8px);
        opacity: 0;
        animation: bg-ember-rise linear infinite;
      }
      @keyframes bg-ember-rise {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        10% { opacity: 0.6; }
        50% { opacity: 0.8; }
        100% { transform: translateY(-120vh) scale(0.5); opacity: 0; }
      }
      /* ดันเนื้อหาหลักทั้งหมดให้ลอยอยู่เหนือลูกไฟ */
      #main-wrapper {
        position: relative;
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
  }

  // อัปเดตสีและสร้างลูกไฟใหม่ตามธีมของหน้าจอ
  globalEmberField.innerHTML = "";
  for (let i = 0; i < 40; i++) {
    // 40 ดวงกระจายเต็มจอ 4K
    const ember = document.createElement("div");
    ember.className = "bg-ember";
    const size = Math.random() * 30 + 10; // ขนาดใหญ่ขึ้นหน่อยเพราะอยู่พื้นหลัง (10-40px)
    ember.style.width = `${size}px`;
    ember.style.height = `${size}px`;
    ember.style.left = `${Math.random() * 100}%`;
    ember.style.background = `radial-gradient(circle, ${themeColor} 0%, transparent 80%)`;
    ember.style.boxShadow = `0 0 ${size}px ${themeColor}`;
    ember.style.animationDuration = `${Math.random() * 12 + 8}s`; // ลอยอ้อยอิ่ง 8-20 วิ
    ember.style.animationDelay = `${Math.random() * 10}s`;
    globalEmberField.appendChild(ember);
  }

  const leftPanelHtml = isAirQuality
    ? `
      <div style="width:12rem; height:12rem; margin-bottom:1.5rem; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); animation: floatBox 3s ease-in-out infinite; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
          ${getMascotSVG(lastVal)}
      </div>
      <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 1.5rem; border-radius: 1.5rem; text-align:center; width:100%; margin-bottom:1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 1s ease-out; flex-shrink: 0;">
          <div style="font-size:2rem; margin-bottom:0.5rem;">${getLevelEmo(lastVal)}</div>
          <div style="font-weight:bold; font-size:1.5rem; color: white;">${getLevel(lastVal).text}</div>
          <div style="font-size:1rem; opacity:0.8; color: #cbd5e1; margin-top:0.5rem;">${getLevel(lastVal).sub}</div>
      </div>
  `
    : mode === "temp"
    ? (() => {
        const tLv = getTempLevel(lastVal);
        return `
      <div style="width:12rem; height:12rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.05); border-radius: 50%; border: 2px solid ${themeColor}; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); animation: floatBox 3s ease-in-out infinite; flex-shrink: 0;">
          <span style="font-size: 5rem;">${tLv.emoji}</span>
      </div>
      <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 1.5rem; border-radius: 1.5rem; text-align:center; width:100%; margin-bottom:1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 1s ease-out; flex-shrink: 0;">
          <div style="font-size:2rem; margin-bottom:0.5rem;">${tLv.emoji}</div>
          <div style="font-weight:bold; font-size:1.5rem; color: ${themeColor};">${tLv.text}</div>
          <div style="font-size:1rem; opacity:0.8; color: #cbd5e1; margin-top:0.5rem;">${tLv.sub}</div>
      </div>
  `;
      })()
    : mode === "energy"
? `
  <div style="width:12rem; height:12rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.05); border-radius: 50%; border: 2px solid ${themeColor}; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); animation: floatBox 3s ease-in-out infinite; flex-shrink: 0;">
    <i class="fa-solid fa-plug" style="font-size: 5rem; color: ${themeColor};"></i>
  </div>

  <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 1.5rem; border-radius: 1.5rem; text-align:center; width:100%; margin-bottom:1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 1s ease-out; flex-shrink: 0;">
      <div style="font-weight:bold; font-size:1.5rem; color: white;">หน่วยไฟฟ้าที่ใช้ไปเฉลี่ย</div>
      <div style="font-size:1rem; opacity:0.8; color: #cbd5e1; margin-top:0.5rem;">ข้อมูลขณะนี้</div>
  </div>
`
    : `
      <div style="width:12rem; height:12rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.05); border-radius: 50%; border: 2px solid ${themeColor}; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); animation: floatBox 3s ease-in-out infinite; flex-shrink: 0;">
          <i class="${mode === "power" ? "fa-solid fa-bolt" : "fa-solid fa-leaf"}" style="font-size: 5rem; color: ${themeColor};"></i>
      </div>
      <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 1.5rem; border-radius: 1.5rem; text-align:center; width:100%; margin-bottom:1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 1s ease-out; flex-shrink: 0;">
          <div style="font-weight:bold; font-size:1.5rem; color: white;">${mode === "power" ? "กำลังไฟฟ้าเฉลี่ย" : "คาร์บอนฟุตพริ้นท์"}</div>
          <div style="font-size:1rem; opacity:0.8; color: #cbd5e1; margin-top:0.5rem;">ข้อมูลขณะนี้</div>
      </div>
  `;

  // 🔴 2. โครงสร้างกราฟ (ถอดลูกไฟข้างในออกแล้ว เพื่อให้โปรงใสเห็นพื้นหลัง)
  container.innerHTML = `
  <style>
      @keyframes floatBox { 0% { transform: translateY(0px); } 50% { transform: translateY(-15px); } 100% { transform: translateY(0px); } }
      @keyframes fadeUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
  </style>
  
  <div class="glass-card" style="width: 100%; flex: 1; display: flex; flex-direction: column; padding: clamp(1.5rem, 3vw, 3rem); margin-bottom: 5rem; box-sizing: border-box; overflow: hidden; position: relative;">
      
      <div style="text-align: center; margin-bottom: 2rem; flex-shrink: 0; animation: fadeUp 0.5s ease-out; position: relative; z-index: 2;">
          <div style="display: inline-flex; align-items: center; gap: 1rem; padding: 0.75rem 2rem; border-radius: 99px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
              <span style="font-size: 1.5rem;">${titleIcon}</span>
              <span style="font-size: 1.5rem; font-weight: bold; color: white;">${titleText} (7 วันย้อนหลัง)</span>
          </div>
      </div>
      
      <div style="display: flex; flex: 1; gap: 3rem; min-height: 0; align-items: center; position: relative; z-index: 2;">
          
          <div style="width: 26rem; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
              ${leftPanelHtml}
              <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 1.5rem; width:100%; text-align:center; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 1.2s ease-out; flex-shrink: 0;">
                  <div id="main-val-display" style="font-size: 4.5rem; font-weight: 900; line-height: 1; color:${themeColor}; text-shadow: 0 0 25px ${themeColor};">0.0</div>
                  <div style="font-size: 1.2rem; opacity: 0.8; color: white; margin-top: 0.5rem;">${unitText}</div>
              </div>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%;">
              <div style="flex: 1; position: relative; background: rgba(255,255,255,0.05); border-radius: 1.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: fadeUp 0.8s ease-out; min-height: 0;">
                  <svg id="chartSvg" style="width:100%; height:100%; display: block; overflow:visible;">
                      <defs>
                          <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="6" result="blur" />
                              <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                              </feMerge>
                          </filter>
                          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stop-color="${themeColor}" stop-opacity="0.7" />
                              <stop offset="100%" stop-color="${themeColor}" stop-opacity="0.0" />
                          </linearGradient>
                      </defs>
                  </svg>
              </div>
              
              <div style="display: flex; gap: 1.5rem; margin-top: 1.5rem; height: 8rem; flex-shrink: 0; animation: fadeUp 1s ease-out;">
                  <div style="flex:1; max-width: 24rem; margin: 0 auto; background:rgba(255,255,255,0.08); border-radius:1rem; display:flex; flex-direction:column; align-items:center; justify-content:center; border: 1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:1rem; opacity:0.7; color: #cbd5e1;">ค่าเฉลี่ย</div>
                      <div style="font-size:2rem; font-weight:bold; color:${themeColor}; text-shadow: 0 0 10px ${themeColor}80;">${avgVal}</div>
                  </div>
                  <div style="flex:1; max-width: 24rem; margin: 0 auto; background:rgba(255,255,255,0.08); border-radius:1rem; display:flex; flex-direction:column; align-items:center; justify-content:center; border: 1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:1rem; opacity:0.7; color: #cbd5e1;">ต่ำสุด</div>
                      <div style="font-size:2rem; font-weight:bold; color:${themeColor}; text-shadow: 0 0 10px ${themeColor}80;">${minVal.toFixed(1)}</div>
                  </div>
                  <div style="flex:1; max-width: 24rem; margin: 0 auto; background:rgba(255,255,255,0.08); border-radius:1rem; display:flex; flex-direction:column; align-items:center; justify-content:center; border: 1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:1rem; opacity:0.7; color: #cbd5e1;">สูงสุด</div>
                      <div style="font-size:2rem; font-weight:bold; color:#ff5252; text-shadow: 0 0 10px #ff525280;">${maxVal.toFixed(1)}</div>
                  </div>
              </div>
          </div>
          
      </div>
  </div>`;

  setTimeout(() => {
    const svg = document.getElementById("chartSvg");
    if (!svg) return;

    const w = svg.clientWidth > 100 ? svg.clientWidth : 1000;
    const h = svg.clientHeight > 100 ? svg.clientHeight : 350;
    const sf = Math.max(1, Math.min(w / 800, h / 300));

    const padX = 50 * sf;
    const padY = 60 * sf;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    let baseMax = 50;
    if (mode === "temp") baseMax = 35;
    if (mode === "carbon") baseMax = 100;
    if (mode === "power") baseMax = 50;
    if (mode === "energy") baseMax = 2000; 
    const gMax = Math.max(...values, baseMax) * 1.2;

    let points = "";
    let areaPoints = `M ${padX},${h - padY} `;

    values.forEach((v, i) => {
      const x = padX + (i / (values.length - 1)) * (w - padX * 2);
      const y = h - padY - (v / gMax) * (h - padY * 2);
      points += `${x},${y} `;
      areaPoints += `L ${x},${y} `;

      const pointGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      const delay = i * 0.15;
      pointGroup.setAttribute("opacity", "0");
      pointGroup.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="${0.5 + delay}s" fill="freeze" />`;

      const rectW = 75 * sf;
      const rectH = 30 * sf;
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("x", x - rectW / 2);
      rect.setAttribute("y", y - 70 * sf);
      rect.setAttribute("width", rectW);
      rect.setAttribute("height", rectH);
      rect.setAttribute("rx", 8 * sf);
      rect.setAttribute("fill", "rgba(0,0,0,0.5)");

      const txtVal = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      txtVal.setAttribute("x", x);
      txtVal.setAttribute("y", y - 48 * sf);
      txtVal.setAttribute("text-anchor", "middle");
      txtVal.setAttribute("fill", themeColor);
      txtVal.setAttribute(
        "style",
        `font-size: ${18 * sf}px; font-weight: 900;`,
      );
      txtVal.textContent = v.toFixed(1);

      pointGroup.appendChild(rect);
      pointGroup.appendChild(txtVal);

      const pointColor = isAirQuality ? "#fbbf24" : mode === "temp" ? getTempLevel(v).color : themeColor;
      if (i === values.length - 1) {
        const pulse = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        pulse.setAttribute("cx", x);
        pulse.setAttribute("cy", y);
        pulse.setAttribute("r", 15 * sf);
        pulse.setAttribute("fill", "none");
        pulse.setAttribute("stroke", pointColor);
        pulse.setAttribute("stroke-width", 3 * sf);
        pulse.innerHTML = `
              <animate attributeName="r" from="${15 * sf}" to="${45 * sf}" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
          `;
        pointGroup.appendChild(pulse);
      }

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 12 * sf);
      circle.setAttribute("fill", pointColor);
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", 3 * sf);
      pointGroup.appendChild(circle);

      if (isAirQuality) {
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", x);
        text.setAttribute("y", y + 6 * sf);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", 20 * sf);
        text.textContent = v > 50 ? "😷" : v > 25 ? "😐" : "😊";
        pointGroup.appendChild(text);
      }

      // 🌡️ Emoji บนจุดกราฟอุณหภูมิ
      if (mode === "temp") {
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", x);
        text.setAttribute("y", y + 6 * sf);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", 20 * sf);
        text.textContent = getTempLevel(v).emoji;
        pointGroup.appendChild(text);
      }

      const dateTxt = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      dateTxt.setAttribute("x", x);
      dateTxt.setAttribute("y", h - 15 * sf);
      dateTxt.setAttribute("text-anchor", "middle");
      dateTxt.setAttribute("fill", "white");
      dateTxt.setAttribute("font-size", 15 * sf);
      dateTxt.setAttribute("font-weight", "bold");
      dateTxt.textContent = dateLabels[i];

      const dateG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      dateG.setAttribute("opacity", "0");
      dateG.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${0.2 + delay}s" fill="freeze" />`;
      dateG.appendChild(dateTxt);
      svg.appendChild(dateG);

      setTimeout(() => svg.appendChild(pointGroup), 0);
    });

    areaPoints += `L ${w - padX},${h - padY} Z`;
    const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area.setAttribute("d", areaPoints);
    area.setAttribute("fill", "url(#areaGradient)");
    area.setAttribute("opacity", "0");
    area.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="1.5s" begin="0.2s" fill="freeze" />`;
    svg.insertBefore(area, svg.firstChild);

    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    line.setAttribute("points", points);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", themeColor);
    line.setAttribute("stroke-width", 6 * sf);
    line.setAttribute("filter", "url(#glowEffect)");
    line.setAttribute("stroke-dasharray", "3000");
    line.setAttribute("stroke-dashoffset", "3000");
    line.innerHTML = `<animate attributeName="stroke-dashoffset" from="3000" to="0" dur="1.5s" fill="freeze" />`;
    svg.insertBefore(line, svg.childNodes[1]);

    const displayEl = document.getElementById("main-val-display");
    if (displayEl) {
      let startTimestamp = null;
      const duration = 1500;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = progress * (2 - progress);
        displayEl.innerHTML = (easeProgress * lastVal).toFixed(1);
        if (progress < 1) window.requestAnimationFrame(step);
        else displayEl.innerHTML = lastVal.toFixed(1);
      };
      window.requestAnimationFrame(step);
    }
  }, 50);
}

// 🔴 จุดแก้บั๊ก! เพิ่ม style="width:100%; height:100%; display:block;" ให้น้องการ์ตูน
function getMascotSVG(v) {
  let mouthPath = v > 50 ? "M 30 75 Q 50 55 70 75" : "M 30 65 Q 50 85 70 65";
  return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; display:block;">
    <circle cx="50" cy="50" r="40" fill="#fff9c4" stroke="#fff" stroke-width="2"/>
    <ellipse cx="35" cy="45" rx="4" ry="6" fill="#1e293b"/>
    <ellipse cx="65" cy="45" rx="4" ry="6" fill="#1e293b"/>
    <circle cx="25" cy="55" r="5" fill="#ff8a80" opacity="0.6"/>
    <circle cx="75" cy="55" r="5" fill="#ff8a80" opacity="0.6"/>
    <path d="${mouthPath}" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="50" y="25" text-anchor="middle" font-size="12" fill="#4caf50">★</text>
    <text x="62" y="28" text-anchor="middle" font-size="8" fill="#81c784">★</text>
  </svg>`;
}

function getLevelEmo(v) {
  return v <= 25 ? "😊" : v <= 50 ? "😐" : "😷";
}

function getIndoorKeyByType(cityName, type) {
  const newsSites = ["chiangmai-news", "khonkaen-news", "hatyai-news"];
  const prefix = newsSites.includes((cityName || "").toLowerCase())
    ? "indoor2"
    : "indoor1";
  return `${prefix}_${type}`;
}

function updateMainDashboard(d) {
  const pmKey = getIndoorKeyByType(city, "pm25");
  const tempKey = getIndoorKeyByType(city, "temp");
  const humiKey = getIndoorKeyByType(city, "humi");

  updateCard("outdoor", d.outdoor_pm25);
  updateCard("indoor", d[pmKey]);

  setText("temp-val", parseFloat(d[tempKey] || 0).toFixed(1));
  setText("humid-val", parseFloat(d[humiKey] || 0).toFixed(1));

  if (document.getElementById("energy-val"))
    setText("energy-val", parseFloat(d.load_active_power_total || 0).toFixed(1));

  if (document.getElementById("daily-energy-val"))
    setText(
      "daily-energy-val",
      parseFloat(d.kwh_day || 0).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    );

  if (document.getElementById("carbon-val"))
    setText(
      "carbon-val",
      parseFloat(d.co2_day_kg || 0).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    );
}

function updateChiangMaiBar(d) {
  const pmKey = getIndoorKeyByType(city, "pm25");
  const tempKey = getIndoorKeyByType(city, "temp");
  const humiKey = getIndoorKeyByType(city, "humi");

  setText("cm-pm25-in", parseFloat(d[pmKey] || 0).toFixed(1));
  setText("cm-pm25-out", parseFloat(d.outdoor_pm25 || 0).toFixed(1));

  setText(
    "cm-temp",
    parseFloat(d[tempKey] || d.outdoor_temp || 0).toFixed(1)
  );

  setText(
    "cm-humi",
    parseFloat(d[humiKey] || d.outdoor_humi || 0).toFixed(0)
  );

  updateStatusColor("cm-pm25-in", parseFloat(d[pmKey] || 0));
  updateStatusColor("cm-pm25-out", parseFloat(d.outdoor_pm25 || 0));

  if (document.getElementById("cm-energy-val"))
    setText("cm-energy-val", parseFloat(d.load_active_power_total || 0).toFixed(1));

  if (document.getElementById("cm-daily-energy-val"))
    setText(
      "cm-daily-energy-val",
      parseFloat(d.kwh_day || 0).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    );

  if (document.getElementById("cm-carbon-val"))
    setText(
      "cm-carbon-val",
      parseFloat(d.co2_day_kg || 0).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    );
}

function updateStatusColor(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.className = "cm-val-text";
    if (val > 75) el.classList.add("text-red-500");
    else if (val > 37) el.classList.add("text-orange-500");
    else if (val > 25) el.classList.add("text-yellow-400");
    else el.classList.add("text-emerald-400");
  }
}

function updateCard(type, val) {
  const v = parseFloat(val || 0);
  const lv = getLevel(v);
  setText(`${type}-val`, v.toFixed(1));

  const card = document.getElementById(`${type}-card`);
  if (card) {
    card.style.background = lv.grad;
    // 🚨 ลูกเล่นการ์ดกระพริบเตือนภัย ถ้า PM2.5 เกิน 50 (สีส้ม/แดง)
    if (v > 50) {
      card.style.animation = "alertPulse 1.5s infinite";
      card.style.border = "2px solid rgba(220, 38, 38, 0.8)";
    } else {
      card.style.animation = "none";
      card.style.border = "1.5px solid var(--card-border)"; // คืนค่าปกติ
    }
  }

  const pill = document.getElementById(`${type}-status-pill`);
  if (pill) {
    pill.innerText = lv.label;
    pill.className =
      type === "outdoor"
        ? `px-4 py-2 lg:px-8 lg:py-3 rounded-full font-black text-sm lg:text-2xl shadow-lg ${lv.color} text-white`
        : `aqi-pill ${lv.color} text-white`;
  }

  const txt = document.getElementById(`${type}-status-text`);
  if (txt) {
    txt.innerText = lv.text;
    txt.className = `text-xl lg:text-3xl font-black ${lv.color.replace("bg-", "text-")}`;
  }

  setText(`${type}-status-sub`, lv.sub);

  const prog = document.getElementById(`${type}-progress-fill`);
  if (prog) {
    prog.style.width = Math.min((v / 100) * 100, 100) + "%";
    prog.className = `h-full rounded-full transition-all duration-1000 ${lv.color}`;
  }
}

function setText(id, t) {
  const el = document.getElementById(id);
  if (el) el.innerText = t;
}

function updateClock() {
  const now = new Date();
  setText("clock", now.toLocaleTimeString("th-TH", { hour12: false }));
  setText(
    "date",
    now
      .toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      .toUpperCase(),
  );
}

// ระบบ Zoom แบบ Hybrid:
// - จอใหญ่ (TV/PC): บังคับ Scale 1920x1080 เพื่อให้ภาพเหมือนต้นฉบับเป๊ะ
// - จอเล็ก (Mobile): ปล่อย Responsive เพื่อให้อ่านง่าย
