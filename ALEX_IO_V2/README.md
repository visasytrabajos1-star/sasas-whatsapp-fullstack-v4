# ALEX IO V2 - Sistema SaaS Escalable

Este es el código completo y optimizado del sistema ALEX IO para escalar a +5,000 usuarios.

## 🚀 Características

- **Backend**: Node.js + Express optimizado.
- **IA**: Gemini (Primario) + DeepSeek (Fallback) + OpenAI (Garantía).
- **Caché**: Node-Cache integrado (Listo para Redis).
- **Frontend**: Dashboard React limpio.
- **WhatsApp**: Soporte para Baileys (QR) y Webhook (Cloud API / 360Dialog).

## 📦 Instalación

### 1. Backend

```bash
cd server
cp .env.example .env
# Edita .env con tus credenciales
npm install
npm start
```

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm start
```

## ⚙️ Configuración (.env)

Ver `server/.env.example` para las variables requeridas.

## 🏗️ Arquitectura para 5,000 Usuarios

1. **Servidor**: Google Cloud (e2-standard-4 o superior).
2. **Base de Datos**: Supabase Pro (con Connection Pooling).
3. **Redis**: Instancia de Redis para caché (opcional pero recomendado).
4. **WhatsApp**: Cuenta 360Dialog Enterprise.

## 🛠️ Comandos Útiles

- **Producción**: `NODE_ENV=production npm start`
- **Desarrollo**: `npm run dev`

## 📄 Licencia

MIT
