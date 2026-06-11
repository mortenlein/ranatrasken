import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { auth } from '@/auth';

export async function POST(request: Request) {
  // Curation writes to src/data/routes.json, which only exists in a dev checkout.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Route curation is only available in development' }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { destId, geometry } = await request.json();

    if (!destId || !geometry) {
      return NextResponse.json({ error: 'Missing destId or geometry' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'src/data/routes.json');
    let routes: Record<string, GeoJSON.Feature> = {};

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      routes = JSON.parse(fileContent || '{}');
    }

    // Merge coordinates if the geometry is a MultiLineString or multiple LineStrings
    // For simplicity, we just save what we get. The frontend will combine them into a MultiLineString.
    routes[destId] = {
      type: 'Feature',
      properties: { id: destId },
      geometry: geometry
    };

    fs.writeFileSync(filePath, JSON.stringify(routes, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
