import mysql from "mysql2/promise";

export const db = await mysql.createConnection({
  host: "localhost", // stays localhost on Hostinger
  user: "u790394236_choresuser",
  password: "Stapleford172",
  database: "u790394236_choresdb",
});

console.log("✅ Connected to MySQL choresdb");
