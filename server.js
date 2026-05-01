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

// قراءة الأجهزة من جدول devices
app.get("/devices", async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*");

  if (error) return res.json({ success: false, error });

  res.json({
    success: true,
    devices: data
  });
});

app.listen(PORT, () => {
  console.log("Server Started 🔥");
});
