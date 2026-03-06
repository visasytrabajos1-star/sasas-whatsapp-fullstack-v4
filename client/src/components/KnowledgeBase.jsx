import React, { useState, useEffect } from 'react';
import { Book, UploadCloud, Trash2, FileText, Loader } from 'lucide-react';
import { fetchJsonWithApiFallback, getAuthHeaders, getPreferredApiBase } from '../api';

export default function KnowledgeBase({ instanceId, tenantId }) {
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [docToDelete, setDocToDelete] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    const loadDocuments = async () => {
        if (!instanceId) return;
        setLoadingDocs(true);
        try {
            const res = await fetchJsonWithApiFallback(`/api/saas/knowledge/${instanceId}`, {
                headers: getAuthHeaders()
            });
            if (res.data && res.data.documents) {
                setDocuments(res.data.documents);
            }
        } catch (err) {
            console.error('Error fetching documents', err);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [instanceId]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !instanceId) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const apiBase = getPreferredApiBase();
            const res = await fetch(`${apiBase}/api/saas/knowledge/${instanceId}/upload`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders() // Notice: no Content-Type here; browser sets multipart/form-data boundary automatically
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatusMsg({ type: 'success', text: `Archivo procesado: ${data.savedChunks} fragmentos indexados usando IA.` });
                setFile(null);
                loadDocuments();
            } else {
                setStatusMsg({ type: 'error', text: data.error || 'Error subiendo archivo' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Falló la conexión al subir el archivo' });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteClick = (docName) => {
        setDocToDelete(docName);
    };

    const confirmDelete = async () => {
        if (!docToDelete) return;

        try {
            const res = await fetchJsonWithApiFallback(`/api/saas/knowledge/${instanceId}/${encodeURIComponent(docToDelete)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (res.response.ok) {
                loadDocuments();
                setStatusMsg({ type: 'success', text: 'Documento eliminado correctamente' });
            } else {
                setStatusMsg({ type: 'error', text: res.data?.error || 'No se pudo eliminar el documento' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Error eliminando el documento' });
        } finally {
            setDocToDelete(null);
        }
    };

    return (
        <div className="glass-card rounded-xl p-6 border border-slate-700 h-full flex flex-col animate-slide-in">
            {docToDelete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-xl font-bold mb-4">¿Eliminar documento?</h3>
                        <p className="text-slate-400 mb-6 text-sm">Estás a punto de borrar los vectores para <strong>{docToDelete}</strong>. El bot ya no consultará esta información.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setDocToDelete(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors">Cancelar</button>
                            <button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition-colors">Borrar</button>
                        </div>
                    </div>
                </div>
            )}

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Book size={20} className="text-blue-500" />
                Base de Conocimiento de IA (RAG)
            </h3>

            <p className="text-xs text-slate-400 mb-6">
                Sube manuales, FAQs o inventarios en PDF o TXT. El Bot consultará esta información en tiempo real usando embeddings semánticos para dar respuestas súper precisas.
            </p>

            {statusMsg && (
                <div className={`mb-4 p-3 rounded text-sm ${statusMsg.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                    {statusMsg.text}
                    <button onClick={() => setStatusMsg(null)} className="float-right font-bold ml-4">✕</button>
                </div>
            )}

            <div className="bg-slate-900 border border-slate-700 border-dashed rounded-lg p-6 mb-6 flex flex-col items-center justify-center text-center">
                <UploadCloud size={32} className="text-slate-500 mb-3" />
                <input
                    type="file"
                    id="doc-upload"
                    className="hidden"
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
                <label
                    htmlFor="doc-upload"
                    className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 font-bold py-2 px-4 rounded cursor-pointer transition-colors text-sm mb-3"
                >
                    Seleccionar Archivo PDF / TXT
                </label>
                {file && (
                    <div className="flex flex-col items-center">
                        <p className="text-xs text-slate-300 font-mono mb-3">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded flex items-center gap-2"
                        >
                            {uploading ? <Loader size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            {uploading ? 'Vectorizando...' : 'Subir e Indexar'}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <h4 className="text-sm font-bold text-slate-300 mb-3">Documentos Vectorizados</h4>

                {loadingDocs ? (
                    <div className="flex justify-center p-4">
                        <Loader size={24} className="animate-spin text-slate-500" />
                    </div>
                ) : documents.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center p-4">Aún no has subido documentos a esta instancia.</p>
                ) : (
                    <div className="space-y-2">
                        {documents.map((doc, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded p-3 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-blue-400" />
                                    <span className="text-sm text-slate-200">{doc}</span>
                                </div>
                                <button
                                    onClick={() => handleDeleteClick(doc)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                    title="Eliminar de la KB"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
