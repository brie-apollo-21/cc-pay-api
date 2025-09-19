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

// amount
const args = process.argv.slice(2)
const amount = args[0]

const users = await db.manyOrNone("SELECT email FROM users WHERE TYPE='STUDENT'");

await db.none("UPDATE users SET balance="+amount+" WHERE type='STUDENT'")
let insert_history = ""
for(let i = 0; i < users.length; i++) {
    insert_history += "INSERT INTO transactions (user_email,amount,timestamp) VALUES ('"+users[i].email+"',"+amount+","+Math.floor(new Date().getTime() / 1000)+");"
}
await db.none(insert_history)
process.exit()