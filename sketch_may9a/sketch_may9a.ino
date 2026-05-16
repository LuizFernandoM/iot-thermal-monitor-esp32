#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// WIFI
const char* ssid = "Luiz";
const char* password = "luiz2728";

// MQTT
const char* mqtt_server = "192.168.0.100";

WiFiClient espClient;
PubSubClient client(espClient);

// SENSOR
#define DHTPIN 15
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// WIFI
void setup_wifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado!");
}

// MQTT
void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      Serial.println("MQTT conectado!");
    } else {
      Serial.print("Erro MQTT: ");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  delay(2000);

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) return;

  String msg = "{";
  msg += "\"temperatura\": " + String(t) + ",";
  msg += "\"umidade\": " + String(h);
  msg += "}";

  client.publish("sensor/dht11", msg.c_str());
}