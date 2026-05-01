require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { RouterOSAPI } = require("node-routeros");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ملفات الواجهة
app.use(express.static("public"));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// اختبار الاتصال بالمايكروتيك
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

// الأجهزة
app.get("/devices", async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*");

  if (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }

  res.json({
    success: true,
    devices: data
  });
});

// Dashboard الحقيقي
app.get("/dashboard", async (req, res) => {
  let routerName = "غير متصل";
  let routerStatus = "offline";

  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT
  });

  try {
    await conn.connect();
    const identity = await conn.write("/system/identity/print");

    if (identity.length > 0) {
      routerName = identity[0].name;
      routerStatus = "online";
    }

    await conn.close();
  } catch (e) {}

  const { data } = await supabase
    .from("devices")
    .select("*");

  const totalDevices = data ? data.length : 0;
  const onlineDevices = data
    ? data.filter(d => d.status === "online").length
    : 0;

  const offlineDevices = totalDevices - onlineDevices;

  res.json({
    success: true,
    router_name: routerName,
    router_status: routerStatus,
    total_devices: totalDevices,
    online_devices: onlineDevices,
    offline_devices: offlineDevices,
    internet_status: "online",
    updated_at: new Date().toLocaleString("ar")
  });
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
