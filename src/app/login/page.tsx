"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      {/* Decorative elements with fixed positions to prevent overflow */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-[5%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-[5%] w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[5%] left-[10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-full mx-auto px-6 max-w-7xl grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Hero content */}
          <div className="space-y-8 text-center md:text-left">
            <h1 className="text-6xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 py-2 leading-tight">
              Diagramify
            </h1>
            <p className="text-2xl md:text-3xl text-gray-600 font-light">
              Transform your text into beautiful diagrams instantly
            </p>
            <div className="space-y-6">
              <p className="text-lg text-gray-600 flex items-center gap-3 justify-center md:justify-start">
                <span className="text-2xl">✨</span>
                Create professional diagrams from text descriptions
              </p>
              <p className="text-lg text-gray-600 flex items-center gap-3 justify-center md:justify-start">
                <span className="text-2xl">🚀</span>
                Generate flowcharts, mind maps, and more in seconds
              </p>
              <p className="text-lg text-gray-600 flex items-center gap-3 justify-center md:justify-start">
                <span className="text-2xl">🎨</span>
                Customize and export your diagrams easily
              </p>
            </div>
          </div>

          {/* Right side - Login card */}
          <div className="backdrop-blur-lg bg-white/30 p-8 rounded-2xl shadow-xl border border-white/50 w-full max-w-md mx-auto">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Welcome to Diagramify
                </h2>
                <p className="text-gray-600">
                  Sign in to start creating amazing diagrams
                </p>
              </div>
              <button
                onClick={signInWithGoogle}
                className="group relative w-full flex items-center justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-white/90" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                  </svg>
                </span>
                Continue with Google
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 text-center text-sm text-gray-600 w-full">
          <p>© 2024 Diagramify. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
} 