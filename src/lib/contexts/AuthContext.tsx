"use client";

import React, { createContext, useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { User } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Usuario autenticado
        setUser(authUser);
        
        // Crear una cookie de sesión simulada
        Cookies.set('session', 'authenticated', { 
          expires: 7, // 7 días
          path: '/'
        });
        
        console.log("Usuario autenticado:", authUser.email);
        
        // Si estamos en la página de login, redirigir al dashboard
        if (window.location.pathname === '/login') {
          router.push('/dashboard');
        }
      } else {
        // No hay usuario autenticado
        setUser(null);
        Cookies.remove('session', { path: '/' });
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Login exitoso", result.user.email);
      // La redirección se maneja en el evento onAuthStateChanged
    } catch (error) {
      console.error("Error al iniciar sesión con Google", error);
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
      Cookies.remove('session', { path: '/' });
      router.push('/login');
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
