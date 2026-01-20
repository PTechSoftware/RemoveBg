import React, { useState, useRef } from 'react';
import { Upload, Download, Trash2, Loader2, Image as ImageIcon, Settings2, X } from 'lucide-react';

function App() {
    const [files, setFiles] = useState([]);
    const [mode, setMode] = useState('original');
    const [width, setWidth] = useState(1920);
    const [height, setHeight] = useState(1080);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
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

        for (let i = 0; i < files.length; i++) {
            const currentFile = files[i];
            if (currentFile.status === 'completed') continue;

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

            try {
                const response = await fetch('http://localhost:8000/process-image', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error('Processing failed');

                const blob = await response.blob();
                const resultUrl = URL.createObjectURL(blob);

                setFiles(prev => prev.map(f =>
                    f.id === currentFile.id ? { ...f, status: 'completed', result: resultUrl } : f
                ));
            } catch (error) {
                console.error(error);
                setFiles(prev => prev.map(f =>
                    f.id === currentFile.id ? { ...f, status: 'error' } : f
                ));
            }
        }

        setIsProcessing(false);
    };

    const downloadImage = (url, originalName) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `nobg_${originalName.replace(/\.[^/.]+$/, "")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadAll = () => {
        files.forEach(file => {
            if (file.result) {
                downloadImage(file.result, file.file.name);
            }
        });
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
                            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Background Remover</h1>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                AI-powered batch processing
                            </p>
                        </div>
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
                                        gap: '8px'
                                    }}
                                >
                                    <Download size={16} />
                                    Download All ({completedCount})
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
                                                    PROCESSED
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
