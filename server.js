require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AK-Mikrotik-Map Running 🔥");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server Started");
});