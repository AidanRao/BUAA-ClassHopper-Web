import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { addDays, today, validDate, weekDates } from "@/lib/dates";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";
import { cn } from "@/lib/utils";
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
export function WeekCalendar({
  date,
  select,
}: {
  date: string;
  select: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(date);
  const days = weekDates(date),
    current = today();
  return (
    <section className="week-calendar" aria-label="课表日期">
      <div className="calendar-tools">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => select(addDays(date, -7))}
            aria-label="上一周"
            data-analytics-id="schedule-previous-week"
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => select(addDays(date, 7))}
            aria-label="下一周"
            data-analytics-id="schedule-next-week"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => select(current)}
          data-analytics-id="schedule-today"
          disabled={date === current}
        >
          今天
        </Button>
      </div>
      <div className="week-grid">
        <button
          className="month-label"
          onClick={() => {
            setDraft(date);
            setOpen(true);
          }}
          aria-label="选择日期"
          data-analytics-id="open-date-picker"
        >
          <span>{Number(date.slice(5, 7))}</span>
          <span className="text-sm">月</span>
          <ChevronDown size={12} />
        </button>
        <div className="week-days">
          {days.map((day, index) => (
            <button
              key={day}
              data-analytics-id="select-schedule-date"
              className={cn(
                "day-cell",
                day === date && "selected",
                day === current && "is-today",
              )}
              onClick={() => select(day)}
              aria-label={`${day} 星期${weekdays[index]}${day === current ? " 今天" : ""}`}
              aria-current={day === current ? "date" : undefined}
              aria-pressed={day === date}
            >
              <span className="weekday">{weekdays[index]}</span>
              <span className="day-number">
                {day === current ? "今" : day.slice(8)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="选择日期">
        <label className="mt-5 block text-sm" htmlFor="schedule-date">
          日期
        </label>
        <input
          id="schedule-date"
          type="date"
          className="date-input mt-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          className="mt-5 w-full"
          data-analytics-id="apply-schedule-date"
          disabled={!validDate(draft)}
          onClick={() => {
            select(draft);
            setOpen(false);
          }}
        >
          查看课表
        </Button>
      </Sheet>
    </section>
  );
}
