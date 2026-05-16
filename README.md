# IoT Monitor — Backend + Dashboard

> ESP32 + Mosquitto + AWS IoT Core já estão rodando.  
> Este projeto entrega o backend Node.js + dashboard em tempo real.

---

## Estrutura

```
iot-backend/
├── src/
│   ├── index.js                # Entrada — Express + Socket.io + pipeline
│   ├── mqtt/mqttClient.js      # Conexão AWS IoT Core (mTLS)
│   ├── rules/rulesEngine.js    # Média móvel + watchdog de timeout
│   ├── alerts/alertService.js  # E-mail via Mailtrap
│   └── websocket/wsServer.js   # Socket.io → dashboard
├── public/
│   └── index.html              # Dashboard (servido pelo backend)
├── certs/                      # ← coloque os certificados AWS aqui
├── .env.example
└── package.json
```

---

## Setup em 4 passos

### 1 — Instalar dependências
```bash
npm install
```

### 2 — Certificados AWS IoT Core
Coloque os 3 arquivos baixados do console AWS dentro de `certs/`:

```
certs/
├── certificate.pem.crt
├── private.pem.key
└── AmazonRootCA1.pem        ← baixe em: https://www.amazontrust.com/repository/AmazonRootCA1.pem
```

### 3 — Configurar variáveis de ambiente
```bash
cp .env.example .env
```

Edite o `.env`:

| Variável | Onde encontrar |
|---|---|
| `AWS_IOT_ENDPOINT` | AWS Console → IoT Core → Settings → Device data endpoint |
| `MAIL_USER` / `MAIL_PASS` | Mailtrap → Inboxes → SMTP Settings → Nodemailer |
| `MAIL_TO` | E-mail do administrador |
| `TEMP_THRESHOLD` | Limite de temperatura (padrão: 28°C) |

### 4 — Rodar
```bash
npm start
# ou com hot-reload:
npm run dev
```

Dashboard: **http://localhost:3001**  
Health API: **http://localhost:3001/api/health**

---

## Formato esperado do payload MQTT

O backend subscreve no tópico definido em `MQTT_TOPIC` e espera:

```json
{
  "temperature": 25.4,
  "humidity": 62.1
}
```

Campos extras (device, timestamp…) são ignorados sem erro.

---

## Motor de Regras

| Regra | Condição | Ação |
|---|---|---|
| Temperatura alta | Média móvel `AVG_WINDOW_MS` > `TEMP_THRESHOLD` | E-mail + alerta no dashboard |
| Timeout | Sem dados por > `TIMEOUT_MS` ms | E-mail crítico + alerta no dashboard |

- Alertas só são disparados uma vez por ocorrência (sem spam).  
- Quando a condição volta ao normal, o dashboard é notificado e o banner some.

---

## API REST

```
GET /api/health   → status geral (mqtt, ws clients, uptime, regras)
GET /api/stats    → estatísticas do motor de regras
```
