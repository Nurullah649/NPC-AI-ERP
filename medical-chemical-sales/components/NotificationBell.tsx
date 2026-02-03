"use client"

import React from "react"
import { Bell, Check } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui"

export const NotificationBell = ({ notifications, onToggleComplete, onGoToDate, side = "bottom" }: any) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-transparent">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
          )}
          <span className="sr-only">Bildirimler</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-96" side={side}>
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Bugünün Bildirimleri</span>
          <span className="text-xs font-normal text-muted-foreground">({notifications.length} adet)</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {notifications.length > 0 ? (
            notifications.map((notif: any) => (
              <div key={notif.id} className="p-2 text-sm border-b last:border-b-0">
                <p className="font-semibold">{notif.companyName}</p>
                {notif.meetingNotes && <p className="text-muted-foreground text-xs py-1">{notif.meetingNotes}</p>}
                <p className="text-xs text-muted-foreground">
                  Görüşme Tarihi: {new Date(notif.parentNoteDate + "T00:00:00").toLocaleDateString("tr-TR")}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => onGoToDate(notif.parentNoteDate)}
                  >
                    Tarihe Git
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-xs h-7 bg-transparent"
                    onClick={() => onToggleComplete(notif.parentNoteDate, notif.id)}
                  >
                    <Check className="h-3 w-3 mr-1" /> Tamamlandı
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">Bugün için bildirim yok.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
