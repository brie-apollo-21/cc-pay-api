import express from "express";
import cors from 'cors';
// const bodyParser = require('body-parser')
const app = express()
app.use(cors(), express.json());
const port = 3000

// app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

import { balance, pay } from './endpoints.js'

// email
app.get('/balance', balance)

// merchant_name, value, id_token
app.post('/pay', pay)