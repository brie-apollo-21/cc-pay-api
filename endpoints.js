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

// id_token
export const start_session = async (req, res, next) => {
    console.log("===== /START_SESSION =====")
    try {
        // CHECK ID TOKEN
        const ticket = await client.verifyIdToken({
            idToken: req.body.id_token,
            audience: '1028999553685-jmt3d709j855hhvdd6e0f19gh1cdmpcv.apps.googleusercontent.com'
        })
        console.log(ticket.getPayload())
        const email = ticket.getPayload().email
        try {
            const user = await db.oneOrNone("SELECT 1 FROM users WHERE email='"+email+"'", [true]);
            if(user == null) {
                console.log("New user: "+email)
                let nis = undefined
                if(email.endsWith("@kanisius.sch.id") == true) {
                    nis = email.match(/\d+/g)[0]
                }
                try {
                    await db.none("INSERT INTO users (email,nis,name,type,balance,id_token) VALUES ($1,$2,$3,'STUDENT',0,$4)", [email, nis, ticket.getPayload().name, req.body.id_token])
                } catch(error) {
                    next(error)
                }
            } else {
                console.log("Existing user: "+email)
                try {
                    await db.none("UPDATE users SET id_token='"+req.body.id_token+"' WHERE email='"+email+"'")
                } catch(error) {
                    next(error)
                }
            }
            res.send("Session started")
        } catch(error) {
            next(error)
        }
    } catch(error) {
        next(error)
    }
}

// id_token
export const end_session = async (req, res, next) => {
    console.log("===== /END_SESSION =====")
    try {
        await db.none("UPDATE users SET id_token=NULL WHERE id_token='"+req.body.id_token+"'")
    } catch(error) {
        next(error)
    }
}

// merchant_name, amount, id_token
export const pay = async (req, res, next) =>{
    console.log("===== /PAY =====")
console.log(req.body)
    try {
        // CHECK USER BALANCE
        // const user = await db.oneOrNone("SELECT * FROM users WHERE id_token='"+req.body.id_token+"'", [true]);
        const user = await db.oneOrNone("SELECT * FROM users WHERE id_token=$1", [req.body.id_token], [true]);
        const balance = user.balance
        // const receiver = await db.oneOrNone("SELECT * FROM users WHERE name='"+req.body.merchant_name+"'", [true]);
        const receiver = await db.oneOrNone("SELECT * FROM users WHERE name=$1", [req.body.merchant_name], [true]);
        const receiver_type = receiver.type
        console.log(user.email + " | " + balance)
        console.log(req.body.merchant_name + " | " + receiver_type)
        if(receiver_type == "MERCHANT") {
            if(balance >= req.body.amount && req.body.amount > 0) {
                try {
                    // await db.none("UPDATE users SET balance=balance+"+req.body.amount+" WHERE name='"+req.body.merchant_name+"'")
                    await db.none("UPDATE users SET balance=balance+$1 WHERE name=$2", [req.body.amount, req.body.merchant_name])
                    // await db.none("UPDATE users SET balance=balance-"+req.body.amount+" WHERE email='"+user.email+"'")
                    await db.none("UPDATE users SET balance=balance-$1 WHERE email=$2", [req.body.amount, user.email])
                    // await db.none("INSERT INTO transactions (user_email,merchant_name,amount,timestamp) VALUES ('"+user.email+"','"+req.body.merchant_name+"',"+req.body.amount+","+Math.floor(new Date().getTime() / 1000)+")")
                    await db.none("INSERT INTO transactions (user_email,merchant_name,amount,timestamp) VALUES ($1,$2,$3,"+Math.floor(new Date().getTime() / 1000)+")", [user.email, req.body.merchant_name, req.body.amount])
                    res.send("Payment completed")
                } catch(error) {
                    next(error)
                }
            } else {
                res.status(400);
                res.send("Insufficient funds or negative payment amount")
            }
        } else {
            res.status(400);
            res.send("Merchant not found")
        }
    } catch(error) {
        next(error)
    }
}

const admins = ["2314999natalius@kanisius.sch.id", "2415517benedict@kanisius.sch.id"]

// id_token, amount
export const set_balances = async (req, res, next) =>{
    console.log("===== /SET_BALANCE =====")
    try {
        const user = await db.oneOrNone("SELECT email FROM users WHERE id_token='"+req.body.id_token+"'", [true]);
        console.log(user.email + " setting balances to Rp"+req.body.amount)
        if(admins.includes(user.email)) {
            const users = await db.manyOrNone("SELECT email FROM users WHERE TYPE='STUDENT'");
            // console.log(JSON.stringify(users))
            await db.none("UPDATE users SET balance="+req.body.amount+" WHERE type='STUDENT'")
            for(let i = 0; i < users.length; i++) {
                await db.none("INSERT INTO transactions (user_email,amount,timestamp) VALUES ('"+users[i].email+"',"+req.body.amount+","+Math.floor(new Date().getTime() / 1000)+")")
            }
            res.send("Success")
        } else {
            res.sendStatus(403)
        }
    } catch(error) {
        next(error)
    }
}

// id_token
export const history = async (req, res, next) =>{
    console.log("===== /HISTORY =====")
    try {
        const user = await db.oneOrNone("SELECT email FROM users WHERE id_token='"+req.body.id_token+"'", [true]);
        
        const transactions = await db.manyOrNone("SELECT * FROM transactions WHERE user_email='"+user.email+"' ORDER BY timestamp DESC");
        
        res.send(transactions)
    } catch(error) {
        next(error)
    }
}

export const merchants = async (res, next) =>{
    console.log("===== /MERCHANTS =====")
    try {
        const merchants = await db.manyOrNone("SELECT name FROM users WHERE type='MERCHANT' ORDER BY name ASC");   
        res.send(JSON.stringify(merchants))
    } catch(error) {
        next(error)
    }
}