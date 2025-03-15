import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
      <h1 className="text-4xl font-bold mb-6 text-blue-600">Diagramify</h1>
      <p className="text-xl mb-8 text-center max-w-2xl text-gray-700">
        Convierte texto en diagramas profesionales con la ayuda de IA
      </p>
      
      <div className="flex gap-4">
        <Link 
          href="/login" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          Iniciar Sesión
        </Link>
        
        <Link 
          href="/dashboard" 
          className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg shadow-md hover:bg-blue-50 transition-colors"
        >
          Dashboard
        </Link>
      </div>
      
      <div className="mt-16 max-w-4xl">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">¿Cómo funciona?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl mb-2">✏️</div>
            <h3 className="text-lg font-medium mb-2">Escribe o habla</h3>
            <p className="text-gray-600">Describe el diagrama que necesitas en texto simple</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl mb-2">✨</div>
            <h3 className="text-lg font-medium mb-2">IA en acción</h3>
            <p className="text-gray-600">La IA convierte tu descripción en código de diagrama</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-lg font-medium mb-2">Visualiza</h3>
            <p className="text-gray-600">Obtén diagramas profesionales listos para usar</p>
          </div>
        </div>
      </div>
    </main>
  );
}
