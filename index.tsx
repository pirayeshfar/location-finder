
import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  MapPin, Navigation, Info, Copy, Share2, 
  RefreshCw, CheckCircle2, AlertCircle, Hash, Globe, Home, Map 
} from 'lucide-react';

// --- Types ---
interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface AddressDetails {
  fullAddress: string;
  road?: string;
  neighbourhood?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  building?: string;
}

enum AppStatus {
  IDLE = 'idle',
  GETTING_COORDS = 'getting_coords',
  GETTING_ADDRESS = 'getting_address',
  SUCCESS = 'success',
  ERROR = 'error'
}

// --- Components ---
const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
    <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 border-b border-blue-100">
      <span className="text-blue-600">{icon}</span>
      <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const DetailItem: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <span className="text-sm font-medium text-gray-700">{value}</span>
  </div>
);

// --- Main App Logic ---
const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<AddressDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getAddressFromGemini = async (lat: number, lng: number): Promise<AddressDetails> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `آدرس دقیق این مختصات را استخراج کن: ${lat}, ${lng}. 
      پاسخ را دقیقاً با این برچسب‌ها بده:
      استان: 
      شهر: 
      منطقه: 
      محله: 
      خیابان: 
      پلاک: 
      کدپستی: 
      آدرس کامل: `,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
      },
    });

    const text = response.text || "";
    const getValue = (label: string) => {
      const regex = new RegExp(`${label}:\\s*(.*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : undefined;
    };

    return {
      state: getValue('استان'),
      city: getValue('شهر'),
      district: getValue('منطقه'),
      neighbourhood: getValue('محله'),
      road: getValue('خیابان'),
      building: getValue('پلاک'),
      postcode: getValue('کدپستی'),
      fullAddress: getValue('آدرس کامل') || text.split('\n')[0]
    };
  };

  const startLocating = useCallback(async () => {
    setStatus(AppStatus.GETTING_COORDS);
    setErrorMsg(null);

    if (!navigator.geolocation) {
      setStatus(AppStatus.ERROR);
      setErrorMsg("مرورگر شما از GPS پشتیبانی نمی‌کند.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setCoords(c);
        setStatus(AppStatus.GETTING_ADDRESS);
        
        try {
          const addr = await getAddressFromGemini(c.latitude, c.longitude);
          setAddress(addr);
          setStatus(AppStatus.SUCCESS);
        } catch (err) {
          console.error(err);
          setStatus(AppStatus.ERROR);
          setErrorMsg("خطا در تحلیل آدرس توسط هوش مصنوعی.");
        }
      },
      (err) => {
        setStatus(AppStatus.ERROR);
        setErrorMsg(err.code === 1 ? "دسترسی به لوکیشن رد شد." : "خطا در دریافت مختصات GPS.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const copyToClipboard = () => {
    if (!address) return;
    navigator.clipboard.writeText(`آدرس: ${address.fullAddress}\nکدپستی: ${address.postcode || '-'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <div className="inline-flex p-3 bg-blue-600 rounded-2xl text-white mb-4 shadow-lg"><MapPin size={32} /></div>
        <h1 className="text-2xl font-bold text-gray-900">یابنده هوشمند آدرس</h1>
        <p className="text-gray-500 text-sm mt-2">استخراج دقیق‌ترین آدرس و کد پستی با هوش مصنوعی</p>
      </header>

      <button
        onClick={startLocating}
        disabled={status === AppStatus.GETTING_COORDS || status === AppStatus.GETTING_ADDRESS}
        className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl transition-all disabled:bg-blue-300"
      >
        {status === AppStatus.GETTING_COORDS || status === AppStatus.GETTING_ADDRESS ? <RefreshCw className="animate-spin" /> : <Navigation />}
        <span>شروع مکان‌یابی</span>
      </button>

      {errorMsg && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex gap-2 border border-red-100"><AlertCircle size={18}/> {errorMsg}</div>}

      {(status === AppStatus.GETTING_COORDS || status === AppStatus.GETTING_ADDRESS) && (
        <div className="mt-8 text-center animate-pulse"><p className="text-blue-600 font-medium">در حال دریافت اطلاعات...</p></div>
      )}

      {status === AppStatus.SUCCESS && coords && address && (
        <div className="mt-8 space-y-4 animate-in fade-in duration-500">
          <InfoCard title="مختصات دقیق" icon={<Navigation size={18}/>}>
            <div className="flex justify-between font-mono text-sm text-blue-700">
              <span>LAT: {coords.latitude.toFixed(6)}</span>
              <span>LNG: {coords.longitude.toFixed(6)}</span>
            </div>
          </InfoCard>

          <InfoCard title="آدرس پستی" icon={<Globe size={18}/>}>
            <p className="text-gray-800 font-medium leading-relaxed">{address.fullAddress}</p>
          </InfoCard>

          <InfoCard title="جزئیات منطقه" icon={<Map size={18}/>}>
            <DetailItem label="شهر/استان" value={`${address.state || '-'} / ${address.city || '-'}`} />
            <DetailItem label="منطقه/محله" value={`${address.district || '-'} / ${address.neighbourhood || '-'}`} />
            <DetailItem label="خیابان/پلاک" value={`${address.road || '-'} / ${address.building || '-'}`} />
            <div className="mt-3 pt-3 border-t flex justify-between">
              <span className="text-xs font-bold text-blue-600">کد پستی ۱۰ رقمی:</span>
              <span className="font-mono font-bold text-lg text-blue-800 tracking-tighter">{address.postcode || 'نامشخص'}</span>
            </div>
          </InfoCard>

          <div className="flex gap-2">
            <button onClick={copyToClipboard} className="flex-1 py-3 bg-white border rounded-xl flex justify-center gap-2 text-sm font-bold">
              {copied ? <CheckCircle2 className="text-green-500" size={18}/> : <Copy size={18}/>} کپی آدرس
            </button>
            <a href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`} target="_blank" className="flex-1 py-3 bg-gray-900 text-white rounded-xl flex justify-center gap-2 text-sm font-bold">
               نمایش روی نقشه
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Rendering ---
import ReactDOM from 'react-dom/client';
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
