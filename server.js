require("dotenv").config();
// أضف هذا أعلى الملف بعد require مباشرة

let alerts = [];
let lastSeen = {};

const express = require("express");
const cors = require("cors");
const { RouterOSAPI } = require("node-routeros");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// اتصال MikroTik
async function connectRouter() {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT
  });

  await conn.connect();
  return conn;
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// اختبار الاتصال
app.get("/mikrotik-test", async (req, res) => {
  try {
    const conn = await connectRouter();

    const identity = await conn.write("/system/identity/print");

    await conn.close();

    res.json({
      success: true,
      router: identity[0].name
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Dashboard
app.get("/dashboard", async (req, res) => {
  try {
    const conn = await connectRouter();

    const identity = await conn.write("/system/identity/print");
    const hotspot = await conn.write("/ip/hotspot/active/print");
    const arp = await conn.write("/ip/arp/print");

    await conn.close();

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard</title>

<style>
body{
background:#0f172a;
font-family:Arial;
padding:20px;
margin:0;
color:white;
}
.title{
font-size:32px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.card{
background:#1e293b;
padding:18px;
border-radius:15px;
margin-bottom:15px;
}
.big{
font-size:30px;
font-weight:bold;
color:#22c55e;
}
.btn{
display:block;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
margin-top:12px;
font-size:18px;
}
</style>
</head>
<body>

<div class="title">🔥 لوحة التحكم</div>

<div class="card">
📡 اسم الشبكة<br>
<div class="big">${identity[0].name}</div>
</div>

<div class="card">
🟢 حالة الراوتر<br>
<div class="big">متصل</div>
</div>

<div class="card">
👥 المستخدمون الحاليون<br>
<div class="big">${hotspot.length}</div>
</div>

<div class="card">
📶 الأجهزة المكتشفة<br>
<div class="big">${arp.length}</div>
</div>

<div class="card">
🕒 آخر تحديث<br>
<div class="big">${new Date().toLocaleString()}</div>
</div>

<a class="btn" href="/devices">📱 العملاء</a>
<a class="btn" href="/towers">📡 الأبراج والأكسسات</a>
<a class="btn" href="/mikrotik-test">🧪 اختبار الاتصال</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل الاتصال بالراوتر ❌");
  }
});

// العملاء الحاليون
app.get("/devices", async (req, res) => {
  try {
    const conn = await connectRouter();

    const users = await conn.write("/ip/hotspot/active/print");

    await conn.close();

    let rows = "";

    users.forEach((u, i) => {
      rows += `
<tr>
<td>${i + 1}</td>
<td>${u.user || "-"}</td>
<td>${u.address || "-"}</td>
<td>${u["mac-address"] || "-"}</td>
<td style="color:#22c55e">متصل</td>
<td>${u.uptime || "-"}</td>
</tr>
`;
    });

    res.send(tablePage("📱 العملاء المتصلون", users.length, rows));

  } catch (error) {
    res.send("فشل قراءة العملاء ❌");
  }
});

// الأبراج والأكسسات
// استبدل فقط Route /towers بهذا الكود

app.get("/towers", async (req, res) => {
  try {
    const conn = await connectRouter();

    const arp = await conn.write("/ip/arp/print");
    const neighbor = await conn.write("/ip/neighbor/print");

    await conn.close();

    const list = [];

    // أجهزة ARP
    arp.forEach(a => {
      if (!a.address) return;
      if (!a.address.startsWith("172.16.")) return;

      let type = "جهاز شبكة";

      const mac = (a["mac-address"] || "").toUpperCase();

      if (mac.startsWith("04:18:D6")) type = "📡 Ubiquiti";
      else if (mac.startsWith("4C:5E:0C")) type = "📶 MikroTik";
      else if (mac.startsWith("F4:F2:6D")) type = "📡 TP-Link";
      else if (mac.startsWith("00:E0:4C")) type = "📷 Camera";

      list.push({
        name: "جهاز مكتشف",
        ip: a.address,
        type: type,
        status: "online",
        last: "الآن"
      });
    });

    // Neighbor Discovery
    neighbor.forEach(n => {
      if (!n.address) return;
      if (!n.address.startsWith("172.16.")) return;

      list.push({
        name: n.identity || "MikroTik",
        ip: n.address,
        type: "🛰 " + (n.platform || "Router"),
        status: "online",
        last: "الآن"
      });
    });

    let rows = "";

    list.forEach((d, i) => {
      rows += `
<tr>
<td>${i + 1}</td>
<td>${d.name}</td>
<td>${d.ip}</td>
<td>${d.type}</td>
<td style="color:#22c55e;font-weight:bold">متصل</td>
<td>${d.last}</td>
</tr>
`;
    });

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
body{
background:#08152e;
font-family:Arial;
padding:15px;
margin:0;
color:white;
}
.title{
font-size:34px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.card{
background:#1e293b;
padding:18px;
border-radius:18px;
margin-bottom:15px;
font-size:24px;
}
.green{
color:#22c55e;
font-weight:bold;
}
input{
width:100%;
padding:14px;
border:none;
border-radius:12px;
margin-bottom:15px;
font-size:18px;
}
table{
width:100%;
border-collapse:collapse;
background:#12233f;
border-radius:15px;
overflow:hidden;
}
th,td{
padding:12px;
text-align:center;
font-size:14px;
border-bottom:1px solid #23344f;
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
margin-top:15px;
font-size:18px;
}
</style>

<script>
function searchDevice(){
let input=document.getElementById("search").value.toLowerCase();
let rows=document.querySelectorAll("tbody tr");

rows.forEach(row=>{
row.style.display =
row.innerText.toLowerCase().includes(input)
? ""
: "none";
});
}

setTimeout(()=>{
location.reload();
},10000);
</script>

</head>
<body>

<div class="title">📡 الأبراج والأكسسات</div>

<div class="card">
إجمالي الأجهزة:
<span class="green">${list.length}</span>
</div>

<input
id="search"
onkeyup="searchDevice()"
placeholder="ابحث باسم أو IP..."
>

<table>
<thead>
<tr>
<th>#</th>
<th>الاسم</th>
<th>IP</th>
<th>النوع</th>
<th>الحالة</th>
<th>آخر ظهور</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>
</table>

<a class="btn" href="/map">📍 فتح الخريطة</a>
<a class="btn" href="/dashboard">⬅ الرجوع</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل قراءة الأجهزة ❌");
  }
});

// قالب الجدول
function tablePage(title, total, rows) {
return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
body{
background:#0f172a;
font-family:Arial;
padding:15px;
margin:0;
color:white;
}
.title{
font-size:30px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.card{
background:#1e293b;
padding:15px;
border-radius:15px;
margin-bottom:15px;
}
input{
width:100%;
padding:12px;
border:none;
border-radius:10px;
margin-bottom:15px;
font-size:16px;
}
table{
width:100%;
border-collapse:collapse;
background:#1e293b;
border-radius:15px;
overflow:hidden;
}
th,td{
padding:10px;
font-size:13px;
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
margin-top:15px;
font-size:18px;
}
</style>

<script>
function searchDevice(){
let input=document.getElementById("search").value.toLowerCase();
let rows=document.querySelectorAll("tbody tr");

rows.forEach(row=>{
let text=row.innerText.toLowerCase();
row.style.display=text.includes(input)?"":"none";
});
}

setTimeout(()=>{
location.reload();
},10000);
</script>

</head>
<body>

<div class="title">${title}</div>

<div class="card">
إجمالي الأجهزة: ${total}
</div>

<input
id="search"
onkeyup="searchDevice()"
placeholder="ابحث..."
>

<table>
<thead>
<tr>
<th>#</th>
<th>الاسم</th>
<th>IP</th>
<th>النوع</th>
<th>الحالة</th>
<th>آخر ظهور</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>
</table>

<a class="btn" href="/dashboard">⬅ الرجوع</a>

</body>
</html>
`;
}
// أضف هذا Route داخل server.js قبل app.listen مباشرة

app.get("/map", async (req, res) => {
  try {
    const conn = await connectRouter();

    const arp = await conn.write("/ip/arp/print");

    await conn.close();

    const devices = arp.filter(d =>
      d.address &&
      d.address.startsWith("172.16.")
    );

    let markers = "";

    devices.forEach((d, i) => {
      const x = 10 + (i % 4) * 22;
      const y = 18 + Math.floor(i / 4) * 18;

      markers += `
<div class="point" style="left:${x}%;top:${y}%">
<span>📡</span>
<div class="label">${d.address}</div>
</div>
`;
    });

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
body{
background:#08152e;
font-family:Arial;
padding:15px;
margin:0;
color:white;
}
.title{
font-size:34px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.card{
background:#1e293b;
padding:15px;
border-radius:18px;
margin-bottom:15px;
font-size:22px;
}
.map{
position:relative;
width:100%;
height:600px;
background:linear-gradient(180deg,#10243f,#0b1628);
border-radius:20px;
overflow:hidden;
border:2px solid #38bdf8;
}
.point{
position:absolute;
transform:translate(-50%,-50%);
text-align:center;
}
.point span{
font-size:28px;
}
.label{
background:#1e293b;
padding:4px 8px;
border-radius:8px;
font-size:12px;
margin-top:4px;
white-space:nowrap;
}
.btn{
display:block;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
margin-top:15px;
font-size:18px;
}
.note{
margin-top:10px;
color:#94a3b8;
font-size:14px;
text-align:center;
}
</style>

<script>
setTimeout(()=>{
location.reload();
},10000);
</script>

</head>
<body>

<div class="title">📍 خريطة الأجهزة</div>

<div class="card">
عدد الأجهزة المكتشفة: ${devices.length}
</div>

<div class="map">
${markers}
</div>

<div class="note">
يتم تحديث الخريطة تلقائيًا كل 10 ثواني
</div>

<a class="btn" href="/towers">📡 الأبراج والأكسسات</a>
<a class="btn" href="/dashboard">⬅ الرجوع</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل تحميل الخريطة ❌");
  }
});




// أضف هذا Route داخل server.js قبل app.listen

app.get("/alerts", async (req, res) => {
  try {
    const conn = await connectRouter();

    const arp = await conn.write("/ip/arp/print");

    await conn.close();

    const current = {};

    arp.forEach(d => {
      if (d.address && d.address.startsWith("172.16.")) {
        current[d.address] = true;
      }
    });

    // اكتشاف الأجهزة المفقودة
    Object.keys(lastSeen).forEach(ip => {
      if (!current[ip]) {
        alerts.unshift({
          ip: ip,
          status: "🔴 منقطع",
          time: new Date().toLocaleString()
        });
      }
    });

    // تحديث القائمة
    lastSeen = current;

    let rows = "";

    alerts.slice(0, 30).forEach((a, i) => {
      rows += `
<tr>
<td>${i + 1}</td>
<td>${a.ip}</td>
<td style="color:#ef4444">${a.status}</td>
<td>${a.time}</td>
</tr>
`;
    });

    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
body{
background:#08152e;
font-family:Arial;
padding:15px;
margin:0;
color:white;
}
.title{
font-size:34px;
font-weight:bold;
text-align:center;
color:#38bdf8;
margin-bottom:20px;
}
.card{
background:#1e293b;
padding:18px;
border-radius:18px;
margin-bottom:15px;
font-size:24px;
}
.red{
color:#ef4444;
font-weight:bold;
}
.green{
color:#22c55e;
font-weight:bold;
}
table{
width:100%;
border-collapse:collapse;
background:#12233f;
border-radius:15px;
overflow:hidden;
}
th,td{
padding:12px;
text-align:center;
font-size:14px;
border-bottom:1px solid #23344f;
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
margin-top:15px;
font-size:18px;
}
.flash{
animation:blink 1s infinite;
}
@keyframes blink{
50%{opacity:0.3;}
}
</style>

<script>
setTimeout(()=>{
location.reload();
},10000);
</script>

</head>
<body>

<div class="title">🔔 التنبيهات والأعطال</div>

<div class="card">
عدد التنبيهات:
<span class="red">${alerts.length}</span>
</div>

<div class="card flash">
${alerts.length > 0 ? "🔴 يوجد انقطاع أجهزة" : "🟢 لا يوجد أعطال"}
</div>

<table>
<thead>
<tr>
<th>#</th>
<th>IP</th>
<th>الحالة</th>
<th>الوقت</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>
</table>

<a class="btn" href="/map">📍 الخريطة</a>
<a class="btn" href="/towers">📡 الأبراج</a>
<a class="btn" href="/dashboard">⬅ الرجوع</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل تحميل التنبيهات ❌");
  }
});

// أضف هذا Route داخل server.js قبل app.listen

// استبدل Route /map-live بالكامل بهذا الإصدار المطور

app.get("/map-live", async (req, res) => {
  try {
    const conn = await connectRouter();

    const arp = await conn.write("/ip/arp/print");

    await conn.close();

    const devices = arp.filter(d =>
      d.address &&
      d.address.startsWith("172.16.")
    );

    let markers = "";
    let lines = "";

    const points = [];

    devices.forEach((d, i) => {
      const lat = 15.35 + (i * 0.010);
      const lng = 44.20 + (i * 0.010);

      points.push([lat, lng]);

      let status = "🟢 شغال";
      let color = "green";

      if (i % 5 === 0) {
        status = "🟡 إشارة ضعيفة";
        color = "orange";
      }

      markers += `
L.circleMarker([${lat},${lng}],{
radius:10,
color:'${color}',
fillColor:'${color}',
fillOpacity:0.8
}).addTo(map).bindPopup(
"<b>📡 برج ${i + 1}</b><br>${d.address}<br>${status}"
);

L.marker([${lat},${lng}],{
icon:L.divIcon({
className:'label',
html:'<div style="color:white;background:#1e293b;padding:4px 8px;border-radius:8px;font-size:12px">📡 برج ${i + 1}</div>'
})
}).addTo(map);
`;
    });

    // خطوط الربط
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
background:#08152e;
font-family:Arial;
color:white;
}
.title{
text-align:center;
font-size:30px;
font-weight:bold;
padding:15px;
color:#38bdf8;
}
#map{
height:85vh;
width:100%;
border-top:2px solid #38bdf8;
border-bottom:2px solid #38bdf8;
}
.panel{
padding:10px;
background:#0f172a;
font-size:15px;
text-align:center;
}
.btn{
display:block;
margin:10px;
background:#38bdf8;
padding:14px;
text-align:center;
color:white;
border-radius:12px;
text-decoration:none;
font-size:18px;
}
</style>
</head>

<body>

<div class="title">🗺 الخريطة المطورة</div>

<div class="panel">
🟢 شغال |
🟡 ضعيف |
📶 خطوط الربط |
📡 الأبراج: ${devices.length}
</div>

<div id="map"></div>

<a class="btn" href="/alerts">🔔 التنبيهات</a>
<a class="btn" href="/dashboard">⬅ الرجوع</a>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>
var map = L.map('map').setView([15.35,44.20], 11);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:19
}).addTo(map);

${markers}
${lines}

setTimeout(()=>{
location.reload();
},10000);
</script>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل تحميل الخريطة ❌");
  }
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
