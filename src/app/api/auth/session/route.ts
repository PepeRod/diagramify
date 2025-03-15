import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Inicializar Firebase Admin si no está inicializado
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 
                  `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}@appspot.gserviceaccount.com`,
      // Usar una clave privada generada o usar una vacía en desarrollo
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY 
                  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
                  : "dummy-key",
    }),
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    // En desarrollo, simplemente establecemos la cookie sin verificar
    const cookieStore = cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: false, // En desarrollo no necesitamos HTTPS
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: '/',
    });
    
    return NextResponse.json({ success: true, message: 'Sesión creada' });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return NextResponse.json(
      { success: false, message: 'Error del servidor' },
      { status: 500 }
    );
  }
} 