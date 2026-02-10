# Scripts de Diagnóstico para Iframe

Este directorio contiene scripts para diagnosticar problemas de integración de iframes cross-origin.

## Uso

### Node.js (Recomendado - Multiplataforma)

```bash
# Diagnóstico con URLs por defecto
node scripts/diagnose-iframe.js

# Diagnóstico con URLs personalizadas
node scripts/diagnose-iframe.js "https://tu-iframe-url.com" "https://tu-host-url.com"
```

### Bash (Linux/macOS)

```bash
# Hacer el script ejecutable
chmod +x scripts/diagnose-iframe.sh

# Ejecutar con URLs por defecto
./scripts/diagnose-iframe.sh

# Ejecutar con URLs personalizadas
./scripts/diagnose-iframe.sh "https://tu-iframe-url.com" "https://tu-host-url.com"
```

## Qué verifica

El script de diagnóstico analiza:

1. **SSL/TLS**: Validez del certificado y fechas de expiración
2. **Headers HTTP**: Todos los headers de seguridad relevantes
3. **CORS**: Configuración de Cross-Origin Resource Sharing
4. **Cookies**: Presencia, atributos (SameSite, Secure, HttpOnly)
5. **X-Frame-Options**: Permite o rechaza iframes
6. **Content-Security-Policy**: Restricciones de seguridad
7. **Referrer-Policy**: Política de envío de referrer

## Interpretación de resultados

### ✓ Verde (Éxito)
Indica que la configuración es correcta para esa característica.

### ⚠ Amarillo (Advertencia)
Indica una configuración que podría causar problemas pero no es crítica.

### ✗ Rojo (Error)
Indica un problema que probablemente impide que el iframe funcione correctamente.

## Problemas comunes

### CORS no habilitado
**Problema**: El servidor no devuelve `Access-Control-Allow-Origin`
**Solución**: Contactar al equipo del servidor para habilitar CORS

### X-Frame-Options: DENY
**Problema**: El servidor rechaza explícitamente iframes
**Solución**: Cambiar a `ALLOWALL` o `SAMEORIGIN`

### Referrer-Policy: strict-origin-when-cross-origin
**Problema**: El servidor rechaza peticiones POST cross-origin sin referrer
**Solución**: Cambiar a `no-referrer` o `same-origin`

### Cookies sin SameSite=None
**Problema**: Las cookies no se envían en iframes cross-origin
**Solución**: Configurar cookies con `SameSite=None; Secure`

## Recomendaciones para el servidor

Si eres responsable del servidor de Tickets Plus, implementa:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
X-Frame-Options: ALLOWALL
Referrer-Policy: no-referrer
Set-Cookie: session=...; SameSite=None; Secure; HttpOnly
```

## Alternativas si el servidor no puede cambiar

1. **Proxy Backend**: Crear un endpoint en tu servidor que actúe como proxy
2. **postMessage**: Usar comunicación entre ventanas con postMessage API
3. **Endpoint específico**: Solicitar al servidor un endpoint diseñado para iframes
