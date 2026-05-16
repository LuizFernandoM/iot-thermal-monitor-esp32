// src/rules/rulesEngine.js
'use strict';

const EventEmitter = require('events');

class RulesEngine extends EventEmitter {
  constructor() {
    super();

    this.threshold   = parseFloat(process.env.TEMP_THRESHOLD)  || 28;
    this.windowMs    = parseInt(process.env.AVG_WINDOW_MS)     || 60_000;
    this.timeoutMs   = parseInt(process.env.TIMEOUT_MS)        || 60_000;

    this._readings   = [];       // { temp, ts }
    this._lastAt     = null;     // Date da última leitura
    this._watchdog   = null;     // timer de timeout

    // Flags para não reenviar alerta enquanto a condição persistir
    this._tempAlert    = false;
    this._timeoutAlert = false;

    console.log('[Rules] ──────────────────────────────────');
    console.log(`[Rules] Limite de temperatura : ${this.threshold}°C`);
    console.log(`[Rules] Janela média móvel    : ${this.windowMs / 1000}s`);
    console.log(`[Rules] Timeout sem dados     : ${this.timeoutMs / 1000}s`);
    console.log('[Rules] ──────────────────────────────────');
  }

  // ── API pública ──────────────────────────────────────────────

  /** Recebe uma nova leitura do sensor */
  processReading(reading) {
    this._addReading(reading.temperature);
    this._resetWatchdog();
    this._checkTemperature();
  }

  /** Inicia o watchdog (chame uma vez após conectar ao MQTT) */
  startWatchdog() {
    this._resetWatchdog();
    console.log('[Rules] ⏱️  Watchdog iniciado');
  }

  /** Estatísticas para a API REST e o WebSocket */
  getStats() {
    const now     = Date.now();
    const recent  = this._readings.filter(r => r.ts >= now - this.windowMs);
    const avg     = recent.length
      ? +(recent.reduce((s, r) => s + r.temp, 0) / recent.length).toFixed(2)
      : null;

    return {
      movingAverage:          avg,
      readingsInWindow:       recent.length,
      windowSeconds:          this.windowMs / 1000,
      tempThreshold:          this.threshold,
      tempAlertActive:        this._tempAlert,
      timeoutAlertActive:     this._timeoutAlert,
      lastReadingAt:          this._lastAt,
      secondsSinceLastReading: this._lastAt
        ? Math.floor((now - this._lastAt.getTime()) / 1000)
        : null,
    };
  }

  // ── Internos ─────────────────────────────────────────────────

  _addReading(temp) {
    this._lastAt = new Date();
    this._readings.push({ temp, ts: Date.now() });

    // Descarta leituras fora da janela
    const cutoff = Date.now() - this.windowMs;
    this._readings = this._readings.filter(r => r.ts >= cutoff);
  }

  _checkTemperature() {
    const recent = this._readings.filter(r => r.ts >= Date.now() - this.windowMs);
    if (!recent.length) return;

    const avg = +(recent.reduce((s, r) => s + r.temp, 0) / recent.length).toFixed(2);
    console.log(`[Rules] Média móvel: ${avg}°C (${recent.length} leituras) | Limite: ${this.threshold}°C`);

    if (avg > this.threshold) {
      if (!this._tempAlert) {
        this._tempAlert = true;
        this.emit('alert', {
          type:          'HIGH_TEMPERATURE',
          severity:      'warning',
          message:       `Temperatura média de ${avg}°C ultrapassa o limite de ${this.threshold}°C`,
          value:         avg,
          threshold:     this.threshold,
          readingsCount: recent.length,
          timestamp:     new Date(),
        });
      }
    } else if (this._tempAlert) {
      this._tempAlert = false;
      console.log('[Rules] ✅ Temperatura voltou ao normal');
      this.emit('alert_resolved', { type: 'HIGH_TEMPERATURE', value: avg });
    }
  }

  _resetWatchdog() {
    clearTimeout(this._watchdog);

    if (this._timeoutAlert) {
      this._timeoutAlert = false;
      console.log('[Rules] ✅ Conexão restabelecida');
      this.emit('alert_resolved', { type: 'CONNECTION_TIMEOUT' });
    }

    this._watchdog = setTimeout(() => {
      this._timeoutAlert = true;
      this.emit('alert', {
        type:          'CONNECTION_TIMEOUT',
        severity:      'critical',
        message:       `Sem dados do sensor há mais de ${this.timeoutMs / 1000}s — possível falha de energia ou conexão`,
        timeoutMs:     this.timeoutMs,
        lastReadingAt: this._lastAt,
        timestamp:     new Date(),
      });
    }, this.timeoutMs);
  }
}

module.exports = new RulesEngine();
