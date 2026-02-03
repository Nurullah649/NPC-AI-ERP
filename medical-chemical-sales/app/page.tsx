"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Check,
    XCircle,
    Info,
    Wrench,
    FileDown,
    Trash2,
    FileText
} from "lucide-react"

import { AppProvider, useAppContext } from "../context/AppContext"
import {
    cn,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    Input,
    Label,
    Checkbox,
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Tooltip,
} from "../components/ui"
import CustomSplashScreen from "../components/SplashScreen"
import { SearchPage } from "../components/views/SearchPage"
import { BatchSearchPage } from "../components/views/BatchSearchPage"
import { CalendarPage } from "../components/views/CalendarPage"
import { SettingsPage } from "../components/views/SettingsPage"
import { FrequentlySearchedPage, SearchHistoryPage } from "../components/views/HistoryPage"
import { Sidebar } from "../components/Sidebar"
import { ThemeProvider } from "../components/ModeToggle"
import { AssignmentItem } from "../types"

const CustomerPage = () => {
    const { assignments, setAssignments, toast } = useAppContext();
    const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
    const [exportCustomerName, setExportCustomerName] = useState("");
    const [selectedForDeletion, setSelectedForDeletion] = useState<AssignmentItem[]>([]);

    useEffect(() => {
        if (window.electronAPI) {
            const cleanup = window.electronAPI.onGeneratePdfResult((result: any) => {
                if (result.status === 'success') {
                    toast('success', `PDF başarıyla oluşturuldu: ${result.path}`);
                } else {
                    toast('error', `PDF oluşturulurken hata: ${result.message}`);
                }
            });
            return () => cleanup();
        }
    }, [toast]);

    const handleGeneratePdf = () => {
        if (!exportCustomerName.trim()) {
            toast("error", "Lütfen bir müşteri adı girin.");
            return;
        }
        toast("info", "PDF teklifi oluşturuluyor...");
        window.electronAPI.generatePdf({ customerName: exportCustomerName, products: assignments });
        setIsPdfDialogOpen(false);
        setExportCustomerName("");
    };

    const handleDeleteAssignment = (productToRemove: AssignmentItem) => {
        setAssignments((prev: any) =>
            prev.filter((p: any) => !(p.product_code === productToRemove.product_code && p.source === productToRemove.source)),
        )
        toast("warning", `'${productToRemove.product_name}' listeden kaldırıldı.`)
    }
    const handleBulkDelete = () => {
        setAssignments((prev: AssignmentItem[]) => prev.filter(p => !selectedForDeletion.some(s => s.product_code === p.product_code && s.source === p.source)));
        toast("error", `${selectedForDeletion.length} ürün listeden kaldırıldı.`);
        setSelectedForDeletion([]);
    }
    const handleRowSelect = (product: AssignmentItem) => {
        setSelectedForDeletion(prev => {
            const isSelected = prev.some(p => p.product_code === product.product_code && p.source === product.source);
            if (isSelected) {
                return prev.filter(p => !(p.product_code === product.product_code && p.source === product.source));
            } else {
                return [...prev, product];
            }
        });
    }
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedForDeletion(assignments);
        } else {
            setSelectedForDeletion([]);
        }
    }
    const isAllSelected = assignments.length > 0 && selectedForDeletion.length === assignments.length;


    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Müşteri Listesi - Atanmış Ürünler</h1>
                <div className="flex items-center gap-2">
                    <Button variant="destructive" onClick={handleBulkDelete} disabled={selectedForDeletion.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" /> Seçilenleri Sil ({selectedForDeletion.length})
                    </Button>
                    <Dialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={assignments.length === 0} onClick={() => setIsPdfDialogOpen(true)}>
                                <FileDown className="mr-2 h-4 w-4" /> PDF Olarak Aktar
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>PDF Teklifi Oluştur</DialogTitle>
                                <DialogDescription>Dosya adında ve teklifte kullanılacak müşteri adını girin.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="customerNamePdf">Müşteri Adı</Label>
                                <Input
                                    id="customerNamePdf"
                                    value={exportCustomerName}
                                    onChange={(e) => setExportCustomerName(e.target.value)}
                                    placeholder="Örn: Proje A Müşterisi"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsPdfDialogOpen(false)}>İptal</Button>
                                <Button onClick={handleGeneratePdf}>Onayla ve Oluştur</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <Card>
                <CardContent className="p-0">
                    {assignments.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"><Checkbox checked={isAllSelected} onCheckedChange={(checked) => handleSelectAll(!!checked)} /></TableHead>
                                    <TableHead>Kaynak</TableHead>
                                    <TableHead>Ürün Adı</TableHead>
                                    <TableHead>Kodu</TableHead>
                                    <TableHead>Fiyat</TableHead>
                                    <TableHead>Stok</TableHead>
                                    <TableHead className="w-[50px] text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assignments.map((product: any, index: any) => (
                                    <TableRow key={`${product.product_code}-${index}`}>
                                        <TableCell><Checkbox onCheckedChange={() => handleRowSelect(product)} checked={selectedForDeletion.some(p => p.product_code === product.product_code && p.source === product.source)} /></TableCell>
                                        <TableCell>{product.source}</TableCell>
                                        <TableCell className="font-medium">{product.product_name}</TableCell>
                                        <TableCell>{product.product_code}</TableCell>
                                        <TableCell>{product.price_str}</TableCell>
                                        <TableCell>{product.cheapest_netflex_stock ?? "N/A"}</TableCell>
                                        <TableCell className="text-right">
                                            <Tooltip content="Ürünü Sil" side="left">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(product)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <p className="mt-4 text-muted-foreground">Henüz atanmış bir ürün bulunmuyor.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


function MainApplication() {
    const {
        page,
        setPage,
        searchHistory,
        calendarNotes,
        setCalendarNotes,
        toast,
        appStatus,
    } = useAppContext();

    const handleReSearch = (term: string) => {
        setPage("search");
    };
    const handleShowHistoryAssignments = (term: string) => {
        // ...
    };

    // --- Notification Logic ---
    const notifications = React.useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const todaysNotes = calendarNotes.find((n: any) => n.date === todayStr);
        if (!todaysNotes) return [];
        return (todaysNotes as any).meetings
            ?.filter((m: any) => !m.completed)
            .map((m: any) => ({ ...m, parentNoteDate: todayStr })) || [];
    }, [calendarNotes]);

    const handleToggleComplete = (date: string, meetingId: string) => {
        const updatedNotes = [...calendarNotes];
        const noteIndex = updatedNotes.findIndex((n: any) => n.date === date);
        if (noteIndex === -1) return;

        const note = updatedNotes[noteIndex];
        const meetingIndex = (note as any).meetings.findIndex((m: any) => m.id === meetingId);
        if (meetingIndex === -1) return;

        (note as any).meetings[meetingIndex].completed = !(note as any).meetings[meetingIndex].completed;
        setCalendarNotes(updatedNotes);
        if (window.electronAPI) {
            window.electronAPI.saveCalendarNotes(updatedNotes);
        }
        toast("success", "Durum güncellendi.");
    };

    const handleGoToDate = (date: string) => {
        // CalendarPage will pick up the date if we could pass it, but for now just switching page
        // Ideally CalendarPage should listen to a context or we pass a prop.
        // Since CalendarPage manages its own state, we might need to lift that state up or use a hack.
        // For now, let's just switch to calendar.
        setPage("calendar");
        // Note: This won't automatically select the date in CalendarPage unless we lift the state.
        // Given the constraints, this prevents the crash but might not fully navigate to the date visually.
    };

    const renderPage = () => {
        if (appStatus === "auth_error") {
            return <SettingsPage authError={true} />;
        }
        switch (page) {
            case "search": return <SearchPage />;
            case "batch-search": return <BatchSearchPage />;
            case "frequent-searches": return <FrequentlySearchedPage searchHistory={searchHistory} onReSearch={handleReSearch} onShowHistoryAssignments={handleShowHistoryAssignments} />;
            case "search-history": return <SearchHistoryPage searchHistory={searchHistory} onReSearch={handleReSearch} onShowHistoryAssignments={handleShowHistoryAssignments} />;
            case "calendar": return <CalendarPage calendarNotes={calendarNotes} setCalendarNotes={setCalendarNotes} toast={toast} />;
            case "settings": return <SettingsPage authError={false} />;
            case "home":
            default: return <CustomerPage />;
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
                <Sidebar
                    setPage={setPage}
                    currentPage={page}
                    notifications={notifications}
                    onToggleComplete={handleToggleComplete}
                    onGoToDate={handleGoToDate}
                    updateStatus={null} // or fetch from context if available
                />
                <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
                    <main className="flex-1 items-start gap-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
                </div>
            </div>
        </motion.div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}

function AppContent() {
    const { appStatus, setAppStatus, toasts, setToasts, toast } = useAppContext();

    useEffect(() => {
        if (window.electronAPI) {
            // 1. Arayüzün hazır olduğunu ana işleme bildir. Bu sadece bir kez yapılır.
            window.electronAPI.rendererReady();

            // 2. Python servis durumlarını dinlemeye başla.
            const cleanupReady = window.electronAPI.onPythonReady(() => {
                console.log("Arayüz: 'onPythonReady' sinyali alındı. Durum 'ready' olarak ayarlanıyor.");
                setAppStatus("ready");
            });

            const cleanupError = window.electronAPI.onPythonError((error: string) => {
                console.error("Arayüz: 'onPythonError' sinyali alındı:", error);
                setAppStatus("error");
                toast('error', `Kritik Arka Plan Hatası: ${error || 'Bilinmeyen bir hata oluştu.'}`);
            });

            const cleanupAuthError = window.electronAPI.onAuthenticationError(() => {
                console.error("Arayüz: 'onAuthenticationError' sinyali alındı.");
                setAppStatus("auth_error");
            });

            const cleanupInitialSetup = window.electronAPI.onInitialSetupRequired(() => {
                console.log("Arayüz: 'onInitialSetupRequired' sinyali alındı. Kurulum gerekli.");
                setAppStatus("setup_required");
            });

            // Bileşen kaldırıldığında tüm dinleyicileri temizle
            return () => {
                cleanupReady();
                cleanupError();
                cleanupAuthError();
                cleanupInitialSetup();
            };
        }
    }, [setAppStatus, toast]);

    const renderContent = () => {
        switch (appStatus) {
            case "initializing": return <CustomSplashScreen key="splash" hasError={false} updateState={{}} />;
            case "setup_required": return <SettingsPage authError={false} />;
            case "ready":
                return <MainApplication key="main_app" />;
            case "auth_error":
                return <SettingsPage authError={true} />;
            case "error": return <CustomSplashScreen key="splash-error" hasError={true} updateState={{}} />;
            default: return <CustomSplashScreen key="splash-default" hasError={false} updateState={{}} />;
        }
    };

    return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <style>{`/* ... CSS ... */`}</style>
            <AnimatePresence mode="wait">
                <motion.div key={appStatus} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                    {renderContent()}
                </motion.div>
            </AnimatePresence>
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                {toasts.map(({ id, type, message, action }: any) => (
                    <motion.div key={id} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
                        className={cn("text-white p-4 rounded-lg shadow-lg flex items-center justify-between gap-4", { "bg-green-600": type === "success", "bg-red-600": type === "error" })}>
                        <div className="flex items-center gap-3"><Info className="h-5 w-5" /><span>{message}</span></div>
                        {action ? action : <button onClick={() => setToasts((prev: any) => prev.filter((t: any) => t.id !== id))}>×</button>}
                    </motion.div>
                ))}
            </div>
        </ThemeProvider>
    );
}
