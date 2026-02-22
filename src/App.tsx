import React, { useState } from 'react';
import { Package, Search, CheckCircle2, XCircle, Loader2, List, Send, BookOpen, Terminal, Settings, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TrackResult {
  code: string;
  ok: boolean;
  data?: any;
  error?: {
    message: string;
    status?: number;
    details?: any;
  };
}

interface BatchResponse {
  requested: number;
  succeeded: number;
  failed: number;
  results: TrackResult[];
}

export default function App() {
  const [codesInput, setCodesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setIsSimulation(data.simulation))
      .catch(() => {});
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const codes = codesInput
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      setError('Por favor, insira pelo menos um código de rastreio.');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/track/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erro ao processar o lote.');
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] selection:bg-[#5A5A40] selection:text-white font-sans">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8 text-[#5A5A40]" />
              <h1 className="text-3xl font-serif italic font-medium">Correios Batch Tracker</h1>
              {isSimulation && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter border border-amber-200">
                  Modo Simulação
                </span>
              )}
            </div>
            <p className="text-[#5A5A40] opacity-80">Agregador de rastreio em lote via Wonca API</p>
          </div>
          <button 
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 hover:bg-black/5 transition-colors text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            Documentação
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#5A5A40]" />
                <h2 className="text-xs uppercase tracking-widest font-bold opacity-40">Entrada de Dados</h2>
              </div>
              <form onSubmit={handleTrack} className="space-y-4">
                <div className="relative group">
                  <textarea
                    value={codesInput}
                    onChange={(e) => setCodesInput(e.target.value)}
                    placeholder="Insira os códigos de rastreio aqui&#10;Um por linha (ex: YB754713088BR)"
                    className="w-full h-80 p-6 bg-white rounded-3xl border border-black/5 shadow-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] font-mono opacity-30 group-focus-within:opacity-100 transition-opacity">
                    {codesInput.split('\n').filter(c => c.trim()).length} códigos detectados
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-[#1A1A1A] text-white rounded-full font-medium flex items-center justify-center gap-3 hover:bg-[#2A2A2A] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processando Lote...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Rastrear em Lote
                    </>
                  )}
                </button>
              </form>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 text-red-500 text-sm font-medium flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {error}
                </motion.p>
              )}
            </section>

            <AnimatePresence>
              {showDocs && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-8 bg-white rounded-3xl border border-black/5 shadow-sm space-y-6">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-[#5A5A40]" />
                      <h3 className="font-serif italic text-xl">API Endpoint</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl relative group">
                        <code className="text-xs font-mono block">POST /api/track/batch</code>
                        <button 
                          onClick={() => copyToClipboard('POST /api/track/batch')}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 opacity-40" />}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40">Configuração Atual</h4>
                        <div className="space-y-2">
                          {[
                            { key: 'WONCA_URL', desc: 'URL da API externa', val: 'https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track' },
                            { key: 'WONCA_AUTH', desc: 'Token de Autorização', val: 'Apikey h_pGYWPsNoUGC2OHJt0ZOZEZFPvYlqnYO6P-RTzUTr0' },
                            { key: 'MAX_CODES', desc: 'Limite de códigos/lote', val: '200' },
                            { key: 'CONCURRENCY', desc: 'Requisições simultâneas', val: '1' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between p-4 bg-[#F5F5F0]/50 rounded-2xl border border-black/5">
                              <div>
                                <p className="text-[10px] font-mono font-bold opacity-60">{item.key}</p>
                                <p className="text-[10px] opacity-40">{item.desc}</p>
                              </div>
                              <p className="text-[10px] font-mono bg-white px-2 py-1 rounded border border-black/5">{item.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#5A5A40]" />
              <h2 className="text-xs uppercase tracking-widest font-bold opacity-40">Resultados Agregados</h2>
            </div>
            
            <div className="min-h-[500px] bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden flex flex-col">
              {!response && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center">
                    <List className="w-8 h-8 opacity-20" />
                  </div>
                  <div>
                    <h3 className="font-serif italic text-2xl mb-2">Aguardando Consulta</h3>
                    <p className="text-sm opacity-40 max-w-xs mx-auto">Insira os códigos de rastreio ao lado para iniciar o processamento em lote.</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-[#5A5A40] animate-spin opacity-20" />
                    <Package className="w-6 h-6 text-[#5A5A40] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-serif italic text-2xl">Consultando Wonca...</h3>
                    <p className="text-sm opacity-40">Isso pode levar alguns segundos dependendo do tamanho do lote.</p>
                  </div>
                </div>
              )}

              {response && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8"
                >
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                      <p className="text-[10px] uppercase tracking-wider opacity-50">Solicitados</p>
                      <p className="text-2xl font-serif">{response.requested}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-2xl text-green-700">
                      <p className="text-[10px] uppercase tracking-wider opacity-50">Sucesso</p>
                      <p className="text-2xl font-serif">{response.succeeded}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-2xl text-red-700">
                      <p className="text-[10px] uppercase tracking-wider opacity-50">Falhas</p>
                      <p className="text-2xl font-serif">{response.failed}</p>
                    </div>
                  </div>

                  {/* List */}
                  <div className="space-y-3">
                    {response.results.map((result, idx) => (
                      <motion.div
                        key={result.code}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex flex-col border-b border-black/5 last:border-0"
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            {result.ok ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <div>
                              <p className="font-mono text-sm font-medium">{result.code}</p>
                              <p className="text-xs opacity-50">
                                {result.ok ? 'Consulta realizada com sucesso' : (result.error?.message || 'Erro na consulta')}
                              </p>
                              {!result.ok && result.error?.details && (
                                <p className="text-[10px] text-red-400 mt-1 font-mono bg-red-50/50 p-1 rounded">
                                  {typeof result.error.details === 'string' 
                                    ? result.error.details 
                                    : JSON.stringify(result.error.details)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {result.ok && (
                              <button 
                                onClick={() => toggleExpand(result.code)}
                                className="text-[10px] font-semibold uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity underline underline-offset-4"
                              >
                                {expandedCodes[result.code] ? 'Ocultar JSON' : 'Ver JSON'}
                              </button>
                            )}
                            <div className="text-right">
                              {result.ok ? (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase font-semibold">
                                  OK
                                </span>
                              ) : (
                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-full uppercase font-semibold">
                                  Error {result.error?.status || ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {expandedCodes[result.code] && result.ok && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                <pre className="bg-[#F5F5F0] p-4 rounded-2xl text-[10px] font-mono overflow-x-auto max-h-64">
                                  {JSON.stringify(result.data, null, 2)}
                                </pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-black/5 flex items-center justify-between opacity-40 text-[10px] uppercase tracking-widest font-bold">
        <p>© 2026 Correios Batch Tracker</p>
        <div className="flex gap-8">
          <p>Powered by Wonca API</p>
          <p>Built with React & Express</p>
        </div>
      </footer>
    </div>
  );
}
