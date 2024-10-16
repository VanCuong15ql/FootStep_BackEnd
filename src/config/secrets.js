const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT ?? 3000;
const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME ?? "chat-online-app";
const DB_USERNAME = process.env.DB_USERNAME ?? "";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";

module.exports = { PORT, MONGO_URL, DB_NAME, DB_USERNAME, DB_PASSWORD };