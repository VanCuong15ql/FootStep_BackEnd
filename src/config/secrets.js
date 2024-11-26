const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT ?? 4000;
const DB_URL = process.env.DB_URL ?? "mongodb+srv://api-user:<PASSWORD>@cluster0.p4pja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "XX4Oas8BOuikWYij";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SG_KEY = process.env.SG_KEY ?? "";
const MAILER = process.env.MAILER ?? "";
const ZEGO_APP_ID = process.env.ZEGO_APP_ID ?? "";
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET ?? "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ?? '';
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY ?? '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const AWS_S3_REGION = process.env.AWS_S3_REGION ?? ''; 

module.exports = { 
    PORT, 
    DB_URL, 
    DB_PASSWORD, 
    JWT_SECRET, 
    SG_KEY, 
    MAILER, 
    ZEGO_APP_ID, 
    ZEGO_SERVER_SECRET, 
    S3_BUCKET_NAME, 
    AWS_ACCESS_KEY, 
    AWS_SECRET_ACCESS_KEY, 
    AWS_S3_REGION 
};