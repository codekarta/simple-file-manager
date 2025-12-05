import { useEffect, useRef, useState } from 'react';
import './MonacoEditor.css';

interface MonacoEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    readonly?: boolean;
    theme?: 'vs-dark' | 'vs';
}

declare global {
    interface Window {
        monaco: any;
        require: any;
    }
}

export default function MonacoEditor({ value, onChange, language = 'plaintext', readonly = false, theme = 'vs-dark' }: MonacoEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const onChangeRef = useRef(onChange);
    // Check if Monaco is already loaded during initial state
    const [isLoaded, setIsLoaded] = useState(() => !!window.monaco);

    // Keep onChange ref updated
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Load Monaco Editor from CDN
    useEffect(() => {
        // If Monaco is already loaded, no need to do anything
        if (window.monaco) {
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
        script.async = true;
        
        script.onload = () => {
            window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
            window.require(['vs/editor/editor.main'], () => {
                // Set state in callback, not synchronously in effect
                setIsLoaded(true);
            });
        };
        
        document.head.appendChild(script);

        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, []);

    // Initialize editor when Monaco is loaded
    useEffect(() => {
        if (!isLoaded || !containerRef.current || editorRef.current) return;

        const editor = window.monaco.editor.create(containerRef.current, {
            value: value || '',
            language: language,
            theme: theme,
            readOnly: readonly,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace",
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            roundedSelection: false,
            scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
            },
            formatOnPaste: !readonly,
            formatOnType: !readonly,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            // Ensure text is left-aligned
            disableLayerHinting: true,
            padding: {
                top: 16,
                bottom: 16,
            },
        });

        editorRef.current = editor;

        // Handle content changes
        const disposable = editor.onDidChangeModelContent(() => {
            const currentValue = editor.getValue();
            onChangeRef.current(currentValue);
        });

        // Enable format command (Ctrl+Shift+F / Cmd+Shift+F)
        editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyMod.Shift | window.monaco.KeyCode.KeyF, () => {
            editor.getAction('editor.action.formatDocument')?.run();
        });

        return () => {
            disposable.dispose();
            editor.dispose();
            editorRef.current = null;
        };
    }, [isLoaded, language]); // onChange is stored in a ref to prevent editor recreation

    // Update readonly, language, and theme when props change
    useEffect(() => {
        if (editorRef.current && window.monaco) {
            editorRef.current.updateOptions({ readOnly: readonly });
            
            // Update theme if changed
            window.monaco.editor.setTheme(theme);
            
            // Update language if changed
            const currentLanguage = editorRef.current.getModel()?.getLanguageId();
            if (currentLanguage !== language) {
                window.monaco.editor.setModelLanguage(editorRef.current.getModel()!, language);
            }
        }
    }, [readonly, language, theme]);

    // Update editor value when prop changes
    useEffect(() => {
        if (editorRef.current && editorRef.current.getValue() !== value) {
            const position = editorRef.current.getPosition();
            const scrollTop = editorRef.current.getScrollTop();
            const scrollLeft = editorRef.current.getScrollLeft();
            
            editorRef.current.setValue(value || '');
            
            if (position) {
                editorRef.current.setPosition(position);
            }
            editorRef.current.setScrollTop(scrollTop);
            editorRef.current.setScrollLeft(scrollLeft);
        }
    }, [value]);

    if (!isLoaded) {
        return (
            <div className="monaco-editor-container monaco-loading">
                <div>Loading editor...</div>
            </div>
        );
    }

    return <div ref={containerRef} className="monaco-editor-container" />;
}

