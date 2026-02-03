"use client"

import React from "react"
import {
  Search,
  Package2,
  Settings,
  User,
  FileSearch,
  TrendingUp,
  History,
  Calendar,
} from "lucide-react"
import { cn, Button, Tooltip } from "./ui"
import { NotificationBell } from "./NotificationBell"
import { ModeToggle } from "./ModeToggle"

export const Sidebar = ({ setPage, currentPage, notifications, onToggleComplete, onGoToDate, updateStatus }: any) => {
  const navItems = [
    { name: "home", href: "#", icon: User, label: "Müşteri Listesi" },
    { name: "search", href: "#", icon: Search, label: "Ürün Arama" },
    { name: "batch-search", href: "#", icon: FileSearch, label: "Toplu Proforma Arama" },
    { name: "frequent-searches", href: "#", icon: TrendingUp, label: "Sık Aratılanlar" },
    { name: "search-history", href: "#", icon: History, label: "Arama Geçmişi" },
    { name: "calendar", href: "#", icon: Calendar, label: "Ajanda" },
    {
      name: "settings",
      href: "#",
      icon: Settings,
      label: "Ayarlar",
      notification: updateStatus === "ready_to_install",
    },
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col border-r bg-background sm:flex dark:border-[#393937]">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <div className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base">
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">NPC-AI ERP</span>
        </div>

        {navItems.map((item) => (
          <Tooltip key={item.name} content={item.label} side="right">
            <a
              href={item.href}
              onClick={(e) => {
                e.preventDefault()
                setPage(item.name)
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                { "bg-accent text-accent-foreground": currentPage === item.name },
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="sr-only">{item.label}</span>
              {item.notification && (
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
              )}
            </a>
          </Tooltip>
        ))}
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <NotificationBell
          side="right"
          notifications={notifications}
          onToggleComplete={onToggleComplete}
          onGoToDate={onGoToDate}
        />

        <Tooltip content="Temayı Değiştir" side="right">
          <ModeToggle />
        </Tooltip>
      </nav>
    </aside>
  )
}
