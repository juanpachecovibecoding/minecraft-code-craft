#!/usr/bin/env node

const express = require('express')
const netApi = require('net-browserify')
const compression = require('compression')
const path = require('path')
const cors = require('cors')
const https = require('https')
const fs = require('fs')
let siModule
try {
  siModule = require('systeminformation')
} catch (err) { }

// Create our app
const app = express()

const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'
const timeoutIndex = process.argv.indexOf('--timeout')
let timeout = timeoutIndex > -1 && timeoutIndex + 1 < process.argv.length
    ? parseInt(process.argv[timeoutIndex + 1])
    : process.env.TIMEOUT
        ? parseInt(process.env.TIMEOUT)
        : 10000
if (isNaN(timeout) || timeout < 0) {
  console.warn('Invalid timeout value provided, using default of 10000ms')
  timeout = 10000
}
app.use(compression())
app.use(cors())

const jsonBody = express.json()

const crypto = require('crypto')
const USERS_FILE = path.join(__dirname, 'users.json')

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return []
  }
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

app.post('/api/register', jsonBody, (req, res) => {
  const { email, username, password } = req.body
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  const users = readUsers()
  const lowerEmail = email.toLowerCase().trim()
  const existingUser = users.find(u => u.email.toLowerCase().trim() === lowerEmail)
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' })
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')

  const newUser = {
    email: lowerEmail,
    username: username.trim(),
    salt,
    hash
  }

  users.push(newUser)
  writeUsers(users)

  res.json({ username: newUser.username })
})

app.post('/api/login', jsonBody, (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const users = readUsers()
  const lowerEmail = email.toLowerCase().trim()
  const user = users.find(u => u.email.toLowerCase().trim() === lowerEmail)
  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password' })
  }

  const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex')
  if (hash !== user.hash) {
    return res.status(400).json({ error: 'Invalid email or password' })
  }

  res.json({ username: user.username })
})

app.post('/EXE', (req, res) => {
  const http = require('http')
  const proxyReq = http.request({
    host: '127.0.0.1',
    port: 10273,
    path: '/EXE',
    method: 'POST',
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('Proxy error to VisualModder:', err.message)
    res.status(502).json({ error: 'Error connecting to Minecraft visualmodder plugin server.' })
  })

  req.pipe(proxyReq)
})

app.use(netApi({
  allowOrigin: '*',
  log: process.argv.includes('--log') || process.env.LOG === 'true',
  timeout
}))
if (!isProd) {
  app.use('/sounds', express.static(path.join(__dirname, './generated/sounds/')))
}
// patch config
app.get('/config.json', (req, res, next) => {
  // read original file config
  let config = {}
  let publicConfig = {}
  try {
    config = require('./config.json')
  } catch {
    try {
      config = require('./dist/config.json')
    } catch { }
  }
  try {
    publicConfig = require('./public/config.json')
  } catch { }
  res.json({
    ...config,
    'defaultProxy': '', // use current url (this server)
    ...publicConfig,
  })
})

if (isProd) {
  // add headers to enable shared array buffer
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    next()
  })

  // First serve from the override directory (volume mount)
  app.use(express.static(path.join(__dirname, './public')))

  // Then fallback to the original dist directory
  app.use(express.static(path.join(__dirname, './dist')))
}

const numArg = process.argv.find(x => x.match(/^\d+$/))
const port = (require.main === module ? numArg : undefined) || 8080

// Start the server
const server =
  app.listen(port, async function () {
    console.log('Proxy server listening on port ' + server.address().port)
    if (siModule && isProd) {
      const _interfaces = await siModule.networkInterfaces()
      const interfaces = Array.isArray(_interfaces) ? _interfaces : [_interfaces]
      let netInterface = interfaces.find(int => int.default)
      if (!netInterface) {
        netInterface = interfaces.find(int => !int.virtual) ?? interfaces[0]
        console.warn('Failed to get the default network interface, searching for fallback')
      }
      if (netInterface) {
        const address = netInterface.ip4
        console.log(`You can access the server on http://localhost:${port} or http://${address}:${port}`)
      }
    }
  })

module.exports = { app }
