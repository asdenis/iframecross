#!/bin/bash

# Script de diagnóstico para iframe de Tickets Plus
# Analiza: SSL, CORS, Cookies, URLs, Headers, etc.

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
IFRAME_URL="${1:-https://ticketsplusform.mendoza.gov.ar/ticketsplusform/com.ticketsplus.responderformularioif}"
HOST_URL="${2:-https://acpiframe-6y76i704t-galions-projects.vercel.app}"
TEMP_DIR=$(mktemp -d)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DIAGNÓSTICO DE IFRAME - TICKETS PLUS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. VERIFICAR SSL/TLS
echo -e "${YELLOW}1. VERIFICACIÓN SSL/TLS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_ssl() {
    local url=$1
    local domain=$(echo $url | sed -E 's|https?://([^/]+).*|\1|')
    
    echo -e "Dominio: ${BLUE}$domain${NC}"
    
    # Verificar certificado SSL
    if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | grep -q "Verify return code: 0"; then
        echo -e "${GREEN}✓ Certificado SSL válido${NC}"
    else
        echo -e "${RED}✗ Certificado SSL inválido o expirado${NC}"
    fi
    
    # Obtener detalles del certificado
    echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | sed 's/^/  /'
}

check_ssl "$IFRAME_URL"
echo ""
check_ssl "$HOST_URL"
echo ""

# 2. VERIFICAR HEADERS HTTP
echo -e "${YELLOW}2. VERIFICACIÓN DE HEADERS HTTP${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_headers() {
    local url=$1
    local label=$2
    
    echo -e "URL: ${BLUE}$url${NC}"
    echo "Headers relevantes:"
    
    curl -s -I "$url" 2>/dev/null | grep -iE "access-control|x-frame|content-security|referrer|set-cookie|strict-transport" | sed 's/^/  /'
    
    echo ""
}

check_headers "$IFRAME_URL" "Iframe"
check_headers "$HOST_URL" "Host"
echo ""

# 3. VERIFICAR CORS
echo -e "${YELLOW}3. VERIFICACIÓN DE CORS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_cors() {
    local url=$1
    local origin=$2
    
    echo -e "Verificando CORS desde: ${BLUE}$origin${NC}"
    echo "Hacia: ${BLUE}$url${NC}"
    
    local response=$(curl -s -I -H "Origin: $origin" -H "Access-Control-Request-Method: POST" "$url" 2>/dev/null)
    
    if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
        echo -e "${GREEN}✓ CORS habilitado${NC}"
        echo "$response" | grep -i "access-control" | sed 's/^/  /'
    else
        echo -e "${RED}✗ CORS no habilitado o no permite el origen${NC}"
    fi
    
    echo ""
}

check_cors "$IFRAME_URL" "$HOST_URL"
echo ""

# 4. VERIFICAR COOKIES
echo -e "${YELLOW}4. VERIFICACIÓN DE COOKIES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_cookies() {
    local url=$1
    local label=$2
    
    echo -e "Cookies de: ${BLUE}$label${NC}"
    
    local cookies=$(curl -s -i "$url" 2>/dev/null | grep -i "set-cookie" || echo "No cookies encontradas")
    
    if [ "$cookies" != "No cookies encontradas" ]; then
        echo "$cookies" | sed 's/^/  /'
        
        # Analizar atributos de cookies
        echo ""
        echo "Análisis de atributos:"
        if echo "$cookies" | grep -qi "samesite=none"; then
            echo -e "  ${GREEN}✓ SameSite=None (permite cross-origin)${NC}"
        elif echo "$cookies" | grep -qi "samesite=lax"; then
            echo -e "  ${YELLOW}⚠ SameSite=Lax (restricción moderada)${NC}"
        elif echo "$cookies" | grep -qi "samesite=strict"; then
            echo -e "  ${RED}✗ SameSite=Strict (no funciona en iframes)${NC}"
        else
            echo -e "  ${YELLOW}⚠ SameSite no especificado${NC}"
        fi
        
        if echo "$cookies" | grep -qi "secure"; then
            echo -e "  ${GREEN}✓ Secure (solo HTTPS)${NC}"
        else
            echo -e "  ${RED}✗ Secure no establecido${NC}"
        fi
        
        if echo "$cookies" | grep -qi "httponly"; then
            echo -e "  ${GREEN}✓ HttpOnly (protección contra XSS)${NC}"
        else
            echo -e "  ${YELLOW}⚠ HttpOnly no establecido${NC}"
        fi
    else
        echo -e "  ${YELLOW}$cookies${NC}"
    fi
    
    echo ""
}

check_cookies "$IFRAME_URL" "Iframe"
check_cookies "$HOST_URL" "Host"
echo ""

# 5. VERIFICAR X-Frame-Options
echo -e "${YELLOW}5. VERIFICACIÓN DE X-Frame-Options${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_frame_options() {
    local url=$1
    local label=$2
    
    echo -e "Servidor: ${BLUE}$label${NC}"
    
    local frame_option=$(curl -s -I "$url" 2>/dev/null | grep -i "x-frame-options" || echo "No especificado")
    
    if echo "$frame_option" | grep -qi "DENY"; then
        echo -e "  ${RED}✗ X-Frame-Options: DENY (no permite iframe)${NC}"
    elif echo "$frame_option" | grep -qi "SAMEORIGIN"; then
        echo -e "  ${YELLOW}⚠ X-Frame-Options: SAMEORIGIN (solo mismo origen)${NC}"
    elif echo "$frame_option" | grep -qi "ALLOWALL"; then
        echo -e "  ${GREEN}✓ X-Frame-Options: ALLOWALL (permite iframe)${NC}"
    else
        echo -e "  ${YELLOW}⚠ $frame_option${NC}"
    fi
    
    echo ""
}

check_frame_options "$IFRAME_URL" "Iframe"
check_frame_options "$HOST_URL" "Host"
echo ""

# 6. VERIFICAR Content-Security-Policy
echo -e "${YELLOW}6. VERIFICACIÓN DE Content-Security-Policy${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_csp() {
    local url=$1
    local label=$2
    
    echo -e "Servidor: ${BLUE}$label${NC}"
    
    local csp=$(curl -s -I "$url" 2>/dev/null | grep -i "content-security-policy" || echo "No especificado")
    
    if [ "$csp" != "No especificado" ]; then
        echo "$csp" | sed 's/^/  /'
    else
        echo -e "  ${YELLOW}$csp${NC}"
    fi
    
    echo ""
}

check_csp "$IFRAME_URL" "Iframe"
check_csp "$HOST_URL" "Host"
echo ""

# 7. VERIFICAR Referrer-Policy
echo -e "${YELLOW}7. VERIFICACIÓN DE Referrer-Policy${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_referrer_policy() {
    local url=$1
    local label=$2
    
    echo -e "Servidor: ${BLUE}$label${NC}"
    
    local policy=$(curl -s -I "$url" 2>/dev/null | grep -i "referrer-policy" || echo "No especificado")
    
    if echo "$policy" | grep -qi "no-referrer"; then
        echo -e "  ${GREEN}✓ Referrer-Policy: no-referrer${NC}"
    elif echo "$policy" | grep -qi "same-origin"; then
        echo -e "  ${YELLOW}⚠ Referrer-Policy: same-origin${NC}"
    elif echo "$policy" | grep -qi "strict-origin-when-cross-origin"; then
        echo -e "  ${RED}✗ Referrer-Policy: strict-origin-when-cross-origin (rechaza POST cross-origin)${NC}"
    else
        echo -e "  ${YELLOW}$policy${NC}"
    fi
    
    echo ""
}

check_referrer_policy "$IFRAME_URL" "Iframe"
check_referrer_policy "$HOST_URL" "Host"
echo ""

# 8. RESUMEN Y RECOMENDACIONES
echo -e "${YELLOW}8. RESUMEN Y RECOMENDACIONES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "${BLUE}Problemas identificados:${NC}"
echo ""

# Verificar problemas comunes
has_issues=0

if ! curl -s -I "$IFRAME_URL" 2>/dev/null | grep -qi "access-control-allow-origin"; then
    echo -e "  ${RED}✗ CORS no habilitado en servidor de Iframe${NC}"
    has_issues=1
fi

if curl -s -I "$IFRAME_URL" 2>/dev/null | grep -qi "x-frame-options.*deny"; then
    echo -e "  ${RED}✗ X-Frame-Options: DENY impide iframe${NC}"
    has_issues=1
fi

if curl -s -I "$IFRAME_URL" 2>/dev/null | grep -qi "referrer-policy.*strict-origin-when-cross-origin"; then
    echo -e "  ${RED}✗ Referrer-Policy rechaza POST cross-origin${NC}"
    has_issues=1
fi

if ! curl -s -i "$IFRAME_URL" 2>/dev/null | grep -qi "set-cookie.*samesite=none"; then
    echo -e "  ${RED}✗ Cookies no tienen SameSite=None (no funcionan en iframes)${NC}"
    has_issues=1
fi

if [ $has_issues -eq 0 ]; then
    echo -e "  ${GREEN}✓ No se identificaron problemas críticos${NC}"
fi

echo ""
echo -e "${BLUE}Recomendaciones:${NC}"
echo ""
echo "1. Contactar al equipo de Tickets Plus para:"
echo "   - Habilitar CORS (Access-Control-Allow-Origin)"
echo "   - Cambiar X-Frame-Options a ALLOWALL"
echo "   - Cambiar Referrer-Policy a 'no-referrer'"
echo "   - Configurar cookies con SameSite=None; Secure"
echo ""
echo "2. Alternativas si el servidor no puede cambiar:"
echo "   - Usar un proxy backend que maneje las peticiones"
echo "   - Usar postMessage para comunicación entre dominios"
echo "   - Solicitar un endpoint específico para iframes"
echo ""

# Limpiar
rm -rf "$TEMP_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FIN DEL DIAGNÓSTICO${NC}"
echo -e "${BLUE}========================================${NC}"
