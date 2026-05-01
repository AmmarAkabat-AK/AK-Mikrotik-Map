require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { RouterOSAPI } = require("node-routeros");
const { createClient } = require("@supabase/supabase-js");
const { exec } = require("child_process");

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
async function getConnection() {
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
  res.send("AK MikroTik Scanner Live 🔥");
});

// Dashboard
app.get("/dashboard", async (req, res) => {
  res.redirect("/towers");
});

// Scanner حقيقي
async function scanDevices() {
  try {
    const conn = await getConnection();

    const arp = await conn.write("/ip/arp/print");
    const neighbors = await conn.write("/ip/neighbor/print");

    await conn.close();

    // حفظ ARP
    for (const d of arp) {
      if (!d.address) continue;

      await supabase
        .from("devices")
        .upsert({
          ip: d.address,
          company: d["mac-address"] || "Unknown",
          customer_name: "جهاز مكتشف",
          status: "online",
          last_seen: new Date()
        }, { onConflict: "ip" });
    }

    // حفظ Neighbor
    for (const n of neighbors) {
      if (!n.address) continue;

      await supabase
        .from("devices")
        .upsert({
          ip: n.address,
          company: n.identity || "Network Device",
          customer_name: "جهاز شبكة",
          status: "online",
          last_seen: new Date()
        }, { onConflict: "ip" });
    }

    console.log("Scan Completed 🔥");

  } catch (e) {
    console.log("Scanner Error", e.message);
  }
}

// تشغيل كل 30 ثانية
setInterval(scanDevices, 30000);
scanDevices();

// صفحة الأبراج والأجهزة
app.get("/towers", async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("last_seen", { ascending: false });

  if (error) return res.send("DB Error ❌");

  let rows = "";

  data.forEach((d, i) => {
    const color =
      d.status === "online" ? "#22c55e" : "#ef4444";

    rows += `
<tr>
<td>${i + 1}</td>
<td>${d.customer_name || "-"}</td>
<td>${d.ip || "-"}</td>
<td>${d.company || "-"}</td>
<td style="color:${color};font-weight:bold">
${d.status}
</td>
<td>${d.last_seen || "-"}</td>
</tr>
`;
  });

  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>الأجهزة</title>

<style>
body{
background:#0f172a;
font-family:Arial;
padding:15px;
margin:0;
color:white;
}
.title{
font-size:28px;
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

<div class="title">📡 الأبراج والأكسسات</div>

<div class="card">
إجمالي الأجهزة: ${data.length}
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

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
