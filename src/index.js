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
const sampleEvents = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf8'))
const sampleNightlog = fs.readFileSync(path.join(DATA_DIR, 'night-logs.md'), 'utf8')
const NIGHTLOG_SHIFT_DATE = '2026-05-28'

app.get('/', (req, res) => {
  res.json({
    service: 'vouch-handover',
    status: 'ok',
    usage: 'GET /handover/:date  or  POST /handover with { date, events?, nightLog?, nightLogDate?, hotel? }',
    example: 'GET /handover/2026-05-30'
  })
})

// GET /handover/:date — uses bundled sample data
app.get('/handover/:date', (req, res) => {
  const { date } = req.params
  const log = logger.child({ hotel: sampleEvents.hotel.id, night: date, endpoint: 'GET' })

  try {
    log.info('start', { step: 'ingest' })
    const events = ingestEvents(sampleEvents)
    const { events: nlEvents, flags } = ingestNightlog(sampleNightlog, NIGHTLOG_SHIFT_DATE)
    log.info('ingested', { events: events.length, nightlogBullets: nlEvents.length, nonEnglishFlags: flags.length })

    const handover = generateHandover({ events, nightlogEvents: nlEvents, nonEnglishFlags: flags, hotel: sampleEvents.hotel, targetDate: date })
    log.info('done', { summary: handover.summary })
    res.json(handover)
  } catch (err) {
    log.error('error', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// GET /handover/:date/view — human-readable HTML
app.get('/handover/:date/view', (req, res) => {
  const { date } = req.params
  const log = logger.child({ hotel: sampleEvents.hotel.id, night: date, endpoint: 'GET-view' })
  try {
    const events = ingestEvents(sampleEvents)
    const { events: nlEvents, flags } = ingestNightlog(sampleNightlog, NIGHTLOG_SHIFT_DATE)
    const handover = generateHandover({ events, nightlogEvents: nlEvents, nonEnglishFlags: flags, hotel: sampleEvents.hotel, targetDate: date })
    log.info('done', { summary: handover.summary })
    res.setHeader('Content-Type', 'text/html')
    res.send(renderHTML(handover))
  } catch (err) {
    log.error('error', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// POST /handover — accepts custom data (generalizable)
app.post('/handover', (req, res) => {
  const { date, events: eventsData, nightLog, nightLogDate, hotel } = req.body || {}
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD morning date)' })

  const hotelInfo = hotel || sampleEvents.hotel
  const log = logger.child({ hotel: hotelInfo.id, night: date, endpoint: 'POST' })

  try {
    log.info('start', { step: 'ingest' })
    const events = ingestEvents(eventsData || sampleEvents)
    const nlText = nightLog || sampleNightlog
    const nlDate = nightLogDate || NIGHTLOG_SHIFT_DATE
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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => logger.info('server started', { port: PORT }))
