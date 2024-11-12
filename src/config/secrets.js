const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT ?? 3001;
const DB_URL = process.env.DB_URL ?? "mongodb+srv://api-user:<PASSWORD>@cluster0.p4pja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "XX4Oas8BOuikWYij";
const JWT_SECRET = process.env.JWT_SECRET ?? "sdg2g345fg34f1238iyu";
const SG_KEY = process.env.SG_KEY ?? "";
const MAILER = process.env.MAILER ?? "";

module.exports = { PORT, DB_URL, DB_PASSWORD, JWT_SECRET, SG_KEY, MAILER };