"use client"

import React from "react"
import { motion } from "framer-motion"

import { useAppContext } from "../../context/AppContext"
import { Sidebar } from "../Sidebar"
import { BatchSearchPage } from "../views/BatchSearchPage"
import { CalendarPage } from "../views/CalendarPage"
import { FrequentlySearchedPage, SearchHistoryPage } from "../views/HistoryPage"
import { SearchPage } from "../views/SearchPage"
import { SettingsPage } from "../views/SettingsPage"
import { CustomerPage } from "./CustomerPage"
import { AssignmentItem, ProductResult } from "../../types"

export function MainApplication() {
  const {
    page,
    setPage,
    searchHistory,
    calendarNotes,
    setCalendarNotes,
    toast,
    appStatus,
    searchResults,
    isLoading,
    error,
    handleSearch,
    handleCancel,
    settings,
    setAssignments,
  } = useAppContext()
  const [filters, setFilters] = React.useState({
    brands: { sigma: true, tci: true, orkim: true, itk: true },
  })
  const [expandedProducts, setExpandedProducts] = React.useState<Set<string>>(new Set())
  const [batchState, setBatchState] = React.useState({
    pageState: "idle",
    filePath: null as string | null,
    fileName: null as string | null,
    customerName: "",
    searchProgress: { term: "", current: 0, total: 0, running: false },
    batchResults: new Map<string, ProductResult[]>(),
    expandedProducts: new Set<string>(),
    selectedForAssignment: [] as AssignmentItem[],
    selectedTerm: null as string | null,
  })

  const handleReSearch = (_term: string) => {
    setPage("search")
  }

  const handleShowHistoryAssignments = (_term: string) => {
    // TODO: Geçmiş atamaları gösterme davranışı burada genişletilebilir.
  }

  const notifications = React.useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    const todaysNotes = calendarNotes.find((n: any) => n.date === todayStr)
    if (!todaysNotes) return []
    return (
      (todaysNotes as any).meetings
        ?.filter((m: any) => !m.completed)
        .map((m: any) => ({ ...m, parentNoteDate: todayStr })) || []
    )
  }, [calendarNotes])

  const handleToggleComplete = (date: string, meetingId: string) => {
    const updatedNotes = [...calendarNotes]
    const noteIndex = updatedNotes.findIndex((n: any) => n.date === date)
    if (noteIndex === -1) return

    const note = updatedNotes[noteIndex]
    const meetingIndex = (note as any).meetings.findIndex((m: any) => m.id === meetingId)
    if (meetingIndex === -1) return

    ;(note as any).meetings[meetingIndex].completed = !(note as any).meetings[meetingIndex]
      .completed
    setCalendarNotes(updatedNotes)
    if (window.electronAPI) {
      window.electronAPI.saveCalendarNotes(updatedNotes)
    }
    toast("success", "Durum güncellendi.")
  }

  const handleGoToDate = (_date: string) => {
    setPage("calendar")
  }

  const handleAssignProducts = (products: AssignmentItem[]) => {
    setAssignments((prev: AssignmentItem[]) => {
      const existingKeys = new Set(prev.map((item) => `${item.source}:${item.product_code}`))
      const additions = products.filter((item) => !existingKeys.has(`${item.source}:${item.product_code}`))
      return [...prev, ...additions]
    })
    setPage("home")
  }

  const handleFilterChange = (_type: string, key: string, value: boolean) => {
    setFilters((prev) => ({
      ...prev,
      brands: { ...prev.brands, [key]: value },
    }))
  }

  const toggleProductExpansion = (productNumber: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productNumber)) {
        next.delete(productNumber)
      } else {
        next.add(productNumber)
      }
      return next
    })
  }

  const renderPage = () => {
    if (appStatus === "auth_error") return <SettingsPage authError />
    switch (page) {
      case "search":
        return (
          <SearchPage
            searchResults={searchResults}
            isLoading={isLoading}
            error={error}
            handleSearch={handleSearch}
            handleCancel={handleCancel}
            onAssignProducts={handleAssignProducts}
            settings={settings}
            initialSearchTerm={null}
            onSearchExecuted={() => {}}
            toast={toast}
            filters={filters}
            expandedProducts={expandedProducts}
            setExpandedProducts={setExpandedProducts}
            handleFilterChange={handleFilterChange}
            toggleProductExpansion={toggleProductExpansion}
          />
        )
      case "batch-search":
        return (
          <BatchSearchPage
            onAssignProducts={handleAssignProducts}
            settings={settings}
            batchState={batchState}
            setBatchState={setBatchState}
            toast={toast}
          />
        )
      case "frequent-searches":
        return (
          <FrequentlySearchedPage
            searchHistory={searchHistory}
            onReSearch={handleReSearch}
            onShowHistoryAssignments={handleShowHistoryAssignments}
          />
        )
      case "search-history":
        return (
          <SearchHistoryPage
            searchHistory={searchHistory}
            onReSearch={handleReSearch}
            onShowHistoryAssignments={handleShowHistoryAssignments}
          />
        )
      case "calendar":
        return (
          <CalendarPage
            calendarNotes={calendarNotes}
            setCalendarNotes={setCalendarNotes}
            toast={toast}
          />
        )
      case "settings":
        return <SettingsPage authError={false} />
      case "home":
      default:
        return <CustomerPage />
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <Sidebar
          setPage={setPage}
          currentPage={page}
          notifications={notifications}
          onToggleComplete={handleToggleComplete}
          onGoToDate={handleGoToDate}
          updateStatus={null}
        />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <main className="flex-1 items-start gap-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
        </div>
      </div>
    </motion.div>
  )
}
