"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import {
  ProductResult,
  AssignmentItem,
  AppSettings,
  SearchHistoryItem,
  CalendarNote,
} from '../types';

// Yardımcı fonksiyonlar
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

const calculateRelevance = (product: ProductResult, term: string): number => {
    let score = 0;
    const termLower = term.toLowerCase().trim();
    if (!termLower) return 0;

    const name = stripHtml(product.product_name || "").toLowerCase();
    const number = (product.product_number || "").toLowerCase();
    const cas = (product.cas_number || "").toLowerCase();
    if (termLower === number) score += 10000;
    if (termLower === cas) score += 5000;
    if (termLower === name) score += 2000;
    if (name.startsWith(termLower)) score += 500;
    if (number.startsWith(termLower)) score += 500;
    if (name.includes(termLower)) score += 100 + 50 / (name.length + 1);
    const termWords = new Set(termLower.split(" ").filter((w) => w));
    const nameWords = new Set(name.split(" ").filter((w) => w));
    let allWordsPresent = true;
    for (const word of termWords) {
        if (!nameWords.has(word)) {
            allWordsPresent = false;
            break;
        }
    }
    if (allWordsPresent && termWords.size > 0) {
        score += termWords.size * 50;
    }
    const commonWords = new Set([...termWords].filter((x) => nameWords.has(x)));
    score += commonWords.size * 10;
    return score;
};


interface IAppContext {
  appStatus: string;
  setAppStatus: (status: string) => void;
  page: string;
  setPage: (page: string) => void;
  assignments: AssignmentItem[];
  setAssignments: (assignments: AssignmentItem[] | ((prev: AssignmentItem[]) => AssignmentItem[])) => void;
  searchHistory: SearchHistoryItem[];
  setSearchHistory: (history: SearchHistoryItem[] | ((prev: SearchHistoryItem[]) => SearchHistoryItem[])) => void;
  calendarNotes: CalendarNote[];
  setCalendarNotes: (notes: CalendarNote[] | ((prev: CalendarNote[]) => CalendarNote[])) => void;
  parities: any;
  settings: AppSettings | null;
  setSettings: (settings: AppSettings | null) => void;
  isLoading: boolean;
  error: string | null;
  searchResults: ProductResult[];
  handleSearch: (searchTerm: string, searchLogic: string) => void;
  handleCancel: () => void;
  toast: (type: "success" | "error" | "warning" | "info", message: string, options?: any) => void;
  toasts: any[];
  setToasts: React.Dispatch<React.SetStateAction<any[]>>;
  // ... diğer state ve fonksiyonlar
}

const AppContext = createContext<IAppContext | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [appStatus, setAppStatus] = useState("initializing");
  const [page, setPage] = useState("calendar");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [parities, setParities] = useState(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawSearchResults, setRawSearchResults] = useState<ProductResult[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");

  const [toasts, setToasts] = useState<any[]>([]);

  const toast = useCallback((type: any, message: any, options: any = {}) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message, ...options }]);
      if (!options.duration || options.duration > 0) {
          setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== id));
          }, options.duration || 5000);
      }
  }, []);

  // LocalStorage'dan veri yükleme
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("search_history");
      if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
      
      const savedAssignments = localStorage.getItem("assignments_single");
      if (savedAssignments) setAssignments(JSON.parse(savedAssignments));
    } catch (error) {
      console.error("localStorage'dan veri yüklenirken hata:", error);
      toast("error", "Kaydedilmiş veriler yüklenemedi.");
    } finally {
      setIsDataLoaded(true);
    }
  }, [toast]);

  // LocalStorage'a veri kaydetme
  useEffect(() => {
    if (isDataLoaded) {
      try {
        localStorage.setItem("assignments_single", JSON.stringify(assignments));
        localStorage.setItem("search_history", JSON.stringify(searchHistory));
      } catch (error) {
        console.error("Veriler kaydedilirken hata:", error);
      }
    }
  }, [assignments, searchHistory, isDataLoaded]);

  const productQueueRef = useRef<ProductResult[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchResults = useMemo(() => {
    if (!settings || !parities) {
      return rawSearchResults;
    }
    // ... (calculateProductPrices mantığı buraya gelecek veya import edilecek)
    return rawSearchResults;
  }, [rawSearchResults, settings, parities, currentSearchTerm]);

  const handleSearch = useCallback((searchTerm: string, searchLogic: string) => {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return;
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    const enabledBrands = ["sigma", "tci", "orkim", "itk", "netflex"]; // Şimdilik hepsi aktif
    productQueueRef.current = [];
    setIsLoading(true);
    setRawSearchResults([]);
    setError(null);
    setCurrentSearchTerm(trimmedSearchTerm);
    if (window.electronAPI) {
      window.electronAPI.performSearch({ searchTerm: trimmedSearchTerm, searchLogic, enabledBrands });
    } else {
      console.error("Electron API bulunamadı, arama yapılamıyor.");
      setIsLoading(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (window.electronAPI) {
      toast("info", "Arama iptal ediliyor...");
      window.electronAPI.cancelSearch();
    }
  }, [toast]);

  // Electron'dan gelen event'leri dinleme
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const cleanups = [
      window.electronAPI.onProductFound(({ product, context }) => {
        if (!context) {
          productQueueRef.current.push(product);
          if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = setTimeout(() => {
            if (productQueueRef.current.length === 0) return;
            setRawSearchResults((prev) => [...prev, ...productQueueRef.current]);
            productQueueRef.current = [];
          }, 200);
        }
      }),
      window.electronAPI.onSearchComplete((summary) => {
        setIsLoading(false);
        toast(summary.status === "cancelled" ? "warning" : "success", `Arama tamamlandı! ${summary.total_found} eşleşme bulundu.`);
      }),
      window.electronAPI.onSearchError((errorMessage) => {
        setError(errorMessage);
        setIsLoading(false);
      }),
      window.electronAPI.onSettingsLoaded((loadedSettings) => setSettings(loadedSettings)),
      window.electronAPI.onParitiesUpdated((updatedParities) => setParities(updatedParities)),
      window.electronAPI.onCalendarNotesLoaded((loadedNotes) => {
        if (loadedNotes && Array.isArray(loadedNotes)) setCalendarNotes(loadedNotes);
      }),
      // ... diğer event listener'lar
    ];

    // Ayarları ve pariteleri yükle
    window.electronAPI.loadSettings();
    window.electronAPI.getParities();
    window.electronAPI.loadCalendarNotes();

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [toast]);


  const value = {
    appStatus, setAppStatus,
    page, setPage,
    assignments, setAssignments,
    searchHistory, setSearchHistory,
    calendarNotes, setCalendarNotes,
    parities,
    settings, setSettings,
    isLoading,
    error,
    searchResults,
    handleSearch,
    handleCancel,
    toast,
    toasts,
    setToasts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
