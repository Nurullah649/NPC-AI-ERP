"use client"

import React, { useEffect, useState } from "react"
import { FileDown, FileText, Trash2 } from "lucide-react"

import { useAppContext } from "../../context/AppContext"
import { AssignmentItem } from "../../types"
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from "../../components/ui"

export const CustomerPage = () => {
  const { assignments, setAssignments, toast } = useAppContext()
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [exportCustomerName, setExportCustomerName] = useState("")
  const [selectedForDeletion, setSelectedForDeletion] = useState<AssignmentItem[]>([])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onGeneratePdfResult((result: any) => {
      if (result.status === "success") {
        toast("success", `PDF başarıyla oluşturuldu: ${result.path}`)
      } else {
        toast("error", `PDF oluşturulurken hata: ${result.message}`)
      }
    })
    return () => cleanup()
  }, [toast])

  const handleGeneratePdf = () => {
    if (!exportCustomerName.trim()) {
      toast("error", "Lütfen bir müşteri adı girin.")
      return
    }
    toast("info", "PDF teklifi oluşturuluyor...")
    window.electronAPI.generatePdf({ customerName: exportCustomerName, products: assignments })
    setIsPdfDialogOpen(false)
    setExportCustomerName("")
  }

  const handleDeleteAssignment = (productToRemove: AssignmentItem) => {
    setAssignments((prev: AssignmentItem[]) =>
      prev.filter(
        (p: AssignmentItem) =>
          !(p.product_code === productToRemove.product_code && p.source === productToRemove.source),
      ),
    )
    toast("warning", `'${productToRemove.product_name}' listeden kaldırıldı.`)
  }

  const handleBulkDelete = () => {
    setAssignments((prev: AssignmentItem[]) =>
      prev.filter(
        (p: AssignmentItem) =>
          !selectedForDeletion.some(
            (s) => s.product_code === p.product_code && s.source === p.source,
          ),
      ),
    )
    toast("error", `${selectedForDeletion.length} ürün listeden kaldırıldı.`)
    setSelectedForDeletion([])
  }

  const handleRowSelect = (product: AssignmentItem) => {
    setSelectedForDeletion((prev) => {
      const isSelected = prev.some(
        (p) => p.product_code === product.product_code && p.source === product.source,
      )
      if (isSelected) {
        return prev.filter(
          (p) => !(p.product_code === product.product_code && p.source === product.source),
        )
      }
      return [...prev, product]
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForDeletion(assignments)
    } else {
      setSelectedForDeletion([])
    }
  }

  const isAllSelected =
    assignments.length > 0 && selectedForDeletion.length === assignments.length

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Müşteri Listesi - Atanmış Ürünler</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={selectedForDeletion.length === 0}
          >
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
                <DialogDescription>
                  Dosya adında ve teklifte kullanılacak müşteri adını girin.
                </DialogDescription>
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
                <Button variant="outline" onClick={() => setIsPdfDialogOpen(false)}>
                  İptal
                </Button>
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
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Kodu</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead className="w-[50px] text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((product: AssignmentItem, index: number) => (
                  <TableRow key={`${product.product_code}-${index}`}>
                    <TableCell>
                      <Checkbox
                        onCheckedChange={() => handleRowSelect(product)}
                        checked={selectedForDeletion.some(
                          (p) =>
                            p.product_code === product.product_code && p.source === product.source,
                        )}
                      />
                    </TableCell>
                    <TableCell>{product.source}</TableCell>
                    <TableCell className="font-medium">{product.product_name}</TableCell>
                    <TableCell>{product.product_code}</TableCell>
                    <TableCell>{product.price_str}</TableCell>
                    <TableCell>{product.cheapest_netflex_stock ?? "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Tooltip content="Ürünü Sil" side="left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAssignment(product)}
                        >
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
  )
}
