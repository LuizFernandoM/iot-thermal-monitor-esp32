// src/alerts/alertService.js
'use strict';

const nodemailer = require('nodemailer');

class AlertService {
  constructor() {
    this._ready   = false;
    this._transport = null;
    this._init();
  }

  async _init() {
    this._transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
      port: parseInt(process.env.MAIL_PORT) || 2525,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    try {
      await this._transport.verify();
      this._ready = true;
      console.log('[Alerts] ✅ Mailtrap conectado — e-mails prontos para envio');
    } catch (err) {
      console.error('[Alerts] ❌ Falha ao conectar ao Mailtrap:', err.message);
      console.warn('[Alerts]    Verifique MAIL_USER e MAIL_PASS no .env');
    }
  }

  async sendAlert(alert) {
    if (!this._ready) {
      console.warn('[Alerts] E-mail ignorado — serviço não inicializado');
      return;
    }

    try {
      const info = await this._transport.sendMail({
        from:    `"IoT Monitor 🌡️" <${process.env.MAIL_FROM || 'iot@monitor.local'}>`,
        to:      process.env.MAIL_TO,
        subject: this._subject(alert),
        text:    this._text(alert),
        html:    this._html(alert),
      });
      console.log(`[Alerts] ✉️  E-mail enviado → ${info.messageId}`);
    } catch (err) {
      console.error('[Alerts] Erro ao enviar e-mail:', err.message);
    }
  }

  _subject(alert) {
    return {
      HIGH_TEMPERATURE: `🌡️ [ALERTA] Temperatura elevada: ${alert.value}°C`,
      CONNECTION_TIMEOUT: `🔌 [CRÍTICO] Sensor sem comunicação`,
    }[alert.type] ?? `[ALERTA IoT] ${alert.type}`;
  }

  _text(alert) {
    const lines = [
      'ALERTA — IoT Monitor',
      '====================',
      `Tipo      : ${alert.type}`,
      `Severidade: ${(alert.severity || '').toUpperCase()}`,
      `Mensagem  : ${alert.message}`,
      `Horário   : ${alert.timestamp?.toLocaleString('pt-BR')}`,
    ];
    if (alert.value     != null) lines.push(`Valor     : ${alert.value}°C`);
    if (alert.threshold != null) lines.push(`Limite    : ${alert.threshold}°C`);
    if (alert.lastReadingAt)     lines.push(`Último dado: ${new Date(alert.lastReadingAt).toLocaleString('pt-BR')}`);
    return lines.join('\n');
  }

  _html(alert) {
    const isTemp  = alert.type === 'HIGH_TEMPERATURE';
    const accent  = isTemp ? '#f59e0b' : '#ef4444';
    const bgLight = isTemp ? '#fef3c7' : '#fee2e2';
    const icon    = isTemp ? '🌡️' : '🔌';
    const title   = isTemp ? 'Temperatura Elevada' : 'Falha de Conexão';
    const action  = isTemp
      ? 'Verifique o ambiente. Considere acionar ventilação ou refrigeração.'
      : 'Verifique a alimentação do ESP32, o Wi-Fi e o broker MQTT/AWS IoT Core.';

    const row = (label, value) => value != null ? `
      <tr>
        <td style="padding:10px 0;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;width:45%">${label}</td>
        <td style="padding:10px 0;color:#1e293b;border-bottom:1px solid #e2e8f0">${value}</td>
      </tr>` : '';

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:${accent};padding:32px 40px;text-align:center">
    <div style="font-size:52px">${icon}</div>
    <h1 style="margin:10px 0 4px;color:#fff;font-size:22px;font-weight:700">${title}</h1>
    <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px">Sistema de Monitoramento IoT · ESP32 / DHT11</p>
  </div>
  <div style="padding:32px 40px">
    <div style="background:${bgLight};border-left:4px solid ${accent};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px">
      <strong style="color:#1e293b">${alert.message}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Horário do alerta', alert.timestamp?.toLocaleString('pt-BR'))}
      ${isTemp ? row('Temperatura média', `<strong style="font-size:20px">${alert.value}°C</strong>`) : ''}
      ${isTemp ? row('Limite configurado', `${alert.threshold}°C`) : ''}
      ${isTemp ? row('Leituras na janela', alert.readingsCount) : ''}
      ${!isTemp && alert.lastReadingAt ? row('Último dado recebido', new Date(alert.lastReadingAt).toLocaleString('pt-BR')) : ''}
    </table>
    <div style="margin-top:24px;padding:14px 16px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569;line-height:1.6">
      <strong>Ação recomendada:</strong> ${action}
    </div>
  </div>
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 40px;text-align:center">
    <p style="margin:0;font-size:11px;color:#94a3b8">IoT Monitor · Alerta automático · Não responda este e-mail</p>
  </div>
</div>
</body></html>`;
  }
}

module.exports = new AlertService();
