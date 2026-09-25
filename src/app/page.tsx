'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ImageIcon, RefreshCw, X, AlertCircle, Eye, EyeOff, ShieldCheck, ChevronRight, Plus, Layers, Images, LayoutGrid, Maximize2, ArrowLeft, Video, Film, Clock, Activity, Play, Sparkles, Scan, Compass, CheckCircle2 } from 'lucide-react';

interface QueuedImage {
  id: string;
  file: File;
  url: string;
}

interface VideoFrame {
  url: string;
  blob: Blob;
  timestamp: number;
  formattedTime: string;
}

interface QueuedVideo {
  file: File;
  url: string;
  duration: number;
  frames: VideoFrame[];
}

export default function ScannerPage() {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'video'>('text');
  
  // Text inputs
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Multi-image inputs
  const [uploadedImages, setUploadedImages] = useState<QueuedImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [batchViewMode, setBatchViewMode] = useState<'all' | 'focus'>('all');
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);

  // Video forensics inputs
  const [uploadedVideo, setUploadedVideo] = useState<QueuedVideo | null>(null);
  const [selectedVideoFrameIndex, setSelectedVideoFrameIndex] = useState<number>(0);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [videoProgress, setVideoProgress] = useState('');

  // States
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textDropZoneRef = useRef<HTMLDivElement>(null);
  const imageDropZoneRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoDropZoneRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());

  // Progress message rotation during analysis
  useEffect(() => {
    if (!analyzing) return;

    const progressMessages = [
      activeTab === 'video' ? 'Inspecting temporal video cadence...' : 'Reading input content...',
      activeTab === 'video' ? 'Running facial & visual artifact checks...' : 'Parsing structural data...',
      'Contacting active detection engine...',
      activeTab === 'video' ? 'Evaluating frame consistency across timeline...' : 'Analyzing segment weights...',
      'Computing region-level signals...',
      'Finalizing verification verdict...'
    ];

    let index = 0;
    setAnalysisProgress(progressMessages[0]);

    const interval = setInterval(() => {
      index = (index + 1) % progressMessages.length;
      setAnalysisProgress(progressMessages[index]);
    }, 450);

    return () => clearInterval(interval);
  }, [analyzing, activeTab]);

  // Clean up all image & video preview URLs ONLY on component unmount to prevent broken images
  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // Prevent browser from navigating to dropped files anywhere on the page
  useEffect(() => {
    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
    };
  }, []);

  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setPastedText(''); // Clear pasted text if file is uploaded
      setError('');
    }
  };

  const addImageFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => {
      const isImgMime = f.type.startsWith('image/');
      const isImgExt = /\.(jpe?g|png|webp|bmp|gif|tiff|avif)$/i.test(f.name);
      return isImgMime || isImgExt;
    });

    if (validFiles.length === 0) {
      setError('Please select valid image files (JPEG, PNG, WebP, BMP).');
      return;
    }

    setUploadedImages(prev => {
      const existingFingerprints = new Set(
        prev.map(img => `${img.file.name}_${img.file.size}_${img.file.lastModified}`)
      );

      const uniqueNewFiles: File[] = [];
      for (const file of validFiles) {
        const fingerprint = `${file.name}_${file.size}_${file.lastModified}`;
        if (!existingFingerprints.has(fingerprint)) {
          existingFingerprints.add(fingerprint);
          uniqueNewFiles.push(file);
        }
      }

      if (uniqueNewFiles.length === 0) {
        return prev;
      }

      const newQueued: QueuedImage[] = uniqueNewFiles.map(file => {
        const url = URL.createObjectURL(file);
        createdUrlsRef.current.add(url);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          url
        };
      });

      return [...prev, ...newQueued];
    });

    setError('');
    setResult(null);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImageFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  // Video Keyframe Extraction via HTML5 Video and Canvas
  const extractFramesFromVideo = async (file: File): Promise<QueuedVideo> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const videoUrl = URL.createObjectURL(file);
      createdUrlsRef.current.add(videoUrl);
      video.src = videoUrl;

      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration || 1;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const frames: VideoFrame[] = [];

          // Sample 6 evenly spaced temporal keyframes
          const frameCount = 6;
          const step = duration / (frameCount + 1);
          const timestamps = Array.from({ length: frameCount }, (_, i) => 
            Math.min(duration - 0.05, Math.max(0.1, (i + 1) * step))
          );

          canvas.width = Math.min(video.videoWidth || 640, 720);
          canvas.height = (video.videoHeight && video.videoWidth)
            ? Math.round((canvas.width * video.videoHeight) / video.videoWidth)
            : 480;

          for (let i = 0; i < timestamps.length; i++) {
            const time = timestamps[i];
            setVideoProgress(`Sampling temporal frame ${i + 1} of ${timestamps.length}...`);

            await new Promise<void>((resSeek) => {
              const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob((blob) => {
                    if (blob) {
                      const frameUrl = URL.createObjectURL(blob);
                      createdUrlsRef.current.add(frameUrl);
                      const mins = Math.floor(time / 60);
                      const secs = Math.floor(time % 60);
                      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                      frames.push({
                        url: frameUrl,
                        blob,
                        timestamp: time,
                        formattedTime: formatted,
                      });
                    }
                    resSeek();
                  }, 'image/jpeg', 0.85);
                } else {
                  resSeek();
                }
              };
              video.addEventListener('seeked', onSeeked);
              video.currentTime = time;
            });
          }

          resolve({
            file,
            url: videoUrl,
            duration,
            frames,
          });
        } catch (err) {
          reject(err);
        }
      };

      video.onerror = () => {
        reject(new Error('Browser could not parse video format. Please upload an MP4, WebM, or MOV video.'));
      };
    });
  };

  const handleVideoFile = async (file: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    const isVideoExt = /\.(mp4|webm|mov|m4v|avi)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !isVideoExt) {
      setError('Unsupported video format. Please upload an MP4, WebM, or MOV video.');
      return;
    }

    if (uploadedVideo) {
      URL.revokeObjectURL(uploadedVideo.url);
      createdUrlsRef.current.delete(uploadedVideo.url);
      uploadedVideo.frames.forEach(f => {
        URL.revokeObjectURL(f.url);
        createdUrlsRef.current.delete(f.url);
      });
    }

    setError('');
    setResult(null);
    setIsExtractingFrames(true);
    setVideoProgress('Reading video container...');

    try {
      const queued = await extractFramesFromVideo(file);
      setUploadedVideo(queued);
      setSelectedVideoFrameIndex(0);
    } catch (err: any) {
      setError(err.message || 'Failed to extract video keyframes.');
    } finally {
      setIsExtractingFrames(false);
      setVideoProgress('');
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleVideoFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoDropZoneRef.current) {
      videoDropZoneRef.current.classList.add('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleVideoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoDropZoneRef.current) {
      videoDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoDropZoneRef.current) {
      videoDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleVideoFile(file);
    }
  };

  const handleClearVideo = () => {
    if (uploadedVideo) {
      URL.revokeObjectURL(uploadedVideo.url);
      createdUrlsRef.current.delete(uploadedVideo.url);
      uploadedVideo.frames.forEach(f => {
        URL.revokeObjectURL(f.url);
        createdUrlsRef.current.delete(f.url);
      });
    }
    setUploadedVideo(null);
    setSelectedVideoFrameIndex(0);
    setResult(null);
    setError('');
  };

  // Drag and drop text files
  const handleTextDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (textDropZoneRef.current) {
      textDropZoneRef.current.classList.add('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleTextDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (textDropZoneRef.current) {
      textDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleTextDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (textDropZoneRef.current) {
      textDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (validTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
        setUploadedFile(file);
        setPastedText('');
        setError('');
      } else {
        setError('Unsupported document type. Please drop a .txt, .docx, or .pdf file.');
      }
    }
  };

  // Drag and drop images for empty drop zone
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (imageDropZoneRef.current) {
      imageDropZoneRef.current.classList.add('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (imageDropZoneRef.current) {
      imageDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imageDropZoneRef.current) {
      imageDropZoneRef.current.classList.remove('border-foreground', 'bg-[#F4EFEB]');
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImageFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (idToRemove: string) => {
    setUploadedImages(prev => {
      const target = prev.find(img => img.id === idToRemove);
      if (target) {
        URL.revokeObjectURL(target.url);
        createdUrlsRef.current.delete(target.url);
      }
      const remaining = prev.filter(img => img.id !== idToRemove);
      if (selectedImageIndex >= remaining.length) {
        setSelectedImageIndex(Math.max(0, remaining.length - 1));
      }
      return remaining;
    });
    setResult(null);
  };

  const handleClearText = () => {
    setPastedText('');
    setUploadedFile(null);
    setResult(null);
    setError('');
  };

  const handleClearImages = () => {
    uploadedImages.forEach(img => {
      URL.revokeObjectURL(img.url);
      createdUrlsRef.current.delete(img.url);
    });
    setUploadedImages([]);
    setSelectedImageIndex(0);
    setResult(null);
    setError('');
  };

  const handleAnalyze = async () => {
    setError('');
    setResult(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      let response: Response;

      if (activeTab === 'text') {
        if (uploadedFile) {
          formData.append('type', 'text');
          formData.append('file', uploadedFile);
          
          response = await fetch('/api/detect', {
            method: 'POST',
            body: formData,
          });
        } else if (pastedText.trim()) {
          response = await fetch('/api/detect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: pastedText }),
          });
        } else {
          setError('Please paste text or select a file to analyze.');
          setAnalyzing(false);
          return;
        }
      } else if (activeTab === 'image') {
        if (uploadedImages.length === 0) {
          setError('Please upload or drop at least one image file first.');
          setAnalyzing(false);
          return;
        }
        formData.append('type', 'image');
        formData.append('isBatch', uploadedImages.length > 1 ? 'true' : 'false');
        uploadedImages.forEach((img) => {
          formData.append('files', img.file);
        });

        response = await fetch('/api/detect', {
          method: 'POST',
          body: formData,
        });
      } else if (activeTab === 'video') {
        if (!uploadedVideo || uploadedVideo.frames.length === 0) {
          setError('Please upload a video and wait for keyframe extraction.');
          setAnalyzing(false);
          return;
        }
        formData.append('type', 'video');
        formData.append('videoName', uploadedVideo.file.name);
        formData.append('duration', uploadedVideo.duration.toString());
        uploadedVideo.frames.forEach((frame, idx) => {
          formData.append('frames', frame.blob, `frame_${idx}.jpg`);
          formData.append('timestamps', frame.formattedTime);
        });

        response = await fetch('/api/detect', {
          method: 'POST',
          body: formData,
        });
      } else {
        setAnalyzing(false);
        return;
      }

      // Update rate limits if headers are available
      const remainingHeader = response.headers.get('X-RateLimit-Remaining');
      if (remainingHeader !== null) {
        setRateLimitRemaining(parseInt(remainingHeader, 10));
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error during scan.');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Verification scan failed. Please verify API key connections.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Quick specimen / sample helpers for frictionless testing
  const handleLoadSampleText = (type: 'ai' | 'human') => {
    setUploadedFile(null);
    setError('');
    if (type === 'ai') {
      setPastedText(
        'Artificial intelligence models have advanced substantially in their capacity to generate natural prose. Through recursive attention weights across billions of parameters, these statistical systems emulate cadence and linguistic cohesion without conscious experience. Consequently, discriminating synthetic syntax requires evaluating distributional entropy, token perplexity, and structural burstiness across sentence boundaries.'
      );
    } else {
      setPastedText(
        'Yesterday morning I caught the early express out toward the coast. The weather was unusually crisp, with an easterly breeze rattling the vintage carriage windows. A dog curled beside the conductor’s boots barely lifted its ears as we rattled past the salt marshes and old stone warehouses that line the estuary.'
      );
    }
  };

  const handleLoadSampleImage = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark luxury background
      const grad = ctx.createLinearGradient(0, 0, 640, 640);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 640);

      // Latent radial glow
      const radial = ctx.createRadialGradient(320, 300, 30, 320, 300, 280);
      radial.addColorStop(0, 'rgba(226, 92, 62, 0.65)');
      radial.addColorStop(0.6, 'rgba(62, 130, 226, 0.3)');
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 640, 640);

      // Subtle synthetic grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 40; i < 640; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 640);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(640, i);
        ctx.stroke();
      }

      // Specimen label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px serif';
      ctx.fillText('TrueLens Specimen #0912', 48, 550);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px monospace';
      ctx.fillText('SYNTHETIC DIFFUSION LATENT SPECIMEN', 48, 574);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'sample_synthetic_specimen.png', { type: 'image/png' });
          addImageFiles([file]);
          setError('');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
    }
  };

  const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;

  // Keyboard shortcut: Cmd/Ctrl + Enter to trigger analysis
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const canAnalyze = !analyzing && !isExtractingFrames && (
          (activeTab === 'text' && (pastedText.trim().length > 0 || uploadedFile !== null)) ||
          (activeTab === 'image' && uploadedImages.length > 0) ||
          (activeTab === 'video' && uploadedVideo !== null)
        );
        if (canAnalyze) {
          e.preventDefault();
          handleAnalyze();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analyzing, isExtractingFrames, activeTab, pastedText, uploadedFile, uploadedImages, uploadedVideo]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-12 py-10 flex flex-col lg:flex-row gap-8 lg:gap-12">
      
      {/* Left Column: Asymmetrical Inputs */}
      <div className="w-full lg:w-1/2 flex flex-col space-y-6">
        
        {/* Header Summary */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center space-x-2 mb-2">
            <span className="inline-flex items-center space-x-1.5 text-[9px] uppercase tracking-[0.2em] text-[#1A1A1A] font-mono font-bold bg-[#1A1A1A]/5 border border-[#1A1A1A]/20 px-2 py-0.5 rounded-xs">
              <ShieldCheck className="w-3 h-3 text-[#1A1A1A]" />
              <span>Authentication Suite</span>
            </span>
            <span className="text-[9px] text-muted font-mono tracking-wider">• Enterprise Forensics</span>
          </div>
          <h2 className="font-serif font-black text-3xl md:text-4xl tracking-tight text-[#1A1A1A] mt-1 mb-2">Scan for AI origin</h2>
          <p className="text-xs text-muted leading-relaxed font-sans max-w-lg">
            Verify content transparency. Paste text passages, drop documents, or upload photos to inspect for structural generation signatures.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border text-[10px] font-mono text-muted">
            <span className="text-[9px] uppercase tracking-wider text-muted/70">Coverage:</span>
            <span className="bg-white border border-border px-1.5 py-0.5 rounded-xs">GPT-4o</span>
            <span className="bg-white border border-border px-1.5 py-0.5 rounded-xs">Claude 3.5</span>
            <span className="bg-white border border-border px-1.5 py-0.5 rounded-xs">Midjourney v6</span>
            <span className="bg-white border border-border px-1.5 py-0.5 rounded-xs">Flux.1</span>
            <span className="bg-white border border-border px-1.5 py-0.5 rounded-xs">Sora</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex space-x-1 border-b border-border pb-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('text'); setError(''); }}
            className={`flex items-center space-x-2 py-2.5 px-3.5 font-mono text-xs uppercase tracking-wider transition-all duration-200 flex-shrink-0 border-b-2 -mb-[1px] ${
              activeTab === 'text'
                ? 'text-foreground font-bold border-foreground bg-white/70 shadow-2xs'
                : 'text-muted hover:text-foreground hover:bg-black/[0.02] border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text Verification</span>
          </button>
          <button
            onClick={() => { setActiveTab('image'); setError(''); }}
            className={`flex items-center space-x-2 py-2.5 px-3.5 font-mono text-xs uppercase tracking-wider transition-all duration-200 flex-shrink-0 border-b-2 -mb-[1px] ${
              activeTab === 'image'
                ? 'text-foreground font-bold border-foreground bg-white/70 shadow-2xs'
                : 'text-muted hover:text-foreground hover:bg-black/[0.02] border-transparent'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo Analysis</span>
          </button>
          <button
            onClick={() => { setActiveTab('video'); setError(''); }}
            className={`flex items-center space-x-2 py-2.5 px-3.5 font-mono text-xs uppercase tracking-wider transition-all duration-200 flex-shrink-0 border-b-2 -mb-[1px] ${
              activeTab === 'video'
                ? 'text-foreground font-bold border-foreground bg-white/70 shadow-2xs'
                : 'text-muted hover:text-foreground hover:bg-black/[0.02] border-transparent'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Forensics</span>
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'text' ? (
            <div className="flex-1 flex flex-col space-y-4">
              {/* Text / File Area */}
              {!uploadedFile ? (
                <div className="flex flex-col flex-1 min-h-[300px]">
                  <div className="flex-1 w-full bg-white border border-border focus-within:border-foreground transition-all duration-200 shadow-xs flex flex-col min-h-[260px]">
                    <textarea
                      value={pastedText}
                      onChange={(e) => { setPastedText(e.target.value); setError(''); }}
                      placeholder="Paste text passage to analyze (articles, essays, emails, code comments, or dialogue)..."
                      className="w-full flex-1 p-5 text-sm font-sans focus:outline-none resize-none leading-relaxed bg-transparent"
                      disabled={analyzing}
                    />
                    {/* Textarea Bottom Action Bar */}
                    <div className="border-t border-border/60 px-4 py-2 bg-[#FAF8F5]/90 flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-muted uppercase tracking-wider">Quick Sample:</span>
                        <button
                          type="button"
                          onClick={() => handleLoadSampleText('ai')}
                          className="text-[10px] px-2 py-0.5 bg-white border border-border hover:border-foreground/50 hover:bg-[#FDFBF7] text-foreground transition rounded-xs font-medium"
                        >
                          AI Generated
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSampleText('human')}
                          className="text-[10px] px-2 py-0.5 bg-white border border-border hover:border-foreground/50 hover:bg-[#FDFBF7] text-foreground transition rounded-xs font-medium"
                        >
                          Human Written
                        </button>
                      </div>
                      <div className="text-[10px] text-muted">
                        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                        {wordCount > 0 && wordCount < 50 && (
                          <span className="text-amber-700 ml-1.5">(≥50 recommended)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Or drop file */}
                  <div
                    ref={textDropZoneRef}
                    onDragOver={handleTextDragOver}
                    onDragLeave={handleTextDragLeave}
                    onDrop={handleTextDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 border border-dashed border-border p-5 text-center cursor-pointer bg-white/60 hover:bg-[#FDFBF7] hover:border-foreground transition duration-150 flex flex-col items-center justify-center space-y-2 group shadow-2xs"
                  >
                    <div className="p-2.5 rounded-full bg-[#FAF8F5] border border-border/60 group-hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
                    </div>
                    <p className="text-xs font-mono">
                      Drag & drop a <span className="underline font-bold">.pdf</span>, <span className="underline font-bold">.docx</span>, or <span className="underline font-bold">.txt</span> file
                    </p>
                    <p className="text-[10px] text-muted font-mono">
                      or click to explore documents folder
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleTextFileChange}
                      accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                    />
                  </div>
                </div>
              ) : (
                /* File Selected View */
                <div className="border border-border p-6 bg-white flex flex-col justify-between items-center space-y-6 min-h-[250px] shadow-xs">
                  <div className="w-full flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-border rounded-sm">
                        <FileText className="w-6 h-6 text-muted" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-mono text-xs font-bold truncate max-w-[250px]">
                          {uploadedFile.name}
                        </h4>
                        <p className="text-[10px] text-muted font-mono">
                          {(uploadedFile.size / 1024).toFixed(1)} KB • document structure
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClearText}
                      className="p-1 hover:bg-border transition duration-150 rounded"
                    >
                      <X className="w-4 h-4 text-muted hover:text-foreground" />
                    </button>
                  </div>
                  
                  <p className="text-xs font-mono text-muted text-center max-w-sm">
                    Ready for inspection. Content will be extracted and parsed dynamically by TrueLens.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'image' ? (
            /* Image Panel content */
            <div className="flex-1 flex flex-col space-y-4">
              {uploadedImages.length === 0 ? (
                <div
                  ref={imageDropZoneRef}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  onDrop={handleImageDrop}
                  onClick={() => imageInputRef.current?.click()}
                  className="flex-1 min-h-[310px] border border-dashed border-border bg-white/70 hover:bg-[#FDFBF7] hover:border-foreground transition-all duration-200 flex flex-col items-center justify-center space-y-3.5 p-8 cursor-pointer group shadow-xs relative"
                >
                  {/* Concentric aperture ring */}
                  <div className="relative flex items-center justify-center mb-1">
                    <div className="w-14 h-14 rounded-full bg-white border border-border/80 shadow-xs flex items-center justify-center ring-8 ring-black/[0.02] group-hover:scale-105 group-hover:border-foreground/40 transition-all duration-300">
                      <Images className="w-6 h-6 text-foreground/75" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-mono font-bold text-foreground">
                      Upload target verification image(s)
                    </p>
                    <p className="text-[11px] text-muted font-sans max-w-xs">
                      Drag and drop single or batch images here, or click to browse files
                    </p>
                    <div className="flex items-center justify-center gap-1.5 pt-2">
                      <span className="text-[9px] font-mono uppercase bg-[#FAF8F5] border border-border/70 px-2 py-0.5 rounded-xs text-muted">JPG • PNG • WebP</span>
                      <span className="text-[9px] font-mono uppercase bg-[#FAF8F5] border border-border/70 px-2 py-0.5 rounded-xs text-muted">Batch Support</span>
                    </div>
                  </div>

                  {/* Sample image quick loader button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSampleImage();
                      }}
                      className="inline-flex items-center space-x-1.5 text-[10px] font-mono px-3 py-1.5 bg-white border border-border hover:border-foreground/60 text-foreground transition-all rounded-xs shadow-2xs group-hover:border-foreground/30"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Load Sample Specimen</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={imageInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleImageFileChange}
                    accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.avif"
                    multiple
                    className="hidden"
                  />
                </div>
              ) : (
                /* Multiple Images Queue View with Drag & Drop */
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOverQueue(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingOverQueue(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOverQueue(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      addImageFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`relative border p-4 bg-white flex flex-col space-y-3 shadow-xs transition duration-150 ${
                    isDraggingOverQueue ? 'border-foreground bg-[#F4EFEB] ring-2 ring-foreground' : 'border-border'
                  }`}
                >
                  {isDraggingOverQueue && (
                    <div className="absolute inset-0 bg-[#F4EFEB]/95 z-20 flex flex-col items-center justify-center border-2 border-dashed border-foreground pointer-events-none">
                      <Plus className="w-8 h-8 text-foreground animate-bounce mb-1" />
                      <p className="font-mono text-xs font-bold text-foreground">Drop photos here to add to queue</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-3.5 h-3.5 text-muted" />
                      <span className="font-mono text-xs font-bold">
                        Queue ({uploadedImages.length} {uploadedImages.length === 1 ? 'photo' : 'photos'})
                      </span>
                    </div>
                    <button
                      onClick={handleClearImages}
                      disabled={analyzing}
                      className="font-mono text-[10px] uppercase text-muted hover:text-ai transition duration-150"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Thumbnail queue list */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[290px] overflow-y-auto p-1">
                    {uploadedImages.map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`group relative border p-1.5 transition duration-150 cursor-pointer flex flex-col items-center bg-[#FAF8F5] ${
                          selectedImageIndex === idx ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:border-foreground/50'
                        }`}
                      >
                        <div className="relative w-full aspect-square bg-border/20 overflow-hidden flex items-center justify-center">
                          <img
                            src={img.url}
                            alt={img.file.name}
                            className="w-full h-full object-cover select-none"
                          />
                          {!analyzing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(img.id);
                              }}
                              className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-white text-foreground rounded-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                              title="Remove photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] font-mono truncate w-full mt-1.5 text-left text-muted" title={img.file.name}>
                          {img.file.name}
                        </span>
                        <span className="text-[9px] font-mono text-muted/70 w-full text-left">
                          {(img.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    ))}

                    {/* Add more button tile with Drag & Drop */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        imageInputRef.current?.click();
                      }}
                      disabled={analyzing}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          addImageFiles(e.dataTransfer.files);
                        }
                      }}
                      className="border border-dashed border-border hover:border-foreground transition duration-150 aspect-square flex flex-col items-center justify-center space-y-1 p-2 bg-white/40 hover:bg-[#FDFBF7]"
                    >
                      <Plus className="w-4 h-4 text-muted" />
                      <span className="text-[10px] font-mono text-muted">Add more</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={imageInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleImageFileChange}
                    accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.avif"
                    multiple
                    className="hidden"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Video Forensics Panel content */
            <div className="flex-1 flex flex-col space-y-4">
              {!uploadedVideo ? (
                <div
                  ref={videoDropZoneRef}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  onClick={() => !isExtractingFrames && videoInputRef.current?.click()}
                  className="flex-1 min-h-[310px] border border-dashed border-border bg-white/70 hover:bg-[#FDFBF7] hover:border-foreground transition-all duration-200 flex flex-col items-center justify-center space-y-3.5 p-8 cursor-pointer group shadow-xs relative"
                >
                  {/* Concentric optical ring */}
                  <div className="relative flex items-center justify-center mb-1">
                    <div className="w-14 h-14 rounded-full bg-white border border-border shadow-xs flex items-center justify-center ring-8 ring-black/[0.02] group-hover:scale-105 group-hover:border-foreground/40 transition-all duration-300">
                      <Video className="w-6 h-6 text-foreground/75" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-mono font-bold text-foreground">
                      Upload target verification video
                    </p>
                    <p className="text-[11px] text-muted font-sans max-w-xs">
                      Drag and drop MP4, WebM, or MOV video file here, or click to browse
                    </p>
                    <div className="flex items-center justify-center gap-1.5 pt-2">
                      <span className="text-[9px] font-mono uppercase bg-[#FAF8F5] border border-border px-2 py-0.5 rounded-xs text-muted">MP4 • WebM • MOV</span>
                      <span className="text-[9px] font-mono uppercase bg-[#FAF8F5] border border-border px-2 py-0.5 rounded-xs text-muted">Temporal Keyframe Extraction</span>
                    </div>
                  </div>
                  {isExtractingFrames && (
                    <div className="flex items-center space-x-2 text-xs font-mono text-muted bg-[#FDFBF7] border border-border px-3 py-1.5 mt-2 shadow-2xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-foreground" />
                      <span>{videoProgress || 'Sampling temporal frames...'}</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={videoInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleVideoFileChange}
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                    className="hidden"
                  />
                </div>
              ) : (
                /* Video Selected & Keyframes Extracted */
                <div className="border border-border p-4 bg-white flex flex-col space-y-4 shadow-xs">
                  {/* Video player preview */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border border-border">
                    <video
                      ref={videoPlayerRef}
                      src={uploadedVideo.url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Video Metadata Header */}
                  <div className="flex justify-between items-center border-b border-border pb-2 text-xs font-mono">
                    <div className="flex items-center space-x-2 truncate max-w-[280px]">
                      <Video className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <span className="font-bold truncate text-foreground" title={uploadedVideo.file.name}>
                        {uploadedVideo.file.name}
                      </span>
                      <span className="text-[10px] text-muted">
                        ({(uploadedVideo.file.size / 1024 / 1024).toFixed(2)} MB • {Math.floor(uploadedVideo.duration / 60)}:{String(Math.floor(uploadedVideo.duration % 60)).padStart(2, '0')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearVideo}
                      disabled={analyzing}
                      className="font-mono text-[10px] uppercase text-muted hover:text-ai transition duration-150"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Extracted Keyframe Timeline Strip */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase tracking-wider">
                      <span>Sampled Keyframes ({uploadedVideo.frames.length} points)</span>
                      <span>Click to scrub player</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {uploadedVideo.frames.map((frame, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedVideoFrameIndex(idx);
                            if (videoPlayerRef.current) {
                              videoPlayerRef.current.currentTime = frame.timestamp;
                            }
                          }}
                          className={`border p-1 flex flex-col items-center cursor-pointer transition duration-150 ${
                            selectedVideoFrameIndex === idx 
                              ? 'border-foreground ring-1 ring-foreground bg-[#FAF8F5]' 
                              : 'border-border hover:border-foreground/50 bg-white'
                          }`}
                        >
                          <div className="relative w-full aspect-video bg-border/30 overflow-hidden">
                            <img
                              src={frame.url}
                              alt={`Frame ${frame.formattedTime}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-[9px] font-mono font-bold mt-1 text-muted">
                            {frame.formattedTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button & Rate Limit Footer */}
        <div className="space-y-3 pt-4">
          {error && (
            <div className="p-3 bg-ai/10 border border-ai/20 text-ai text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={
              analyzing || 
              isExtractingFrames ||
              (activeTab === 'text' && !pastedText.trim() && !uploadedFile) || 
              (activeTab === 'image' && uploadedImages.length === 0) ||
              (activeTab === 'video' && !uploadedVideo)
            }
            className="w-full bg-[#1A1A1A] text-[#FDFBF7] font-mono text-xs uppercase tracking-widest py-3.5 px-6 transition duration-200 flex justify-center items-center space-x-2.5 disabled:bg-border/90 disabled:text-muted disabled:cursor-not-allowed btn-premium rounded-xs shadow-xs"
          >
            {isExtractingFrames ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{videoProgress || 'Extracting video keyframes...'}</span>
              </>
            ) : analyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{analysisProgress}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white/90" />
                <span>
                  Analyze authenticity
                  {activeTab === 'image' && uploadedImages.length > 1 ? ` (${uploadedImages.length} photos)` : ''}
                  {activeTab === 'video' && uploadedVideo ? ` (${uploadedVideo.frames.length} keyframes)` : ''}
                </span>
                <span className="hidden sm:inline-flex items-center text-[9px] bg-white/20 border border-white/25 px-1.5 py-0.5 rounded-xs tracking-normal ml-2 font-mono">
                  ⌘↵
                </span>
              </>
            )}
          </button>

          {rateLimitRemaining !== null && (
            <p className="text-[10px] text-muted text-right font-mono">
              Requests remaining before reset rate limit: <span className="font-bold">{rateLimitRemaining}</span>
            </p>
          )}
        </div>

      </div>

      {/* Right Column: Asymmetric Results Presentation */}
      <div className="w-full lg:w-1/2 flex flex-col editorial-card corner-ticks p-6 md:p-8 relative shadow-sm">
        
        {/* Results view header */}
        <div className="border-b border-border pb-4 mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="font-serif font-black text-xl">Verification metrics</h3>
            {result?.isBatch && (
              <span className="text-[10px] font-mono text-muted">
                Batch scan: {result.summary?.total} photos evaluated
              </span>
            )}
            {result?.isVideo && (
              <span className="text-[10px] font-mono text-muted">
                Video forensics: {result.summary?.totalFrames} temporal frames evaluated
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {result && (activeTab === 'image' || activeTab === 'video') && (
              <button
                onClick={() => setShowOverlays(!showOverlays)}
                className="flex items-center space-x-1.5 text-[10px] font-mono border border-border px-2.5 py-1.5 bg-white hover:bg-[#FDFBF7] shadow-xs"
              >
                {showOverlays ? <EyeOff className="w-3 h-3 text-muted" /> : <Eye className="w-3 h-3 text-muted" />}
                <span>{showOverlays ? 'Hide overlays' : 'Show overlays'}</span>
              </button>
            )}

            {result?.isBatch && (
              <div className="flex border border-border bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setBatchViewMode('all')}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-mono transition duration-150 ${
                    batchViewMode === 'all' 
                      ? 'bg-foreground text-background font-bold' 
                      : 'text-muted hover:text-foreground'
                  }`}
                  title="Show all photos simultaneously"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>All Photos ({result.items?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchViewMode('focus')}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-mono transition duration-150 border-l border-border ${
                    batchViewMode === 'focus' 
                      ? 'bg-foreground text-background font-bold' 
                      : 'text-muted hover:text-foreground'
                  }`}
                  title="Focus single photo inspector"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Focus</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Inner Panels */}
        {!result && !analyzing && (
          /* 1. Empty state (Editorial Forensic Standby) */
          <div className="flex-1 flex flex-col justify-center items-center text-center p-6 md:p-8 py-14 border border-dashed border-border bg-white/50 relative overflow-hidden">
            {/* Precision Optical Reticle Graphic */}
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border border-border flex items-center justify-center relative shadow-2xs">
                <div className="w-14 h-14 rounded-full border border-dashed border-border flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white border border-border shadow-xs flex items-center justify-center">
                    <Scan className="w-4 h-4 text-[#1A1A1A]" />
                  </div>
                </div>
                {/* Thin reticle crosshairs */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-border/60 pointer-events-none" />
                <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-border/60 pointer-events-none" />
              </div>
            </div>

            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#1A1A1A]/5 border border-[#1A1A1A]/20 text-[9px] font-mono text-muted mb-3 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Forensic Engine Standby</span>
            </div>

            <h4 className="font-serif font-bold text-lg text-foreground mb-1 tracking-tight">Authenticity report pending</h4>
            <p className="text-xs text-muted max-w-sm font-sans leading-relaxed mb-6">
              Scan results, sentence weights, and image generation heatmap coordinates will render here once analysis runs.
            </p>

            {/* 3 Capabilities Preview Cards */}
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
              <div className="p-3 bg-white border border-border shadow-2xs">
                <span className="text-[9px] uppercase tracking-wider font-mono text-muted block mb-1">01 / Syntax</span>
                <p className="text-[11px] font-bold text-foreground leading-tight">Perplexity & Burstiness</p>
                <p className="text-[9px] text-muted font-mono mt-1">Linguistic distribution analysis</p>
              </div>
              <div className="p-3 bg-white border border-border shadow-2xs">
                <span className="text-[9px] uppercase tracking-wider font-mono text-muted block mb-1">02 / Spatial</span>
                <p className="text-[11px] font-bold text-foreground leading-tight">Artifact Heatmap</p>
                <p className="text-[9px] text-muted font-mono mt-1">Latent diffusion fingerprints</p>
              </div>
              <div className="p-3 bg-white border border-border shadow-2xs">
                <span className="text-[9px] uppercase tracking-wider font-mono text-muted block mb-1">03 / Temporal</span>
                <p className="text-[11px] font-bold text-foreground leading-tight">Frame Cadence</p>
                <p className="text-[9px] text-muted font-mono mt-1">Consistency across video strip</p>
              </div>
            </div>
          </div>
        )}

        {analyzing && (
          /* 2. Loading state */
          <div className="flex-1 flex flex-col justify-center items-center py-20">
            <div className="w-10 h-10 border-t-2 border-foreground rounded-full animate-spin mb-6"></div>
            <h4 className="font-serif font-bold text-base animate-pulse mb-1">Scanning source footprint...</h4>
            <p className="text-xs text-muted font-mono">{analysisProgress}</p>
          </div>
        )}

        {result && !analyzing && (
          /* 3. Output state */
          <div className="flex-1 flex flex-col space-y-6">
            
            {/* 1. VIDEO FORENSICS RESULT VIEW */}
            {result.isVideo ? (
              <div className="space-y-6">
                {/* Video Summary Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-border bg-white divide-x divide-y sm:divide-y-0 divide-border shadow-xs">
                  <div className="p-3">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Video Verdict</span>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        result.summary?.overallVerdict === 'ai' 
                          ? 'bg-ai' 
                          : result.summary?.overallVerdict === 'uncertain' 
                            ? 'bg-uncertain' 
                            : 'bg-human'
                      }`} />
                      <span className={`font-serif font-black text-base uppercase tracking-tight ${
                        result.summary?.overallVerdict === 'ai' 
                          ? 'text-ai' 
                          : result.summary?.overallVerdict === 'uncertain' 
                            ? 'text-uncertain' 
                            : 'text-human'
                      }`}>
                        {result.summary?.overallVerdict === 'ai' 
                          ? 'AI Deepfake' 
                          : result.summary?.overallVerdict === 'uncertain' 
                            ? 'Uncertain' 
                            : 'Authentic'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Avg AI Risk</span>
                    <div className="flex items-baseline space-x-1 mt-1">
                      <span className="font-serif font-black text-2xl">{result.summary?.averageConfidence ?? 0}</span>
                      <span className="text-xs font-mono text-muted">%</span>
                    </div>
                  </div>

                  <div className="p-3">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Peak Anomaly</span>
                    <div className="flex items-baseline space-x-1.5 mt-1">
                      <span className={`font-serif font-black text-2xl ${
                        (result.summary?.peakConfidence ?? 0) >= 60 ? 'text-ai' : ''
                      }`}>
                        {result.summary?.peakConfidence ?? 0}%
                      </span>
                      <span className="text-[10px] font-mono text-muted truncate">
                        @ {result.summary?.peakTimestamp || '00:00'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Sampled Cadence</span>
                    <div className="font-serif font-black text-2xl mt-1">
                      <span className="text-ai">{result.summary?.aiCount ?? 0}</span>
                      <span className="text-xs font-mono text-muted font-normal"> / {result.summary?.totalFrames ?? 0} AI</span>
                    </div>
                  </div>
                </div>

                {/* Temporal Risk Timeline Scrubber Bar */}
                <div className="border border-border bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted" />
                      <span className="font-bold text-foreground">Temporal Risk Timeline</span>
                      <span className="truncate max-w-[180px]">({result.videoName})</span>
                    </div>
                    <span>Click marker to inspect keyframe</span>
                  </div>

                  <div className="pt-2 pb-1">
                    <div className="relative w-full py-3 bg-[#FAF8F5] border border-border px-3 rounded-xs flex items-center justify-between">
                      {/* Timeline horizontal connecting line */}
                      <div className="absolute left-6 right-6 h-0.5 bg-border z-0" />

                      {result.timeline?.map((item: any, idx: number) => {
                        const isSelected = selectedVideoFrameIndex === idx;
                        const isAI = item.result?.verdict === 'ai';
                        const isUncertain = item.result?.verdict === 'uncertain';
                        const badgeBg = isAI ? 'bg-ai text-white' : isUncertain ? 'bg-uncertain text-white' : 'bg-human text-white';

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedVideoFrameIndex(idx);
                              if (videoPlayerRef.current && uploadedVideo?.frames[idx]) {
                                videoPlayerRef.current.currentTime = uploadedVideo.frames[idx].timestamp;
                              }
                            }}
                            className={`group relative z-10 flex flex-col items-center cursor-pointer transition-all duration-150 ${
                              isSelected ? 'scale-110' : 'hover:scale-105'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shadow-xs transition-all ${badgeBg} ${
                              isSelected ? 'ring-2 ring-foreground ring-offset-2' : 'opacity-90 group-hover:opacity-100'
                            }`}>
                              #{idx + 1}
                            </div>
                            <span className={`text-[9px] font-mono font-bold mt-1.5 ${isSelected ? 'text-foreground font-extrabold' : 'text-muted'}`}>
                              {item.timestamp}
                            </span>
                            <span className="text-[8px] font-mono text-muted">
                              {item.result?.confidence}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Selected Keyframe Deep-Inspector */}
                {(() => {
                  const safeIndex = Math.min(
                    Math.max(0, selectedVideoFrameIndex),
                    (result.timeline?.length || 1) - 1
                  );
                  const activeItem = result.timeline?.[safeIndex] || result.timeline?.[0];
                  const activeFrame = uploadedVideo?.frames?.[safeIndex] || uploadedVideo?.frames?.[0];
                  const itemResult = activeItem?.result;
                  const isAI = itemResult?.verdict === 'ai';
                  const isUncertain = itemResult?.verdict === 'uncertain';

                  return (
                    <div className="space-y-4">
                      {/* Subheader & Navigation */}
                      <div className="flex justify-between items-center border-b border-border pb-2 text-xs font-mono">
                        <div className="flex items-center space-x-2">
                          <Film className="w-3.5 h-3.5 text-muted" />
                          <span className="font-bold text-foreground">
                            Keyframe #{safeIndex + 1} Inspector
                          </span>
                          <span className="text-muted">
                            (Time: {activeItem?.timestamp || '00:00'})
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            disabled={safeIndex <= 0}
                            onClick={() => {
                              const newIdx = Math.max(0, safeIndex - 1);
                              setSelectedVideoFrameIndex(newIdx);
                              if (videoPlayerRef.current && uploadedVideo?.frames[newIdx]) {
                                videoPlayerRef.current.currentTime = uploadedVideo.frames[newIdx].timestamp;
                              }
                            }}
                            className="px-2 py-1 border border-border bg-white text-[10px] font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FDFBF7]"
                          >
                            ← Prev
                          </button>
                          <button
                            type="button"
                            disabled={safeIndex >= (result.timeline?.length || 1) - 1}
                            onClick={() => {
                              const newIdx = Math.min((result.timeline?.length || 1) - 1, safeIndex + 1);
                              setSelectedVideoFrameIndex(newIdx);
                              if (videoPlayerRef.current && uploadedVideo?.frames[newIdx]) {
                                videoPlayerRef.current.currentTime = uploadedVideo.frames[newIdx].timestamp;
                              }
                            }}
                            className="px-2 py-1 border border-border bg-white text-[10px] font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FDFBF7]"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      {/* Keyframe Verdict Metric Row */}
                      <div className="grid grid-cols-3 border border-border bg-white divide-x divide-border shadow-xs">
                        <div className="p-3">
                          <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Frame Verdict</span>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <span className={`w-2 h-2 rounded-full ${isAI ? 'bg-ai' : isUncertain ? 'bg-uncertain' : 'bg-human'}`} />
                            <span className={`font-serif font-black text-sm uppercase ${isAI ? 'text-ai' : isUncertain ? 'text-uncertain' : 'text-human'}`}>
                              {isAI ? 'AI Frame' : isUncertain ? 'Uncertain' : 'Authentic'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3">
                          <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Confidence</span>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className="font-serif font-black text-xl">{itemResult?.confidence ?? 0}</span>
                            <span className="text-xs font-mono text-muted">%</span>
                          </div>
                        </div>

                        <div className="p-3">
                          <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Anomaly Regions</span>
                          <span className="font-mono text-xs font-bold mt-1 block text-muted">
                            {itemResult?.regions?.length > 0 ? `${itemResult.regions.length} localized` : '0 regions'}
                          </span>
                        </div>
                      </div>

                      {/* Frame Image Display with Spatial AI Heatmap Overlays */}
                      <div className="relative border border-border bg-black flex items-center justify-center overflow-hidden w-full aspect-video shadow-inner">
                        {activeFrame?.url ? (
                          <div className="relative w-full h-full flex items-center justify-center select-none">
                            <img
                              src={activeFrame.url}
                              alt={`Keyframe at ${activeItem?.timestamp}`}
                              className="w-full h-full object-contain"
                            />

                            {showOverlays && itemResult?.regions && itemResult.regions.map((reg: any, rIdx: number) => (
                              <div
                                key={rIdx}
                                style={{
                                  position: 'absolute',
                                  left: `${reg.x}%`,
                                  top: `${reg.y}%`,
                                  width: `${reg.width}%`,
                                  height: `${reg.height}%`,
                                  border: '2px solid var(--color-ai)',
                                  backgroundColor: 'rgba(226, 92, 62, 0.18)',
                                }}
                                className="group flex items-start justify-start p-0.5"
                                title={`${reg.label || 'AI Region'}: ${reg.confidence}%`}
                              >
                                <span className="bg-ai text-white text-[8px] font-mono px-1 py-0.5 rounded-xs select-none pointer-events-none truncate max-w-full font-bold">
                                  {reg.label ? `${reg.label} (${reg.confidence}%)` : `${reg.confidence}%`}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs font-mono text-muted">No frame preview available</div>
                        )}
                      </div>

                      {/* Explanatory Caption */}
                      <p className="text-[10px] font-mono text-muted text-center w-full">
                        {itemResult?.regions?.length > 0
                          ? 'Spatial bounding boxes highlight localized generative artifacts and facial inconsistencies in this keyframe.'
                          : isAI
                            ? 'Neural synthesis textures and compression inconsistency detected across this temporal frame.'
                            : 'Frame optical noise and sensor pattern are consistent with authentic camera footage.'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* 2. PHOTO BATCH & SINGLE ITEM / TEXT RESULT VIEWS */
              <>
                {/* Batch Summary Bar if result.isBatch */}
                {result.isBatch && result.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-border bg-white divide-x divide-y sm:divide-y-0 divide-border shadow-xs">
                    <div className="p-3">
                      <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Total Photos</span>
                      <div className="font-serif font-black text-2xl mt-1">{result.summary.total}</div>
                    </div>
                    <div className="p-3">
                      <span className="text-[9px] uppercase tracking-widest text-ai font-mono">AI Generated</span>
                      <div className="font-serif font-black text-2xl text-ai mt-1">{result.summary.aiCount}</div>
                    </div>
                    <div className="p-3">
                      <span className="text-[9px] uppercase tracking-widest text-human font-mono">Human Made</span>
                      <div className="font-serif font-black text-2xl text-human mt-1">{result.summary.humanCount}</div>
                    </div>
                    <div className="p-3">
                      <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Avg Score</span>
                      <div className="font-serif font-black text-2xl mt-1">{result.summary.averageConfidence}%</div>
                    </div>
                  </div>
                )}

                {/* VIEW MODE A: ALL PHOTOS SIMULTANEOUS GALLERY */}
                {result.isBatch && batchViewMode === 'all' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-muted">
                      <span>Batch Overview ({result.items.length} Photos)</span>
                      <span>Click photo to deep inspect</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-h-[620px] overflow-y-auto pr-1">
                      {result.items.map((item: any, idx: number) => {
                        const itemResult = item.result;
                        const isAI = itemResult.verdict === 'ai';
                        const isUncertain = itemResult.verdict === 'uncertain';
                        const imgObj = uploadedImages.find(img => img.file.name === item.fileName) || uploadedImages[idx];
                        const previewUrl = imgObj?.url;

                        return (
                          <div 
                            key={item.id || idx}
                            className="border border-border bg-white p-4 shadow-xs flex flex-col sm:flex-row gap-4 hover:border-foreground/50 transition duration-150"
                          >
                            {/* Photo Thumbnail with Spatial Heatmap Overlays */}
                            <div 
                              onClick={() => {
                                setSelectedImageIndex(idx);
                                setBatchViewMode('focus');
                              }}
                              className="relative w-full sm:w-44 aspect-video sm:aspect-square bg-border/20 border border-border flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer group"
                            >
                              {previewUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center select-none">
                                  <img
                                    src={previewUrl}
                                    alt={item.fileName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                   {showOverlays && itemResult.regions && itemResult.regions.map((reg: any, rIdx: number) => (
                                     <div
                                       key={rIdx}
                                       style={{
                                         position: 'absolute',
                                         left: `${reg.x}%`,
                                         top: `${reg.y}%`,
                                         width: `${reg.width}%`,
                                         height: `${reg.height}%`,
                                         border: '2px solid var(--color-ai)',
                                         backgroundColor: 'rgba(226, 92, 62, 0.18)',
                                       }}
                                       className="flex items-start justify-start p-0.5"
                                       title={`${reg.label || 'AI Region'}: ${reg.confidence}%`}
                                     >
                                       <span className="bg-ai text-white text-[7.5px] font-mono px-1 py-0.2 rounded-xs select-none pointer-events-none truncate max-w-full font-bold">
                                         {reg.label ? `${reg.label} (${reg.confidence}%)` : `${reg.confidence}%`}
                                       </span>
                                     </div>
                                   ))}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs font-mono text-muted">No preview</div>
                              )}
                            </div>

                            {/* Details, Verdict & Confidence */}
                            <div className="flex-1 flex flex-col justify-between space-y-2">
                              <div>
                                <div className="flex items-start justify-between">
                                  <div className="space-y-0.5 max-w-[220px]">
                                    <span className="text-[10px] font-mono text-muted font-bold block">
                                      Photo #{idx + 1}
                                    </span>
                                    <h5 className="font-mono text-xs font-bold truncate text-foreground" title={item.fileName}>
                                      {item.fileName}
                                    </h5>
                                    <span className="text-[9px] font-mono text-muted">
                                      {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono block">Confidence</span>
                                    <span className="font-serif font-black text-2xl">
                                      {itemResult.confidence}%
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 mt-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${
                                    isAI ? 'bg-ai' : isUncertain ? 'bg-uncertain' : 'bg-human'
                                  }`} />
                                  <span className={`font-serif font-black text-base uppercase tracking-tight ${
                                    isAI ? 'text-ai' : isUncertain ? 'text-uncertain' : 'text-human'
                                  }`}>
                                    {isAI ? 'AI Generated' : isUncertain ? 'Uncertain' : 'Human Made'}
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${isAI ? 'bg-ai' : isUncertain ? 'bg-uncertain' : 'bg-human'}`}
                                  style={{ width: `${itemResult.confidence}%` }}
                                />
                              </div>

                              {/* Findings & Focus Button */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px] font-mono text-muted">
                                <span className="truncate max-w-[200px]">
                                  {itemResult.regions?.length > 0 
                                    ? `${itemResult.regions.length} anomaly region(s) localized` 
                                    : isAI 
                                      ? 'Synthetic neural generation signatures detected' 
                                      : 'Consistent with authentic optical camera capture'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedImageIndex(idx);
                                    setBatchViewMode('focus');
                                  }}
                                  className="text-[10px] uppercase font-mono tracking-wider font-bold text-foreground hover:underline flex items-center space-x-1"
                                >
                                  <span>Inspect</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* VIEW MODE B: FOCUS INSPECTOR (For single files or selected batch item) */}
                {(!result.isBatch || batchViewMode === 'focus') && (
                  <div className="space-y-6">
                    
                    {/* Back to all photos button when in batch mode */}
                    {result.isBatch && (
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => setBatchViewMode('all')}
                          className="text-xs font-mono text-muted hover:text-foreground flex items-center space-x-1.5 font-bold transition duration-150"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to All Photos Overview</span>
                        </button>
                        <span className="text-[10px] font-mono text-muted">
                          Viewing Photo {selectedImageIndex + 1} of {result.items.length}
                        </span>
                      </div>
                    )}

                    {/* Batch Photo Selector Strip */}
                    {result.isBatch && result.items?.length > 1 && (
                      <div className="space-y-2">
                        <div className="flex gap-2 overflow-x-auto pb-2 p-1">
                          {result.items.map((item: any, idx: number) => {
                            const isSelected = selectedImageIndex === idx;
                            const itemResult = item.result;
                            const isAI = itemResult.verdict === 'ai';
                            const isUncertain = itemResult.verdict === 'uncertain';
                            const imgObj = uploadedImages.find(img => img.file.name === item.fileName) || uploadedImages[idx];

                            return (
                              <button
                                key={item.id || idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`flex-shrink-0 border p-2 flex items-center space-x-2.5 text-left transition duration-150 rounded-none cursor-pointer ${
                                  isSelected 
                                    ? 'bg-white border-foreground shadow-xs ring-1 ring-foreground' 
                                    : 'bg-white/60 border-border hover:bg-white hover:border-foreground/40'
                                }`}
                              >
                                {imgObj?.url && (
                                  <img
                                    src={imgObj.url}
                                    alt={item.fileName}
                                    className="w-9 h-9 object-cover rounded-xs border border-border"
                                  />
                                )}
                                <div className="flex flex-col max-w-[120px]">
                                  <span className="text-[11px] font-mono truncate font-bold text-foreground">{item.fileName}</span>
                                  <span className={`text-[9px] font-mono font-bold mt-0.5 ${
                                    isAI ? 'text-ai' : isUncertain ? 'text-uncertain' : 'text-human'
                                  }`}>
                                    {isAI ? `AI (${itemResult.confidence}%)` : isUncertain ? `Uncertain (${itemResult.confidence}%)` : `Human (${itemResult.confidence}%)`}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active Inspector Details */}
                    {(() => {
                      const activeDetection = result.isBatch 
                        ? (result.items?.[selectedImageIndex]?.result || result.items?.[0]?.result) 
                        : result;
                      const activeImgObj = result.isBatch 
                        ? (uploadedImages.find(img => img.file.name === result.items?.[selectedImageIndex]?.fileName) || uploadedImages[selectedImageIndex])
                        : uploadedImages[0];
                      const activePreview = activeTab === 'image' 
                        ? (activeImgObj?.url || null)
                        : null;
                      const activeFileName = result.isBatch 
                        ? (result.items?.[selectedImageIndex]?.fileName || '') 
                        : (uploadedImages[0]?.file.name || '');

                      if (!activeDetection) return null;

                      return (
                        <div className="space-y-6">
                          {/* Overall Verdict Card */}
                          <div className="grid grid-cols-1 md:grid-cols-3 border border-border bg-white divide-y md:divide-y-0 md:divide-x divide-border shadow-xs">
                            
                            {/* Verdict Indicator */}
                            <div className="p-4 flex flex-col justify-between min-h-[90px]">
                              <span className="text-[9px] uppercase tracking-widest text-muted font-mono">
                                {result.isBatch ? `Photo Verdict (${selectedImageIndex + 1}/${result.items.length})` : 'Verdict'}
                              </span>
                              <div className="flex items-center space-x-1.5 mt-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                  activeDetection.verdict === 'ai' 
                                    ? 'bg-ai' 
                                    : activeDetection.verdict === 'uncertain' 
                                      ? 'bg-uncertain' 
                                      : 'bg-human'
                                }`} />
                                <span className="font-serif font-black text-lg uppercase tracking-tight">
                                  {activeDetection.verdict === 'ai' ? 'AI Generated' : activeDetection.verdict === 'uncertain' ? 'Uncertain' : 'Human Made'}
                                </span>
                              </div>
                            </div>

                            {/* Confidence Score */}
                            <div className="p-4 flex flex-col justify-between min-h-[90px]">
                              <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Generation Confidence</span>
                              <div className="flex items-baseline space-x-1 mt-1">
                                <span className="font-serif font-black text-3xl tracking-tighter">{activeDetection.confidence}</span>
                                <span className="text-xs font-mono text-muted">%</span>
                              </div>
                            </div>

                            {/* System details */}
                            <div className="p-4 flex flex-col justify-between min-h-[90px]">
                              <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Target Inspection</span>
                              <div className="flex items-center space-x-1.5 text-xs font-mono mt-3">
                                <ShieldCheck className="w-4 h-4 text-muted flex-shrink-0" />
                                <span className="text-muted truncate max-w-[130px]" title={activeFileName}>
                                  {activeFileName || 'Verified Engine'}
                                </span>
                              </div>
                            </div>

                          </div>


                          {/* Content Highlight Detail Box */}
                          <div className="flex-1 flex flex-col min-h-[250px]">
                            
                            {activeTab === 'text' && activeDetection.textSegments?.length > 0 && (
                              <div className="flex-1 flex flex-col">
                                <h4 className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">Sentence-Level Risk Highlights</h4>
                                <div className="flex-1 bg-white border border-border p-5 text-sm leading-relaxed max-h-[350px] overflow-y-auto font-sans shadow-inner">
                                  {activeDetection.textSegments.map((seg: any, idx: number) => {
                                    let style = '';
                                    let title = '';

                                    if (seg.verdict === 'ai') {
                                      style = 'bg-ai/15 border-b-2 border-ai/55 cursor-help';
                                      title = `AI Probability: ${seg.confidence}%`;
                                    } else if (seg.verdict === 'uncertain') {
                                      style = 'bg-uncertain/15 border-b-2 border-uncertain/40 cursor-help';
                                      title = `Uncertainty Index: ${seg.confidence}%`;
                                    }

                                    return (
                                      <span 
                                        key={idx} 
                                        className={`inline transition-all duration-200 ${style} px-0.5`}
                                        title={title}
                                      >
                                        {seg.text}{' '}
                                      </span>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 flex space-x-4 text-[10px] font-mono text-muted">
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2.5 h-1.5 bg-ai/15 border-b-2 border-ai" />
                                    <span>Likely AI</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2.5 h-1.5 bg-uncertain/15 border-b-2 border-uncertain" />
                                    <span>Uncertain</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2.5 h-1.5 bg-white border-b border-border" />
                                    <span>Likely Human</span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {activeTab === 'image' && (
                              <div className="flex-1 flex flex-col items-center">
                                <h4 className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2 w-full text-left">
                                  Spatial AI Overlay Highlights {result.isBatch && `(${selectedImageIndex + 1} of ${result.items.length})`}
                                </h4>
                                <div className="relative border border-border bg-border/20 flex items-center justify-center overflow-hidden w-full aspect-video shadow-inner">
                                  {activePreview ? (
                                    <div className="relative max-h-[300px] select-none">
                                      <img
                                        src={activePreview}
                                        alt="Overlay results"
                                        className="max-h-[300px] object-contain"
                                      />

                                      {showOverlays && activeDetection.regions && activeDetection.regions.map((reg: any, idx: number) => {
                                        return (
                                          <div
                                            key={idx}
                                            style={{
                                              position: 'absolute',
                                              left: `${reg.x}%`,
                                              top: `${reg.y}%`,
                                              width: `${reg.width}%`,
                                              height: `${reg.height}%`,
                                              border: '2px solid var(--color-ai)',
                                              backgroundColor: 'rgba(226, 92, 62, 0.16)',
                                            }}
                                            className="group transition-all duration-200 hover:bg-ai/30 flex items-start justify-start p-1 pointer-events-auto"
                                            title={`${reg.label || 'AI Region'}: ${reg.confidence}% confidence`}
                                          >
                                            <span className="bg-ai text-white text-[8.5px] font-mono px-1.5 py-0.5 rounded-xs select-none shadow-xs truncate max-w-full font-bold">
                                              {reg.label ? `${reg.label} (${reg.confidence}%)` : `${reg.confidence}%`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs font-mono text-muted">No preview available</div>
                                  )}
                                </div>
                                {activeDetection.regions?.length > 0 ? (
                                  <div className="mt-3 w-full space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted">
                                      <span>AI-Detected Artifact Locations ({activeDetection.regions.length})</span>
                                      <span className="text-ai font-bold">Localized with AI Vision</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {activeDetection.regions.map((reg: any, rIdx: number) => (
                                        <div key={rIdx} className="border border-ai/30 bg-ai/5 p-2 flex items-center justify-between text-xs font-mono">
                                          <div className="flex items-center space-x-1.5 truncate">
                                            <span className="w-2 h-2 rounded-full bg-ai flex-shrink-0" />
                                            <span className="font-bold text-foreground truncate">{reg.label || `Anomaly #${rIdx + 1}`}</span>
                                          </div>
                                          <span className="text-ai font-bold flex-shrink-0 ml-2">{reg.confidence}%</span>
                                        </div>
                                      ))}
                                    </div>
                                    {activeDetection.summary && (
                                      <p className="text-[10px] font-mono text-muted bg-[#FAF8F5] border border-border p-2 leading-relaxed">
                                        <strong className="text-foreground">Forensic Observation:</strong> {activeDetection.summary}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[10px] font-mono text-muted mt-2 text-center w-full">
                                    No matching region anomalies detected. Entire image footprint matches standard human capture characteristics.
                                  </p>
                                )}
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })()}

                  </div>
                )}
              </>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
