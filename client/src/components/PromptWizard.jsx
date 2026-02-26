import React, { useState } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, Loader, Wand2, Copy, CheckCircle2 } from 'lucide-react';
import { fetchJsonWithApiFallback } from '../api';

const STEPS = [
    {
        id: 'business_type',
        title: '¿Qué tipo de negocio tenés?',
        subtitle: 'Esto nos ayuda a adaptar el tono y vocabulario del bot.',
        options: ['Restaurante/Gastronomía', 'Clínica/Salud', 'E-commerce/Tienda Online', 'Inmobiliaria', 'Servicios Profesionales', 'Educación/Cursos', 'Belleza/Estética', 'Otro'],
        allowCustom: true,
        field: 'businessType'
    },
    {
        id: 'objective',
        title: '¿Cuál es el objetivo principal del bot?',
        subtitle: 'El bot se optimizará para lograr este resultado.',
        options: ['Vender productos/servicios', 'Agendar citas/turnos', 'Soporte al cliente (FAQ)', 'Recuperar leads/seguimiento', 'Informar precios y catálogo', 'Tomar pedidos', 'Otro'],
        allowCustom: true,
        field: 'objective'
    },
    {
        id: 'tone',
        title: '¿Qué tono debe usar el bot?',
        subtitle: 'Define la personalidad de tu asistente virtual.',
        options: ['Formal y profesional', 'Cercano y amigable', 'Técnico/Experto', 'Divertido y casual'],
        extras: [
            { label: '¿Tutear o usar usted?', options: ['Tutear (vos/tú)', 'Usted'], field: 'formality' },
            { label: '¿Usar emojis?', options: ['Sí, moderado 😊', 'Sí, muchos 🎉🚀', 'No, sin emojis'], field: 'emojis' }
        ],
        field: 'tone'
    },
    {
        id: 'faqs',
        title: 'Preguntas frecuentes de tus clientes',
        subtitle: 'Escribí las preguntas más comunes y sus respuestas. El bot las aprenderá.',
        type: 'faq_list',
        field: 'faqs'
    },
    {
        id: 'limits',
        title: 'Reglas y límites del bot',
        subtitle: '¿Qué NO debe hacer o prometer el bot?',
        options: ['No dar precios exactos (derivar a vendedor)', 'No prometer tiempos de entrega', 'Derivar a humano si es complejo', 'No discutir temas sensibles', 'No dar asesoría legal/médica'],
        multiSelect: true,
        extras: [
            { label: '¿Cuándo derivar a un humano?', type: 'text', placeholder: 'Ej: cuando piden reembolso, cuando hay quejas, si no sé la respuesta...', field: 'humanHandoff' }
        ],
        field: 'limits'
    },
    {
        id: 'info',
        title: 'Información clave de tu negocio',
        subtitle: 'Datos que el bot necesita saber para responder correctamente.',
        type: 'key_info',
        fields: [
            { label: 'Nombre del negocio', placeholder: 'Ej: Café Roma', field: 'businessName' },
            { label: 'Horarios', placeholder: 'Ej: Lunes a Viernes 9 a 18hs', field: 'hours' },
            { label: 'Dirección/Ubicación', placeholder: 'Ej: Av. Corrientes 1234, CABA', field: 'location' },
            { label: 'Redes sociales / Web', placeholder: 'Ej: @caferoma en Instagram', field: 'socials' },
            { label: 'Info adicional importante', placeholder: 'Delivery, métodos de pago, políticas...', field: 'extra' }
        ],
        field: 'info'
    }
];

export default function PromptWizard({ onClose, onPromptGenerated, instanceName }) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState({
        businessType: '',
        objective: '',
        tone: '',
        formality: 'Tutear (vos/tú)',
        emojis: 'Sí, moderado 😊',
        faqs: [{ question: '', answer: '' }],
        limits: [],
        humanHandoff: '',
        businessName: instanceName || '',
        hours: '',
        location: '',
        socials: '',
        extra: ''
    });
    const [generating, setGenerating] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copied, setCopied] = useState(false);
    const [customInput, setCustomInput] = useState('');

    const currentStep = STEPS[step];
    const isLastStep = step === STEPS.length - 1;
    const isReviewStep = step === STEPS.length;

    const setAnswer = (field, value) => setAnswers(prev => ({ ...prev, [field]: value }));

    const handleOptionSelect = (option) => {
        if (currentStep.multiSelect) {
            setAnswer(currentStep.field,
                answers[currentStep.field]?.includes(option)
                    ? answers[currentStep.field].filter(o => o !== option)
                    : [...(answers[currentStep.field] || []), option]
            );
        } else {
            setAnswer(currentStep.field, option);
        }
    };

    const addFaq = () => setAnswer('faqs', [...answers.faqs, { question: '', answer: '' }]);
    const updateFaq = (idx, key, val) => {
        const updated = [...answers.faqs];
        updated[idx][key] = val;
        setAnswer('faqs', updated);
    };
    const removeFaq = (idx) => setAnswer('faqs', answers.faqs.filter((_, i) => i !== idx));

    const canProceed = () => {
        if (!currentStep) return true;
        if (currentStep.type === 'faq_list') return answers.faqs.some(f => f.question.trim());
        if (currentStep.type === 'key_info') return answers.businessName.trim();
        if (currentStep.multiSelect) return true;
        return answers[currentStep.field];
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const { data } = await fetchJsonWithApiFallback('/api/saas/generate-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answers),
                timeoutMs: 30000
            });
            if (data.prompt && data.prompt.super_prompt_base) {
                setGeneratedPrompt(data.prompt);
            } else if (data.prompt && typeof data.prompt === 'string') {
                // If it accidentally returned a string, wrap it
                setGeneratedPrompt({
                    version: "1.0-legacy",
                    super_prompt_base: data.prompt,
                    wizard_input: answers
                });
            } else {
                throw new Error(data.error || 'No se generó el prompt válido');
            }
        } catch (err) {
            // Fallback: generate locally if backend fails
            setGeneratedPrompt(generateLocalPrompt(answers));
        } finally {
            setGenerating(false);
        }
    };

    const generateLocalPrompt = (a) => {
        const lines = [];
        lines.push(`Eres el asistente virtual de "${a.businessName || 'nuestro negocio'}".`);
        if (a.businessType) lines.push(`Tipo de negocio: ${a.businessType}.`);
        if (a.objective) lines.push(`Tu objetivo principal es: ${a.objective.toLowerCase()}.`);
        if (a.tone) lines.push(`Tu tono es ${a.tone.toLowerCase()}.`);
        if (a.formality) lines.push(`${a.formality === 'Usted' ? 'Siempre tratá al cliente de usted.' : 'Podés tutear al cliente.'}`);
        if (a.emojis?.includes('No')) lines.push('No uses emojis en tus respuestas.');
        else if (a.emojis?.includes('muchos')) lines.push('Usá emojis frecuentemente para ser expresivo.');
        else lines.push('Usá emojis con moderación.');
        if (a.hours) lines.push(`Horarios de atención: ${a.hours}.`);
        if (a.location) lines.push(`Ubicación: ${a.location}.`);
        if (a.socials) lines.push(`Redes/Web: ${a.socials}.`);
        const validFaqs = a.faqs?.filter(f => f.question.trim() && f.answer.trim());
        if (validFaqs?.length > 0) {
            lines.push('\nPreguntas frecuentes:');
            validFaqs.forEach(f => lines.push(`- Pregunta: "${f.question}" → Respuesta: "${f.answer}"`));
        }
        if (a.limits?.length > 0) {
            lines.push('\nReglas importantes:');
            a.limits.forEach(l => lines.push(`- ${l}`));
        }
        if (a.humanHandoff) lines.push(`\nDerivar a un humano cuando: ${a.humanHandoff}`);
        if (a.extra) lines.push(`\nInformación adicional: ${a.extra}`);
        lines.push('\nSiempre sé útil, conciso y amable. Si no sabés algo, decilo honestamente.');

        return {
            version: "1.0-local-fallback",
            updated_at: new Date().toISOString(),
            constitution: `Eres el asistente virtual de "${a.businessName || 'nuestro negocio'}".`,
            blocks: {
                role: a.businessType,
                objectives: a.objective,
                tone: `${a.tone} - ${a.formality}`,
                rules: a.limits || [],
                faqs: validFaqs ? validFaqs.map(f => ({ q: f.question, a: f.answer })) : [],
                handoff: a.humanHandoff
            },
            wizard_input: a,
            super_prompt_base: lines.join('\n')
        };
    };

    const handleCopy = () => {
        const textToCopy = generatedPrompt?.super_prompt_base || '';
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUsePrompt = () => {
        onPromptGenerated(generatedPrompt);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Wand2 size={24} className="text-white" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Asistente de Implementación IA</h2>
                            <p className="text-white/70 text-xs">Configurá tu bot en 7 minutos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white text-sm">✕</button>
                </div>

                {/* Progress Bar */}
                <div className="px-5 pt-4">
                    <div className="flex items-center gap-1 mb-1">
                        {STEPS.map((_, i) => (
                            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                    <p className="text-xs text-slate-500">Paso {Math.min(step + 1, STEPS.length)} de {STEPS.length}</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-5">
                    {generatedPrompt ? (
                        /* RESULT SCREEN */
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-green-400">
                                <Sparkles size={20} />
                                <h3 className="text-lg font-bold">¡Prompt generado!</h3>
                                {generatedPrompt?.version && (
                                    <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                                        v{generatedPrompt.version}
                                    </span>
                                )}
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-h-64 overflow-auto">
                                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                                    {generatedPrompt?.super_prompt_base || JSON.stringify(generatedPrompt, null, 2)}
                                </pre>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleCopy} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                                    {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                                <button onClick={handleUsePrompt} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-4 py-2 rounded-lg font-bold transition-all">
                                    ✨ Usar este Prompt
                                </button>
                            </div>
                            <button onClick={() => { setGeneratedPrompt(''); setStep(0); }} className="text-slate-500 text-sm hover:text-white transition-colors w-full text-center">
                                Empezar de nuevo
                            </button>
                        </div>
                    ) : isReviewStep ? (
                        /* REVIEW & GENERATE */
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-400" /> Revisar y Generar
                            </h3>
                            <div className="bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
                                <p><span className="text-slate-400">Negocio:</span> <span className="text-white">{answers.businessName || '-'}</span></p>
                                <p><span className="text-slate-400">Tipo:</span> <span className="text-white">{answers.businessType || '-'}</span></p>
                                <p><span className="text-slate-400">Objetivo:</span> <span className="text-white">{answers.objective || '-'}</span></p>
                                <p><span className="text-slate-400">Tono:</span> <span className="text-white">{answers.tone || '-'} ({answers.formality})</span></p>
                                <p><span className="text-slate-400">FAQs:</span> <span className="text-white">{answers.faqs.filter(f => f.question.trim()).length} preguntas</span></p>
                                <p><span className="text-slate-400">Reglas:</span> <span className="text-white">{answers.limits?.length || 0} límites</span></p>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
                            >
                                {generating ? (
                                    <><Loader className="animate-spin" size={20} /> Generando con IA...</>
                                ) : (
                                    <><Wand2 size={20} /> Generar Prompt con IA</>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* QUESTION STEP */
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">{currentStep.title}</h3>
                                <p className="text-sm text-slate-400 mt-1">{currentStep.subtitle}</p>
                            </div>

                            {/* Options grid */}
                            {currentStep.options && (
                                <div className="grid grid-cols-2 gap-2">
                                    {currentStep.options.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleOptionSelect(opt)}
                                            className={`text-left p-3 rounded-lg border text-sm transition-all ${currentStep.multiSelect
                                                ? answers[currentStep.field]?.includes(opt)
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                                : answers[currentStep.field] === opt
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Custom input for "Otro" */}
                            {currentStep.allowCustom && answers[currentStep.field] === 'Otro' && (
                                <input
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm"
                                    placeholder="Describí tu tipo de negocio..."
                                    value={customInput}
                                    onChange={(e) => { setCustomInput(e.target.value); setAnswer(currentStep.field, e.target.value || 'Otro'); }}
                                />
                            )}

                            {/* Extra sub-questions */}
                            {currentStep.extras?.map((extra, idx) => (
                                <div key={idx} className="mt-3">
                                    <label className="block text-sm text-slate-400 mb-2">{extra.label}</label>
                                    {extra.options ? (
                                        <div className="flex gap-2 flex-wrap">
                                            {extra.options.map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setAnswer(extra.field, opt)}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${answers[extra.field] === opt
                                                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <input
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm"
                                            placeholder={extra.placeholder}
                                            value={answers[extra.field] || ''}
                                            onChange={(e) => setAnswer(extra.field, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}

                            {/* FAQ List editor */}
                            {currentStep.type === 'faq_list' && (
                                <div className="space-y-3">
                                    {answers.faqs.map((faq, idx) => (
                                        <div key={idx} className="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500 font-bold">FAQ #{idx + 1}</span>
                                                {answers.faqs.length > 1 && (
                                                    <button onClick={() => removeFaq(idx)} className="text-red-400 text-xs hover:text-red-300">Eliminar</button>
                                                )}
                                            </div>
                                            <input
                                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm"
                                                placeholder="¿Qué pregunta hacen los clientes?"
                                                value={faq.question}
                                                onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                                            />
                                            <textarea
                                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm h-16"
                                                placeholder="¿Cuál es la respuesta?"
                                                value={faq.answer}
                                                onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                                            />
                                        </div>
                                    ))}
                                    <button onClick={addFaq} className="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1">
                                        + Agregar otra pregunta
                                    </button>
                                    <p className="text-xs text-slate-500 italic">Tip: Podés dejar las que no sepas en blanco. La IA te ayudará.</p>
                                </div>
                            )}

                            {/* Key Info fields */}
                            {currentStep.type === 'key_info' && (
                                <div className="space-y-3">
                                    {currentStep.fields.map((f) => (
                                        <div key={f.field}>
                                            <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                                            <input
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm"
                                                placeholder={f.placeholder}
                                                value={answers[f.field] || ''}
                                                onChange={(e) => setAnswer(f.field, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                {!generatedPrompt && (
                    <div className="border-t border-slate-700 p-4 flex items-center justify-between bg-slate-800/50">
                        <button
                            onClick={() => setStep(s => Math.max(0, s - 1))}
                            disabled={step === 0}
                            className="flex items-center gap-1 text-slate-400 hover:text-white text-sm disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={16} /> Anterior
                        </button>

                        {!isReviewStep && (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                disabled={!canProceed()}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                            >
                                {isLastStep ? 'Revisar' : 'Siguiente'} <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
