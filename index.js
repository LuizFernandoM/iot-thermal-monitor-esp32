// src/index.js
'use strict';

require('dotenv').config();
const http    = require('http');
const express = require('express');
const path    = require('path');

const mqtt    = require('./mqttClient');
const rules   = require('./rulesEngine');
const alerts  = require('./alertService');
const ws      = require('./wsServer');

// ── Servidor HTTP ──────────────────────────────────────────────────
const app  = express();
app.use(express.json());

// Dashboard (frontend estático)
app.use(express.static(path.join(__dirname, 'public')));

// API
app.get('/api/health', (_req, res) => res.json({
  status:  'ok',
  mqtt:    mqtt.isConnected() ? 'connected' : 'disconnected',
  clients: ws.clients,
  rules:   rules.getStats(),
  uptime:  Math.floor(process.uptime()),
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const server = http.createServer(app);
ws.init(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        IoT Monitor — Backend             ║');
  console.log(`║  Dashboard : http://localhost:${PORT}        ║`);
  console.log(`║  Health    : http://localhost:${PORT}/api/health ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

// ── Pipeline: MQTT → Regras → WS + E-mail ─────────────────────────

mqtt.on('connected', () => {
  ws.broadcastMqttStatus('connected');
  rules.startWatchdog();
});

mqtt.on('reading', (reading) => {
  rules.processReading(reading);
  ws.broadcastReading(reading, rules.getStats());
});

mqtt.on('reconnecting', () => ws.broadcastMqttStatus('reconnecting'));
mqtt.on('offline',      () => ws.broadcastMqttStatus('offline'));
mqtt.on('disconnected', () => ws.broadcastMqttStatus('disconnected'));

rules.on('alert', async (alert) => {
  console.log(`\n🚨 [${alert.severity?.toUpperCase()}] ${alert.message}\n`);
  ws.broadcastAlert(alert);
  await alerts.sendAlert(alert);
});

rules.on('alert_resolved', (data) => {
  ws.broadcastAlertResolved(data);
});

// ── Conecta ao AWS IoT Core ────────────────────────────────────────
try {
  mqtt.connect();
} catch (err) {
  console.error('\n❌ Erro fatal ao conectar MQTT:', err.message);
  console.error('   Verifique as variáveis AWS_IOT_* e os arquivos em ./certs/\n');
  process.exit(1);
}

// ── Graceful shutdown ──────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[App] Encerrando...');
  mqtt.disconnect();
  server.close(() => process.exit(0));
});
