const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT ?? 3001;
const DB_URL = process.env.DB_URL ?? "";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SG_KEY = process.env.SG_KEY ?? "";
const MAILER = process.env.MAILER ?? "";
const ZEGO_APP_ID = process.env.ZEGO_APP_ID ?? "";
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER ?? "";

module.exports = { PORT, DB_URL, DB_PASSWORD, JWT_SECRET, SG_KEY, MAILER, ZEGO_APP_ID, ZEGO_SERVER_SECRET };