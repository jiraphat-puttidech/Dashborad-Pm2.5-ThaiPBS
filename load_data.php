<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// ==========================
// CONNECT DB
// ==========================
$conn = new mysqli("localhost", "root", "P@ssEMM2025", "emm", 3306);
$conn->set_charset("utf8");

if ($conn->connect_error) {
    echo json_encode(["error" => "Database Error"]);
    exit;
}

// ==========================
// 1. รับ site จาก JS
// ==========================
// ❗ แก้ bug: จาก city -> site
$req_site = isset($_GET['site']) 
    ? $conn->real_escape_string($_GET['site']) 
    : 'bangkok';

// 👉 สร้าง site ของ news
$news_site = $req_site . '-news';

// ==========================
// 2. คำนวณ kWh / CO2 รายวัน
// ==========================
$sql_daily = "SELECT 
                site, 
                ROUND(SUM(load_active_power_total) / 60, 1) AS kwh_day, 
                ROUND((SUM(load_active_power_total) / 60) * 0.4750, 1) AS co2_day_kg 
              FROM telemetry 
              WHERE DATE(CONVERT_TZ(ts_utc, '+00:00', '+07:00')) = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))
              GROUP BY site";

$result_daily = $conn->query($sql_daily);
$daily_stats = [];

if ($result_daily) {
    while($r = $result_daily->fetch_assoc()) {
        $daily_stats[$r['site']] = $r;
    }
}

// ==========================
// 3. REALTIME DATA (site ปกติ)
// ==========================
$sql_realtime = "SELECT * FROM telemetry 
                 WHERE site = '$req_site' 
                 ORDER BY ts_utc DESC LIMIT 1";

$result = $conn->query($sql_realtime);
$data = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {

        $site = $row['site'];

        // ==========================
        // DEFAULT VALUES
        // ==========================
        $row['indoor1_pm25'] = $row['indoor1_pm25'] ?? 0;
        $row['indoor2_pm25'] = $row['indoor2_pm25'] ?? 0;
        $row['indoor1_temp'] = $row['indoor1_temp'] ?? 0;
        $row['indoor2_temp'] = $row['indoor2_temp'] ?? 0;

        // ==========================
        // DAILY STATS
        // ==========================
        if (isset($daily_stats[$site])) {
            $row['kwh_day'] = $daily_stats[$site]['kwh_day'];
            $row['co2_day_kg'] = $daily_stats[$site]['co2_day_kg'];
        } else {
            $row['kwh_day'] = 0;
            $row['co2_day_kg'] = 0;
        }

        // ==========================
        // 4. HISTORY 7 DAYS (สำคัญ)
        // ==========================
        $history = [];

        $sql_hist = "SELECT 
            DATE(ts_utc) as date_val,

            AVG(outdoor_pm25) as outdoor_pm25,

            -- indoor1 = site ปกติ
            AVG(CASE WHEN site = '$req_site' THEN indoor1_pm25 END) as indoor1_pm25,
            AVG(CASE WHEN site = '$req_site' THEN indoor1_temp END) as indoor1_temp,

            -- indoor2 = site-news
            AVG(CASE WHEN site = '$news_site' THEN indoor1_pm25 END) as indoor2_pm25,
            AVG(CASE WHEN site = '$news_site' THEN indoor1_temp END) as indoor2_temp,

            AVG(load_active_power_total) as avg_power,

            ROUND(SUM(load_active_power_total) / 60, 1) as kwh_day,
            ROUND((SUM(load_active_power_total) / 60) * 0.4750, 1) as co2_day_kg

        FROM telemetry
        WHERE site IN ('$req_site', '$news_site')
        GROUP BY DATE(ts_utc)
        ORDER BY date_val DESC
        LIMIT 7";

        $res_hist = $conn->query($sql_hist);

        if ($res_hist) {
            while($h_row = $res_hist->fetch_assoc()) {

                // กัน null
                $h_row['indoor1_pm25'] = $h_row['indoor1_pm25'] ?? 0;
                $h_row['indoor2_pm25'] = $h_row['indoor2_pm25'] ?? 0;
                $h_row['indoor1_temp'] = $h_row['indoor1_temp'] ?? 0;
                $h_row['indoor2_temp'] = $h_row['indoor2_temp'] ?? 0;

                array_unshift($history, $h_row);
            }
        }

        $row['history_list'] = $history;

        $data[] = $row;
    }

    echo json_encode($data);

} else {
    echo json_encode([]);
}

$conn->close();
?>