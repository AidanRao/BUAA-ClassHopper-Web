import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { CourseStatus } from "@/components/course-status";
import { CourseDetailSheet } from "@/components/course-detail-sheet";
import { useSession } from "@/auth/context";
import { api, ApiError } from "@/lib/api";
import { courseTime, timeLabel, today, validDate } from "@/lib/dates";
import type { Schedule } from "@/lib/types";
import { scheduleKey, useAuthorization } from "@/lib/iclass";
import { WeekCalendar } from "@/components/week-calendar";
import { Banner } from "@/components/banner";
import {
  AuthorizationPrompt,
  Failure,
  LoadingRows,
  Message,
  SessionGate,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
export function SchedulePage() {
  const { date = "" } = useParams();
  const navigate = useNavigate();
  if (!date) return <Navigate replace to={`/app/schedule/${today()}`} />;
  if (!validDate(date))
    return (
      <Message title="日期无效">
        <Button asChild>
          <Link to="/app/schedule">返回今天</Link>
        </Button>
      </Message>
    );
  return (
    <>
      <WeekCalendar
        date={date}
        select={(next) => navigate(`/app/schedule/${next}`)}
      />
      <Banner />
      <SessionGate>
        <DaySchedule key={date} date={date} />
      </SessionGate>
    </>
  );
}
function DaySchedule({ date }: { date: string }) {
  const [selected, setSelected] = useState<{
    id: string;
    trigger: HTMLButtonElement;
  } | null>(null);
  const { manager, profile } = useSession(),
    authorization = useAuthorization();
  const query = useQuery({
    queryKey: scheduleKey(profile!.id, date),
    queryFn: ({ signal }) =>
      api<Schedule>(`/v1/iclass/course-schedules?date=${date}`, manager, {
        signal,
      }),
    enabled: authorization.data?.authorized === true,
    retry: false,
    staleTime: 15_000,
  });
  const restored = useRef("");
  useEffect(() => {
    if (!query.data || restored.current === date) return;
    const id = requestAnimationFrame(() => {
      restored.current = date;
      window.scrollTo(
        0,
        Number(sessionStorage.getItem(`schedule-scroll:${date}`) ?? 0),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [date, query.data]);
  if (authorization.isPending) return <LoadingRows />;
  if (authorization.error)
    return (
      <Failure
        error={authorization.error}
        retry={() => {
          void authorization.refetch();
        }}
      />
    );
  if (!authorization.data?.authorized)
    return (
      <AuthorizationPrompt
        refresh={() => {
          void authorization.refetch();
        }}
        busy={authorization.isFetching}
      />
    );
  if (query.isPending) return <LoadingRows />;
  if (query.error) {
    const authError =
      query.error instanceof ApiError &&
      query.error.reason?.startsWith("ICLASS_AUTHORIZATION");
    if (authError)
      return (
        <AuthorizationPrompt
          refresh={() => {
            void authorization.refetch();
            void query.refetch();
          }}
          busy={query.isFetching}
        />
      );
    return (
      <Failure
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  }
  const courses = [...query.data.items].sort(
    (a, b) => courseTime(a.classBeginTime) - courseTime(b.classBeginTime),
  );
  if (!courses.length)
    return (
      <Message title="当天没有课程">
        <Button
          variant="ghost"
          onClick={() => {
            void query.refetch();
          }}
          disabled={query.isFetching}
        >
          刷新课表
        </Button>
      </Message>
    );
  return (
    <section aria-label="当日课程">
      <ul className="course-list">
        {courses.map((course) => (
          <li key={course.courseScheduleId}>
            <button
              type="button"
              className="course-row"
              aria-haspopup="dialog"
              onClick={(event) =>
                setSelected({ id: course.courseScheduleId, trigger: event.currentTarget })
              }
            >
              <CourseStatus course={course} />
              <div className="course-information">
                <h2 className="course-name">{course.courseName}</h2>
                <p>任课教师：{course.teacherName.join("、") || "未提供"}</p>
                <p>地点：{course.classroomName.join("、") || "未提供"}</p>
                <p className="tabular-nums">
                  时间：{timeLabel(course.classBeginTime)}–
                  {timeLabel(course.classEndTime)}
                </p>
              </div>
              <ChevronRight className="course-chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-center py-5">
        <Button
          variant="ghost"
          onClick={() => {
            void query.refetch();
          }}
          disabled={query.isFetching}
        >
          {query.isFetching ? "刷新中…" : "刷新课表"}
        </Button>
      </div>
      {selected && (
        <CourseDetailSheet
          key={selected.id}
          date={date}
          id={selected.id}
          onClose={() => setSelected(null)}
          returnFocusTo={selected.trigger}
        />
      )}
    </section>
  );
}
