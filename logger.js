import winston from "winston";
const { combine, timestamp, printf, colorize, align, splat, prettyPrint, uncolorize, json, metadata } = winston.format;

const customJsonFormat = printf(info => {
    return `[${info.timestamp}] ${info.level}: ${JSON.stringify(info.message)}`;
});

const logger = winston.createLogger({
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        splat(),
        align(),
        printf(({level, message, timestamp, ...metadata}) => {
            return `[${timestamp}] ${level}: ${message}${Object.keys(metadata)[0] == undefined ? '' : JSON.stringify(metadata)}`;
        })
    ),
    transports: [new winston.transports.File({ filename: 'logs/all.log' }), new winston.transports.Console()],
});

export default logger;