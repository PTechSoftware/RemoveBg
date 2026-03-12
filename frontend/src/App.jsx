import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Trash2, Loader2, Image as ImageIcon, Settings2, X, Sparkles, Target, Eraser, FileArchive } from 'lucide-react';
import JSZip from 'jszip';

function App() {
    const [files, setFiles] = useState([]);
    const [mode, setMode] = useState('original');
    const [width, setWidth] = useState(1920);
    const [height, setHeight] = useState(1080);
    const [isProcessing, setIsProcessing] = useState(false);
    const [beautify, setBeautify] = useState(false);
    const [sobelRefinement, setSobelRefinement] = useState(true);
    const [removeBackground, setRemoveBackground] = useState(true);
    const [dragActive, setDragActive] = useState(false);
    const [compress, setCompress] = useState(false);
    const [autoCrop, setAutoCrop] = useState(true);
    const [brightness, setBrightness] = useState(1);
    const [saturation, setSaturation] = useState(1);
    const [sharpness, setSharpness] = useState(1);
    const [bgModel, setBgModel] = useState('u2net');
    const [samIncludeCardboard, setSamIncludeCardboard] = useState(true);
    const [overallProgress, setOverallProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
        if (selectedFiles.length > 0) {
            const newFiles = selectedFiles.map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                file,
                preview: URL.createObjectURL(file),
                status: 'pending',
                result: null
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const newFiles = droppedFiles.map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                file,
                preview: URL.createObjectURL(file),
                status: 'pending',
                result: null
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (id) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const processQueue = async () => {
        setIsProcessing(true);
        setOverallProgress(0);

        const pendingFiles = files.filter(f => f.status !== 'completed');
        const CONCURRENCY_LIMIT = 1; // Process 4 images at a time for speed
        const chunks = [];

        for (let i = 0; i < pendingFiles.length; i += CONCURRENCY_LIMIT) {
            chunks.push(pendingFiles.slice(i, i + CONCURRENCY_LIMIT));
        }

        let processedCount = files.filter(f => f.status === 'completed').length;

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (currentFile) => {
                setFiles(prev => prev.map(f =>
                    f.id === currentFile.id ? { ...f, status: 'processing' } : f
                ));

                const formData = new FormData();
                formData.append('file', currentFile.file);
                formData.append('mode', mode);
                if (mode === 'custom') {
                    formData.append('width', width);
                    formData.append('height', height);
                }
                formData.append('beautify', beautify);
                formData.append('brightness', brightness);
                formData.append('saturation', saturation);
                formData.append('sharpness', sharpness);
                formData.append('sobel_refinement', sobelRefinement);
                formData.append('bg_model', bgModel);
                formData.append('sam_include_cardboard', samIncludeCardboard);
                formData.append('remove_background', removeBackground);
                formData.append('compress', compress);
                formData.append('auto_crop', autoCrop);

                try {
                    const response = await fetch('/process-image', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) throw new Error('Processing failed');

                    const blob = await response.blob();
                    const resultUrl = URL.createObjectURL(blob);

                    setFiles(prev => prev.map(f =>
                        f.id === currentFile.id ? { ...f, status: 'completed', result: resultUrl, resultBlob: blob } : f
                    ));
                } catch (error) {
                    console.error(error);
                    setFiles(prev => prev.map(f =>
                        f.id === currentFile.id ? { ...f, status: 'error' } : f
                    ));
                }
                processedCount++;
                setOverallProgress((processedCount / files.length) * 100);
            }));
        }

        setIsProcessing(false);
    };

    const downloadImage = (url, originalName) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${originalName.replace(/\.[^/.]+$/, "")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadAll = async () => {
        const zip = new JSZip();
        let hasFiles = false;

        files.forEach(file => {
            if (file.resultBlob) {
                const fileName = `${file.file.name.replace(/\.[^/.]+$/, "")}.png`;
                zip.file(fileName, file.resultBlob);
                hasFiles = true;
            }
        });

        if (hasFiles) {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "processed_images.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const completedCount = files.filter(f => f.status === 'completed').length;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
            {/* Header */}
            <header style={{
                borderBottom: '1px solid var(--border)',
                padding: '20px 0',
                backgroundColor: 'var(--bg-secondary)'
            }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <ImageIcon size={24} color="white" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Image Processor</h1>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                    AI-powered batch processing & enhancement
                                </p>
                            </div>
                        </div>

                        {isProcessing && (
                            <div style={{ flex: 1, maxWidth: '400px', margin: '0 40px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>Processing...</span>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>{Math.round(overallProgress)}%</span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${overallProgress}%`,
                                        backgroundColor: 'var(--accent)',
                                        transition: 'width 0.3s ease',
                                        boxShadow: '0 0 10px var(--accent)'
                                    }} />
                                </div>
                            </div>
                        )}
                        <a
                            href="/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: '10px 16px',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                fontSize: '14px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--accent)';
                                e.currentTarget.style.borderColor = 'var(--accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            API Docs
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>

                    {/* Sidebar - Settings */}
                    <aside>
                        <div style={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '24px',
                            position: 'sticky',
                            top: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                <Settings2 size={20} color="var(--text-secondary)" />
                                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Settings</h2>
                            </div>

                            {/* Output Size */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    marginBottom: '8px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Output Size
                                </label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: '6px',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    padding: '4px',
                                    borderRadius: '8px'
                                }}>
                                    <button
                                        onClick={() => setMode('original')}
                                        style={{
                                            padding: '10px 8px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            backgroundColor: mode === 'original' ? 'var(--accent)' : 'transparent',
                                            color: mode === 'original' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Original
                                    </button>
                                    <button
                                        onClick={() => setMode('optimized')}
                                        style={{
                                            padding: '10px 8px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            backgroundColor: mode === 'optimized' ? 'var(--accent)' : 'transparent',
                                            color: mode === 'optimized' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Optimized
                                    </button>
                                    <button
                                        onClick={() => setMode('custom')}
                                        style={{
                                            padding: '10px 8px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            backgroundColor: mode === 'custom' ? 'var(--accent)' : 'transparent',
                                            color: mode === 'custom' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {mode === 'optimized' && (
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '8px 12px',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: 'var(--accent)',
                                        lineHeight: '1.4'
                                    }} className="fade-in">
                                        Resizes to ~500px max dimension, maintains aspect ratio, reduces file size
                                    </div>
                                )}
                            </div>

                            {/* Custom Dimensions */}
                            {mode === 'custom' && (
                                <div style={{ marginBottom: '24px' }} className="fade-in">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '12px',
                                                fontWeight: '500',
                                                marginBottom: '6px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                Width
                                            </label>
                                            <input
                                                type="number"
                                                value={width}
                                                onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '14px'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '12px',
                                                fontWeight: '500',
                                                marginBottom: '6px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                Height
                                            </label>
                                            <input
                                                type="number"
                                                value={height}
                                                onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '14px'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Manual Adjustments */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    marginBottom: '12px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Ajustes Manuales
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>Brillo</label>
                                            <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{brightness.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="2" step="0.1" 
                                            value={brightness} 
                                            onChange={(e) => setBrightness(parseFloat(e.target.value))}
                                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                                            title="Controla el brillo"
                                        />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>Saturación</label>
                                            <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{saturation.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="2" step="0.1" 
                                            value={saturation} 
                                            onChange={(e) => setSaturation(parseFloat(e.target.value))}
                                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                                            title="Controla la saturación"
                                        />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>Nitidez</label>
                                            <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{sharpness.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="3" step="0.1" 
                                            value={sharpness} 
                                            onChange={(e) => setSharpness(parseFloat(e.target.value))}
                                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                                            title="Controla la nitidez"
                                        />
                                    </div>
                                    {(brightness !== 1 || saturation !== 1 || sharpness !== 1) && (
                                        <button 
                                            onClick={() => { setBrightness(1); setSaturation(1); setSharpness(1); }}
                                            style={{ 
                                                fontSize: '11px', 
                                                color: 'var(--accent)', 
                                                background: 'transparent', 
                                                border: 'none', 
                                                cursor: 'pointer',
                                                textAlign: 'right',
                                                padding: '4px 0'
                                            }}
                                        >
                                            Restablecer
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Additional Features */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    marginBottom: '12px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Enhancements
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => setBeautify(!beautify)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            backgroundColor: beautify ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${beautify ? 'var(--accent)' : 'var(--border)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Sparkles size={16} color={beautify ? 'var(--accent)' : 'var(--text-secondary)'} />
                                            <span style={{ fontSize: '13px', fontWeight: '500', color: beautify ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Catalog Beautifier</span>
                                        </div>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: `2px solid ${beautify ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                            backgroundColor: beautify ? 'var(--accent)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {beautify && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg)', marginBottom: '2px' }} />}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setSobelRefinement(!sobelRefinement)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            backgroundColor: sobelRefinement ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${sobelRefinement ? 'var(--accent)' : 'var(--border)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            width: '100%',
                                            opacity: removeBackground ? 1 : 0.5,
                                            pointerEvents: removeBackground ? 'auto' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Target size={16} color={sobelRefinement ? 'var(--accent)' : 'var(--text-secondary)'} />
                                            <span style={{ fontSize: '13px', fontWeight: '500', color: sobelRefinement ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Sobel Contour</span>
                                        </div>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: `2px solid ${sobelRefinement ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                            backgroundColor: sobelRefinement ? 'var(--accent)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {sobelRefinement && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg)', marginBottom: '2px' }} />}
                                        </div>
                                    </button>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <button
                                            onClick={() => setRemoveBackground(!removeBackground)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px',
                                                backgroundColor: removeBackground ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                                border: `1px solid ${removeBackground ? 'var(--accent)' : 'var(--border)'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                width: '100%'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Eraser size={16} color={removeBackground ? 'var(--accent)' : 'var(--text-secondary)'} />
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: removeBackground ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Remove Background</span>
                                            </div>
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '4px',
                                                border: `2px solid ${removeBackground ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                                backgroundColor: removeBackground ? 'var(--accent)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {removeBackground && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg)', marginBottom: '2px' }} />}
                                            </div>
                                        </button>
                                        
                                        {removeBackground && (
                                            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)' }} className="fade-in">
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>AI Model</label>
                                                <select 
                                                    value={bgModel}
                                                    onChange={(e) => setBgModel(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        backgroundColor: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '6px',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '12px',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    <option value="u2net">U2NET (Standardizado)</option>
                                                    <option value="isnet-general-use">ISNet (Mejor para Objetos)</option>
                                                    <option value="silueta">Silueta (Más rápido)</option>
                                                    <option value="sam">Mobile SAM3 ONNX (Alta Precisión)</option>
                                                </select>
                                                
                                                {bgModel === 'sam' && (
                                                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }} className="fade-in">
                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-secondary)' }}>Modo de Recorte SAM</label>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSamIncludeCardboard(true); }}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '500',
                                                                    backgroundColor: samIncludeCardboard ? 'var(--accent)' : 'transparent',
                                                                    color: samIncludeCardboard ? 'white' : 'var(--text-secondary)',
                                                                    border: '1px solid',
                                                                    borderColor: samIncludeCardboard ? 'var(--accent)' : 'var(--border)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Con Cartón
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSamIncludeCardboard(false); }}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '500',
                                                                    backgroundColor: !samIncludeCardboard ? 'var(--accent)' : 'transparent',
                                                                    color: !samIncludeCardboard ? 'white' : 'var(--text-secondary)',
                                                                    border: '1px solid',
                                                                    borderColor: !samIncludeCardboard ? 'var(--accent)' : 'var(--border)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Sin Cartón
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setAutoCrop(!autoCrop)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            backgroundColor: autoCrop ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${autoCrop ? 'var(--accent)' : 'var(--border)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={autoCrop ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M6 2v14a2 2 0 0 0 2 2h14"></path>
                                                <path d="M18 22V8a2 2 0 0 0-2-2H2"></path>
                                            </svg>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: autoCrop ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Auto-Crop & Square</span>
                                                {autoCrop && <span style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '-2px' }}>Perfectly centered & squared</span>}
                                            </div>
                                        </div>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: `2px solid ${autoCrop ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                            backgroundColor: autoCrop ? 'var(--accent)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {autoCrop && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg)', marginBottom: '2px' }} />}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setCompress(!compress)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            backgroundColor: compress ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${compress ? 'var(--accent)' : 'var(--border)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FileArchive size={16} color={compress ? 'var(--accent)' : 'var(--text-secondary)'} />
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: compress ? 'var(--text-primary)' : 'var(--text-secondary)' }}>PNG-8 Compression</span>
                                                {compress && <span style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '-2px' }}>Photoshop quality quantization</span>}
                                            </div>
                                        </div>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: `2px solid ${compress ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                            backgroundColor: compress ? 'var(--accent)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {compress && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg)', marginBottom: '2px' }} />}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Process Button */}
                            <button
                                onClick={processQueue}
                                disabled={files.length === 0 || isProcessing}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    backgroundColor: 'var(--accent)',
                                    color: 'white',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    marginBottom: '12px'
                                }}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>Process All ({files.length})</>
                                )}
                            </button>

                            {/* Download All */}
                            {completedCount > 0 && (
                                <button
                                    onClick={downloadAll}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                >
                                    <FileArchive size={16} color="var(--accent)" />
                                    Download ZIP ({completedCount})
                                </button>
                            )}

                            {/* Stats */}
                            {files.length > 0 && (
                                <div style={{
                                    marginTop: '24px',
                                    padding: '16px',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Progress
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: '700' }}>
                                        {completedCount} / {files.length}
                                    </div>
                                    <div style={{
                                        marginTop: '12px',
                                        height: '4px',
                                        backgroundColor: 'var(--bg-primary)',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(completedCount / files.length) * 100}%`,
                                            backgroundColor: 'var(--success)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Main Area */}
                    <div>
                        {/* Upload Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                backgroundColor: dragActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: '12px',
                                padding: '48px 24px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                marginBottom: '24px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                margin: '0 auto 16px',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Upload size={32} color="var(--text-secondary)" />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                                Drop images here or click to browse
                            </h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                                Supports PNG, JPG, WEBP
                            </p>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                ref={fileInputRef}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Files Grid */}
                        {files.length > 0 && (
                            <div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '16px'
                                }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                                        Images ({files.length})
                                    </h3>
                                    <button
                                        onClick={() => setFiles([])}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: 'transparent',
                                            color: 'var(--text-secondary)',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        Clear All
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {files.map((file) => (
                                        <div
                                            key={file.id}
                                            className="fade-in"
                                            style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                display: 'grid',
                                                gridTemplateColumns: '120px 120px 1fr auto',
                                                gap: '16px',
                                                alignItems: 'center'
                                            }}
                                        >
                                            {/* Original Preview */}
                                            <div>
                                                <div style={{
                                                    fontSize: '11px',
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: '6px',
                                                    fontWeight: '500'
                                                }}>
                                                    ORIGINAL
                                                </div>
                                                <div style={{
                                                    width: '120px',
                                                    height: '120px',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <img
                                                        src={file.preview}
                                                        alt="original"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Processed Preview */}
                                            <div>
                                                <div style={{
                                                    fontSize: '11px',
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: '6px',
                                                    fontWeight: '500'
                                                }}>
                                                    {removeBackground ? 'REMOVED BG' : 'ENHANCED'}
                                                </div>
                                                <div
                                                    className="checkerboard"
                                                    style={{
                                                        width: '120px',
                                                        height: '120px',
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {file.status === 'completed' && file.result ? (
                                                        <img
                                                            src={file.result}
                                                            alt="processed"
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'contain'
                                                            }}
                                                        />
                                                    ) : file.status === 'processing' ? (
                                                        <Loader2 size={24} color="var(--accent)" className="animate-spin" />
                                                    ) : file.status === 'error' ? (
                                                        <div style={{ color: 'var(--error)', fontSize: '12px' }}>Error</div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Waiting</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* File Info */}
                                            <div>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    marginBottom: '4px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {file.file.name}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    {(file.file.size / 1024).toFixed(0)} KB
                                                </div>
                                                {file.status === 'completed' && (
                                                    <div style={{
                                                        display: 'inline-block',
                                                        marginTop: '8px',
                                                        padding: '4px 8px',
                                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                        color: 'var(--success)',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        borderRadius: '4px'
                                                    }}>
                                                        COMPLETED
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {file.result && (
                                                    <button
                                                        onClick={() => downloadImage(file.result, file.file.name)}
                                                        style={{
                                                            padding: '10px',
                                                            backgroundColor: 'var(--accent)',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        <Download size={18} color="white" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeFile(file.id)}
                                                    style={{
                                                        padding: '10px',
                                                        backgroundColor: 'var(--bg-tertiary)',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <X size={18} color="var(--text-secondary)" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {files.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: '64px 24px',
                                color: 'var(--text-secondary)'
                            }}>
                                <ImageIcon size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <p style={{ fontSize: '14px', margin: 0 }}>No images uploaded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
