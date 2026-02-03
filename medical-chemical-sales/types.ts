
export interface SigmaVariation {
  material_number: string;
  price: number | null;
  price_eur?: number | null;
  currency: string;
  availability_date: string | null;
  price_eur_str?: string;
  original_price_str?: string;
  package_size?: string; // Assuming this might exist based on usage
}

export interface NetflexResult {
  source: "Netflex";
  product_name: string;
  product_code: string;
  price_numeric: number | null;
  price_str: string;
  stock: number | string;
  brand?: string; // Assuming this might exist based on usage
}

export interface TciVariation {
  unit: string;
  original_price: string;
  original_price_numeric: number | null;
  stock_info?: { country: string; stock: string }[];
  calculated_price_eur?: number | null;
  calculated_price_eur_str?: string;
}

export interface ItkVariation {
  product_code: string;
  product_name: string;
  price_str: string;
  price: number;
  currency: string;
  stock_quantity: string;
  unit?: string; // Assuming this might exist based on usage
}

export interface ProductResult {
  source: string;
  product_name: string;
  product_number: string;
  cas_number: string;
  brand: string;
  sigma_variations: {
    us?: SigmaVariation[];
    de?: SigmaVariation[];
    gb?: SigmaVariation[];
  };
  netflex_matches: NetflexResult[];
  tci_variations?: TciVariation[];
  itk_variations?: ItkVariation[];
  cheapest_eur_price_str?: string;
  cheapest_material_number?: string;
  cheapest_source_country?: string;
  cheapest_netflex_stock?: number | string;
  product_url?: string;
}

export interface AssignmentItem {
  product_name: string;
  product_code: string;
  cas_number: string;
  price_numeric: number | null;
  price_str: string;
  source: string;
  brand: string;
  unit: string;
  cheapest_netflex_stock?: number | string;
}

export interface AppSettings {
  netflex_username: string;
  netflex_password: string;
  orkim_username: string;
  orkim_password: string;
  itk_username: string;
  itk_password: string;
  tci_coefficient: number;
  itk_coefficient: number;
  sigma_coefficient_us: number;
  sigma_coefficient_de: number;
  sigma_coefficient_gb: number;
  // license_key: string;
}

export interface SearchHistoryItem {
  term: string;
  timestamp: number;
}

export interface CalendarNote {
  id: string;
  date: string; // YYYY-MM-DD formatında
  note: string;
  meetings: Meeting[];
}

export interface Meeting {
  id: string;
  type: "görüşme" | "toplantı";
  companyName: string;
  authorizedPerson: string;
  department: string;
  email: string;
  phone: string;
  meetingNotes: string;
  nextMeetingDate: string | null; // YYYY-MM-DD formatında
  priority: "low" | "medium" | "high";
  completed: boolean;
  notificationFrequency: string;
  notificationDailyFrequency: "once" | "twice" | "thrice" | "five_times" | "ten_times" | "hourly";
}

// Global Electron API tanımı
declare global {
  interface Window {
    electronAPI: {
      rendererReady: () => void;
      performSearch: (data: { searchTerm: string; searchLogic: string; enabledBrands: string[] }) => void;
      cancelSearch: () => void;
      exportToExcel: (data: any) => void;
      loadSettings: () => void;
      saveSettings: (settings: any) => void;
      selectFile: () => Promise<string | null>;
      startBatchSearch: (data: { filePath: string; customerName: string }) => void;
      cancelBatchSearch: () => void;
      cancelCurrentTermSearch: () => void;
      getParities: () => void;
      onServicesReady: (callback: (isReady: boolean) => void) => () => void;
      onInitialSetupRequired: (callback: () => void) => () => void;
      onProductFound: (callback: (message: { product: any; context?: any }) => void) => () => void;
      onSearchComplete: (callback: (summary: any) => void) => () => void;
      onExportResult: (callback: (result: any) => void) => () => void;
      onSearchError: (callback: (error: string) => void) => () => void;
      onSettingsLoaded: (callback: (settings: any) => void) => () => void;
      onSettingsSaved: (callback: (result: any) => void) => () => void;
      onAuthenticationError: (callback: () => void) => () => void;
      // onLicenseError: (callback: () => void) => () => void;
      onPythonCrashed: (callback: () => void) => () => void;
      onBatchSearchProgress: (callback: (progress: any) => void) => () => void;
      onBatchSearchComplete: (callback: (summary: any) => void) => () => void;
      onParitiesUpdated: (callback: (parities: any) => void) => () => void;
      onLogSearchTerm: (callback: (data: { term: string }) => void) => () => void;
      saveCalendarNotes: (notes: CalendarNote[]) => void;
      loadCalendarNotes: () => void;
      onCalendarNotesLoaded: (callback: (notes: CalendarNote[]) => void) => () => void;
      exportMeetings: (data: { notes: CalendarNote[]; startDate: string; endDate: string }) => void;
      onExportMeetingsResult: (callback: (result: any) => void) => () => void;
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateDownloadProgress: (callback: (progressInfo: any) => void) => () => void;
      onUpdateDownloaded: (callback: (info: any) => void) => () => void;
      onNewSettingsAvailable: (callback: () => void) => () => void;
      onUpdateNotAvailable: (callback: (info: any) => void) => () => void;
      onUpdateError: (callback: (error: any) => void) => () => void;
      restartAppAndUpdate: () => void;
      checkForUpdates: () => void;
      getOrkimStock: (productUrl: string) => void;
      onOrkimStockResult: (callback: (result: { url: string; stock: number | string }) => void) => () => void;
      getAppVersion: () => Promise<string>;
    };
  }
}
