const express = require('express');

const routes = require('./routes/index');

const morgan = require('morgan');

const rateLimit = require('express-rate-limit');

const helmet = require('helmet');

const mongoSanitize = require('express-mongo-sanitize');

const bodyParser = require('body-parser');

// const xss = require('xss');

const cors = require('cors');

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(mongoSanitize());

app.use(cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json({ limit: "10kb" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(helmet());

const {NODE_ENV} = require('./config/secrets');
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

const limiter = rateLimit({
    max: 3000,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour'
});

app.use("/tawk", limiter);

app.use(routes);

// app.use(xss());

module.exports = app;