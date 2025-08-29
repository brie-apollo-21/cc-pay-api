import pgPromise from 'pg-promise'
import 'dotenv/config'

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
    console.log("===== /BALANCE =====")
    console.log(req.body)
    try {
        let user = undefined
        if(req.body.email) {
            user = await db.oneOrNone("SELECT * FROM users WHERE email='"+req.body.email+"'", [true]);
        } else if(req.body.name) {
            user = await db.oneOrNone("SELECT * FROM users WHERE name='"+req.body.name+"'", [true]);
        }
        console.log(user)
        if(user !== null) {
            res.send(user.balance)
        } else {
            res.sendStatus(404)
        }
        // success
    } 
    catch(error) {
        next(error)
        // error
    }
}

// merchant_name, amount, id_token
export const pay = async (req, res, next) =>{
    console.log("===== /PAY =====")
    try {
        // CHECK ID TOKEN
        const ticket = await client.verifyIdToken({
            idToken: req.body.id_token,
            audience: '1028999553685-jmt3d709j855hhvdd6e0f19gh1cdmpcv.apps.googleusercontent.com'
        })
        const email = ticket.getPayload().email
        try {
            // CHECK USER BALANCE
            const user = await db.oneOrNone("SELECT * FROM users WHERE email='"+email+"'", [true]);
            const balance = user.balance
            const receiver = await db.oneOrNone("SELECT * FROM users WHERE name='"+req.body.merchant_name+"'", [true]);
            const receiver_type = receiver.type
            console.log(email + " | " + balance)
            console.log(req.body.merchant_name + " | " + receiver_type)
            if(balance >= req.body.amount && receiver_type == "MERCHANT") {
                try {
                    await db.none("UPDATE users SET balance=balance+"+req.body.amount+" WHERE name='"+req.body.merchant_name+"'")
                    await db.none("UPDATE users SET balance=balance-"+req.body.amount+" WHERE email='"+email+"'")
                    await db.none("INSERT INTO transactions (user_email,merchant_name,amount,timestamp) VALUES ('"+email+"','"+req.body.merchant_name+"',"+req.body.amount+","+Math.floor(new Date().getTime() / 1000)+")")
                    res.send("Payment completed")
                } catch(error) {
                    next(error)
                }
            } else {
                res.send("Insufficient funds")
            }
        } catch(error) {
            next(error)
        }
    } catch(error) {
        next(error)
    }
}