import React, { useState, useEffect } from 'react';
import { Fingerprint, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { FingerprintReader, SampleFormat } from '@digitalpersona/devices';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function FingerprintEnrollmentModal({
  isOpen,
  onClose,
  employee,
  onSuccess
}) {
  const [reader, setReader] = useState(null);
  const [scans, setScans] = useState([]);
  const [statusText, setStatusText] = useState("Initializing Scanner...");
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isOpen || !employee) return;
    
    const fpReader = new FingerprintReader();
    setReader(fpReader);
    setScans([]);
    setErrorMsg("");
    setIsProcessing(false);
    setIsComplete(false);
    
    let mounted = true;

    const onDeviceConnected = () => { if(mounted) setStatusText("Scanner connected. Ready to capture."); };
    const onDeviceDisconnected = () => { if(mounted) setStatusText("Scanner disconnected."); };
    const onCommunicationFailed = () => { if(mounted) { setErrorMsg("Lite Client unavailable"); setStatusText("Failed"); } };
    
    const onSamplesAcquired = async (ev) => {
      if (!mounted) return;
      const sample = ev.samples[0];
      let b64Data = typeof sample === 'string' ? sample : sample.Data || sample;
      if (typeof b64Data === 'string' && b64Data.startsWith('{')) {
          try { b64Data = JSON.parse(b64Data).Data; } catch(e) {}
      }
      b64Data = b64Data.replace(/-/g, '+').replace(/_/g, '/');

      setScans(prev => {
        const newScans = [...prev, b64Data];
        if (newScans.length < 3) {
          setStatusText(`Capture ${newScans.length} of 3 successful. Lift and place finger again.`);
        }
        return newScans;
      });
    };

    fpReader.on("DeviceConnected", onDeviceConnected);
    fpReader.on("DeviceDisconnected", onDeviceDisconnected);
    fpReader.on("CommunicationFailed", onCommunicationFailed);
    fpReader.on("SamplesAcquired", onSamplesAcquired);

    // Start acquisition automatically
    fpReader.startAcquisition(SampleFormat.PngImage).then(() => {
      if(mounted) setStatusText("Please place finger on the scanner. (Capture 1 of 3)");
    }).catch(() => {
      if(mounted) setErrorMsg("Could not start scanner. Ensure DigitalPersona client is running.");
    });

    return () => {
      mounted = false;
      fpReader.off("DeviceConnected", onDeviceConnected);
      fpReader.off("DeviceDisconnected", onDeviceDisconnected);
      fpReader.off("CommunicationFailed", onCommunicationFailed);
      fpReader.off("SamplesAcquired", onSamplesAcquired);
      fpReader.stopAcquisition().catch(() => {});
    };
  }, [isOpen, employee]);

  useEffect(() => {
    if (scans.length === 3 && !isProcessing && !isComplete) {
      verifyAndEnroll();
    }
  }, [scans]);

  const verifyAndEnroll = async () => {
    setIsProcessing(true);
    setStatusText("Cross-verifying 3 captured fingerprints...");
    
    try {
      if (reader) await reader.stopAcquisition().catch(() => {});
      
      const pngA = scans[0];
      const pngB = scans[1];
      const pngC = scans[2];

      // 1. Cross Verify
      const verifyRes = await fetch(`${API_BASE}/biometrics/poc-compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pngA, pngB, pngC })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyData.success) {
        throw new Error("Verification failed: " + verifyData.message);
      }

      const scores = verifyData.scores;
      const minScore = Math.min(scores.AvsB, scores.AvsC, scores.BvsC);
      
      if (minScore < 40) {
        throw new Error("Fingerprint captures were inconsistent. Please make sure to place the same finger firmly each time.");
      }

      setStatusText(`High quality captures confirmed (Score: ${minScore.toFixed(0)}). Enrolling...`);

      // 2. Enroll
      const token = localStorage.getItem('adminToken');
      const enrollRes = await fetch(`${API_BASE}/employees/${employee._id}/enroll`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ png: pngA })
      });
      const enrollData = await enrollRes.json();

      if (!enrollData.success) throw new Error(enrollData.message || "Failed to save fingerprint");

      setIsComplete(true);
      setStatusText("Fingerprint successfully enrolled!");
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (err) {
      setErrorMsg(err.message || "An error occurred during enrollment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScans([]);
    setErrorMsg("");
    setStatusText("Please place finger on the scanner. (Capture 1 of 3)");
    if (reader) {
      reader.stopAcquisition().then(() => {
        reader.startAcquisition(SampleFormat.PngImage).catch(() => {});
      }).catch(() => {
        reader.startAcquisition(SampleFormat.PngImage).catch(() => {});
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg tracking-tight">Register Fingerprint</h3>
            {employee && <p className="text-xs text-slate-500 font-medium">For: {employee.name}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center justify-center space-y-6">
          <div className="relative flex items-center justify-center h-32 w-32">
            {isComplete ? (
              <div className="absolute inset-0 bg-emerald-100 rounded-full scale-150 animate-ping opacity-20"></div>
            ) : errorMsg ? (
              <div className="absolute inset-0 bg-rose-100 rounded-full scale-150 animate-ping opacity-20"></div>
            ) : (
              <div className="absolute inset-0 bg-indigo-100 rounded-full scale-[1.3] animate-pulse opacity-50"></div>
            )}
            
            <div className={`relative z-10 flex items-center justify-center h-24 w-24 rounded-full shadow-inner ${
              isComplete ? 'bg-emerald-500' : errorMsg ? 'bg-rose-500' : isProcessing ? 'bg-amber-500' : 'bg-indigo-600'
            } transition-colors duration-500`}>
              {isComplete ? (
                <CheckCircle className="h-10 w-10 text-white" />
              ) : errorMsg ? (
                <AlertCircle className="h-10 w-10 text-white" />
              ) : isProcessing ? (
                <RefreshCw className="h-10 w-10 text-white animate-spin" />
              ) : (
                <Fingerprint className="h-12 w-12 text-white animate-pulse" />
              )}
            </div>
          </div>

          {/* Status */}
          <div className="text-center space-y-2">
            <h4 className={`font-extrabold text-xl ${
              isComplete ? 'text-emerald-600' : errorMsg ? 'text-rose-600' : 'text-slate-800'
            }`}>
              {isComplete ? 'Success!' : errorMsg ? 'Enrollment Failed' : isProcessing ? 'Verifying...' : 'Scan 3 Times'}
            </h4>
            <p className="text-sm font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
              {errorMsg ? errorMsg : statusText}
            </p>
          </div>

          {/* Progress Indicators */}
          {!isComplete && !errorMsg && !isProcessing && (
            <div className="w-full space-y-3 pt-2">
              <div className="flex justify-between space-x-2">
                {[1, 2, 3].map((step) => (
                  <div 
                    key={step}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      step <= scans.length
                        ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' 
                        : 'bg-slate-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {errorMsg && (
            <button onClick={handleReset} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline">
              Try Again
            </button>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
        </div>

      </div>
    </div>
  );
}
