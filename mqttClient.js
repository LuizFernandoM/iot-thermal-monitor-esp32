// src/mqtt/mqttClient.js
'use strict';

const mqtt       = require('mqtt');
const fs         = require('fs');
const path       = require('path');
const EventEmitter = require('events');

class MqttClient extends EventEmitter {
  constructor() {
    super();
    this.client    = null;
    this.connected = false;
    this.topic     = process.env.MQTT_TOPIC || 'sensor/dht11';
    this.endpoint  = process.env.AWS_IOT_ENDPOINT;
  }

  connect() {
    if (!this.endpoint) {
      throw new Error('AWS_IOT_ENDPOINT não definido no .env');
    }

    // Carrega certificados mTLS exigidos pelo AWS IoT Core
    const certPath = path.resolve(process.env.AWS_IOT_CERT);
    const keyPath  = path.resolve(process.env.AWS_IOT_KEY);
    const caPath   = path.resolve(process.env.AWS_IOT_CA);

    for (const [label, p] of [['CERT', certPath], ['KEY', keyPath], ['CA', caPath]]) {
      if (!fs.existsSync(p)) {
        throw new Error(`Certificado ${label} não encontrado: ${p}`);
      }
    }

    const brokerUrl = `mqtts://${this.endpoint}:8883`;
    console.log(`[MQTT] Conectando → ${brokerUrl}`);
    console.log(`[MQTT] Tópico    → ${this.topic}`);

    this.client = mqtt.connect(brokerUrl, {
      clientId:           process.env.AWS_IOT_CLIENT_ID || `iot-monitor-${Date.now()}`,
      cert:               fs.readFileSync(certPath),
      key:                fs.readFileSync(keyPath),
      ca:                 fs.readFileSync(caPath),
      protocol:           'mqtts',
      rejectUnauthorized: true,
      reconnectPeriod:    5_000,
      connectTimeout:     15_000,
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[MQTT] ✅ Conectado ao AWS IoT Core!');

      this.client.subscribe(this.topic, { qos: 1 }, (err) => {
        if (err) console.error('[MQTT] Erro ao subscrever:', err.message);
        else console.log(`[MQTT] Subscrito em: ${this.topic}`);
      });

      this.emit('connected');
    });

    this.client.on('message', (_topic, payload) => {
      let data;
      try {
        data = JSON.parse(payload.toString());
      } catch {
        console.warn('[MQTT] Payload não é JSON válido:', payload.toString());
        return;
      }

    const temp = data.temperature ?? data.temperatura;
    const hum  = data.humidity ?? data.umidade;

    if (temp == null || hum == null) {
    console.warn('[MQTT] Campos inválidos:', data);
     return;
}

      const reading = {
  temperature: parseFloat(temp),
  humidity: parseFloat(hum),
  timestamp: new Date(),
  raw: data,
};
      console.log(
        `[MQTT] 📡 Temp: ${reading.temperature}°C  |  Umidade: ${reading.humidity}%`
      );

      this.emit('reading', reading);
    });

    this.client.on('reconnect', () => {
      this.connected = false;
      console.log('[MQTT] 🔄 Reconectando...');
      this.emit('reconnecting');
    });

    this.client.on('offline', () => {
      this.connected = false;
      console.warn('[MQTT] ⚠️  Offline');
      this.emit('offline');
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Erro:', err.message);
      this.emit('error', err);
    });

    this.client.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });
  }

  isConnected() { return this.connected; }
  disconnect()  { this.client?.end(); }
}

module.exports = new MqttClient();
