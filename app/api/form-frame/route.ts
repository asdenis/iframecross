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
    const baseUrl = formUrl.split('?')[0]; // URL base sin parámetros

    // Inyectar base tag y script para interceptar peticiones POST
    const modifiedHtml = html.replace(
      '</head>',
      `<base href="${baseUrl}/">
      <script>
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
    );st html = await response.text();
    const baseUrl = formUrl.split('?')[0]; // URL base sin parámetros

    // Inyectar base tag y script para interceptar peticiones POST
    const modifiedHtml = html.replace(
      '</head>',
      `<base href="${baseUrl}/">
      <script>
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
