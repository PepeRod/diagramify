import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { content, prompt, currentDiagram } = await req.json();

    // Validar entrada
    if (!content && !currentDiagram) {
      return NextResponse.json(
        { error: 'Se requiere contenido o un diagrama existente' },
        { status: 400 }
      );
    }

    // Mejorar la detección de solicitudes de cambio de color
    const colorKeywords = ['color', 'colores', 'colorear', 'cambiar el color', 'cambia el color', 
                          'verde', 'azul', 'rojo', 'amarillo', 'naranja', 'morado', 'púrpura', 
                          'gris', 'negro', 'blanco', 'rosa', 'violeta', 'marrón', 'turquesa'];
    
    const isColorChangeRequest = colorKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    );

    console.log(`Prompt: "${prompt}" - Es solicitud de color: ${isColorChangeRequest}`);

    const systemPrompt = `Eres un experto en la generación y modificación de diagramas Mermaid.
Cuando se te pida modificar un diagrama existente:
1. Analiza cuidadosamente el diagrama actual y las instrucciones de cambio
2. Aplica SOLO los cambios solicitados
3. Mantén la estructura y elementos no mencionados en las instrucciones
4. Asegúrate de que el diagrama resultante sea válido
5. Si la instrucción menciona hacer el diagrama horizontal, usa 'graph LR' en lugar de 'graph TD'
${isColorChangeRequest ? '6. Para cambios de color, utiliza classDef y class para definir estilos y aplicarlos a nodos' : ''}

Reglas generales:
- Usa la sintaxis correcta de Mermaid
- Mantén el diagrama limpio y legible
${isColorChangeRequest ? 
`- Para cambios de color:
  * Usa classDef para definir clases de estilo (ej: classDef verde fill:#90EE90)
  * Aplica las clases a los nodos con class (ej: class A,B verde)
  * También puedes usar style para aplicar estilos a nodos específicos (ej: style A fill:#f9f,stroke:#333,stroke-width:4px)
  * Asegúrate de que el código del diagrama inicie con graph TD o graph LR antes de añadir estilos` : 
'- NO agregues atributos de estilo como fill:#fff, stroke:#333, o stroke-width en los nodos'}
- Evita usar linkStyle en la medida de lo posible
- No agregues comentarios ni explicaciones, solo el código Mermaid
- Asegúrate de que todos los nodos y conexiones sean válidos
- Si necesitas definir un nodo con texto, usa la sintaxis ID[Texto] sin estilos adicionales`;

    const userPrompt = currentDiagram
      ? `Diagrama actual:\n${currentDiagram}\n\nAplica estos cambios específicos:\n${prompt}`
      : `Genera un diagrama Mermaid para representar esta información:\n${content}\n\nInstrucciones adicionales:\n${prompt || 'Crear un diagrama jerárquico claro y conciso.'}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Reducido para mayor consistencia
      max_tokens: 1500,
    });

    const diagramText = completion.choices[0]?.message?.content;
    if (!diagramText) {
      throw new Error('No se recibió respuesta del modelo');
    }
    
    // Extraer solo el código Mermaid
    const mermaidCode = diagramText.includes('```mermaid')
      ? diagramText.split('```mermaid')[1].split('```')[0].trim()
      : diagramText.trim();

    // Limpiar códigos de estilo solo si no es una solicitud de cambio de color
    let cleanedCode = isColorChangeRequest 
      ? mermaidCode 
      : mermaidCode
        // Eliminar estilos en línea como fill:#fff,stroke:#333,stroke-width:1px
        .replace(/\[\s*([^\]]*?)(?:fill:[^,\]]+|stroke:[^,\]]+|stroke-width:[^,\]]+)([^\]]*)\]/g, '[$1$2]')
        // Eliminar estilos vacíos que pueden haber quedado
        .replace(/\[\s*,\s*\]/g, '')
        .replace(/\[\s*\]/g, '');

    // Validar que el diagrama generado es diferente al actual
    if (currentDiagram) {
      const normalizedCurrent = currentDiagram.replace(/\s+/g, ' ').trim();
      const normalizedNew = cleanedCode.replace(/\s+/g, ' ').trim();
      
      if (normalizedCurrent === normalizedNew) {
        return NextResponse.json(
          { error: 'No se detectaron cambios en el diagrama. Por favor, especifica los cambios que deseas realizar.' },
          { status: 400 }
        );
      }
    }

    // Mejorar la validación del diagrama para ser más tolerante
    const validStartPatterns = [
      'graph', 
      'flowchart', 
      'sequenceDiagram', 
      'classDef', 
      'erDiagram', 
      'pie', 
      'gantt',
      'stateDiagram',
      'journey',
      'timeline',
      'mindmap'
    ];
    
    // Verificar si hay al menos un patrón válido en cualquier línea del diagrama
    const diagramLines = cleanedCode.split('\n').map(line => line.trim());
    
    // Si hay instrucciones de estilo (classDef, style, class) pero no una declaración graph, añadir graph TD al inicio
    const hasStyleDirectives = diagramLines.some(line => 
      line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('style')
    );
    
    const hasGraphDeclaration = diagramLines.some(line => 
      line.startsWith('graph ') || line.startsWith('flowchart ')
    );
    
    // Si hay directivas de estilo pero no una declaración graph, añadir graph TD al inicio
    if (hasStyleDirectives && !hasGraphDeclaration) {
      cleanedCode = `graph TD\n${cleanedCode}`;
      console.log("Se agregó 'graph TD' al inicio del diagrama con directivas de estilo");
    }
    
    // Volver a verificar si el diagrama es válido después de los ajustes
    const isValidDiagram = validStartPatterns.some(pattern => 
      cleanedCode.trim().startsWith(pattern) || 
      cleanedCode.split('\n').some(line => line.trim().startsWith(pattern))
    );

    // Si aún no es válido y es una solicitud de color, intentar un último arreglo
    if (!isValidDiagram && isColorChangeRequest) {
      // Si parece que solo contiene directivas de estilo, intentar agregar el diagrama original
      cleanedCode = `${currentDiagram}\n${cleanedCode}`;
      console.log("Se combinó el diagrama original con las nuevas directivas de estilo");
    }
    
    // Verificación final
    const isFinalValidDiagram = validStartPatterns.some(pattern => 
      cleanedCode.trim().startsWith(pattern) || 
      cleanedCode.split('\n').some(line => line.trim().startsWith(pattern))
    );

    if (!isFinalValidDiagram) {
      console.error("Diagrama inválido generado:", cleanedCode);
      throw new Error('El diagrama generado no es válido. Por favor, intenta con una solicitud más específica.');
    }

    return NextResponse.json({ diagram: cleanedCode });
  } catch (error: any) {
    console.error('Error generating diagram:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar el diagrama' },
      { status: 500 }
    );
  }
} 