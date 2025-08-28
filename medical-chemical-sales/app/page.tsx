"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { Euro, Home, Search, Users, Package2, DollarSign, Activity, PlusCircle, User, UserPlus, FileText, ChevronDown, Moon, Sun, LoaderCircle, AlertCircle, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";


// --------------------------------------------------------------------------------
// Electron API ve Veri Tipleri
// --------------------------------------------------------------------------------

interface ComparisonItem {
  source: string;
  product_name: string;
  product_code: string;
  price_numeric: number | null;
  price_str: string;
}

interface ProductResult {
  product_name: string;
  product_number: string;
  cas_number: string;
  brand: string;
  sigma_price_str: string;
  cheapest_netflex_name: string;
  cheapest_netflex_price_str: string;
  comparison: ComparisonItem[];
}

declare global {
  interface Window {
    electronAPI: {
      performSearch: (searchTerm: string) => void;
      onDatabaseResults: (callback: (data: { results: ProductResult[], execution_time: number }) => void) => void;
      onProductFound: (callback: (product: ProductResult) => void) => void;
      onSearchProgress: (callback: (progress: { status: string, total: number, processed: number }) => void) => void;
      onSearchComplete: (callback: (summary: { status: string, total_found: number, execution_time: number }) => void) => void;
      onSearchError: (callback: (error: string) => void) => void;
      exportToExcel: (data: { customerName: string; products: ComparisonItem[] }) => void;
      onExportResult: (callback: (result: { status: string; path?: string; message?: string }) => void) => void;
    };
  }
}


// --------------------------------------------------------------------------------
// Tema Sağlayıcısı (ThemeProvider)
// --------------------------------------------------------------------------------
const ThemeProviderContext = createContext({ theme: "system", setTheme: (theme) => {}, });
const ThemeProvider = ({ children, defaultTheme = "system", storageKey = "vite-ui-theme" }) => {
  const [theme, setTheme] = useState(defaultTheme);
  useEffect(() => { const storedTheme = localStorage.getItem(storageKey) || defaultTheme; setTheme(storedTheme); }, []);
  useEffect(() => { const root = window.document.documentElement; root.classList.remove("light", "dark"); if (theme === "system") { const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; root.classList.add(systemTheme); return; } root.classList.add(theme); }, [theme]);
  const value = { theme, setTheme: (newTheme) => { localStorage.setItem(storageKey, newTheme); setTheme(newTheme); }, };
  return (<ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>);
};
const useTheme = () => useContext(ThemeProviderContext);

// --------------------------------------------------------------------------------
// Tema Değiştirme Düğmesi
// --------------------------------------------------------------------------------
const ModeToggle = () => {
    const { theme, setTheme } = useTheme();
    return (<Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" /><Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" /><span className="sr-only">Temayı değiştir</span></Button>);
}


// --------------------------------------------------------------------------------
// Sidebar Bileşeni
// --------------------------------------------------------------------------------
const Sidebar = ({ setPage, currentPage }) => {
  const navItems = [ { name: "home", href: "#", icon: Home, label: "Ana Sayfa" }, { name: "search", href: "#", icon: Search, label: "Ürün Arama" }, { name: "customers", href: "#", icon: Users, label: "Müşteriler" }, ];
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <a href="#" onClick={() => setPage("home")} className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"><Package2 className="h-4 w-4 transition-all group-hover:scale-110" /><span className="sr-only">Tales Job</span></a>
        <TooltipProvider>{navItems.map((item) => (<Tooltip key={item.name}><TooltipTrigger asChild><a href={item.href} onClick={(e) => { e.preventDefault(); setPage(item.name); }} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8", { "bg-accent text-accent-foreground": currentPage === item.name, })}><item.icon className="h-5 w-5" /><span className="sr-only">{item.label}</span></a></TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip>))}
        </TooltipProvider>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5"><ModeToggle /></nav>
    </aside>
  );
};

// --------------------------------------------------------------------------------
// Ana Sayfa (Dashboard)
// --------------------------------------------------------------------------------
const HomePage = ({ stats }) => {
  const formatCurrency = (value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  return (
    <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Hoş Geldiniz!</h1>
        <p className="text-muted-foreground">Yönetim sisteminize genel bir bakış.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam Ciro</CardTitle><Euro className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div><p className="text-xs text-muted-foreground">Müşterilere atanan tüm ürünler</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Müşteriler</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.customerCount}</div><p className="text-xs text-muted-foreground">Toplam kayıtlı müşteri</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Atanan Toplam Ürün</CardTitle><Package2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalUniqueProducts}</div><p className="text-xs text-muted-foreground">Müşterilerdeki toplam ürün çeşidi</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Aktif Siparişler</CardTitle><Activity className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.activeOrders}</div><p className="text-xs text-muted-foreground">Toplam ürün atama sayısı</p></CardContent></Card>
        </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// Müşteriler Sayfası
// --------------------------------------------------------------------------------
const CustomersPage = ({ customers, setCustomers, assignments }) => {
  const [newCustomer, setNewCustomer] = useState({ name: "" });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const handleAddCustomer = () => { if (newCustomer.name.trim()) { setCustomers([...customers, { id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1, ...newCustomer }]); setNewCustomer({ name: "" }); setIsAddDialogOpen(false); toast.success("Yeni müşteri başarıyla eklendi!"); } else { toast.error("Lütfen müşteri adını girin."); } };
  const handleExport = () => { if (!selectedCustomer || !window.electronAPI) return; const assignedProducts = assignments[selectedCustomer.id] || []; toast.info("Excel dosyası oluşturuluyor..."); window.electronAPI.exportToExcel({ customerName: selectedCustomer.name, products: assignedProducts }); };
  const assignedProducts = selectedCustomer ? (assignments[selectedCustomer.id] || []) : [];
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Müşteriler</h1><Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Yeni Müşteri Ekle</Button></DialogTrigger><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>Yeni Müşteri Ekle</DialogTitle><DialogDescription>Yeni müşterinin adını ve soyadını girin.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">Ad Soyad</Label><Input id="name" value={newCustomer.name} onChange={(e) => setNewCustomer({ name: e.target.value })} className="col-span-3" /></div></div><DialogFooter><Button type="submit" onClick={handleAddCustomer}>Kaydet</Button></DialogFooter></DialogContent></Dialog></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{customers.map((customer) => (<Card key={customer.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedCustomer(customer)}><CardHeader><CardTitle className="flex items-center gap-2 py-4"><User className="h-5 w-5" />{customer.name}</CardTitle></CardHeader></Card>))}</div>
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{selectedCustomer?.name} - Atanmış Ürünler</DialogTitle><DialogDescription>Bu müşteriye atanmış ürünlerin listesi.</DialogDescription></DialogHeader>{assignedProducts.length > 0 ? (<Table><TableHeader><TableRow><TableHead>Ürün Adı</TableHead><TableHead>Kodu</TableHead><TableHead>Fiyat</TableHead></TableRow></TableHeader><TableBody>{assignedProducts.map(product => (<TableRow key={product.product_code}><TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} /><TableCell>{product.product_code}</TableCell><TableCell>{product.price_str}</TableCell></TableRow>))}</TableBody></Table>) : (<div className="flex flex-col items-center justify-center text-center py-10"><FileText className="h-12 w-12 text-muted-foreground" /><p className="mt-4 text-muted-foreground">Bu müşteriye henüz atanmış bir ürün bulunmuyor.</p></div>)}<DialogFooter><Button variant="outline" onClick={handleExport} disabled={assignedProducts.length === 0}><FileDown className="mr-2 h-4 w-4" /> Excel'e Aktar</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
// GÜNCELLEME: Bu bileşen artık state'leri prop olarak alıyor.
const SearchPage = ({
  customers,
  onAssignProducts,
  searchResults,
  isLoading,
  error,
  progress,
  handleSearch
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<ComparisonItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const onSearchClick = () => {
      handleSearch(searchTerm);
  };

  const handleSelectVariant = (variant: ComparisonItem, isSelected: boolean) => {
    setSelectedProducts(prev => isSelected ? [...prev, variant] : prev.filter(p => p.product_code !== variant.product_code));
  };

  const handleAssignToCustomer = () => {
    if (!selectedCustomer) { toast.error("Lütfen bir müşteri seçin."); return; }
    onAssignProducts(selectedCustomer, selectedProducts);
    const customerName = customers.find(c => c.id.toString() === selectedCustomer)?.name;
    toast.success(`${selectedProducts.length} ürün, ${customerName} adlı müşteriye atandı!`);
    setSelectedProducts([]);
    setSelectedCustomer(null);
    setIsAssignDialogOpen(false);
  };

  const progressValue = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
      <div className="flex gap-2 mb-4">
        <Input type="search" placeholder="Ürün adı veya kodu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearchClick()} disabled={isLoading}/>
        <Button onClick={onSearchClick} disabled={isLoading} className="w-28">{isLoading ? <LoaderCircle className="animate-spin" /> : "Ara"}</Button>
      </div>

      {isLoading && (
        <div className="my-4 p-4 border rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">
                    {progress.status === 'found_sigma' ? `Sigma'da ${progress.total} ürün bulundu, işleniyor...` : `Ürünler işleniyor...`}
                </p>
                <p className="text-sm text-muted-foreground">{progress.processed} / {progress.total}</p>
            </div>
            <Progress value={progressValue} className="w-full" />
        </div>
      )}

      {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Hata</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}

      {searchResults.length > 0 && (
          <Card>
              <CardHeader><CardTitle>Arama Sonuçları ({searchResults.length})</CardTitle></CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader><TableRow><TableHead>Sigma Ürün Adı</TableHead><TableHead>Ürün Kodu</TableHead><TableHead>CAS</TableHead><TableHead>Sigma Fiyatı</TableHead><TableHead>En Ucuz Netflex</TableHead><TableHead className="text-right">Detaylar</TableHead></TableRow></TableHeader>
                      {searchResults.map((product, index) => (
                      <Collapsible asChild key={product.product_number + index}>
                          <TableBody>
                          <TableRow>
                              <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                              <TableCell>{product.product_number}</TableCell>
                              <TableCell>{product.cas_number}</TableCell>
                              <TableCell>{product.sigma_price_str}</TableCell>
                              <TableCell>{product.cheapest_netflex_price_str}</TableCell>
                              <TableCell className="text-right"><CollapsibleTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="h-4 w-4" /></Button></CollapsibleTrigger></TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                              <tr>
                              <td colSpan={6} className="p-4 bg-muted/50 dark:bg-muted/20">
                                  <h4 className="font-semibold mb-2 ml-2">Karşılaştırma ve Atama Detayları</h4>
                                  <Table><TableHeader><TableRow><TableHead className="w-[50px]">Seç</TableHead><TableHead>Kaynak</TableHead><TableHead>Ürün Adı</TableHead><TableHead>Ürün Kodu</TableHead><TableHead>Fiyat</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                      {product.comparison.map((variant, vIndex) => (
                                          <TableRow key={vIndex}>
                                          <TableCell><Checkbox checked={selectedProducts.some(p => p.product_code === variant.product_code)} onCheckedChange={(checked) => handleSelectVariant(variant, !!checked)}/></TableCell>
                                          <TableCell>{variant.source}</TableCell>
                                          <TableCell dangerouslySetInnerHTML={{ __html: variant.product_name }} />
                                          <TableCell>{variant.product_code}</TableCell>
                                          <TableCell>{variant.price_str}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody></Table>
                              </td>
                              </tr>
                          </CollapsibleContent>
                          </TableBody>
                      </Collapsible>
                      ))}
                  </Table>
              </CardContent>
          </Card>
      )}

      {!isLoading && searchResults.length === 0 && progress.status === 'complete' && (
          <div className="text-center py-10"><FileText className="h-12 w-12 mx-auto text-muted-foreground" /><p className="mt-4 text-muted-foreground">Bu arama için sonuç bulunamadı.</p></div>
      )}

      {selectedProducts.length > 0 && (
         <div className="fixed bottom-4 right-4 z-20">
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}><DialogTrigger asChild><Button size="lg" className="shadow-lg"><UserPlus className="mr-2 h-4 w-4" />{selectedProducts.length} Ürünü Müşteriye Ata</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Müşteriye Ata</DialogTitle><DialogDescription>Seçili ürünleri atamak için bir müşteri seçin.</DialogDescription></DialogHeader><div className="py-4"><Select onValueChange={setSelectedCustomer}><SelectTrigger><SelectValue placeholder="Bir müşteri seçin..." /></SelectTrigger><SelectContent>{customers.map(customer => (<SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>))}</SelectContent></Select></div><Button onClick={handleAssignToCustomer} className="w-full">Atamayı Onayla</Button></DialogContent></Dialog>
         </div>
      )}
    </div>
  );
};


// --------------------------------------------------------------------------------
// Ana Uygulama Bileşeni (Router ve Layout)
// --------------------------------------------------------------------------------
export default function App() {
  const [page, setPage] = useState("home");
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState<{[key: string]: ComparisonItem[]}>({});
  const [dashboardStats, setDashboardStats] = useState({ totalRevenue: 0, customerCount: 0, totalUniqueProducts: 0, activeOrders: 0, });

  // GÜNCELLEME: Arama ile ilgili state'ler buraya taşındı.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [progress, setProgress] = useState({ status: 'idle', total: 0, processed: 0, message: '' });

  // GÜNCELLEME: Electron dinleyicileri artık App bileşeninde.
  useEffect(() => {
    window.electronAPI.onDatabaseResults((data) => {
      setSearchResults(data.results);
      setIsLoading(false);
      toast.success(`Veritabanında ${data.results.length} sonuç bulundu (${data.execution_time} saniye).`);
    });

    window.electronAPI.onProductFound((product) => {
      setSearchResults(prev => {
        if (prev.some(p => p.product_number === product.product_number)) {
          return prev;
        }
        return [...prev, product];
      });
    });

    window.electronAPI.onSearchProgress((progressData) => {
      setProgress(progressData);
    });

    window.electronAPI.onSearchComplete((summary) => {
      setIsLoading(false);
      setProgress(prev => ({ ...prev, status: 'complete' }));
      toast.success(`Arama tamamlandı! ${summary.total_found} eşleşme bulundu (${summary.execution_time} saniye).`);
    });

    window.electronAPI.onSearchError((errorMessage) => {
      setError(errorMessage);
      setIsLoading(false);
      setProgress({ status: 'error', total: 0, processed: 0, message: '' });
    });

    // Excel dinleyicisi
    if (window.electronAPI?.onExportResult) {
      const removeListener = window.electronAPI.onExportResult((result) => {
        if (result.status === 'success') {
          toast.success(`Excel dosyası kaydedildi: ${result.path}`);
        } else {
          toast.error(`Excel hatası: ${result.message}`);
        }
      });
      // Bu listener'ın temizlenmesi gerekebilir, ancak şimdilik bırakıyoruz.
    }
  }, []);

  useEffect(() => {
    let revenue = 0;
    let productCount = 0;
    const uniqueProducts = new Set<string>();
    Object.values(assignments).forEach(productList => {
      productCount += productList.length;
      productList.forEach(product => {
        uniqueProducts.add(product.product_code);
        if (product.price_numeric) {
          revenue += product.price_numeric;
        } else if (product.price_str) {
          const priceMatch = product.price_str.match(/[\d.,]+/);
          if (priceMatch) {
            const cleanedPrice = priceMatch[0].replace(/\./g, '').replace(',', '.');
            revenue += parseFloat(cleanedPrice) || 0;
          }
        }
      });
    });
    setDashboardStats({
      totalRevenue: revenue,
      customerCount: customers.length,
      totalUniqueProducts: uniqueProducts.size,
      activeOrders: productCount,
    });
  }, [assignments, customers]);

  const handleAssignProducts = (customerId, products: ComparisonItem[]) => {
    setAssignments(prev => {
      const currentAssigned = prev[customerId] || [];
      const newProducts = products.filter(p => !currentAssigned.some(ap => ap.product_code === p.product_code));
      return { ...prev, [customerId]: [...currentAssigned, ...newProducts] };
    });
  };

  // GÜNCELLEME: Arama başlatma fonksiyonu artık App bileşeninde.
  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || isLoading) return;
    setIsLoading(true);
    setSearchResults([]);
    setError(null);
    setProgress({ status: 'searching', total: 0, processed: 0, message: 'Arama başlatılıyor...' });
    window.electronAPI.performSearch(searchTerm);
  };

  const renderPage = () => {
    switch (page) {
      case "search":
        return <SearchPage
                  customers={customers}
                  onAssignProducts={handleAssignProducts}
                  searchResults={searchResults}
                  isLoading={isLoading}
                  error={error}
                  progress={progress}
                  handleSearch={handleSearch}
                />;
      case "customers":
        return <CustomersPage
                  customers={customers}
                  setCustomers={setCustomers}
                  assignments={assignments}
                />;
      case "home":
      default:
        return <HomePage stats={dashboardStats} />;
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
          <Sidebar setPage={setPage} currentPage={page} />
          <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
            <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
          </div>
          <Toaster position="bottom-right" />
        </div>
    </ThemeProvider>
  );
}
