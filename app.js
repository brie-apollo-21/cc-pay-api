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

import { balance, pay } from './endpoints.js'

// email
app.post('/balance', balance)

// merchant_name, value, id_token
app.post('/pay', pay)