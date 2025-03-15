"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Section } from '@/lib/types';
import DiagramSection from '@/components/DiagramSection';
import { Trash2, FileText, SplitSquareHorizontal } from 'lucide-react';

interface MarkdownEditorProps {
  defaultValue?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ defaultValue = '' }) => {
  const [markdown, setMarkdown] = useState(defaultValue);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    // Parse the markdown into sections based on main headers only
    const parseSections = (text: string) => {
      const lines = text.split('\n');
      const newSections: Section[] = [];
      let currentTitle = '';
      let currentContent: string[] = [];
      let inSection = false;

      lines.forEach((line, index) => {
        // Check if the line is a main header (starts with single #)
        if (line.match(/^#\s+[^#]/)) {
          // If we were already in a section, save it before starting a new one
          if (inSection) {
            newSections.push({
              title: currentTitle,
              content: currentContent.join('\n'),
              diagram: '',
              prompt: 'Genera un diagrama mermaid a partir de este contenido',
            });
          }

          currentTitle = line.replace(/^#\s+/, '').trim();
          currentContent = [];
          inSection = true;
        } else if (inSection) {
          currentContent.push(line);
        }
      });

      // Don't forget to add the last section
      if (inSection) {
        newSections.push({
          title: currentTitle,
          content: currentContent.join('\n'),
          diagram: '',
          prompt: 'Genera un diagrama mermaid a partir de este contenido',
        });
      }

      return newSections;
    };

    setSections(parseSections(markdown));
  }, [markdown]);

  const handleClearText = () => {
    if (markdown.trim() && !confirm('¿Estás seguro de que quieres borrar todo el texto?')) {
      return;
    }
    setMarkdown('');
    setSections([]);
  };

  return (
    <div className="flex flex-1 gap-4 p-4">
      <div className="w-1/2 relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-gray-600">
            <FileText size={16} />
            <span className="text-xs font-medium">Editor de Markdown</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearText}
              className="p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-all"
              title="Borrar texto"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="w-full h-[calc(100vh-8rem)] pt-12 px-4 pb-4 font-mono text-xs bg-transparent resize-none focus:outline-none"
          placeholder="Escribe o pega tu texto Markdown aquí..."
          spellCheck={false}
        />
      </div>
      <div className="w-1/2 relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 py-2 flex items-center z-20">
          <div className="flex items-center gap-2 text-gray-600">
            <SplitSquareHorizontal size={16} />
            <span className="text-xs font-medium">Vista previa y diagramas</span>
          </div>
        </div>
        <div className="h-[calc(100vh-8rem)] pt-12 px-4 pb-4 overflow-y-auto">
          <div className="space-y-6">
            {sections.map((section, index) => (
              <DiagramSection
                key={`${section.title}-${index}`}
                section={section}
                index={index}
                onUpdate={(updatedSection: Section) => {
                  const newSections = [...sections];
                  newSections[index] = updatedSection;
                  setSections(newSections);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor; 