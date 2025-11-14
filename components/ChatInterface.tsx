import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Message } from '../types';
import { translateSignToText, translateTextToSign } from '../services/geminiService';
import { analyzePose } from '../services/poseService';
import { fetchLandmarks, type LandmarkPoint } from '../services/landmarkService';
import { CameraIcon, HomeIcon, RefreshIcon } from '../constants';
import { IoHandLeftOutline } from 'react-icons/io5';

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '기타 검사 받으러 왔어요.', sender: 'user' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signDescription, setSignDescription] = useState('김수화님! 무엇을 도와드릴까요?');
  const [videoQueue, setVideoQueue] = useState<string[]>([]);
  const [landmarkOverlay, setLandmarkOverlay] = useState<LandmarkPoint[]>([]);
  const landmarkCache = useRef<Record<string, LandmarkPoint[]>>({});
  const activeVideo = videoQueue[0] ?? null;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const enqueueVideosFromText = useCallback((text: string) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const additions: string[] = [];
    if (normalized.includes('안녕하세요')) {
      additions.push('hello');
    }
    if (normalized.includes('배부르네요')) {
      additions.push('full');
    }
    if (!additions.length) return;
    setVideoQueue(prev => [...prev, ...additions]);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setVideoQueue(prev => prev.slice(1));
  }, []);

  const handleToggleWebcam = useCallback(async () => {
    if (isWebcamOn) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      if(videoRef.current) videoRef.current.srcObject = null;
      setIsWebcamOn(false);
      setVideoQueue([]);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsWebcamOn(true);
        setVideoQueue([]);
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setSignDescription("Error: Could not access webcam. Please check permissions.");
      }
    }
  }, [isWebcamOn]);

  const handleCaptureAndTranslate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    setIsProcessing(true);
    setSignDescription("잠시만요, 제스처를 준비해주세요...");

    await new Promise(resolve => setTimeout(resolve, 2000));
    setSignDescription("Analyzing gesture...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageDataUrl.split(',')[1];
    
    try {
      const poseResult = await analyzePose(base64Data);
      if (poseResult?.text) {
        const message = poseResult.text.trim();
        setMessages(prev => [...prev, { id: Date.now(), text: message, sender: 'user' }]);
        setSignDescription(message);
        enqueueVideosFromText(message);
      } else {
        setSignDescription('포즈 인식 결과가 없습니다.');
      }
    } catch (error) {
      console.error('Pose API error:', error);
      setSignDescription('포즈 분석 중 문제가 발생했습니다. 다시 시도해주세요.');
    }

    try {
      const translatedText = await translateSignToText(base64Data);
      const hasMeaningfulText = translatedText && !translatedText.toLowerCase().startsWith('error');

      if (hasMeaningfulText) {
        const message = translatedText.trim();
        setMessages(prev => [...prev, { id: Date.now(), text: message, sender: 'user' }]);
        setSignDescription('추가 설명이 생성되었습니다.');
        enqueueVideosFromText(message);
      }
    } catch (err) {
      console.error('Gemini translation error:', err);
    }

    setIsProcessing(false);
  }, [isProcessing]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const textToTranslate = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);
    setMessages(prev => [...prev, { id: Date.now(), text: textToTranslate, sender: 'user' }]);
    enqueueVideosFromText(textToTranslate);

    if (isWebcamOn) {
      await handleToggleWebcam();
    }

    const description = await translateTextToSign(textToTranslate);
    if (description && !description.toLowerCase().startsWith('error')) {
      if (!description.toLowerCase().startsWith('to sign')) {
        setSignDescription(description);
      }
    } else {
      setSignDescription('AI가 잠시 응답하지 않아요. 다시 시도해 주세요.');
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    let isMounted = true;
    const loadLandmarks = async () => {
      if (!activeVideo) {
        if (isMounted) setLandmarkOverlay([]);
        return;
      }
      if (landmarkCache.current[activeVideo]) {
        if (isMounted) setLandmarkOverlay(landmarkCache.current[activeVideo]);
        return;
      }
      try {
        const data = await fetchLandmarks(activeVideo);
        const points = data.average || [];
        landmarkCache.current[activeVideo] = points;
        if (isMounted) setLandmarkOverlay(points);
      } catch (err) {
        console.error('Failed to load landmark overlay:', err);
        if (isMounted) setLandmarkOverlay([]);
      }
    };
    loadLandmarks();
    return () => {
      isMounted = false;
    };
  }, [activeVideo]);

  const videoSources: Record<string, { webm: string; mp4: string; ogv: string }> = {
    hello: {
      webm: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191021/629456/MOV000257117_700X466.webm",
      mp4: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191021/629456/MOV000257117_700X466.mp4",
      ogv: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191021/629456/MOV000257117_700X466.ogv",
    },
    full: {
      webm: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191028/631916/MOV000244936_700X466.webm",
      mp4: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191028/631916/MOV000244936_700X466.mp4",
      ogv: "http://sldict.korean.go.kr/multimedia/multimedia_files/convert/20191028/631916/MOV000244936_700X466.ogv",
    },
  };

  return (
    <div className="flex-1 flex flex-col bg-[#e5e7eb] overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-300 bg-white">
            <div className="text-sm">
                <span className="text-gray-500">방용투리</span>
                <span className="text-gray-400 mx-2">&gt;</span>
                <span className="font-semibold text-gray-800">보련소 양방방 수여 통신</span>
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 text-gray-600">
                    <HomeIcon className="w-5 h-5 cursor-pointer hover:text-gray-900"/>
                    <RefreshIcon className="w-5 h-5 cursor-pointer hover:text-gray-900"/>
                </div>
                <button className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-200 transition-colors">
                    대화 시작
                </button>
            </div>
        </div>
        
        <main className="flex-1 flex gap-4 p-4 overflow-hidden">
            {/* Left Pane: Video/Avatar */}
            <div className="w-1/2 flex flex-col items-center justify-center bg-white rounded-lg p-4 space-y-4">
                <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center w-full">
                    <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${isWebcamOn ? 'block' : 'hidden'}`}></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {!isWebcamOn && (
                      activeVideo && videoSources[activeVideo] ? (
                        <video
                          key={activeVideo}
                          id="html5VideoPreview"
                          controls
                          preload="auto"
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                          controlsList="nodownload"
                          onEnded={handleVideoEnded}
                        >
                          <source src={videoSources[activeVideo].webm} type="video/webm" />
                          <source src={videoSources[activeVideo].mp4} type="video/mp4" />
                          <source src={videoSources[activeVideo].ogv} type="video/ogv" />
                        </video>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-blue-600 space-y-2">
                          <IoHandLeftOutline className="w-20 h-20" />
                          <p className="text-base font-semibold text-gray-700">카메라를 켜고 제스처를 보여주세요</p>
                        </div>
                      )
                    )}
                    {!isWebcamOn && landmarkOverlay.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {landmarkOverlay.map(point => (
                          <span
                            key={point.id}
                            className="absolute w-2 h-2 rounded-full bg-blue-500 opacity-80"
                            style={{
                              left: `${point.x * 100}%`,
                              top: `${point.y * 100}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        ))}
                      </div>
                    )}
                     <div className="absolute top-2 right-2 flex items-center gap-2">
                       <button onClick={handleToggleWebcam} className="p-2 bg-black bg-opacity-40 text-white rounded-full hover:bg-opacity-60 transition-opacity">
                           <CameraIcon className="w-5 h-5" />
                       </button>
                    </div>
                </div>
                 {isWebcamOn ? (
                    <button 
                        onClick={handleCaptureAndTranslate} 
                        disabled={isProcessing}
                        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                        {isProcessing ? 'Translating...' : 'Translate Gesture'}
                    </button>
                 ) : (
                    <div className="w-full flex justify-center mt-4">
                        <div className="bg-white rounded-3xl px-6 py-3 shadow-sm relative text-center">
                            <p className="text-gray-800">{signDescription}</p>
                            <div className="absolute -bottom-2 w-4 h-4 bg-white transform rotate-45 left-1/2 -translate-x-1/2"></div>
                        </div>
                    </div>
                 )}
            </div>

            {/* Right Pane: Chat */}
            <div className="w-1/2 flex flex-col bg-white rounded-lg overflow-hidden border border-gray-300">
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {messages.map(msg => (
                        <div key={msg.id} className="flex justify-end">
                            <div className="max-w-sm px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-2 bg-white border-t border-gray-200">
                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="대화명"
                            className="w-full p-3 pr-12 border-none bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            disabled={isProcessing}
                        />
                        <button type="submit" className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 rounded-full disabled:text-gray-300 transition-colors" disabled={isProcessing}>
                            <CameraIcon className="w-6 h-6" />
                        </button>
                    </form>
                </div>
            </div>
        </main>
    </div>
  );
};

export default ChatInterface;
