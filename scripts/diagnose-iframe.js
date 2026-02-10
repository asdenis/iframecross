#!/usr/bin/env node

/**
 * Script de diagnóstico para iframe de Tickets Plus
 * Analiza: SSL, CORS, Cookies, URLs, Headers, etc.
 * 
 * Uso: node scripts/diagnose-iframe.js [iframe-url] [host-url]
 */

const https = require('https');
const url = require('url');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.blue}${msg}${colors.reset}\n${'━'.repeat(80)}`),
};

// URLs por defecto
const IFRAME_URL = process.argv[2] || 'https://ticketsplusform.mendoza.gov.ar/ticketsplusform/com.ticketsplus.responderformularioif';
const HOST_URL = process.argv[3] || 'https://acpiframe-6y76i704t-galions-projects.vercel.app';

// Función para hacer peticiones HTTPS
function makeRequest(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new url.URL(urlString);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Diagnostic Tool)',
        ...options.headers,
      },
      timeout: 10000,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Función para extraer dominio
function getDomain(urlString) {
  return new url.URL(urlString).hostname;
}

// 1. Verificar SSL/TLS
async function checkSSL() {
  log.section('1. VERIFICACIÓN SSL/TLS');

  for (const testUrl of [IFRAME_URL, HOST_URL]) {
    const domain = getDomain(testUrl);
    console.log(`Dominio: ${colors.blue}${domain}${colors.reset}`);

    try {
      const response = await makeRequest(testUrl);
      log.success('Certificado SSL válido');
    } catch (error) {
      log.error(`Error SSL: ${error.message}`);
    }
  }
}

// 2. Verificar Headers HTTP
async function checkHeaders() {
  log.section('2. VERIFICACIÓN DE HEADERS HTTP');

  const checkUrl = async (testUrl, label) => {
    console.log(`${label}: ${colors.blue}${testUrl}${colors.reset}`);
    console.log('Headers relevantes:');

    try {
      const response = await makeRequest(testUrl);
      const relevantHeaders = [
        'access-control-allow-origin',
        'access-control-allow-credentials',
        'x-frame-options',
        'content-security-policy',
        'referrer-policy',
        'set-cookie',
        'strict-transport-security',
      ];

      let found = false;
      for (const header of relevantHeaders) {
        if (response.headers[header]) {
          console.log(`  ${header}: ${response.headers[header]}`);
          found = true;
        }
      }

      if (!found) {
        console.log('  (No headers de seguridad encontrados)');
      }
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    console.log('');
  };

  await checkUrl(IFRAME_URL, 'Iframe');
  await checkUrl(HOST_URL, 'Host');
}

// 3. Verificar CORS
async function checkCORS() {
  log.section('3. VERIFICACIÓN DE CORS');

  const hostDomain = getDomain(HOST_URL);
  console.log(`Verificando CORS desde: ${colors.blue}${hostDomain}${colors.reset}`);
  console.log(`Hacia: ${colors.blue}${IFRAME_URL}${colors.reset}\n`);

  try {
    const response = await makeRequest(IFRAME_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': HOST_URL,
        'Access-Control-Request-Method': 'POST',
      },
    });

    const corsHeader = response.headers['access-control-allow-origin'];
    if (corsHeader) {
      log.success(`CORS habilitado: ${corsHeader}`);
      if (response.headers['access-control-allow-credentials']) {
        console.log(`  Credentials: ${response.headers['access-control-allow-credentials']}`);
      }
    } else {
      log.error('CORS no habilitado o no permite el origen');
    }
  } catch (error) {
    log.error(`Error: ${error.message}`);
  }
}

// 4. Verificar Cookies
async function checkCookies() {
  log.section('4. VERIFICACIÓN DE COOKIES');

  const checkUrl = async (testUrl, label) => {
    console.log(`Cookies de: ${colors.blue}${label}${colors.reset}`);

    try {
      const response = await makeRequest(testUrl);
      const setCookie = response.headers['set-cookie'];

      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        cookies.forEach((cookie) => {
          console.log(`  ${cookie}`);
        });

        console.log('\nAnálisis de atributos:');

        const cookieStr = cookies.join(';').toLowerCase();

        if (cookieStr.includes('samesite=none')) {
          log.success('SameSite=None (permite cross-origin)');
        } else if (cookieStr.includes('samesite=lax')) {
          log.warn('SameSite=Lax (restricción moderada)');
        } else if (cookieStr.includes('samesite=strict')) {
          log.error('SameSite=Strict (no funciona en iframes)');
        } else {
          log.warn('SameSite no especificado');
        }

        if (cookieStr.includes('secure')) {
          log.success('Secure (solo HTTPS)');
        } else {
          log.error('Secure no establecido');
        }

        if (cookieStr.includes('httponly')) {
          log.success('HttpOnly (protección contra XSS)');
        } else {
          log.warn('HttpOnly no establecido');
        }
      } else {
        console.log('  No cookies encontradas');
      }
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    console.log('');
  };

  await checkUrl(IFRAME_URL, 'Iframe');
  await checkUrl(HOST_URL, 'Host');
}

// 5. Verificar X-Frame-Options
async function checkFrameOptions() {
  log.section('5. VERIFICACIÓN DE X-Frame-Options');

  const checkUrl = async (testUrl, label) => {
    console.log(`Servidor: ${colors.blue}${label}${colors.reset}`);

    try {
      const response = await makeRequest(testUrl);
      const frameOption = response.headers['x-frame-options'];

      if (!frameOption) {
        log.warn('X-Frame-Options no especificado');
      } else if (frameOption.toUpperCase() === 'DENY') {
        log.error('X-Frame-Options: DENY (no permite iframe)');
      } else if (frameOption.toUpperCase() === 'SAMEORIGIN') {
        log.warn('X-Frame-Options: SAMEORIGIN (solo mismo origen)');
      } else if (frameOption.toUpperCase() === 'ALLOWALL') {
        log.success('X-Frame-Options: ALLOWALL (permite iframe)');
      } else {
        console.log(`  X-Frame-Options: ${frameOption}`);
      }
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    console.log('');
  };

  await checkUrl(IFRAME_URL, 'Iframe');
  await checkUrl(HOST_URL, 'Host');
}

// 6. Verificar CSP
async function checkCSP() {
  log.section('6. VERIFICACIÓN DE Content-Security-Policy');

  const checkUrl = async (testUrl, label) => {
    console.log(`Servidor: ${colors.blue}${label}${colors.reset}`);

    try {
      const response = await makeRequest(testUrl);
      const csp = response.headers['content-security-policy'];

      if (csp) {
        console.log(`  ${csp}`);
      } else {
        log.warn('CSP no especificado');
      }
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    console.log('');
  };

  await checkUrl(IFRAME_URL, 'Iframe');
  await checkUrl(HOST_URL, 'Host');
}

// 7. Verificar Referrer-Policy
async function checkReferrerPolicy() {
  log.section('7. VERIFICACIÓN DE Referrer-Policy');

  const checkUrl = async (testUrl, label) => {
    console.log(`Servidor: ${colors.blue}${label}${colors.reset}`);

    try {
      const response = await makeRequest(testUrl);
      const policy = response.headers['referrer-policy'];

      if (!policy) {
        log.warn('Referrer-Policy no especificado');
      } else if (policy.includes('no-referrer')) {
        log.success('Referrer-Policy: no-referrer');
      } else if (policy.includes('same-origin')) {
        log.warn('Referrer-Policy: same-origin');
      } else if (policy.includes('strict-origin-when-cross-origin')) {
        log.error('Referrer-Policy: strict-origin-when-cross-origin (rechaza POST cross-origin)');
      } else {
        console.log(`  Referrer-Policy: ${policy}`);
      }
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    console.log('');
  };

  await checkUrl(IFRAME_URL, 'Iframe');
  await checkUrl(HOST_URL, 'Host');
}

// 8. Resumen y recomendaciones
async function summary() {
  log.section('8. RESUMEN Y RECOMENDACIONES');

  console.log(`${colors.blue}Problemas identificados:${colors.reset}\n`);

  let hasIssues = false;

  try {
    const response = await makeRequest(IFRAME_URL);

    if (!response.headers['access-control-allow-origin']) {
      log.error('CORS no habilitado en servidor de Iframe');
      hasIssues = true;
    }

    if (response.headers['x-frame-options']?.toUpperCase() === 'DENY') {
      log.error('X-Frame-Options: DENY impide iframe');
      hasIssues = true;
    }

    if (response.headers['referrer-policy']?.includes('strict-origin-when-cross-origin')) {
      log.error('Referrer-Policy rechaza POST cross-origin');
      hasIssues = true;
    }

    const setCookie = response.headers['set-cookie'];
    if (setCookie && !setCookie.toString().toLowerCase().includes('samesite=none')) {
      log.error('Cookies no tienen SameSite=None (no funcionan en iframes)');
      hasIssues = true;
    }
  } catch (error) {
    log.error(`Error al verificar: ${error.message}`);
  }

  if (!hasIssues) {
    log.success('No se identificaron problemas críticos');
  }

  console.log(`\n${colors.blue}Recomendaciones:${colors.reset}\n`);
  console.log('1. Contactar al equipo de Tickets Plus para:');
  console.log('   - Habilitar CORS (Access-Control-Allow-Origin)');
  console.log('   - Cambiar X-Frame-Options a ALLOWALL');
  console.log('   - Cambiar Referrer-Policy a "no-referrer"');
  console.log('   - Configurar cookies con SameSite=None; Secure\n');
  console.log('2. Alternativas si el servidor no puede cambiar:');
  console.log('   - Usar un proxy backend que maneje las peticiones');
  console.log('   - Usar postMessage para comunicación entre dominios');
  console.log('   - Solicitar un endpoint específico para iframes\n');
}

// Ejecutar diagnóstico
async function run() {
  console.log(`\n${colors.blue}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.blue}DIAGNÓSTICO DE IFRAME - TICKETS PLUS${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}\n`);

  try {
    await checkSSL();
    await checkHeaders();
    await checkCORS();
    await checkCookies();
    await checkFrameOptions();
    await checkCSP();
    await checkReferrerPolicy();
    await summary();
  } catch (error) {
    log.error(`Error durante el diagnóstico: ${error.message}`);
  }

  console.log(`\n${colors.blue}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.blue}FIN DEL DIAGNÓSTICO${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}\n`);
}

run();
