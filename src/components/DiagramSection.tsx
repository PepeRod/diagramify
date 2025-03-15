"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Section } from '@/lib/types';
import MermaidRenderer from '@/components/MermaidRenderer';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Maximize2, Minimize2, Edit, RefreshCw, X, ZoomIn, ZoomOut, Download, FileImage, Check, Undo, Redo, Target, Crosshair, Move } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast, { Toaster } from 'react-hot-toast';

interface DiagramSectionProps {
  section: Section;
  index: number;
  onUpdate: (section: Section) => void;
}

const DiagramSection: React.FC<DiagramSectionProps> = ({ section, index, onUpdate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedKey, setExpandedKey] = useState(0); // Clave para forzar re-renderizado
  const [localPrompt, setLocalPrompt] = useState(section.prompt);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  const [isEditingDiagram, setIsEditingDiagram] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const expandedDiagramRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const [diagramHistory, setDiagramHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [showUndo, setShowUndo] = useState(false);
  const [showRedo, setShowRedo] = useState(false);
  const [isUndoAnimating, setIsUndoAnimating] = useState(false);
  const [isRedoAnimating, setIsRedoAnimating] = useState(false);

  // Efecto para re-renderizar el diagrama cuando se expande
  useEffect(() => {
    if (isExpanded) {
      setIsRendering(true);
      // Pequeño retraso para asegurar que el DOM se ha actualizado
      const timer = setTimeout(() => {
        setExpandedKey(prev => prev + 1);
        setIsRendering(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Efecto para manejar el overflow del body cuando el diagrama está expandido
  useEffect(() => {
    const originalStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      top: document.body.style.top,
      paddingRight: document.body.style.paddingRight,
      scrollY: window.scrollY
    };

    if (isExpanded) {
      // Guardar la posición de scroll actual
      const scrollY = window.scrollY;
      
      // Aplicar el bloqueo
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.paddingRight = '15px'; // Compensar la barra de scroll
      
      // Desactivar cualquier evento de rueda en el cuerpo del documento
      const disableWheel = (e: WheelEvent) => {
        if (!e.target || !(e.target as HTMLElement).closest('.diagram-expanded-container')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      
      document.addEventListener('wheel', disableWheel, { passive: false, capture: true });
      
      return () => {
        // Restaurar todo al estado original
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.width = originalStyle.width;
        document.body.style.height = originalStyle.height;
        document.body.style.top = originalStyle.top;
        document.body.style.paddingRight = originalStyle.paddingRight;
        
        // Restaurar la posición de scroll
        window.scrollTo(0, originalStyle.scrollY);
        
        document.removeEventListener('wheel', disableWheel, { capture: true });
      };
    }
  }, [isExpanded]);

  // Efecto para inicializar el historial y los botones de deshacer/rehacer
  useEffect(() => {
    if (section.diagram && !diagramHistory.includes(section.diagram)) {
      // Si es el primer diagrama, simplemente inicializamos el historial sin mostrar el botón de deshacer
      if (diagramHistory.length === 0) {
        setDiagramHistory([section.diagram]);
        setCurrentHistoryIndex(0);
        setShowUndo(false); // Aseguramos que el botón de deshacer esté oculto inicialmente
      } else {
        // Si ya hay diagramas en el historial, actualizamos normalmente
        const newHistory = [...diagramHistory, section.diagram];
        setDiagramHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
        
        // Solo mostrar el botón de deshacer si hay más de un elemento en el historial
        setShowUndo(newHistory.length > 1);
      }
      setShowRedo(false);
    }
  }, [section.diagram]);

  // Modificar el efecto que captura los eventos de la rueda a nivel global
  useEffect(() => {
    // Prevenir scroll global cuando el diagrama está expandido
    const preventScroll = (e: WheelEvent) => {
      // Solo previene scroll si el evento ocurre fuera del contenedor del diagrama
      const target = e.target as HTMLElement;
      
      if (isExpanded && !target.closest('.diagram-expanded-container')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Si estamos dentro del contenedor del diagrama, NO prevenimos el evento
      // para que pueda ser manejado por el onWheel del contenedor
    };

    // Solucionar el problema de scroll en la ventana principal
    if (isExpanded) {
      // Capturar eventos incluso antes de que lleguen a otros manejadores
      window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
      
      return () => {
        window.removeEventListener('wheel', preventScroll, { capture: true });
        // Eliminar el div de bloqueo ya no es necesario
      };
    }
    
    return undefined;
  }, [isExpanded]);

  // Efecto para establecer el zoom inicial y centrar el diagrama al expandirse
  useEffect(() => {
    if (isExpanded && expandedDiagramRef.current) {
      // Establecer zoom inicial
      setZoomLevel(1.5);
      
      // Dar tiempo a que el diagrama se renderice antes de calcular posiciones
      const timer = setTimeout(() => {
        if (diagramRef.current && expandedDiagramRef.current) {
          const containerWidth = expandedDiagramRef.current.clientWidth;
          const containerHeight = expandedDiagramRef.current.clientHeight;
          const diagramWidth = diagramRef.current.clientWidth;
          const diagramHeight = diagramRef.current.clientHeight;
          
          // Calcular posición para centrar con ligera compensación a la izquierda
          const posX = (containerWidth - diagramWidth * 1.5) / 2 - 20; // Compensación de 20px a la izquierda
          const posY = (containerHeight - diagramHeight * 1.5) / 2;
          
          // Establecer posición
          setPosition({
            x: Math.max(0, posX),
            y: Math.max(0, posY)
          });
        }
      }, 800);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isExpanded]);

  const generateDiagramWithRetry = async (attempt = 0): Promise<any> => {
    try {
      const content = `${section.title}\n\n${section.content}`;
      const response = await fetch('/api/openai/generate-diagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          prompt: section.prompt,
        }),
      });

      if (!response.ok) {
        if (response.status === 404 && attempt < MAX_RETRIES) {
          // Esperar un momento antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000));
          return generateDiagramWithRetry(attempt + 1);
        }
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        // Esperar un momento antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
        return generateDiagramWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      setIsUndoAnimating(true);
      const previousDiagram = diagramHistory[currentHistoryIndex - 1];
      
      onUpdate({
        ...section,
        diagram: previousDiagram,
      });
      
      setCurrentHistoryIndex(prev => prev - 1);
      setShowRedo(true);
      
      // Ocultar el botón de deshacer si llegamos al primer elemento del historial
      setShowUndo(currentHistoryIndex - 1 > 0);
      
      // Remover la animación después de un momento
      setTimeout(() => {
        setIsUndoAnimating(false);
      }, 500);
    }
  };

  const handleRedo = () => {
    if (currentHistoryIndex < diagramHistory.length - 1) {
      setIsRedoAnimating(true);
      const nextDiagram = diagramHistory[currentHistoryIndex + 1];
      
      onUpdate({
        ...section,
        diagram: nextDiagram,
      });
      
      setCurrentHistoryIndex(prev => prev + 1);
      
      // Mostrar el botón de deshacer si hay posibilidad de deshacer
      setShowUndo(true);
      
      // Ocultar el botón de rehacer si llegamos al final del historial
      setShowRedo(currentHistoryIndex + 1 < diagramHistory.length - 1);
      
      // Remover la animación después de un momento
      setTimeout(() => {
        setIsRedoAnimating(false);
      }, 500);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Siempre prevenir el comportamiento predeterminado de scroll
    e.preventDefault();
    e.stopPropagation();
    
    // Calcular el factor de zoom basado en la dirección de la rueda
    const delta = e.deltaY < 0 ? 0.1 : -0.1; // Simplificado para mayor claridad
    
    // Aplicar el cambio de zoom con límites
    const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 3);
    setZoomLevel(newZoom);
    
    // Opcional: centrar si hay un cambio grande de zoom
    if (Math.abs(newZoom - zoomLevel) > 0.2) {
      setTimeout(centerDiagram, 50);
    }
    
    return false;
  };

  // Función para manejar el evento keydown global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevenir el comportamiento del scroll con las teclas de flecha cuando el diagrama está expandido
      if (isExpanded && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    if (isExpanded) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  const generateDiagram = async () => {
    setIsGenerating(true);
    setError(null);
    setRetryCount(0);

    try {
      const data = await generateDiagramWithRetry();
      
      if (data.diagram) {
        // Verificar si el diagrama generado es diferente al actual
        const isDifferent = data.diagram !== section.diagram;
        
        // Solo actualizar el historial si el diagrama es diferente
        if (isDifferent) {
          // Limpiar la historia futura si estamos en medio del historial
          const newHistory = diagramHistory.slice(0, currentHistoryIndex + 1);
          const updatedHistory = [...newHistory, data.diagram];
          setDiagramHistory(updatedHistory);
          setCurrentHistoryIndex(newHistory.length);
          
          onUpdate({
            ...section,
            diagram: data.diagram,
          });
          
          // Solo mostrar el botón de deshacer si hay más de un elemento en el historial
          setShowUndo(updatedHistory.length > 1);
          setShowRedo(false);
        } else {
          // Si el diagrama es el mismo, no hacemos nada con el historial
          console.log("El diagrama generado es igual al actual");
        }
      } else {
        throw new Error('No se pudo generar el diagrama');
      }
    } catch (err) {
      console.error('Error generating diagram:', err);
      setError(
        err instanceof Error 
          ? `${err.message}. Por favor, intenta generar el diagrama nuevamente.` 
          : 'Ocurrió un error. Por favor, intenta generar el diagrama nuevamente.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePrompt = () => {
    onUpdate({
      ...section,
      prompt: localPrompt,
    });
    setIsEditingPrompt(false);
  };

  const handleExpand = () => {
    setIsExpanded(true);
    // Resetear posición y zoom - esto ya no es necesario ya que se establece en el useEffect
    // setZoomLevel(1);
    // setPosition({ x: 0, y: 0 });
    
    // Forzar un nuevo renderizado
    setExpandedKey(prev => prev + 1);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleEditDiagram = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/openai/generate-diagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `${section.title}\n\n${section.content}`,
          prompt: editInstructions,
          currentDiagram: section.diagram
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      if (!data.diagram) {
        throw new Error('La respuesta no incluye un diagrama');
      }

      // Verificar si el diagrama editado es diferente al actual
      const isDifferent = data.diagram !== section.diagram;
      
      // Solo actualizar el historial si el diagrama es diferente
      if (isDifferent) {
        // Limpiar la historia futura si estamos en medio del historial
        const newHistory = diagramHistory.slice(0, currentHistoryIndex + 1);
        const updatedHistory = [...newHistory, data.diagram];
        setDiagramHistory(updatedHistory);
        setCurrentHistoryIndex(newHistory.length);

        onUpdate({
          ...section,
          diagram: data.diagram,
        });
        
        // Solo mostrar el botón de deshacer si hay más de un elemento en el historial
        setShowUndo(updatedHistory.length > 1);
        setShowRedo(false);
      } else {
        // Si el diagrama es el mismo, no hacemos nada con el historial
        console.log("El diagrama editado es igual al actual");
      }
      
      setIsEditingDiagram(false);
      setEditInstructions('');
      setError(null);
    } catch (err) {
      console.error('Error updating diagram:', err);
      setError(
        err instanceof Error 
          ? err.message
          : 'Ocurrió un error inesperado al actualizar el diagrama'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Permitir nueva línea con Shift+Enter
        return;
      }
      e.preventDefault();
      if (editInstructions.trim()) {
        handleEditDiagram();
      }
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Solo botón izquierdo
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownloadPDF = async () => {
    if (!diagramRef.current) return;
    
    const downloadToast = toast.loading(
      <div className="flex items-center gap-2">
        <span>Preparando PDF...</span>
        <LoadingSpinner size="small" />
      </div>
    );
    
    setIsDownloading(true);
    try {
      // Mostrar mensaje de generación
      toast.loading(
        <div className="flex items-center gap-2">
          <span>Generando imagen del diagrama...</span>
          <LoadingSpinner size="small" />
        </div>,
        { id: downloadToast }
      );

      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: '#FFFFFF',
      });
      
      // Actualizar mensaje a procesamiento PDF
      toast.loading(
        <div className="flex items-center gap-2">
          <span>Convirtiendo a PDF...</span>
          <LoadingSpinner size="small" />
        </div>,
        { id: downloadToast }
      );

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      const fileName = `${section.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_diagram.pdf`;
      
      // Iniciar la descarga
      pdf.save(fileName);

      // Esperar un tiempo razonable para que el archivo se descargue
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success(
        <div className="flex items-center gap-2">
          <Check size={18} />
          <div className="flex flex-col">
            <span className="font-medium">PDF descargado con éxito</span>
            <span className="text-sm text-gray-500">Archivo: {fileName}</span>
          </div>
        </div>,
        { 
          id: downloadToast,
          duration: 4000,
          style: {
            minWidth: '300px',
          }
        }
      );
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      toast.error(
        <div className="flex items-center gap-2">
          <span>Error al generar el PDF. Por favor, intenta nuevamente.</span>
        </div>,
        { 
          id: downloadToast,
          duration: 4000
        }
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadJPG = async () => {
    if (!diagramRef.current) return;
    
    const downloadToast = toast.loading(
      <div className="flex items-center gap-2">
        <span>Preparando imagen JPG...</span>
        <LoadingSpinner size="small" />
      </div>
    );
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: '#FFFFFF',
      });
      
      const link = document.createElement('a');
      const fileName = `${section.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_diagram.jpg`;
      link.download = fileName;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
      
      // Pequeño delay para la notificación de JPG también
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success(
        <div className="flex items-center gap-2">
          <Check size={18} />
          <div className="flex flex-col">
            <span className="font-medium">Imagen JPG descargada con éxito</span>
            <span className="text-sm text-gray-500">Archivo: {fileName}</span>
          </div>
        </div>,
        { 
          id: downloadToast,
          duration: 4000,
          style: {
            minWidth: '300px',
          }
        }
      );
    } catch (err) {
      console.error('Error al descargar JPG:', err);
      toast.error(
        <div className="flex items-center gap-2">
          <span>Error al generar la imagen. Por favor, intenta nuevamente.</span>
        </div>,
        { 
          id: downloadToast,
          duration: 4000
        }
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Función para centrar manualmente el diagrama - muy simplificada y precisa
  const centerDiagram = () => {
    if (!expandedDiagramRef.current || !diagramRef.current) return;
    
    const container = expandedDiagramRef.current;
    const diagram = diagramRef.current;
    
    const centerX = (container.clientWidth - diagram.clientWidth * zoomLevel) / 2 - 20; // Compensación de 20px
    const centerY = (container.clientHeight - diagram.clientHeight * zoomLevel) / 2;
    
    setPosition({
      x: Math.max(0, centerX),
      y: Math.max(0, centerY)
    });
  };

  // Estilo inicial y función de renderizado del diagrama
  const diagramStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
    transformOrigin: 'center center',
    transition: isExpanded ? 'transform 300ms ease-out' : 'none',
    // Forzar al navegador a usar aceleración por hardware
    willChange: 'transform',
  };

  return (
    <>
      <Toaster 
        position="bottom-center"
        toastOptions={{
          className: '',
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
            padding: '12px 16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#059669',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fff',
            },
          },
          loading: {
            style: {
              background: '#fff',
              color: '#363636',
              padding: '12px 16px',
            },
          },
        }}
      />
      <div className="border rounded-lg p-3 bg-gradient-to-br from-white to-gray-50 shadow-md text-black hover:shadow-lg transition-shadow duration-200">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">{section.title}</h2>
        
        <div className="mb-2">
          {section.diagram ? (
            <div className="relative">
              {isExpanded ? (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-hidden diagram-expanded-container"
                  onClick={(e) => e.target === e.currentTarget && handleClose()}
                  onWheel={(e) => {
                    // Solo prevenir la propagación si es fuera del contenedor del diagrama
                    if (e.target === e.currentTarget) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                    // Si es dentro del contenedor, permitir que el evento continúe
                  }}
                  style={{ touchAction: 'none' }}
                >
                  <div 
                    className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 w-full h-full max-w-[95%] max-h-[95%] relative overflow-hidden shadow-2xl select-none flex flex-col diagram-content"
                    onWheel={handleWheel}
                    style={{ touchAction: 'none' }}
                  >
                    <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
                      <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs text-gray-600">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button 
                        onClick={handleClose}
                        className="p-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                        aria-label="Cerrar"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div 
                      ref={expandedDiagramRef}
                      key={`expanded-${expandedKey}`} 
                      className="w-full h-full relative flex items-center justify-center diagram-container"
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onWheel={handleWheel}
                    >
                      {isRendering ? (
                        <div className="flex items-center justify-center h-full">
                          <LoadingSpinner size="large" text="Renderizando diagrama..." />
                        </div>
                      ) : (
                        <div 
                          ref={diagramRef}
                          className="absolute transition-transform duration-200 ease-out"
                          style={diagramStyle}
                        >
                          <MermaidRenderer diagram={section.diagram} isExpanded={true} />
                        </div>
                      )}
                    </div>

                    {/* Botones de acción en la esquina superior derecha */}
                    <div className="absolute top-12 right-2 z-40 flex items-center gap-1.5">
                      <button
                        onClick={() => setIsEditingDiagram(true)}
                        className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-all duration-200 shadow-sm"
                        title="Editar Diagrama"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={generateDiagram}
                        disabled={isGenerating}
                        className="p-2 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-all duration-200 shadow-sm disabled:opacity-50"
                        title="Regenerar"
                      >
                        <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                      </button>
                      {showUndo && (
                        <button
                          onClick={handleUndo}
                          disabled={isGenerating}
                          className={`p-2 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-all duration-200 shadow-sm disabled:opacity-50 ${
                            isUndoAnimating ? 'animate-[wiggle_0.5s_ease-in-out]' : ''
                          }`}
                          title="Deshacer cambios"
                        >
                          <Undo size={16} className={isUndoAnimating ? 'animate-[spin_0.5s_ease-in-out]' : ''} />
                        </button>
                      )}
                      {showRedo && (
                        <button
                          onClick={handleRedo}
                          disabled={isGenerating}
                          className={`p-2 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-all duration-200 shadow-sm disabled:opacity-50 ${
                            isRedoAnimating ? 'animate-[wiggle_0.5s_ease-in-out]' : ''
                          }`}
                          title="Rehacer cambios"
                        >
                          <Redo size={16} className={isRedoAnimating ? 'animate-[spin_0.5s_ease-in-out]' : ''} />
                        </button>
                      )}
                    </div>

                    {/* Botones de zoom en la parte inferior central */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-40">
                      <button
                        onClick={handleZoomOut}
                        className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-all duration-200 shadow-sm"
                        title="Reducir"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <button
                        onClick={centerDiagram}
                        className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-all duration-200 shadow-sm"
                        title="Centrar diagrama"
                      >
                        <Crosshair size={16} />
                      </button>
                      <button
                        onClick={handleZoomIn}
                        className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-all duration-200 shadow-sm"
                        title="Ampliar"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>

                    {/* Botón de descarga en la esquina inferior derecha */}
                    <div className="absolute bottom-4 right-4">
                      <div className="download-menu">
                        <div className="download-options absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1 opacity-0 invisible translate-y-2 transition-all duration-200">
                          <button
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Download size={14} />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={handleDownloadJPG}
                            disabled={isDownloading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <FileImage size={14} />
                            <span>JPG</span>
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.currentTarget.parentElement?.querySelector('.download-options')?.classList.toggle('active');
                          }}
                          disabled={isDownloading}
                          className="p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-colors"
                          title="Descargar"
                        >
                          {isDownloading ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Download size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <div ref={diagramRef}>
                    <MermaidRenderer diagram={section.diagram} isExpanded={false} />
                  </div>
                  <div className="diagram-actions">
                    <button
                      onClick={handleExpand}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                      aria-label={isExpanded ? "Minimizar" : "Expandir"}
                      title={isExpanded ? "Minimizar" : "Expandir"}
                    >
                      <Maximize2 size={16} />
                    </button>
                    <button
                      onClick={() => setIsEditingDiagram(true)}
                      className="bg-green-100 text-green-700 hover:bg-green-200"
                      aria-label="Editar Diagrama"
                      title="Editar Diagrama"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={generateDiagram}
                      disabled={isGenerating}
                      className="bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                      aria-label="Regenerar"
                      title="Regenerar"
                    >
                      <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                    </button>
                    {showUndo && (
                      <button
                        onClick={handleUndo}
                        disabled={isGenerating}
                        className={`bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isUndoAnimating ? 'animate-[wiggle_0.5s_ease-in-out]' : ''
                        }`}
                        aria-label="Deshacer cambios"
                        title="Deshacer cambios"
                      >
                        <Undo size={16} className={isUndoAnimating ? 'animate-[spin_0.5s_ease-in-out]' : ''} />
                      </button>
                    )}
                    {showRedo && (
                      <button
                        onClick={handleRedo}
                        disabled={isGenerating}
                        className={`bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRedoAnimating ? 'animate-[spin_0.5s_ease-in-out]' : ''
                        }`}
                        aria-label="Rehacer cambios"
                        title="Rehacer cambios"
                      >
                        <Redo size={16} className={isRedoAnimating ? 'animate-[spin_0.5s_ease-in-out]' : ''} />
                      </button>
                    )}
                  </div>
                  
                  {/* Botón de descarga en la esquina inferior derecha */}
                  <div className="absolute bottom-2 right-2 z-10">
                    <div className="download-menu">
                      <div className="download-options absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg p-1 flex flex-col gap-1 opacity-0 invisible translate-y-2 transition-all duration-200">
                        <button
                          onClick={handleDownloadPDF}
                          disabled={isDownloading}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Download size={14} />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={handleDownloadJPG}
                          disabled={isDownloading}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <FileImage size={14} />
                          <span>JPG</span>
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.currentTarget.parentElement?.querySelector('.download-options')?.classList.toggle('active');
                        }}
                        disabled={isDownloading}
                        className="p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-colors"
                      >
                        {isDownloading ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={!isGenerating ? generateDiagram : undefined}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50/80 transition-colors duration-200 ${isGenerating ? 'opacity-50' : ''}`}
            >
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center">
                  <LoadingSpinner text={`Generando diagrama${retryCount > 0 ? ` (Intento ${retryCount + 1}/${MAX_RETRIES + 1})` : ''}...`} />
                </div>
              ) : (
                <p className="text-xs text-gray-600">Haz clic para generar un diagrama de esta sección</p>
              )}
            </div>
          )}
          
          {error && (
            <div className="mt-2 p-2 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-800 rounded-lg text-xs">
              <p className="font-medium">Error al generar el diagrama:</p>
              <p className="mt-0.5">{error}</p>
              <button
                onClick={generateDiagram}
                disabled={isGenerating}
                className="mt-1.5 px-2 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 flex items-center gap-1.5 text-xs transition-colors duration-200"
              >
                <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                Intentar nuevamente
              </button>
            </div>
          )}
          
          {isEditingDiagram && (
            <div className="mt-2 p-3 border rounded-lg bg-gray-50/80 backdrop-blur-sm shadow-sm">
              <h3 className="font-medium mb-1.5 text-gray-800 text-xs">Editar Diagrama</h3>
              <p className="text-xs text-gray-600 mb-2 space-y-0.5">
                Describe los cambios específicos que quieres hacer al diagrama.<br/>
                Ejemplos:<br/>
                - "Hacer el diagrama horizontal"<br/>
                - "Cambiar el título de X a Y"<br/>
                - "Agregar una flecha de A hacia B"<br/>
                - "Cambiar el color del nodo A a verde"<br/>
                - "Usar colores azules para todas las cajas"<br/>
                - "Colorear los nodos principales de rojo y los secundarios de azul"<br/>
                - "Cambiar el fondo de los nodos a amarillo claro"<br/>
                <span className="text-blue-600">Presiona Enter para guardar o Shift+Enter para nueva línea.</span>
              </p>
              <textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 border rounded mb-2 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                rows={3}
                placeholder="Escribe tus instrucciones para modificar el diagrama..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditingDiagram(false);
                    setEditInstructions('');
                    setError(null);
                  }}
                  className="px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-xs transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditDiagram}
                  className="px-2 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-all duration-200 shadow-sm hover:shadow"
                  disabled={isGenerating || !editInstructions.trim()}
                >
                  {isGenerating ? 'Actualizando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="prose prose-xs max-w-none text-gray-700 [&>*]:text-xs [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-sm">
          <ReactMarkdown>{section.content}</ReactMarkdown>
        </div>
      </div>
    </>
  );
};

export default DiagramSection; 