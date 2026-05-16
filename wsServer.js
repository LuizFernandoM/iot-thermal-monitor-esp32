// src/websocket/wsServer.js
'use strict';

class WsServer {
  constructor() {
    this.io            = null;
    this._clients      = 0;
    this._lastReading  = null;
    this._activeAlerts = new Map();
  }

  init(httpServer) {
    const { Server } = require('socket.io');
    this.io = new Server(httpServer, { cors: { origin: '*' } });

    this.io.on('connection', (socket) => {
      this._clients++;
      console.log(`[WS] Cliente conectado (total: ${this._clients})`);

      // Envia estado atual ao recém-conectado
      if (this._lastReading) socket.emit('reading', this._lastReading);
      this._activeAlerts.forEach(a => socket.emit('alert', a));

      socket.on('disconnect', () => {
        this._clients--;
        console.log(`[WS] Cliente desconectado (total: ${this._clients})`);
      });
    });

    console.log('[WS] ✅ Socket.io pronto');
  }

  broadcastReading(reading, stats) {
    if (!this.io) return;
    const payload = { temperature: reading.temperature, humidity: reading.humidity, timestamp: reading.timestamp, stats };
    this._lastReading = payload;
    this.io.emit('reading', payload);
  }

  broadcastAlert(alert) {
    if (!this.io) return;
    this._activeAlerts.set(alert.type, alert);
    this.io.emit('alert', alert);
  }

  broadcastAlertResolved(data) {
    if (!this.io) return;
    this._activeAlerts.delete(data.type);
    this.io.emit('alert_resolved', data);
  }

  broadcastMqttStatus(status) {
    if (this.io) this.io.emit('mqtt_status', { status, timestamp: new Date() });
  }

  get clients() { return this._clients; }
}

module.exports = new WsServer();
