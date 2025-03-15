"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import LoadingSpinner from './LoadingSpinner';

interface MermaidRendererProps {
  diagram: string;
  isExpanded?: boolean;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ 
  diagram,
  isExpanded = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const diagramRef = useRef(diagram);
  const renderAttemptRef = useRef(0);
  const uniqueId = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const lastRenderTimeRef = useRef<number>(0);
  const isRenderingRef = useRef(false);
  const svgContentRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar mermaid una sola vez con configuración más estable
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        logLevel: 'fatal',
        fontFamily: 'Arial, sans-serif',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'linear',
          diagramPadding: 8,
          nodeSpacing: 30,
          rankSpacing: 40
        },
        er: {
          useMaxWidth: true
        },
        sequence: {
          useMaxWidth: true
        },
        themeVariables: {
          // Permitir variables para temas y colores personalizados
          primaryColor: '#1f77b4', // Color principal azul
          primaryTextColor: '#000',
          primaryBorderColor: '#7F7F7F',
          lineColor: '#7F7F7F',
          secondaryColor: '#2ca02c', // Color secundario verde
          tertiaryColor: '#ff7f0e', // Color terciario naranja
          // Añadir más colores para nodos
          secondaryBorderColor: '#2ca02c',
          tertiaryBorderColor: '#ff7f0e',
          noteBkgColor: '#fff5ad',
          noteTextColor: '#333',
          // Colores adicionales para tipos específicos
          nodeBkg: '#eee',
          nodeBorder: '#999',
          mainBkg: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error("Error initializing mermaid:", error);
    }
  }, []);

  // Función para limpiar el diagrama
  const clearDiagram = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, []);

  // Función para renderizar el diagrama con enfoque en estabilidad
  const renderDiagram = useCallback(async () => {
    // Evitar renderizados simultáneos
    if (isRenderingRef.current || !containerRef.current || !diagram) return;
    
    // Evitar renderizados demasiado frecuentes
    const now = Date.now();
    if (now - lastRenderTimeRef.current < 500) {
      return;
    }
    
    // Marcar como renderizando
    isRenderingRef.current = true;
    lastRenderTimeRef.current = now;
    
    try {
      // Si ya tenemos un SVG renderizado y el diagrama no ha cambiado, usarlo directamente
      if (svgContentRef.current && diagramRef.current === diagram) {
        clearDiagram();
        if (containerRef.current) {
          containerRef.current.innerHTML = svgContentRef.current;
          setIsLoading(false);
          isRenderingRef.current = false;
          return;
        }
      }
      
      // Actualizar la referencia al diagrama actual
      diagramRef.current = diagram;
      
      // Limpiar completamente el contenedor antes de renderizar
      clearDiagram();
      setError(null);
      
      // Limpiar códigos de estilo antes de renderizar
      const cleanedDiagram = diagram;
      
      // Ya no limpiamos los estilos para permitir cambios de color
      
      // Simplificar el diagrama solo para linkStyles pero preservar classDef y class para colores
      const simplifiedDiagram = cleanedDiagram
        .replace(/curve=basis/g, 'curve=linear');
      // Ya no eliminamos los linkStyle, classDef o class
      
      try {
        // Renderizar a SVG estático usando la API de renderización a string
        const { svg } = await mermaid.render(uniqueId.current, simplifiedDiagram);
        
        // Modificar el SVG para asegurar fondo blanco y escalado correcto
        const modifiedSvg = svg
          .replace(/<svg /g, '<svg style="background-color: white; width: 100%; height: auto;" ')
          .replace(/<g /g, '<g style="background-color: white;" ');
        
        // Guardar el SVG para reutilizarlo si es necesario
        svgContentRef.current = modifiedSvg;
        
        // Insertar el SVG en el contenedor
        if (containerRef.current) {
          containerRef.current.innerHTML = modifiedSvg;
          
          // Aplicar estilos adicionales al SVG renderizado
          const svgElement = containerRef.current.querySelector('svg');
          if (svgElement) {
            // Configurar dimensiones para escalado automático
            svgElement.style.width = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.minHeight = isExpanded ? '400px' : '250px';
            svgElement.style.display = 'block';
            svgElement.style.backgroundColor = 'white';
            
            // Asegurar que los colores personalizados se muestren correctamente
            const coloredElements = svgElement.querySelectorAll('[fill], [stroke]');
            coloredElements.forEach(element => {
              // Asegurar que los atributos de color sean visibles
              const fill = element.getAttribute('fill');
              const stroke = element.getAttribute('stroke');
              if (fill && fill !== 'none') {
                element.setAttribute('fill', fill);
              }
              if (stroke && stroke !== 'none') {
                element.setAttribute('stroke', stroke);
              }
            });
            
            // Ajustar el viewBox para asegurar que todo el diagrama sea visible
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
              const [x, y, width, height] = viewBox.split(' ').map(Number);
              
              // Calcular un nuevo viewBox con padding
              const padding = Math.max(width, height) * 0.15; // 15% de padding
              const newViewBox = `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`;
              svgElement.setAttribute('viewBox', newViewBox);
              
              // Asegurar que el diagrama se ajuste al contenedor y se centre
              svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
            
            // Añadir clases específicas si está expandido
            if (isExpanded) {
              svgElement.classList.add('mermaid-expanded-svg');
              containerRef.current.classList.add('mermaid-expanded');
            }
            
            // Ocultar mensajes de error que puedan aparecer
            const errorTexts = svgElement.querySelectorAll('text.error-text');
            errorTexts.forEach(errorText => {
              errorText.setAttribute('visibility', 'hidden');
            });
          }
        }
        
        setIsLoading(false);
      } catch (renderError: any) {
        console.error('Error rendering mermaid diagram:', renderError);
        
        // Si es el primer intento, intentar con un diagrama aún más simplificado
        if (renderAttemptRef.current < 1) {
          renderAttemptRef.current += 1;
          
          // Limpiar cualquier código de estilo visible
          const cleanedBasicDiagram = diagram
            .replace(/\[\s*([^\]]*?)(?:fill:[^,\]]+|stroke:[^,\]]+|stroke-width:[^,\]]+)([^\]]*)\]/g, '[$1$2]')
            .replace(/\[\s*,\s*\]/g, '')
            .replace(/\[\s*\]/g, '');
          
          // Crear un diagrama extremadamente simplificado
          let basicDiagram = cleanedBasicDiagram;
          
          // Si es un flowchart, simplificarlo drásticamente
          if (cleanedBasicDiagram.includes('flowchart') || cleanedBasicDiagram.includes('graph')) {
            // Mantener directivas de estilo y color junto con la estructura básica
            const nodeLines = cleanedBasicDiagram.split('\n')
              .filter(line => 
                line.includes('flowchart') || 
                line.includes('graph') || 
                /^\s*[A-Za-z0-9_]+(\[[^\]]+\])?/.test(line) || 
                /^\s*[A-Za-z0-9_]+\s*-->\s*[A-Za-z0-9_]+/.test(line) ||
                line.trim().startsWith('classDef') ||
                line.trim().startsWith('class ') ||
                line.trim().startsWith('style ') ||
                line.trim().startsWith('linkStyle')
              );
            
            basicDiagram = nodeLines.join('\n');
          }
          
          try {
            // Renderizar el diagrama simplificado
            const { svg } = await mermaid.render(uniqueId.current + '-basic', basicDiagram);
            
            // Modificar el SVG para asegurar fondo blanco
            const modifiedSvg = svg
              .replace(/<svg /g, '<svg style="background-color: white;" ')
              .replace(/<g /g, '<g style="background-color: white;" ');
            
            // Guardar el SVG para reutilizarlo
            svgContentRef.current = modifiedSvg;
            
            // Insertar el SVG en el contenedor
            if (containerRef.current) {
              containerRef.current.innerHTML = modifiedSvg;
              
              // Aplicar estilos básicos
              const svgElement = containerRef.current.querySelector('svg');
              if (svgElement) {
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', isExpanded ? '400px' : '250px');
                svgElement.style.minHeight = isExpanded ? '400px' : '250px';
                svgElement.style.backgroundColor = 'white';
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              }
            }
            
            setIsLoading(false);
          } catch (basicError) {
            console.error('Error rendering basic diagram:', basicError);
            setError('No se pudo renderizar el diagrama. Por favor, verifica la sintaxis.');
            setIsLoading(false);
          }
        } else {
          setError('Error al renderizar el diagrama. Por favor, intenta con un diagrama más simple.');
          setIsLoading(false);
        }
      }
    } finally {
      // Marcar como no renderizando
      isRenderingRef.current = false;
    }
  }, [diagram, isExpanded, clearDiagram]);

  // Efecto para renderizar el diagrama
  useEffect(() => {
    // Resetear el contador de intentos
    renderAttemptRef.current = 0;
    setIsLoading(true);
    
    // Limpiar cualquier timeout pendiente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Ejecutar la renderización con un pequeño retraso para evitar problemas de timing
    timeoutRef.current = setTimeout(() => {
      renderDiagram();
    }, 300);
    
    // Limpiar el timeout si el componente se desmonta
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [diagram, renderDiagram]);

  // Efecto para manejar cambios en isExpanded
  useEffect(() => {
    // Si cambia isExpanded, actualizar el SVG existente sin volver a renderizar
    if (!isLoading && containerRef.current) {
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.setAttribute('height', isExpanded ? '400px' : '250px');
        svgElement.style.minHeight = isExpanded ? '400px' : '250px';
        
        if (isExpanded) {
          svgElement.classList.add('mermaid-expanded-svg');
          containerRef.current.classList.add('mermaid-expanded');
        } else {
          svgElement.classList.remove('mermaid-expanded-svg');
          containerRef.current.classList.remove('mermaid-expanded');
        }
      }
    }
  }, [isExpanded, isLoading]);

  return (
    <div className={`w-full ${isExpanded ? 'h-full' : ''}`}>
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner text="Renderizando diagrama..." />
        </div>
      )}
      <div 
        ref={containerRef} 
        className={`mermaid-container ${isExpanded ? 'mermaid-expanded' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          minHeight: isExpanded ? '400px' : '250px',
          height: 'auto',
          transition: 'opacity 0.3s ease-in-out',
          backgroundColor: 'white'
        }}
      ></div>
      {error && (
        <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded">
          <p className="font-medium">Error en el diagrama</p>
          <p className="text-sm mt-1">{error}</p>
          <div className="mt-2">
            <p className="text-sm font-medium">Código del diagrama:</p>
            <pre className="mt-1 p-2 bg-gray-100 overflow-auto text-xs rounded">{diagram}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

// Añadir la propiedad resizeTimer a Window
declare global {
  interface Window {
    resizeTimer: ReturnType<typeof setTimeout>;
  }
}

export default MermaidRenderer; 