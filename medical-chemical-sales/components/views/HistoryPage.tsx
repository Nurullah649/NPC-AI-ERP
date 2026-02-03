"use client"

import React, { useMemo, useState } from "react"
import { Search, FileText, TrendingUp, History } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Tooltip,

} from "../ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

export const FrequentlySearchedPage = ({ searchHistory, onReSearch, onShowHistoryAssignments }: any) => {
  const frequentSearches = useMemo(() => {
    const counts = new Map<string, number>()
    searchHistory.forEach((item: any) => {
      const term = item.term.trim()
      if (term) {
        counts.set(term, (counts.get(term) || 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 1000)
  }, [searchHistory])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">En Sık Aratılanlar</h1>
      <Card>
        <CardContent className="p-0">
          {frequentSearches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Sıra</TableHead>
                  <TableHead>Arama Terimi</TableHead>
                  <TableHead className="w-[150px]">Arama Sayısı</TableHead>
                  <TableHead className="w-[200px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frequentSearches.map((item, index) => (
                  <TableRow key={item.term}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{item.term}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip content="Atanmış Ürünleri Göster" side="left">
                          <Button variant="ghost" size="icon" onClick={() => onShowHistoryAssignments(item.term)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Button variant="outline" size="sm" onClick={() => onReSearch(item.term)}>
                          <Search className="mr-2 h-4 w-4" /> Tekrar Ara
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Henüz arama yapılmamış.</p>
              <p className="text-sm text-muted-foreground">Arama yaptıkça bu liste dolacaktır.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const SearchHistoryPage = ({ searchHistory, onReSearch, onShowHistoryAssignments }: any) => {
  const [filter, setFilter] = useState("monthly")

  const filteredHistory = useMemo(() => {
    const now = new Date()
    const oneDay = 24 * 60 * 60 * 1000
    const oneWeek = 7 * oneDay
    const oneMonth = 30 * oneDay
    const oneYear = 365 * oneDay

    return searchHistory
      .filter((item: any) => {
        const itemDate = new Date(item.timestamp)
        switch (filter) {
          case "daily":
            return now.getTime() - itemDate.getTime() < oneDay
          case "weekly":
            return now.getTime() - itemDate.getTime() < oneWeek
          case "monthly":
            return now.getTime() - itemDate.getTime() < oneMonth
          case "yearly":
            return now.getTime() - itemDate.getTime() < oneYear
          default:
            return true
        }
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
  }, [searchHistory, filter])

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Arama Geçmişi</h1>
        <div className="w-[200px]">
          <Select value={filter} onValueChange={(value) => setFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrele..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Son 24 Saat</SelectItem>
              <SelectItem value="weekly">Son 1 Hafta</SelectItem>
              <SelectItem value="monthly">Son 1 Ay</SelectItem>
              <SelectItem value="yearly">Son 1 Yıl</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {filteredHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arama Terimi</TableHead>
                  <TableHead className="w-[250px]">Tarih</TableHead>
                  <TableHead className="w-[200px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((item: any, index: any) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.term}</TableCell>
                    <TableCell>{new Date(item.timestamp).toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip content="Atanmış Ürünleri Göster" side="left">
                          <Button variant="ghost" size="icon" onClick={() => onShowHistoryAssignments(item.term)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Button variant="outline" size="sm" onClick={() => onReSearch(item.term)}>
                          <Search className="mr-2 h-4 w-4" /> Tekrar Ara
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Seçili filtre için geçmiş arama bulunamadı.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
