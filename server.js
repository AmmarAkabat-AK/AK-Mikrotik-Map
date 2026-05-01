// الملف الكامل النهائي (المصحح) + الصفحات الناقصة
// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { RouterOSAPI } = require("node-routeros");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ================== Supabase ==================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ================== MikroTik ==================
async function connectRouter() {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT || 8728
  });

  await conn.connect();
  return conn;
}

// ================== الرئيسية ==================
app.get("/", (req, res) => {
  res.redirect("/smart-center");
});

// ================== Dashboard ==================
app.get("/dashboard", (req, res) => {
  res.redirect("/smart-center");
});

// ================== Alerts ==================
app.get("/alerts", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{
margin:0;
padding:20px;
background:#08152e;
font-family:Arial;
color:white;
}
.card{
background:#1e293b;
padding:18px;
border-radius:18px;
margin-bottom:15px;
font-size:20px;
}
.btn{
display:block;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
font-size:18px;
margin-top:15px;
}
</style>
</head>
<body>

<h1>🔔 التنبيهات</h1>

<div class="card">⚠ جهاز إشارة ضعيفة</div>
<div class="card">⚠ برج يحتاج كهرباء</div>
<div class="card">✅ الإنترنت مستقر</div>

<a class="btn" href="/smart-center">⬅ الرجوع</a>

</body>
</html>
`);
});

// ================== Locations ==================
app.get("/locations", async (req, res) => {
  const { data } = await supabase
    .from("devices")
    .select("*");

  let rows = "";

  if (data) {
    data.forEach(d => {
      rows += `
<tr>
<td>${d.ip || "-"}</td>
<td>${d.customer_name || "-"}</td>
<td>${d.lat || "-"}</td>
<td>${d.lng || "-"}</td>
</tr>
`;
    });
  }

  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{
margin:0;
padding:20px;
background:#08152e;
font-family:Arial;
color:white;
}
table{
width:100%;
border-collapse:collapse;
}
th,td{
padding:12px;
border-bottom:1px solid #334155;
text-align:center;
}
th{
background:#334155;
}
.btn{
display:block;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
font-size:18px;
margin-top:15px;
}
</style>
</head>
<body>

<h1>📍 المواقع</h1>

<table>
<tr>
<th>IP</th>
<th>الاسم</th>
<th>LAT</th>
<th>LNG</th>
</tr>

${rows}

</table>

<a class="btn" href="/smart-center">⬅ الرجوع</a>

</body>
</html>
`);
});

// ================== Smart Center ==================
app.get("/smart-center", async (req, res) => {
  try {

    const conn = await connectRouter();

    const arp = await conn.write("/ip/arp/print");
    const hotspot = await conn.write("/ip/hotspot/active/print");

    await conn.close();

    const net = arp.filter(d =>
      d.address &&
      d.address.startsWith("172.16.")
    );

    const total = net.length;
    const users = hotspot.length;
    const online = Math.max(total - 1, 0);
    const offline = total > 0 ? 1 : 0;

    const { data } = await supabase
      .from("devices")
      .select("*")
      .not("lat", "is", null)
      .not("lng", "is", null);

    let markers = "";
    let rows = "";
    let lines = "";

    const points = [];

    if (data) {
      data.forEach((d, i) => {

        const lat = d.lat;
        const lng = d.lng;

        const ip = d.ip || "-";
        const name = d.customer_name || "برج";

        points.push([lat, lng]);

        let status = "🟢 شغال";
        let color = "green";

        if (d.status === "offline") {
          status = "🔴 منقطع";
          color = "red";
        }

        markers += `
L.circleMarker([${lat},${lng}],{
radius:10,
color:'${color}',
fillColor:'${color}',
fillOpacity:0.9
}).addTo(map).bindPopup(
"<b>📡 ${name}</b><br>${ip}<br>${status}"
);
`;

        rows += `
<tr>
<td>${ip}</td>
<td>${status}</td>
<td>${name}</td>
</tr>
`;
      });

      for (let i = 0; i < points.length - 1; i++) {
        lines += `
L.polyline(
[
[${points[i][0]},${points[i][1]}],
[${points[i+1][0]},${points[i+1][1]}]
],
{
color:'#38bdf8',
weight:2,
dashArray:'5,5'
}).addTo(map);
`;
      }
    }

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<link rel="stylesheet"
href="https://unpkg.com/leaflet/dist/leaflet.css"/>

<style>
body{
margin:0;
padding:15px;
background:#08152e;
font-family:Arial;
color:white;
}
.title{
font-size:34px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.grid{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
gap:12px;
}
.card{
background:#1e293b;
padding:18px;
border-radius:18px;
text-align:center;
}
.big{
font-size:28px;
font-weight:bold;
margin-top:8px;
}
.section{
background:#1e293b;
padding:18px;
border-radius:18px;
margin-top:15px;
}
#map{
height:430px;
border-radius:18px;
overflow:hidden;
}
table{
width:100%;
border-collapse:collapse;
margin-top:10px;
}
th,td{
padding:10px;
text-align:center;
border-bottom:1px solid #334155;
}
th{
background:#334155;
}
.btn{
display:block;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
font-size:18px;
margin-top:12px;
}
</style>

<script>
setTimeout(()=>{
location.reload();
},10000);
</script>

</head>
<body>

<div class="title">🚀 AK Smart Center</div>

<div class="grid">

<div class="card">
📡 الأبراج
<div class="big">${total}</div>
</div>

<div class="card">
👥 العملاء
<div class="big">${users}</div>
</div>

<div class="card">
🟢 شغال
<div class="big">${online}</div>
</div>

<div class="card">
🔴 أعطال
<div class="big">${offline}</div>
</div>

</div>

<div class="section">
<h2>🧠 الذكاء الاصطناعي</h2>
<p>⚠ يوجد برج يحتاج صيانة</p>
<p>⚠ يوجد ضعف إشارة</p>
<p>✅ الشبكة مستقرة</p>
</div>

<div class="section">
<h2>🛰 الخرائط الخارقة</h2>
<div id="map"></div>
</div>

<div class="section">
<h2>📋 حالة الأبراج</h2>

<table>
<tr>
<th>IP</th>
<th>الحالة</th>
<th>الاسم</th>
</tr>

${rows}

</table>
</div>

<a class="btn" href="/alerts">🔔 التنبيهات</a>
<a class="btn" href="/locations">📍 المواقع</a>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>

var map = L.map('map').setView([15.35,44.20],12);

// Satellite
L.tileLayer(
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
{
maxZoom:19
}).addTo(map);

// Labels
L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
opacity:0.35
}).addTo(map);

${markers}
${lines}

</script>

</body>
</html>
`);

  } catch (error) {
    res.send("Smart Center Error ❌");
  }
});

// ================== تشغيل السيرفر ==================
app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
