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

// اختبار MikroTik
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

// Dashboard
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
    const users = await conn.write("/ip/hotspot/active/print");

    await conn.close();

    const total = users.length;

    res.send(`
<!DOCTYPE html>
<html>
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
.small{
color:#94a3b8;
}
</style>
</head>

<body>

<div class="title">🔥 AK MikroTik Dashboard</div>

<div class="card">
📡 Network Name<br>
<div class="num">${identity[0].name}</div>
</div>

<div class="card">
🟢 Router Status<br>
<div class="num">ONLINE</div>
</div>

<div class="card">
👥 Connected Users<br>
<div class="num">${total}</div>
</div>

<div class="card">
🌐 Internet Status<br>
<div class="num">ONLINE</div>
</div>

<div class="card">
🕒 Last Update<br>
<div class="small">${new Date().toLocaleString()}</div>
</div>

<a class="btn" href="/devices">📱 Devices</a>
<a class="btn" href="/mikrotik-test">🧪 Test Router</a>

</body>
</html>
    `);

  } catch (error) {
    res.send("Router Offline ❌");
  }
});

// صفحة الأجهزة الاحترافية
app.get("/devices", async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return res.send("Database Error ❌");
  }

  let rows = "";

  data.forEach(device => {
    const statusColor =
      device.status === "online" ? "#22c55e" : "#ef4444";

    rows += `
<tr>
<td>${device.id}</td>
<td>${device.company || "-"}</td>
<td>${device.ip || "-"}</td>
<td style="color:${statusColor};font-weight:bold">
${device.status || "offline"}
</td>
<td>${device.last_seen || "-"}</td>
</tr>
`;
  });

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devices</title>

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
padding:12px;
font-size:14px;
text-align:left;
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

<div class="title">📱 Devices List</div>

<div class="card">
Total Devices: ${data.length}
</div>

<input
id="search"
onkeyup="searchDevice()"
placeholder="Search device..."
>

<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>IP</th>
<th>Status</th>
<th>Last Seen</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>
</table>

<a class="btn" href="/dashboard">⬅ Dashboard</a>

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
