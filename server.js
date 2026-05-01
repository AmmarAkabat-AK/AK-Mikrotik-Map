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
  res.send("AK-Mikrotik-Map Live 🔥");
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

// Dashboard احترافي
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
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AK Dashboard</title>

<style>
body{
background:#0f172a;
font-family:Arial;
color:white;
padding:20px;
margin:0;
}
.card{
background:#1e293b;
padding:18px;
border-radius:15px;
margin-bottom:15px;
box-shadow:0 0 15px rgba(0,0,0,.3);
}
.title{
font-size:28px;
font-weight:bold;
margin-bottom:20px;
text-align:center;
color:#38bdf8;
}
.num{
font-size:30px;
font-weight:bold;
color:#22c55e;
}
.btn{
display:block;
background:#38bdf8;
color:white;
padding:14px;
text-align:center;
border-radius:12px;
text-decoration:none;
margin-top:10px;
font-size:18px;
}
.small{
color:#94a3b8;
font-size:14px;
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

// الأجهزة
app.get("/devices", async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*");

  if (error) return res.json({ success:false });

  res.json(data);
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
