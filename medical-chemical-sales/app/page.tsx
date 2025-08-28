"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { Home, Search, Users, Package2, DollarSign, Activity, PlusCircle, User, SearchIcon, UserPlus, FileText, ChevronDown, Moon, Sun, LoaderCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils"; // Bu fonksiyonun projenizde tanımlı olduğunu varsayıyoruz.
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// --------------------------------------------------------------------------------
// Electron API ve Veri Tipleri
// --------------------------------------------------------------------------------

// Python'dan gelen veriler için TypeScript tipleri
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

interface ScriptResult {
    results: ProductResult[];
    execution_time: number;
}

// preload.js dosyasındaki API'nin tipini tanımlıyoruz
declare global {
  interface Window {
    electronAPI: {
      performSearch: (searchTerm: string) => void;
      onResults: (callback: (data: ScriptResult) => void) => void;
      onSearchError: (callback: (error: string) => void) => void;
    };
  }
}


// --------------------------------------------------------------------------------
// Tema Sağlayıcısı (ThemeProvider)
// --------------------------------------------------------------------------------
const ThemeProviderContext = createContext({
  theme: "system",
  setTheme: (theme) => {},
});

const ThemeProvider = ({ children, defaultTheme = "system", storageKey = "vite-ui-theme" }) => {
  const [theme, setTheme] = useState(defaultTheme);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
      setIsMounted(true);
      const storedTheme = localStorage.getItem(storageKey) || defaultTheme;
      setTheme(storedTheme);
  }, []);


  useEffect(() => {
    if (!isMounted) return;

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme, isMounted]);

  const value = {
    theme,
    setTheme: (newTheme) => {
      if (!isMounted) return;
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  if (!isMounted) {
    return null;
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// --------------------------------------------------------------------------------
// Tema Değiştirme Düğmesi
// --------------------------------------------------------------------------------
const ModeToggle = () => {
    const { theme, setTheme } = useTheme();

    return (
        <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Temayı değiştir</span>
        </Button>
    );
}


// --------------------------------------------------------------------------------
// Sidebar Bileşeni
// --------------------------------------------------------------------------------
const Sidebar = ({ setPage, currentPage }) => {
  const navItems = [
    { name: "home", href: "#", icon: Home, label: "Ana Sayfa" },
    { name: "search", href: "#", icon: Search, label: "Ürün Arama" },
    { name: "customers", href: "#", icon: Users, label: "Müşteriler" },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <a
          href="#"
          onClick={() => setPage("home")}
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Tales Job</span>
        </a>
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(item.name);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                    {
                      "bg-accent text-accent-foreground": currentPage === item.name,
                    }
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <ModeToggle />
      </nav>
    </aside>
  );
};

// --------------------------------------------------------------------------------
// Ana Sayfa (Dashboard)
// --------------------------------------------------------------------------------
const HomePage = ({ customerCount }) => {
  return (
    <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Hoş Geldiniz!</h1>
        <p className="text-muted-foreground">
            Depo Yönetim Sisteminize genel bir bakış.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Ciro</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₺45,231.89</div>
                    <p className="text-xs text-muted-foreground">Geçen aydan +%20.1</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Müşteriler</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{customerCount}</div>
                    <p className="text-xs text-muted-foreground">Toplam kayıtlı müşteri</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Ürün</CardTitle>
                    <Package2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+12,234</div>
                    <p className="text-xs text-muted-foreground">Stoktaki ürün çeşidi</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Aktif Siparişler</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+573</div>
                    <p className="text-xs text-muted-foreground">Hazırlanmakta olan siparişler</p>
                </CardContent>
            </Card>
        </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// Müşteriler Sayfası
// --------------------------------------------------------------------------------
const CustomersPage = ({ customers, setCustomers, assignments, allFoundProducts }) => {
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const handleAddCustomer = () => {
    if (newCustomer.name && newCustomer.email) {
      setCustomers([...customers, { id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1, ...newCustomer }]);
      setNewCustomer({ name: "", email: "", phone: "" });
      setIsAddDialogOpen(false);
      toast.success("Yeni müşteri başarıyla eklendi!");
    } else {
      toast.error("Lütfen müşteri adı ve e-posta alanlarını doldurun.");
    }
  };

  const getProductDetails = (productId) => {
    return allFoundProducts.find(p => p.product_number === productId) || null;
  };

  const assignedProducts = selectedCustomer ?
    (assignments[selectedCustomer.id] || []).map(getProductDetails).filter(Boolean) : [];

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Müşteriler</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Yeni Müşteri Ekle</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
              <DialogDescription>Yeni müşteri bilgilerini girin.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">İsim</Label>
                <Input id="name" value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">E-posta</Label>
                <Input id="email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Telefon</Label>
                <Input id="phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} className="col-span-3" />
              </div>
            </div>
            <DialogFooter><Button type="submit" onClick={handleAddCustomer}>Kaydet</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => (
          <Card key={customer.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedCustomer(customer)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />{customer.name}</CardTitle>
              <CardDescription>{customer.email}</CardDescription>
            </CardHeader>
            <CardContent><p>{customer.phone}</p></CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{selectedCustomer?.name} - Sipariş Dosyaları</DialogTitle>
                <DialogDescription>Bu müşteriye atanmış olan ürünlerin listesi.</DialogDescription>
            </DialogHeader>
            {assignedProducts.length > 0 ? (
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ürün Adı</TableHead>
                            <TableHead>Kodu</TableHead>
                            <TableHead>En Ucuz Netflex Fiyatı</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assignedProducts.map(product => (
                            <TableRow key={product.product_number}>
                                <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                                <TableCell>{product.product_number}</TableCell>
                                <TableCell>{product.cheapest_netflex_price_str}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="flex flex-col items-center justify-center text-center py-10">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Bu müşteriye henüz atanmış bir ürün bulunmuyor.</p>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
const SearchPage = ({ customers, onAssignProducts, searchResults, setSearchResults, allFoundProducts, setAllFoundProducts }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  useEffect(() => {
    const removeResultsListener = window.electronAPI.onResults((data) => {
      console.log("Sonuçlar arayüze ulaştı:", data);
      setSearchResults(data);
      setAllFoundProducts(prevProducts => {
          const newProducts = data.results.filter(p => !prevProducts.some(fp => fp.product_number === p.product_number));
          return [...prevProducts, ...newProducts];
      });
      setIsLoading(false);
    });

    const removeErrorListener = window.electronAPI.onSearchError((errorMessage) => {
      console.error("Hata arayüze ulaştı:", errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    });

  }, [setSearchResults, setAllFoundProducts]);

  const handleSearch = () => {
    if (!searchTerm.trim() || isLoading) return;
    setIsLoading(true);
    setSearchResults(null);
    setError(null);
    console.log(`Arama sinyali gönderiliyor: ${searchTerm}`);
    window.electronAPI.performSearch(searchTerm);
  };

  const handleSelectProduct = (productId) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const handleAssignToCustomer = () => {
    if (!selectedCustomer) {
        toast.error("Lütfen bir müşteri seçin.");
        return;
    }
    onAssignProducts(selectedCustomer, Array.from(selectedProducts));
    const customerName = customers.find(c => c.id.toString() === selectedCustomer)?.name;
    toast.success(`${selectedProducts.size} ürün, ${customerName} adlı müşteriye başarıyla atandı!`);
    setSelectedProducts(new Set());
    setSelectedCustomer(null);
    setIsAssignDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
      <div className="flex gap-2 mb-4">
        <Input
          type="search"
          placeholder="Ürün adı veya kodu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          disabled={isLoading}
        />
        <Button onClick={handleSearch} disabled={isLoading} className="w-28">
          {isLoading ? <LoaderCircle className="animate-spin" /> : "Ara"}
        </Button>
      </div>

      {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hata</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      {searchResults && (
          <>
              <div className="text-center text-sm text-muted-foreground my-4">
                  Arama {searchResults.results.length} sonuç için {searchResults.execution_time.toFixed(2)} saniyede tamamlandı.
              </div>
              <Card>
                  <CardHeader>
                  <CardTitle>Arama Sonuçları</CardTitle>
                  </CardHeader>
                  <CardContent>
                  {searchResults.results.length > 0 ? (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">Seç</TableHead>
                                <TableHead>Sigma Ürün Adı</TableHead>
                                <TableHead>Ürün Kodu</TableHead>
                                <TableHead>CAS Numarası</TableHead>
                                <TableHead>Sigma Fiyatı</TableHead>
                                <TableHead>En Ucuz Netflex Fiyatı</TableHead>
                                <TableHead className="text-right">Detaylar</TableHead>
                              </TableRow>
                          </TableHeader>
                          {searchResults.results.map((product, index) => (
                          <Collapsible asChild key={index}>
                              <TableBody>
                              <TableRow>
                                  <TableCell><Checkbox checked={selectedProducts.has(product.product_number)} onCheckedChange={() => handleSelectProduct(product.product_number)}/></TableCell>
                                  <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                                  <TableCell>{product.product_number}</TableCell>
                                  <TableCell>{product.cas_number}</TableCell>
                                  <TableCell>{product.sigma_price_str}</TableCell>
                                  <TableCell>{product.cheapest_netflex_price_str}</TableCell>
                                  <TableCell className="text-right">
                                  <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <ChevronDown className="h-4 w-4" />
                                      </Button>
                                  </CollapsibleTrigger>
                                  </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                  <tr>
                                  <td colSpan={7} className="p-4 bg-muted/50 dark:bg-muted/20">
                                      <h4 className="font-semibold mb-2 ml-2">Karşılaştırma Detayları</h4>
                                      <Table>
                                      <TableHeader>
                                          <TableRow>
                                          <TableHead>Kaynak</TableHead>
                                          <TableHead>Ürün Adı</TableHead>
                                          <TableHead>Ürün Kodu</TableHead>
                                          <TableHead>Fiyat</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {product.comparison.map((variant, vIndex) => (
                                              <TableRow key={vIndex}>
                                              <TableCell>{variant.source}</TableCell>
                                              <TableCell dangerouslySetInnerHTML={{ __html: variant.product_name }} />
                                              <TableCell>{variant.product_code}</TableCell>
                                              <TableCell>{variant.price_str}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                      </Table>
                                  </td>
                                  </tr>
                              </CollapsibleContent>
                              </TableBody>
                          </Collapsible>
                          ))}
                      </Table>
                  ) : (
                      <p className="text-muted-foreground">Bu arama için sonuç bulunamadı.</p>
                  )}
                  </CardContent>
              </Card>
          </>
      )}

      {selectedProducts.size > 0 && (
         <div className="mt-4">
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" />{selectedProducts.size} Ürünü Müşteriye Ata</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Müşteriye Ata</DialogTitle>
                        <DialogDescription>Seçili ürünleri atamak için bir müşteri seçin.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select onValueChange={setSelectedCustomer}>
                            <SelectTrigger><SelectValue placeholder="Bir müşteri seçin..." /></SelectTrigger>
                            <SelectContent>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAssignToCustomer} className="w-full">Atamayı Onayla</Button>
                </DialogContent>
            </Dialog>
         </div>
      )}
    </div>
  );
};


// --------------------------------------------------------------------------------
// Ana Uygulama Bileşeni (Router ve Layout)
// --------------------------------------------------------------------------------
export default function App() {
  const [page, setPage] = useState("home"); // 'home', 'search', 'customers'

  // DÜZENLEME: Başlangıçta müşteri listesi boş.
  const [customers, setCustomers] = useState([]);

  // DÜZENLEME: Başlangıçta atama listesi boş.
  const [assignments, setAssignments] = useState({});

  const [searchResults, setSearchResults] = useState(null);
  const [allFoundProducts, setAllFoundProducts] = useState([]);

  const handleAssignProducts = (customerId, productIds) => {
    setAssignments(prevAssignments => {
        const currentAssigned = prevAssignments[customerId] || [];
        const newAssigned = [...new Set([...currentAssigned, ...productIds])]; // Tekrarları önle
        return {
            ...prevAssignments,
            [customerId]: newAssigned
        };
    });
  };

  const renderPage = () => {
    switch (page) {
      case "search":
        return <SearchPage
                    customers={customers}
                    onAssignProducts={handleAssignProducts}
                    searchResults={searchResults}
                    setSearchResults={setSearchResults}
                    allFoundProducts={allFoundProducts}
                    setAllFoundProducts={setAllFoundProducts}
                />;
      case "customers":
        return <CustomersPage
                    customers={customers}
                    setCustomers={setCustomers}
                    assignments={assignments}
                    allFoundProducts={allFoundProducts}
                />;
      case "home":
      default:
        return <HomePage customerCount={customers.length} />;
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
          <Sidebar setPage={setPage} currentPage={page} />
          <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
            <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
              {renderPage()}
            </main>
          </div>
          <Toaster />
        </div>
    </ThemeProvider>
  );
}
