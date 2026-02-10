import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    
    // El path viene como ['ticketsplusform', 'static', 'bootstrap', 'css', 'bootstrap.min.css']
    // Necesitamos construir: https://ticketsplusform.mendoza.gov.ar/ticketsplusform/static/...
    const resourcePath = path.join('/');
    const resourceUrl = `https://ticketsplusform.mendoza.gov.ar/${resourcePath}`;

    console.log('Proxy GET request:', resourceUrl);

    // Obtener el recurso
    const response = await fetch(resourceUrl, {
      method: 'GET',
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
      },
    });

    if (!response.ok) {
      console.error('Proxy error:', response.status, response.statusText, 'URL:', resourceUrl);
      return NextResponse.json(
        { error: `Error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    console.log('Proxy success:', resourceUrl, 'Content-Type:', contentType);

    return new NextResponse(buffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error en proxy:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
