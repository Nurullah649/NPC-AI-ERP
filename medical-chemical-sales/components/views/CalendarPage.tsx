"use client"

import React, { useState, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Save,
  Trash2,
  Check,
  X,
  Users,
  Briefcase,
  Mail,
  Phone,
  Clock,
  FileDown,
  Calendar,
} from "lucide-react"
import {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui"
import { CalendarNote, Meeting } from "../../types"

export const CalendarPage = ({ calendarNotes, setCalendarNotes, toast }: any) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isAddingMeeting, setIsAddingMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState({
    type: "görüşme" as "görüşme" | "toplantı",
    companyName: "",
    authorizedPerson: "",
    department: "",
    email: "",
    phone: "",
    meetingNotes: "",
    nextMeetingDate: "",
    priority: "medium" as "low" | "medium" | "high",
    notificationFrequency: "for_3_days",
    notificationDailyFrequency: "once" as "once" | "twice" | "thrice" | "five_times" | "ten_times" | "hourly",
  })
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportDates, setExportDates] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
  })

  useEffect(() => {
    if (selectedDate) {
      const existingNote = calendarNotes.find((n: any) => n.date === selectedDate)
      if (existingNote) {
        setMeetings((existingNote as any).meetings)
      } else {
        setMeetings([])
      }
    }
  }, [selectedDate, calendarNotes])

  useEffect(() => {
    if (newMeeting.type === "görüşme") {
      setNewMeeting((prev) => ({ ...prev, notificationFrequency: "for_3_days" }))
    } else {
      setNewMeeting((prev) => ({ ...prev, notificationFrequency: "1_day_before" }))
    }
  }, [newMeeting.type])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7
    const days: (number | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(dateStr)
  }

  const handleSaveDay = () => {
    if (!selectedDate) return
    const updatedNotes = [...calendarNotes]
    const existingIndex = updatedNotes.findIndex((n: any) => n.date === selectedDate)

    const noteOnThisDate = calendarNotes.find((n: any) => n.date === selectedDate)
    const otherNotes = noteOnThisDate ? (noteOnThisDate as any).note : ""

    const noteData: CalendarNote = {
      id: existingIndex >= 0 ? (updatedNotes[existingIndex] as any).id : Date.now().toString(),
      date: selectedDate,
      note: otherNotes,
      meetings: meetings,
    }
    if (existingIndex >= 0) {
      updatedNotes[existingIndex] = noteData
    } else {
      updatedNotes.push(noteData)
    }
    setCalendarNotes(updatedNotes)
    if (window.electronAPI) {
      window.electronAPI.saveCalendarNotes(updatedNotes)
    }
    toast("success", "Gün kaydedildi!")
  }

  const handleAddMeeting = () => {
    if (!selectedDate) {
      toast("error", "Lütfen önce bir gün seçin!")
      return
    }
    if (!newMeeting.companyName.trim()) {
      toast("error", "Lütfen firma adı girin!")
      return
    }
    const meeting: Meeting = {
      id: Date.now().toString(),
      ...newMeeting,
      nextMeetingDate: newMeeting.type === "görüşme" ? selectedDate : newMeeting.nextMeetingDate || null,
      completed: false,
    }
    setMeetings([...meetings, meeting])
    setNewMeeting({
      type: "görüşme",
      companyName: "",
      authorizedPerson: "",
      department: "",
      email: "",
      phone: "",
      meetingNotes: "",
      nextMeetingDate: "",
      priority: "medium",
      notificationFrequency: "for_3_days",
      notificationDailyFrequency: "once",
    })
    setIsAddingMeeting(false)
  }

  const handleDeleteMeeting = (meetingId: string) => {
    setMeetings(meetings.filter((m) => m.id !== meetingId))
  }

  const handleToggleMeetingComplete = (meetingId: string) => {
    setMeetings(meetings.map((m) => (m.id === meetingId ? { ...m, completed: !m.completed } : m)))
  }

  const handleExportMeetings = () => {
    if (!exportDates.startDate || !exportDates.endDate) {
      toast("error", "Lütfen başlangıç ve bitiş tarihlerini seçin.")
      return
    }
    toast("info", "Görüşmeler Excel'e aktarılıyor...")
    window.electronAPI.exportMeetings({
      notes: calendarNotes,
      startDate: exportDates.startDate,
      endDate: exportDates.endDate,
    })
    setIsExportDialogOpen(false)
  }

  const hasEventsOnDate = (dateStr: string) => {
    const note = calendarNotes.find((n: any) => n.date === dateStr)
    return note && (note as any).meetings.length > 0
  }

  const hasUpcomingMeetingOnDate = (dateStr: string) => {
    const note = calendarNotes.find((n: any) => n.date === dateStr)
    if (note) {
      return (note as any).meetings.some((m: any) => !m.completed)
    }
    return calendarNotes.some((n: any) => n.meetings.some((m: any) => m.nextMeetingDate === dateStr && !m.completed))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-50 dark:bg-red-950"
      case "medium":
        return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950"
      case "low":
        return "text-green-500 bg-green-50 dark:bg-green-950"
      default:
        return "text-gray-500 bg-gray-50 dark:bg-gray-950"
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Yüksek"
      case "medium":
        return "Orta"
      case "low":
        return "Düşük"
      default:
        return "Orta"
    }
  }

  const days = getDaysInMonth(currentDate)
  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ]
  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dijital Ajanda</h1>
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" /> Raporu Dışa Aktar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Görüşme Raporunu Dışa Aktar</DialogTitle>
              <DialogDescription>Rapor oluşturmak için lütfen bir başlangıç ve bitiş tarihi seçin.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={exportDates.startDate}
                  onChange={(e) => setExportDates({ ...exportDates, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Bitiş Tarihi</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={exportDates.endDate}
                  onChange={(e) => setExportDates({ ...exportDates, endDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleExportMeetings}>Excel Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} />
                }
                const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
                const isSelected = selectedDate === dateStr
                const isToday =
                  dateStr === formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                const hasEvent = hasEventsOnDate(dateStr)
                const hasUpcoming = hasUpcomingMeetingOnDate(dateStr)
                return (
                  <Button
                    key={day}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-20 p-1 relative flex flex-col justify-start items-start",
                      isToday && !isSelected && "border-primary border-2",
                      hasEvent && "font-bold",
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    <span>{day}</span>
                    {hasEvent && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                    {hasUpcoming && <div className="absolute top-1.5 right-1.5 h-3 w-3 text-orange-500" />}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Bir tarih seçin"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDate ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Etkinlikler</Label>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingMeeting(!isAddingMeeting)}>
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Ekle
                    </Button>
                  </div>

                  {isAddingMeeting && (
                    <Card className="p-4 space-y-4">
                      <Select
                        value={newMeeting.type}
                        onValueChange={(value) => setNewMeeting({ ...newMeeting, type: value as any })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="görüşme">Görüşme</SelectItem>
                          <SelectItem value="toplantı">Toplantı</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Firma Adı"
                        value={newMeeting.companyName}
                        onChange={(e) => setNewMeeting({ ...newMeeting, companyName: e.target.value })}
                      />
                      <Input
                        placeholder="Yetkili Kişi"
                        value={newMeeting.authorizedPerson}
                        onChange={(e) => setNewMeeting({ ...newMeeting, authorizedPerson: e.target.value })}
                      />
                      <Input
                        placeholder="Departman"
                        value={newMeeting.department}
                        onChange={(e) => setNewMeeting({ ...newMeeting, department: e.target.value })}
                      />
                      <Input
                        placeholder="E-mail Adresi"
                        value={newMeeting.email}
                        onChange={(e) => setNewMeeting({ ...newMeeting, email: e.target.value })}
                      />
                      <Input
                        placeholder="Telefon"
                        value={newMeeting.phone}
                        onChange={(e) => setNewMeeting({ ...newMeeting, phone: e.target.value })}
                      />
                      <textarea
                        className="w-full min-h-[60px] p-2 border rounded-md bg-background text-sm"
                        placeholder="Açıklama / Notlar"
                        value={newMeeting.meetingNotes}
                        onChange={(e) => setNewMeeting({ ...newMeeting, meetingNotes: e.target.value })}
                      />

                      {newMeeting.type === "toplantı" && (
                        <div className="space-y-2">
                          <Label>Toplantı Tarihi</Label>
                          <Input
                            type="date"
                            value={newMeeting.nextMeetingDate}
                            onChange={(e) => setNewMeeting({ ...newMeeting, nextMeetingDate: e.target.value })}
                          />
                        </div>
                      )}

                      <Select
                        value={newMeeting.priority}
                        onValueChange={(value) => setNewMeeting({ ...newMeeting, priority: value as any })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Düşük Öncelik</SelectItem>
                          <SelectItem value="medium">Orta Öncelik</SelectItem>
                          <SelectItem value="high">Yüksek Öncelik</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="space-y-2">
                        <Label htmlFor="notificationFrequency">Hatırlatma Şekli</Label>
                        {newMeeting.type === "görüşme" ? (
                          <Select
                            value={newMeeting.notificationFrequency}
                            onValueChange={(value) => setNewMeeting({ ...newMeeting, notificationFrequency: value })}
                            id="notificationFrequency"
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Bildirme</SelectItem>
                              <SelectItem value="for_1_day">1 Gün Boyunca</SelectItem>
                              <SelectItem value="for_3_days">3 Gün Boyunca</SelectItem>
                              <SelectItem value="for_1_week">1 Hafta Boyunca</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={newMeeting.notificationFrequency}
                            onValueChange={(value) => setNewMeeting({ ...newMeeting, notificationFrequency: value })}
                            id="notificationFrequency"
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Bildirme</SelectItem>
                              <SelectItem value="on_day">Olay Günü</SelectItem>
                              <SelectItem value="1_day_before">1 Gün Önce</SelectItem>
                              <SelectItem value="1_week_before">1 Hafta Önce</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notificationDailyFrequency">Gün İçi Sıklık</Label>
                        <Select
                          value={newMeeting.notificationDailyFrequency}
                          onValueChange={(value) =>
                            setNewMeeting({ ...newMeeting, notificationDailyFrequency: value as any })
                          }
                          id="notificationDailyFrequency"
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once">Günde 1 Kez (Sabah)</SelectItem>
                            <SelectItem value="twice">Günde 2 Kez (Sabah, Akşam)</SelectItem>
                            <SelectItem value="thrice">Günde 3 Kez (Sabah, Öğle, Akşam)</SelectItem>
                            <SelectItem value="five_times">Günde 5 Kez</SelectItem>
                            <SelectItem value="ten_times">Günde 10 Kez</SelectItem>
                            <SelectItem value="hourly">Saat Başı (Mesai Saatleri)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={handleAddMeeting} className="flex-1">
                          <Check className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsAddingMeeting(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  )}

                  {meetings.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {meetings.map((meeting) => (
                        <Card key={meeting.id} className={cn("p-3", meeting.completed && "opacity-50")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={meeting.completed}
                                  onCheckedChange={() => handleToggleMeetingComplete(meeting.id)}
                                />
                                <p className={cn("font-semibold text-sm", meeting.completed && "line-through")}>
                                  {meeting.companyName}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">({meeting.type})</span>
                                </p>
                              </div>
                              <div className="pl-6 space-y-1.5 text-xs text-muted-foreground">
                                {meeting.authorizedPerson && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3" />
                                    <span>{meeting.authorizedPerson}</span>
                                  </div>
                                )}
                                {meeting.department && (
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{meeting.department}</span>
                                  </div>
                                )}
                                {meeting.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3" />
                                    <span>{meeting.email}</span>
                                  </div>
                                )}
                                {meeting.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    <span>{meeting.phone}</span>
                                  </div>
                                )}
                                {meeting.meetingNotes && <p className="pt-1">{meeting.meetingNotes}</p>}
                              </div>
                              {meeting.nextMeetingDate && (
                                <div className="flex items-center gap-1 pl-6 text-xs pt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Tarih: {new Date(meeting.nextMeetingDate + "T00:00:00").toLocaleDateString("tr-TR")}
                                  </span>
                                </div>
                              )}
                              <div
                                className={cn(
                                  "inline-block px-2 py-0.5 rounded text-xs ml-6",
                                  getPriorityColor(meeting.priority),
                                )}
                              >
                                {getPriorityLabel(meeting.priority)}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Bu gün için etkinlik yok</p>
                  )}
                </div>

                <Button onClick={handleSaveDay} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Günü Kaydet
                </Button>
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Ajandadan bir tarih seçin</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
