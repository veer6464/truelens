'use client';

import { useState, useEffect } from 'react';
import { Shield, Cpu, Cloud, Settings, Key, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [config, setConfig] = useState({ textEngine: 'api', imageEngine: 'api' });
  const [keysConfigured, setKeysConfigured] = useState<any>({ gptZero: false, sightEngine: false, nvidiaNim: false, huggingFace: false });
  const [hfModel, setHfModel] = useState('dima806/deepfake_vs_real_image_detection');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Check if we already have a saved password in sessionStorage
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('truelens_admin_pw');
    if (savedPassword) {
      verifyPassword(savedPassword);
    }
  }, []);

  const verifyPassword = async (pwdToVerify: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/config', {
        headers: {
          'x-admin-password': pwdToVerify,
        },
      });

      const data = await res.json();

      if (res.ok && data.isAuthenticated) {
        setIsAuthenticated(true);
        setConfig(data.config);
        setKeysConfigured(data.keysConfigured);
        if (data.huggingFaceModel) setHfModel(data.huggingFaceModel);
        sessionStorage.setItem('truelens_admin_pw', pwdToVerify);
        setPassword(pwdToVerify);
      } else {
        setError(data.error || 'Invalid system password.');
        sessionStorage.removeItem('truelens_admin_pw');
      }
    } catch (err) {
      setError('Connection failed. Please check backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    verifyPassword(password);
  };

  const handleToggleEngine = async (type: 'text' | 'image', target: 'api' | 'local') => {
    setSaving(true);
    setSaveStatus('');
    try {
      const activePassword = sessionStorage.getItem('truelens_admin_pw') || password;
      const updatedConfig = {
        ...config,
        [type === 'text' ? 'textEngine' : 'imageEngine']: target,
      };

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': activePassword,
        },
        body: JSON.stringify(updatedConfig),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.config);
        setSaveStatus('Engine configuration updated successfully.');
        setTimeout(() => setSaveStatus(''), 4000);
      } else {
        setError(data.error || 'Failed to save changes.');
      }
    } catch (err) {
      setError('Failed to contact backend API.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('truelens_admin_pw');
    setIsAuthenticated(false);
    setPassword('');
    setError('');
  };

  // 1. Password login screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-20 bg-background">
        <div className="w-full max-w-md border border-border bg-white p-8 md:p-12 shadow-sm rounded-none">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-border rounded-full mb-4">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h1 className="font-serif font-black text-2xl tracking-tight mb-2">Administrative Console</h1>
            <p className="text-xs font-mono text-muted">TrueLens Engine Routing Gateway</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                System Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full border-b border-border focus:border-foreground py-2 outline-none font-mono text-center transition duration-200"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-ai/10 text-ai text-xs font-mono rounded-none border border-ai/20 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background font-mono text-xs uppercase tracking-widest py-3 hover:bg-foreground/90 transition duration-150 flex justify-center items-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Access Console</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Admin Dashboard Panel
  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-12 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 mb-10">
        <div>
          <h1 className="font-serif font-black text-3xl tracking-tight mb-1">Engine routing console</h1>
          <p className="text-xs font-mono text-muted">Configure active detection layers & verify credentials</p>
        </div>
        <button
          onClick={handleLogout}
          className="mt-4 md:mt-0 font-mono text-[10px] uppercase tracking-widest border border-border px-4 py-2 hover:bg-foreground hover:text-background transition duration-150"
        >
          Logout Console
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: API Keys and System Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-border p-6 bg-white shadow-sm">
            <h2 className="font-serif font-bold text-lg mb-4 flex items-center space-x-2">
              <Key className="w-4 h-4 text-muted" />
              <span>Third-party Keys</span>
            </h2>
            <p className="text-xs text-muted mb-4 font-mono leading-relaxed">
              These keys must reside in server-side configuration (.env) and are never exposed to the client interface.
            </p>

            <div className="space-y-4">
              {/* GPTZero Status */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold">GPTZero (Text Detection)</span>
                  {keysConfigured.gptZero ? (
                    <span className="text-[10px] bg-human/10 text-human border border-human/20 px-2 py-0.5 font-mono rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] bg-ai/10 text-ai border border-ai/20 px-2 py-0.5 font-mono rounded">
                      Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted font-mono">
                  Used for sentence-level text analysis.
                </p>
              </div>

              {/* Sightengine Status */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold">Sightengine (Image Detection)</span>
                  {keysConfigured.sightEngine ? (
                    <span className="text-[10px] bg-human/10 text-human border border-human/20 px-2 py-0.5 font-mono rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] bg-ai/10 text-ai border border-ai/20 px-2 py-0.5 font-mono rounded">
                      Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted font-mono">
                  Used for overall & grid-tiled image analysis.
                </p>
              </div>

              {/* NVIDIA NIM Status */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold">NVIDIA NIM (LLM Detection)</span>
                  {keysConfigured.nvidiaNim ? (
                    <span className="text-[10px] bg-human/10 text-human border border-human/20 px-2 py-0.5 font-mono rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] bg-ai/10 text-ai border border-ai/20 px-2 py-0.5 font-mono rounded">
                      Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted font-mono">
                  Used for Local Model text classification.
                </p>
              </div>

              {/* Hugging Face Status */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold">Hugging Face (Image Detection)</span>
                  {keysConfigured.huggingFace ? (
                    <span className="text-[10px] bg-human/10 text-human border border-human/20 px-2 py-0.5 font-mono rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] bg-ai/10 text-ai border border-ai/20 px-2 py-0.5 font-mono rounded">
                      Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted font-mono">
                  Used for Local Model image deepfake detection ({hfModel}).
                </p>
              </div>
            </div>

            {(!keysConfigured.gptZero || !keysConfigured.sightEngine) && (
              <div className="mt-6 p-3 bg-uncertain/10 border border-uncertain/20 rounded-none flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-uncertain flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted font-mono leading-relaxed">
                  <strong>Sandbox Fallback Active:</strong> If API keys are missing, the API engine will output synthetic mock predictions so the app remains fully interactive.
                </p>
              </div>
            )}
          </div>

          <div className="border border-border p-6 bg-white shadow-sm">
            <h2 className="font-serif font-bold text-lg mb-2 flex items-center space-x-2">
              <Settings className="w-4 h-4 text-muted" />
              <span>Proxy Rate Limits</span>
            </h2>
            <p className="text-xs text-muted mb-4 font-mono leading-relaxed">
              Rate limiting is enforced server-side via token-bucket to shield your credentials from scrapers.
            </p>
            <div className="font-mono text-xs space-y-2 border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-muted">Burst Limit:</span>
                <span>5 requests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Refill Rate:</span>
                <span>1 request / 10s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Enforcement:</span>
                <span>Client IP Address</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Switcher Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-border p-6 md:p-8 bg-white shadow-sm">
            <h2 className="font-serif font-bold text-xl mb-1">Active Engine Assignment</h2>
            <p className="text-xs font-mono text-muted mb-8">Switch between external API layers and local model stubs.</p>

            {saveStatus && (
              <div className="mb-6 p-3 bg-human/10 text-human text-xs font-mono border border-human/20 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>{saveStatus}</span>
              </div>
            )}

            <div className="space-y-10">
              {/* Text Engine Router */}
              <div className="border-b border-border pb-8">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg">Text Detection Layer</h3>
                    <p className="text-xs text-muted font-mono mt-1">
                      Determines routing path for text, PDF, and DOCX analysis.
                    </p>
                  </div>
                  <div className="flex bg-border p-1 rounded-sm border border-border">
                    <button
                      onClick={() => handleToggleEngine('text', 'api')}
                      disabled={saving}
                      className={`flex items-center space-x-2 px-4 py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all duration-150 ${
                        config.textEngine === 'api'
                          ? 'bg-white text-foreground shadow-xs font-bold border border-border'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>API Engine</span>
                    </button>
                    <button
                      onClick={() => handleToggleEngine('text', 'local')}
                      disabled={saving}
                      className={`flex items-center space-x-2 px-4 py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all duration-150 ${
                        config.textEngine === 'local'
                          ? 'bg-white text-foreground shadow-xs font-bold border border-border'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Local Model</span>
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-[10px] font-mono text-muted flex items-center gap-1.5">
                  <span>Active Routing Mode:</span>
                  <span className="font-bold text-foreground">
                    {config.textEngine === 'local' ? 'Local Model (Nvidia NIM API)' : 'Third-Party API (GPTZero)'}
                  </span>
                  {config.textEngine === 'api' && !keysConfigured.gptZero && (
                    <span className="text-ai bg-ai/10 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                      ⚠️ Sandbox Mock Fallback (No Key)
                    </span>
                  )}
                  {config.textEngine === 'local' && !keysConfigured.nvidiaNim && (
                    <span className="text-ai bg-ai/10 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                      ⚠️ Sandbox Mock Fallback (No Key)
                    </span>
                  )}
                </div>
              </div>

              {/* Image Engine Router */}
              <div>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg">Image Detection Layer</h3>
                    <p className="text-xs text-muted font-mono mt-1">
                      Determines routing path for JPEG and PNG analysis.
                    </p>
                  </div>
                  <div className="flex bg-border p-1 rounded-sm border border-border">
                    <button
                      onClick={() => handleToggleEngine('image', 'api')}
                      disabled={saving}
                      className={`flex items-center space-x-2 px-4 py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all duration-150 ${
                        config.imageEngine === 'api'
                          ? 'bg-white text-foreground shadow-xs font-bold border border-border'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>API Engine</span>
                    </button>
                    <button
                      onClick={() => handleToggleEngine('image', 'local')}
                      disabled={saving}
                      className={`flex items-center space-x-2 px-4 py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all duration-150 ${
                        config.imageEngine === 'local'
                          ? 'bg-white text-foreground shadow-xs font-bold border border-border'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Local Model</span>
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-[10px] font-mono text-muted flex items-center gap-1.5">
                  <span>Active Routing Mode:</span>
                  <span className="font-bold text-foreground">
                    {config.imageEngine === 'local' 
                      ? (keysConfigured.huggingFace ? `Local Model (Hugging Face: ${hfModel})` : 'Local Model (Synthetic Coordinate Heatmap)')
                      : 'Third-Party API (Sightengine + Grid Crop Tiling)'}
                  </span>
                  {config.imageEngine === 'api' && !keysConfigured.sightEngine && (
                    <span className="text-ai bg-ai/10 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                      ⚠️ Sandbox Mock Fallback (No Key)
                    </span>
                  )}
                  {config.imageEngine === 'local' && !keysConfigured.huggingFace && (
                    <span className="text-ai bg-ai/10 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                      ⚠️ Sandbox Mock (No HF_TOKEN)
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
