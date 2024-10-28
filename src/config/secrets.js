const dotenv = require("dotenv");
dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? "";
const PORT = process.env.PORT ?? 3000;
const DB_URL = process.env.DB_URL ?? "mongodb+srv://api-user:<PASSWORD>@cluster0.p4pja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "XX4Oas8BOuikWYij";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SG_KEY = process.env.SG_KEY ?? "";

module.exports = { NODE_ENV, PORT, DB_URL, DB_PASSWORD, JWT_SECRET, SG_KEY };