# 📋 DOCUMENTACIÓN TÉCNICA V2 - ALEX IO SAAS
**Proyecto:** WhatsApp Conversational Core (SaaS)
**Versión:** 2.1.0 (Producción Activa)
**Fecha de Actualización:** 28 Febrero 2026
**Arquitectura:** Híbrida (Baileys QR + Meta Cloud API)

---

## 🏗️ ARQUITECTURA GENERAL (V2)

### Stack Tecnológico Actualizado
- **Runtime:** Node.js >= 18.0.0
- **Framework Web:** Express 4.18.2
- **Protocolo WhatsApp:** Baileys 6.6.0 (Multidispositivo / QR) y Meta Cloud API
- **IA Conversacional:** Cascada Gemini 1.5 Flash / GPT-4o Mini / DeepSeek V3
- **Voz AI (TTS):** OpenAI TTS-1 (Voz: Nova)
- **Base de Datos:** Supabase (PostgreSQL + RLS)
- **Persistencia:** Sesiones locales en `./sessions` y estado hidratado desde Supabase

### Punto de Entrada Principal
**Archivo:** `server/index.js`  
**Servicio WhatsApp:** `server/services/whatsappSaas.js`
**Comando de Inicio:** `npm start`

---

## 📁 ESTRUCTURA DE SERVICIOS (REFACCIÓN V2.1)

```
server/
├── services/
│   ├── alexBrain.js          # Orquestador de IA (Gemini -> DeepSeek -> OpenAI)
│   ├── promptService.js      # Gestión de versiones y promoción de prompts (NUEVO)
│   ├── whatsappSaas.js       # Handler multitenant de WhatsApp (Baileys Core)
│   ├── supabaseClient.js     # Cliente de base de datos con seguridad reforzada
│   └── ...
├── middleware/
│   ├── auth.js               # Autenticación JWT y RBAC (Seguridad V2)
│   └── ...
└── sql/                      # Scripts de base de datos para SaaS
```

---

## 🔑 VARIABLES DE ENTORNO (CRÍTICAS V2)

### Seguridad y Auth
```env
JWT_SECRET=tu_secreto_seguro  # REQUERIDO en producción
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Inteligencia Artificial (AI Cascade)
```env
GEMINI_API_KEY=...    # Proveedor Primario
DEEPSEEK_API_KEY=...  # Proveedor de Fallback 1
OPENAI_API_KEY=...    # Proveedor de Fallback 2 y TTS
```

### Configuración de WhatsApp
```env
WHATSAPP_SESSIONS_TABLE=whatsapp_sessions
WHATSAPP_IGNORE_GROUPS=true  # Ignorar grupos (Default: true)
WHATSAPP_MAX_RECONNECT_ATTEMPTS=5
```

---

## 🔄 FLUJO DE INTELIGENCIA (CASCADE V2)

El sistema utiliza un sistema de cascada con **Circuit Breaker**:

1.  **Recepción:** El mensaje llega vía Baileys o Webhook Cloud API.
2.  **Cerebro (alexBrain):**
    *   Consulta a **Gemini 1.5 Flash**. Si falla por timeout o cuota, salta.
    *   Consulta a **DeepSeek V3**.
    *   Consulta a **GPT-4o Mini**.
    *   **Circuit Breaker:** Si una llave reporta error de "Saldo Insuficiente" o "Expirada", se desactiva por 1 hora automáticamente.
3.  **Voz (TTS):** Si hay una llave de OpenAI válida, se genera un audio PTT (nota de voz).
4.  **Respuesta:** Se envía el texto y opcionalmente el audio al usuario.

---

## 🛡️ SEGURIDAD Y MULTI-TENANCY

### Aislamiento de Datos
- Cada usuario tiene un `tenantId` derivado de su email o ID de Supabase.
- El middleware `authenticateTenant` inyecta este ID en todas las peticiones.
- Las sesiones de WhatsApp están aisladas en carpetas individuales bajo `./sessions/{instanceId}`.

### Roles de Usuario (RBAC)
- **OWNER:** Dueño de su bot y configuraciones.
- **SUPERADMIN:** Acceso a todos los clientes, métricas globales y bypass de sesiones.
- **USER:** Acceso restringido (solo lectura o limitado).

---

## 🔧 OPERACIONES Y MANTENIMIENTO

### Reinicio de Instancia
Se puede forzar el reinicio de un conector de WhatsApp mediante el endpoint:
`POST /api/saas/instance/:instanceId/restart`

### Gestión de Prompts
Los prompts ahora tienen versionado. Se pueden crear versiones de "test", probarlas y luego promoverlas a "active" usando `promptService.js`.

---

## 🚀 NOTAS DE DESPLIEGUE (RENDER)

1.  **Persistencia:** En Render, asegúrese de usar un **Disk Mount** en `/sessions` para que los QRs escaneados persistan tras reinicios del servidor.
2.  **Health Check:** La ruta `/api/status` devuelve la versión actual y el estado de los servicios.
3.  **Variables:** Todas las llaves de API deben estar configuradas en el panel de Render.

---

**Última Versión:** 2.1.0  
**Desarrollado por:** Antigravity AI  
**Fecha:** 28 Feb 2026
