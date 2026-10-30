import { CalendarCheck, Check, Circle } from "lucide-react";
import type { Course } from "@/lib/types";

export function CourseStatus({
  course,
  variant = "list",
}: {
  course: Pick<Course, "signStatus" | "isReserved">;
  variant?: "list" | "detail";
}) {
  const status = course.signStatus === 1
    ? { name: "signed", label: "已签到", Icon: Check }
    : course.isReserved === true
      ? { name: "reserved", label: "已预约", Icon: CalendarCheck }
      : { name: "unsigned", label: "未签到", Icon: Circle };
  return (
    <div className={`${variant === "list" ? "course-status" : "detail-status"} ${status.name}`}>
      <status.Icon size={16} aria-hidden="true" />
      <span>{status.label}</span>
    </div>
  );
}
