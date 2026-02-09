import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const formUrl = process.env.NEXT_PUBLIC_FORM_BASE_URL;

    if (!formUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_FORM_BASE_URL no configurada' },
        { status: 500 }
      );
    }

    // Obtener los parámetros de la URL original del iframe
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = `${formUrl}?${queryString}`;

    // Hacer la petición al servidor de formularios
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
        'User-Agent': request.headers.get('user-agent') || '',
      },
      body: body,
      credentials: 'include', // Incluir cookies
    });

    // Obtener la respuesta
    const responseBody = await response.text();

    // Crear respuesta con los mismos headers
    const responseHeaders = new Headers();
    
    // Copiar headers importantes
    if (response.headers.get('content-type')) {
      responseHeaders.set('content-type', response.headers.get('content-type')!);
    }
    if (response.headers.get('set-cookie')) {
      responseHeaders.set('set-cookie', response.headers.get('set-cookie')!);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Error en form-proxy:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
