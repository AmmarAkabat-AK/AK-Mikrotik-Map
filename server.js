require("dotenv").config();
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

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("AK-MikroTik-Map Live 🔥");
});

// اختبار الراوتر
app.get("/mikrotik-test", async (req, res) => {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT
  });

  try {
    await conn.connect();
    const identity = await conn.write("/system/identity/print");
    await conn.close();

    res.json({
      success: true,
      mikrotik: identity
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// لوحة التحكم
app.get("/dashboard", async (req, res) => {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT
  });

  try {
    await conn.connect();

    const identity = await conn.write("/system/identity/print");
    const active = await conn.write("/ip/hotspot/active/print");

    await conn.close();

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة التحكم</title>

<style>
body{
background:#0f172a;
font-family:Arial;
padding:20px;
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
padding:18px;
border-radius:15px;
margin-bottom:15px;
}
.num{
font-size:28px;
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

<div class="title">🔥 لوحة تحكم الشبكة</div>

<div class="card">
📡 اسم الشبكة<br>
<div class="num">${identity[0].name}</div>
</div>

<div class="card">
🟢 حالة الراوتر<br>
<div class="num">متصل</div>
</div>

<div class="card">
👥 المستخدمون الحاليون<br>
<div class="num">${active.length}</div>
</div>

<div class="card">
🕒 آخر تحديث<br>
<div class="num">${new Date().toLocaleString()}</div>
</div>

<a class="btn" href="/devices">📱 الأجهزة الحقيقية</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("الراوتر غير متصل ❌");
  }
});

// الأجهزة الحقيقية من MikroTik
app.get("/devices", async (req, res) => {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT
  });

  try {
    await conn.connect();

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
<td style="color:#22c55e;font-weight:bold">متصل</td>
<td>${u.uptime || "-"}</td>
</tr>
`;
    });

    res.send(`
<!DOCTYPE html>
<html>
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
direction:rtl;
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
</script>

</head>
<body>

<div class="title">📱 الأجهزة المتصلة الآن</div>

<div class="card">
إجمالي الأجهزة: ${users.length}
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
<th>MAC</th>
<th>الحالة</th>
<th>المدة</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>
</table>

<a class="btn" href="/dashboard">⬅ رجوع</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("فشل قراءة الأجهزة ❌");
  }
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
