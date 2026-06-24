const express = require('express')
const fs = require('fs')
const path = require('path')
const logger = require('./logger')
const { ingestEvents } = require('./ingest/events')
const { ingestNightlog } = require('./ingest/nightlog')
const { generateHandover } = require('./handover')
const { renderHTML } = require('./render')

const app = express()
app.use(express.json({ limit: '2mb' }))

const DATA_DIR = path.join(__dirname, '../data')

let sampleEvents, sampleNightlog
try {
  sampleEvents = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf8'))
  sampleNightlog = fs.readFileSync(path.join(DATA_DIR, 'night-logs.md'), 'utf8')
} catch (err) {
  logger.error('failed to load sample data', { error: err.message, DATA_DIR })
  process.exit(1)
}

function nightlogDate(targetDate) {
  const d = new Date(targetDate)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function validateDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

app.get('/', (req, res) => {
  res.json({
    service: 'vouch-handover',
    status: 'ok',
    usage: 'GET /handover/:date  or  POST /handover with { date, events?, nightLog?, nightLogDate?, hotel? }',
    example: 'GET /handover/2026-05-30'
  })
})

app.get('/handover/:date', (req, res) => {
  const { date } = req.params
  if (!validateDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' })
  const log = logger.child({ hotel: sampleEvents.hotel.id, night: date, endpoint: 'GET' })
  try {
    log.info('start', { step: 'ingest' })
    const events = ingestEvents(sampleEvents)
    const nlDate = nightlogDate(date)
    const { events: nlEvents, flags } = ingestNightlog(sampleNightlog, nlDate)
    log.info('ingested', { events: events.length, nightlogBullets: nlEvents.length, nonEnglishFlags: flags.length })
    const handover = generateHandover({ events, nightlogEvents: nlEvents, nonEnglishFlags: flags, hotel: sampleEvents.hotel, targetDate: date })
    log.info('done', { summary: handover.summary })
    res.json(handover)
  } catch (err) {
    log.error('error', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.get('/handover/:date/view', (req, res) => {
  const { date } = req.params
  if (!validateDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' })
  const log = logger.child({ hotel: sampleEvents.hotel.id, night: date, endpoint: 'GET-view' })
  try {
    const events = ingestEvents(sampleEvents)
    const nlDate = nightlogDate(date)
    const { events: nlEvents, flags } = ingestNightlog(sampleNightlog, nlDate)
    const handover = generateHandover({ events, nightlogEvents: nlEvents, nonEnglishFlags: flags, hotel: sampleEvents.hotel, targetDate: date })
    log.info('done', { summary: handover.summary })
    res.setHeader('Content-Type', 'text/html')
    res.send(renderHTML(handover))
  } catch (err) {
    log.error('error', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.post('/handover', (req, res) => {
  const { date, events: eventsData, nightLog, nightLogDate, hotel } = req.body || {}
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD morning date)' })
  if (!validateDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' })
  const hotelInfo = hotel || sampleEvents.hotel
  const log = logger.child({ hotel: hotelInfo.id, night: date, endpoint: 'POST' })
  try {
    log.info('start', { step: 'ingest' })
    const events = ingestEvents(eventsData || sampleEvents)
    const nlText = nightLog || sampleNightlog
    const nlDate = nightLogDate || nightlogDate(date)
    const { events: nlEvents, flags } = ingestNightlog(nlText, nlDate)
    log.info('ingested', { events: events.length, nightlogBullets: nlEvents.length, nonEnglishFlags: flags.length })
    const handover = generateHandover({ events, nightlogEvents: nlEvents, nonEnglishFlags: flags, hotel: hotelInfo, targetDate: date })
    log.info('done', { summary: handover.summary })
    res.json(handover)
  } catch (err) {
    log.error('error', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

module.exports = app
