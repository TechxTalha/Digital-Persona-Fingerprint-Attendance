import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { FingerprintReader, SampleFormat } from '@digitalpersona/devices';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AttendanceKiosk() {
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [message, setMessage] = useState('Place your finger on the scanner');
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [time, setTime] = useState(new Date());
  const [reader, setReader] = useState(null);
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    let isProcessingScan = false;
    const fpReader = new FingerprintReader();
    setReader(fpReader);

    const onDeviceConnected = () => { if(mounted) setMessage("Scanner connected. Ready."); };
    const onDeviceDisconnected = () => { if(mounted) setMessage("Scanner disconnected."); };
    
    const onSamplesAcquired = async (ev) => {
      if (!mounted || isProcessingScan) return;
      isProcessingScan = true;
      setStatus('processing');
      setMessage('Identifying fingerprint...');
      
      try {
        // Stop acquisition immediately to clear SDK buffers
        fpReader.stopAcquisition().catch(() => {});

        const sample = ev.samples[0];
        let b64Data = typeof sample === 'string' ? sample : sample.Data || sample;
        if (typeof b64Data === 'string' && b64Data.startsWith('{')) {
            try { b64Data = JSON.parse(b64Data).Data; } catch(e) {}
        }
        b64Data = b64Data.replace(/-/g, '+').replace(/_/g, '/');

        const res = await fetch(`${API_BASE}/attendance/punch-biometric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ png: b64Data })
        });
        
        const data = await res.json();
        
        if (mounted) {
          if (data.success) {
            setStatus('success');
            setMessage(data.message);
            setEmployeeInfo(data.employee);
          } else {
            setStatus('error');
            setMessage(data.message || 'Fingerprint not recognized.');
            setEmployeeInfo(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setStatus('error');
          setMessage('Server communication error.');
          setEmployeeInfo(null);
        }
      }

      // Reset after delay and restart scanner
      setTimeout(() => {
        if (mounted) {
          setStatus('idle');
          setMessage('Place your finger on the scanner');
          setEmployeeInfo(null);
          isProcessingScan = false;
          // Restart scanner for next capture
          fpReader.startAcquisition(SampleFormat.PngImage).catch(() => {});
        }
      }, 1500);
    };

    fpReader.on('DeviceConnected', onDeviceConnected);
    fpReader.on('DeviceDisconnected', onDeviceDisconnected);
    fpReader.on('SamplesAcquired', onSamplesAcquired);
    
    // Start acquisition immediately
    fpReader.startAcquisition(SampleFormat.PngImage).then(() => {
      if (mounted) setMessage('Place your finger on the scanner');
    }).catch(() => {
      if (mounted) setMessage('Failed to start scanner');
    });

    return () => {
      mounted = false;
      fpReader.off('DeviceConnected', onDeviceConnected);
      fpReader.off('DeviceDisconnected', onDeviceDisconnected);
      fpReader.off('SamplesAcquired', onSamplesAcquired);
      fpReader.stopAcquisition().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] h-full p-3 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col transform transition-all duration-500">
        
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-slate-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-white">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Biometric Kiosk</h2>
            <p className="text-slate-400 font-medium mt-1 text-sm sm:text-base">Automated Attendance System</p>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center sm:justify-end space-x-2">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-teal-400 shrink-0" />
              <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">
              {time.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Main Display Area */}
        <div className="p-6 sm:p-10 lg:p-12 flex flex-col items-center justify-center min-h-[280px] sm:min-h-[350px] relative overflow-hidden">
          
          {/* Background Ambient Glow */}
          <div className={`absolute inset-0 opacity-10 transition-colors duration-700 ${
            status === 'success' ? 'bg-emerald-500' :
            status === 'error' ? 'bg-rose-500' :
            status === 'processing' ? 'bg-amber-500' : 'bg-slate-500'
          }`} />

          {/* Icon Container */}
          <div className="relative mb-6 sm:mb-8">
            {status === 'processing' && (
              <div className="absolute inset-0 bg-amber-400 rounded-full scale-[1.5] animate-ping opacity-20"></div>
            )}
            {status === 'success' && (
              <div className="absolute inset-0 bg-emerald-400 rounded-full scale-[2] animate-ping opacity-20"></div>
            )}
            
            <div className={`relative z-10 flex items-center justify-center h-28 w-28 sm:h-40 sm:w-40 rounded-full shadow-2xl transition-all duration-500 ${
              status === 'success' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 scale-110' :
              status === 'error' ? 'bg-gradient-to-br from-rose-400 to-rose-600' :
              status === 'processing' ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
              'bg-gradient-to-br from-slate-700 to-slate-900'
            }`}>
              {status === 'success' ? <CheckCircle className="h-14 w-14 sm:h-20 sm:w-20 text-white" /> :
               status === 'error' ? <AlertCircle className="h-14 w-14 sm:h-20 sm:w-20 text-white" /> :
               status === 'processing' ? <RefreshCw className="h-14 w-14 sm:h-20 sm:w-20 text-white animate-spin" /> :
               <Fingerprint className="h-14 w-14 sm:h-20 sm:w-20 text-white animate-pulse" />}
            </div>
          </div>

          {/* Status Messaging */}
          <div className="text-center z-10 space-y-3 sm:space-y-4 px-1">
            <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight transition-colors duration-500 break-words ${
              status === 'success' ? 'text-emerald-600' :
              status === 'error' ? 'text-rose-600' :
              status === 'processing' ? 'text-amber-600' : 'text-slate-800'
            }`}>
              {status === 'success' && employeeInfo ? `Welcome, ${employeeInfo.name}!` :
               status === 'error' ? 'Punch Failed' :
               status === 'processing' ? 'Analyzing Biometrics...' :
               'Ready for Scan'}
            </h1>
            
            <p className="text-sm sm:text-lg font-medium text-slate-500 max-w-md mx-auto">
              {message}
            </p>
            
            {status === 'idle' && (
              <button
                onClick={() => {
                  setStatus('processing');
                  setMessage('Restarting scanner...');
                  window.location.reload();
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline mt-2 inline-block"
              >
                Reset Scanner
              </button>
            )}

            {employeeInfo && status === 'success' && (
              <div className="mt-4 sm:mt-6 inline-block bg-emerald-50 border border-emerald-100 rounded-2xl px-4 sm:px-6 py-3">
                <p className="text-emerald-800 font-semibold text-sm sm:text-base">{employeeInfo.role}</p>
                <p className="text-emerald-600 text-xs sm:text-sm font-medium">Shift: {employeeInfo.shift}</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 py-3 sm:py-4 px-4 sm:px-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>DigitalPersona Core</span>
          <span>SourceAFIS Java Engine</span>
        </div>
      </div>
    </div>
  );
}
