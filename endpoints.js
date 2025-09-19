import pgPromise from 'pg-promise'
import 'dotenv/config'
import logger from './logger.js';

const pgp = pgPromise()
const db = pgp({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: {
        rejectUnauthorized: false
    }
});
db.connect()

import { OAuth2Client } from 'google-auth-library'
const client = new OAuth2Client();

// email || name
export const balance = async (req, res, next) => {
    logger.info("===== /BALANCE =====")
    logger.info("Request: ", req.body)
    try {
        let user = undefined
        if (req.body.email) {
            user = await db.oneOrNone("SELECT * FROM users WHERE email='" + req.body.email + "'", [true]);
        } else if (req.body.name) {
            user = await db.oneOrNone("SELECT * FROM users WHERE name='" + req.body.name + "'", [true]);
        }
        if (user !== null) {
            logger.info("User: ", user)
            res.send(user.balance)
        } else {
            logger.error("User not found")
            res.sendStatus(404)
        }
        // success
    }
    catch (error) {
        logger.error(error)
        next(error)
        // error
    }
}

// id_token
export const start_session = async (req, res, next) => {
    logger.info("===== /START_SESSION =====")
    try {
        // CHECK ID TOKEN
        const ticket = await client.verifyIdToken({
            idToken: req.body.id_token,
            audience: '1028999553685-jmt3d709j855hhvdd6e0f19gh1cdmpcv.apps.googleusercontent.com'
        })
        logger.info("Payload: ", ticket.getPayload())
        const email = ticket.getPayload().email
        try {
            const user = await db.oneOrNone("SELECT 1 FROM users WHERE email='" + email + "'", [true]);
            if (user == null) {
                logger.info("New user: " + email)
                let nis = undefined
                if (email.endsWith("@kanisius.sch.id") == true) {
                    nis = email.match(/\d+/g)[0]
                }
                try {
                    await db.none("INSERT INTO users (email,nis,name,type,balance,id_token) VALUES ($1,$2,$3,'STUDENT',0,$4)", [email, nis, ticket.getPayload().name, req.body.id_token])
                } catch (error) {
                    logger.error(error)
                    next(error)
                }
            } else {
                logger.info("Existing user: " + email)
                try {
                    await db.none("UPDATE users SET id_token='" + req.body.id_token + "' WHERE email='" + email + "'")
                } catch (error) {
                    logger.error(error)
                    next(error)
                }
            }
            res.send("Session started")
        } catch (error) {
            logger.error(error)
            next(error)
        }
    } catch (error) {
        logger.error(error)
        next(error)
    }
}

// id_token
export const end_session = async (req, res, next) => {
    logger.info("===== /END_SESSION =====")
    logger.info("Request: ", req.body)
    try {
        await db.none("UPDATE users SET id_token=NULL WHERE id_token='" + req.body.id_token + "'")
    } catch (error) {
        logger.error(error)
        next(error)
    }
}

// merchant_name, amount, id_token
export const pay = async (req, res, next) => {
    logger.info("===== /PAY =====")
    logger.info("Request: ", req.body)
    try {
        // CHECK USER BALANCE
        // const user = await db.oneOrNone("SELECT * FROM users WHERE id_token='"+req.body.id_token+"'", [true]);
        const user = await db.oneOrNone("SELECT * FROM users WHERE id_token=$1", [req.body.id_token], [true]);
        const balance = user.balance
        // const receiver = await db.oneOrNone("SELECT * FROM users WHERE name='"+req.body.merchant_name+"'", [true]);
        const receiver = await db.oneOrNone("SELECT * FROM users WHERE name=$1", [req.body.merchant_name], [true]);
        const receiver_type = receiver.type
        logger.info("SENDER | " + user.email + " | " + balance)
        logger.info("RECEIVER | " + req.body.merchant_name + " | " + receiver_type)
        if (receiver_type == "MERCHANT") {
            if (balance >= req.body.amount && req.body.amount > 0) {
                try {
                    // await db.none("UPDATE users SET balance=balance+"+req.body.amount+" WHERE name='"+req.body.merchant_name+"'")
                    await db.none("UPDATE users SET balance=balance+$1 WHERE name=$2", [req.body.amount, req.body.merchant_name])
                    // await db.none("UPDATE users SET balance=balance-"+req.body.amount+" WHERE email='"+user.email+"'")
                    await db.none("UPDATE users SET balance=balance-$1 WHERE email=$2", [req.body.amount, user.email])
                    // await db.none("INSERT INTO transactions (user_email,merchant_name,amount,timestamp) VALUES ('"+user.email+"','"+req.body.merchant_name+"',"+req.body.amount+","+Math.floor(new Date().getTime() / 1000)+")")
                    await db.none("INSERT INTO transactions (user_email,merchant_name,amount,timestamp) VALUES ($1,$2,$3," + Math.floor(new Date().getTime() / 1000) + ")", [user.email, req.body.merchant_name, req.body.amount])
                    logger.info("Payment successful: " + user.email + " paid " + req.body.amount + " to " + req.body.merchant_name)
                    res.send("Payment completed")
                } catch (error) {
                    logger.error(error)
                    next(error)
                }
            } else {
                logger.error("Insufficient funds or negative payment amount")
                res.status(400).send("Insufficient funds or negative payment amount")
            }
        } else {
            logger.error("Merchant not found")
            res.status(400).send("Merchant not found")
        }
    } catch (error) {
        logger.error(error)
        next(error)
    }
}

const admins = ["2314999natalius@kanisius.sch.id", "2415517benedict@kanisius.sch.id"]

// id_token, amount
export const set_balances = async (req, res, next) => {
    logger.info("===== /SET_BALANCE =====")
    try {
        const user = await db.oneOrNone("SELECT email FROM users WHERE id_token='" + req.body.id_token + "'", [true]);
        logger.info(user.email + " setting balances to Rp" + req.body.amount)
        if (admins.includes(user.email)) {
            const users = await db.manyOrNone("SELECT email FROM users WHERE TYPE='STUDENT'");
            // logger.info(JSON.stringify(users))
            await db.none("UPDATE users SET balance=" + req.body.amount + " WHERE type='STUDENT'")
            for (let i = 0; i < users.length; i++) {
                await db.none("INSERT INTO transactions (user_email,amount,timestamp) VALUES ('" + users[i].email + "'," + req.body.amount + "," + Math.floor(new Date().getTime() / 1000) + ")")
            }
            res.send("Success")
        } else {
            res.status(403).send("Forbidden")
        }
    } catch (error) {
        logger.error(error)
        next(error)
    }
}

// id_token
export const history = async (req, res, next) => {
    logger.info("===== /HISTORY =====")
    try {
        const user = await db.oneOrNone("SELECT email FROM users WHERE id_token='" + req.body.id_token + "'", [true]);

        const transactions = await db.manyOrNone("SELECT * FROM transactions WHERE user_email='" + user.email + "' ORDER BY timestamp DESC");

        res.send(transactions)
    } catch (error) {
        logger.error(error)
        next(error)
    }
}

export const merchants = async (req, res) => {
    logger.info("===== /MERCHANTS =====")
    try {
        const merchants = await db.manyOrNone("SELECT name FROM users WHERE type='MERCHANT' ORDER BY name ASC");
        let merchants_string = "["
        for (let i = 0; i < merchants.length; i++) {
            merchants_string += "\"" + merchants[i].name + "\","
        }
        merchants_string = merchants_string.slice(0, merchants_string.length - 1) + "]"
        logger.info(merchants_string)
        res.send(merchants_string)
    } catch (error) {
        res.send("Error fetching merchants")
    }
}