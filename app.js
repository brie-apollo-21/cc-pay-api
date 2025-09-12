import express from "express";
import cors from 'cors';
import 'dotenv/config'
// const bodyParser = require('body-parser')
const app = express()
app.use(cors(), express.json());
const port = process.env.PORT || 80

// app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`CC Pay API listening on port ${port}`)
})

import { balance, pay, start_session, set_balances, history } from './endpoints.js'

// email
app.post('/balance', balance)

// merchant_name, value, id_token
app.post('/pay', pay)

// id_token
app.post('/start_session', start_session)

// id_token, amount
app.post('/set_balances', set_balances)

// id_token
app.post('/history', history)