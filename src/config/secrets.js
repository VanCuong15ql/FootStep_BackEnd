const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT ?? 3000;
const DB_URL = process.env.DB_URL ?? "mongodb+srv://api-user:<PASSWORD>@cluster0.p4pja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "XX4Oas8BOuikWYij";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SG_KEY = process.env.SG_KEY ?? "";
const MAILER = process.env.MAILER ?? "";
const ZEGO_APP_ID = process.env.ZEGO_APP_ID ?? "";
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET ?? "";

module.exports = { PORT, DB_URL, DB_PASSWORD, JWT_SECRET, SG_KEY, MAILER, ZEGO_APP_ID, ZEGO_SERVER_SECRET };