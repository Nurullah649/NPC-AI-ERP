"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, LoaderCircle, Moon, Sun, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Python'dan gelen veriler için TypeScript tipleri
interface ComparisonItem {
  source: string;
  product_name: string;
  product_code: string;
  price_numeric: number | null;
  price_str: string;
}

// ProductResult arayüzü CAS numarası içerecek şekilde güncellendi
interface ProductResult {
  product_name: string;
  product_number: string;
  cas_number: string; // YENİ EKLENDİ
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

export default function DashboardPage() {
  const { setTheme, theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ScriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.onResults((data) => {
      console.log("Sonuçlar arayüze ulaştı:", data);
      setResults(data);
      setIsLoading(false);
    });

    window.electronAPI.onSearchError((errorMessage) => {
      console.error("Hata arayüze ulaştı:", errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    });
  }, []);

  const handleSearch = () => {
    if (!searchTerm.trim() || isLoading) return;
    
    setIsLoading(true);
    setResults(null);
    setError(null);
    
    console.log(`Arama sinyali gönderiliyor: ${searchTerm}`);
    window.electronAPI.performSearch(searchTerm);
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="grid gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>Kimyasal Fiyat Karşılaştırma</CardTitle>
                    <CardDescription>
                      Aramak istediğiniz ürünün adını veya kodunu girin.
                    </CardDescription>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    aria-label="Toggle theme"
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex w-full max-w-lg items-center space-x-2">
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
          </CardContent>
        </Card>

        {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Hata</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        
        {results && (
            <>
                <div className="text-center text-sm text-muted-foreground">
                    Arama {results.results.length} sonuç için {results.execution_time} saniyede tamamlandı.
                </div>
                <Card>
                    <CardHeader>
                    <CardTitle>Arama Sonuçları</CardTitle>
                    </CardHeader>
                    <CardContent>
                    {results.results.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead className="w-[35%]">Sigma Ürün Adı</TableHead>
                                <TableHead>Ürün Kodu</TableHead>
                                <TableHead>CAS Numarası</TableHead> 
                                <TableHead>Sigma Fiyatı</TableHead>
                                <TableHead>En Ucuz Netflex Fiyatı</TableHead>
                                <TableHead className="text-right">Detaylar</TableHead>
                                </TableRow>
                            </TableHeader>
                            {results.results.map((product, index) => (
                            <Collapsible asChild key={index}>
                                <tbody>
                                <TableRow>
                                    
                                    <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                                    <TableCell>{product.product_number}</TableCell>
                                    <TableCell>{product.cas_number}</TableCell>
                                    <TableCell>{product.sigma_price_str}</TableCell>
                                    <TableCell>{product.cheapest_netflex_price_str}</TableCell>
                                    <TableCell className="text-right">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                        <ChevronsUpDown className="h-4 w-4" />
                                        </Button>
                                    </CollapsibleTrigger>
                                    </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                    <tr>
                                    
                                    <td colSpan={6} className="p-4 bg-muted/50 dark:bg-muted/20">
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
                                </tbody>
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
      </div>
    </main>
  );
}
