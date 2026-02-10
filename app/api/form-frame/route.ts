import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const formUrl = process.env.NEXT_PUBLIC_FORM_BASE_URL;
    const formParams = process.env.NEXT_PUBLIC_FORM_PARAMS;

    if (!formUrl || !formParams) {
      return NextResponse.json(
        { error: 'Configuración incompleta' },
        { status: 500 }
      );
    }

    // Construir URL completa del formulario
    const timestamp = Date.now();
    const fullUrl = `${formUrl}?${formParams},gx-no-cache=${timestamp}`;

    // Obtener el HTML del formulario
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Error del servidor de formularios: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();

    // Reescribir URLs de recursos para que usen el proxy
    // Solo reescribir URLs que NO estén ya reescritas
    let modifiedHtml = html
      // URLs absolutas /ticketsplusform/ → /api/proxy/ticketsplusform/
      .replace(/(['"])(\/ticketsplusform\/)/g, (match, quote, path) => {
        // Evitar duplicar si ya está reescrito
        if (match.includes('/api/proxy/')) return match;
        return `${quote}/api/proxy${path}`;
      })
      // URLs relativas static/ → /api/proxy/ticketsplusform/static/
      .replace(/(['"])(static\/)/g, (match, quote, path) => {
        if (match.includes('/api/proxy/')) return match;
        return `${quote}/api/proxy/ticketsplusform/${path}`;
      })
      // URLs en url() de CSS
      .replace(/url\((['"]?)(\/ticketsplusform\/)/g, (match, quote, path) => {
        if (match.includes('/api/proxy/')) return match;
        return `url(${quote}/api/proxy${path}`;
      })
      .replace(/url\((['"]?)(static\/)/g, (match, quote, path) => {
        if (match.includes('/api/proxy/')) return match;
        return `url(${quote}/api/proxy/ticketsplusform/${path}`;
      });

    // Inyectar script para interceptar peticiones POST
    modifiedHtml = modifiedHtml.replace(
      '</head>',
      `<script>
        (function() {
          const originalFetch = window.fetch;
          const originalXHR = window.XMLHttpRequest;
          
          // Interceptar fetch
          window.fetch = function(...args) {
            const [resource, config] = args;
            
            if (typeof resource === 'string' && resource.includes('ticketsplusform')) {
              const url = new URL(resource, window.location.origin);
              const proxyUrl = '/api/form-proxy?' + url.searchParams.toString();
              
              return originalFetch(proxyUrl, {
                ...config,
                method: config?.method || 'GET',
              });
            }
            
            return originalFetch(...args);
          };
          
          // Interceptar XMLHttpRequest
          const XHROpen = originalXHR.prototype.open;
          originalXHR.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('ticketsplusform')) {
              const fullUrl = new URL(url, window.location.origin);
              const proxyUrl = '/api/form-proxy?' + fullUrl.searchParams.toString();
              return XHROpen.call(this, method, proxyUrl, ...rest);
            }
            return XHROpen.call(this, method, url, ...rest);
          };
        })();
      </script></head>`
    );

    return new NextResponse(modifiedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error en form-frame:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
