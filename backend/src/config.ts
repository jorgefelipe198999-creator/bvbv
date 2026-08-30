export interface AppConfig {
  port: number;
  mqttUrl: string;
  mqttTopic: string;
  mqttUsername?: string;
  mqttPassword?: string;
  mongodbUri: string;
  mongodbDbName: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  mqttUrl: process.env.MQTT_URL ?? "mqtt://localhost:1883",
  mqttTopic: process.env.MQTT_TOPIC ?? "producao/eventos",
  mqttUsername: process.env.MQTT_USERNAME,
  mqttPassword: process.env.MQTT_PASSWORD,
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "nexaline",
};
