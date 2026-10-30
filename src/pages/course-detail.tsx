import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/context";
import { api, ApiError } from "@/lib/api";
import { timeLabel, validDate } from "@/lib/dates";
import type { Schedule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CourseStatus } from "@/components/course-status";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  AuthorizationPrompt,
  Failure,
  LoadingRows,
  Message,
  SessionGate,
} from "@/components/feedback";
import { scheduleKey, useAuthorization } from "./schedule";
export function CourseDetailPage() {
  const { date = "", courseScheduleId = "" } = useParams();
  if (!validDate(date))
    return (
      <Message title="日期无效">
        <Button asChild>
          <Link to="/app/schedule">返回课表</Link>
        </Button>
      </Message>
    );
  return (
    <SessionGate>
      <CourseDetail date={date} id={courseScheduleId} />
    </SessionGate>
  );
}
function CourseDetail({ date, id }: { date: string; id: string }) {
  const { manager, profile } = useSession();
  const client = useQueryClient();
  const authorization = useAuthorization();
  const [confirm, setConfirm] = useState(false),
    [feedback, setFeedback] = useState("");
  const key = scheduleKey(profile!.id, date);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api<Schedule>(`/v1/iclass/course-schedules?date=${date}`, manager, {
        signal,
      }),
    enabled: authorization.data?.authorized === true,
    staleTime: 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (outside: boolean) =>
      api<{ alreadySigned: boolean }>("/v1/iclass/sign-ins", manager, {
        method: "POST",
        body: JSON.stringify({
          date,
          courseScheduleId: id,
          allowOutsideWindow: outside,
        }),
      }),
    retry: false,
    onSuccess: async (result) => {
      setConfirm(false);
      setFeedback(result.alreadySigned ? "该课程已签到" : "签到成功");
      await client.invalidateQueries({ queryKey: key });
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        error.reason === "SIGN_WINDOW_CONFIRMATION_REQUIRED"
      ) {
        setConfirm(true);
        return;
      }
      setConfirm(false);
      setFeedback(
        error instanceof Error ? error.message : "请求失败，请刷新课表查看",
      );
      await client.invalidateQueries({ queryKey: key });
    },
  });
  if (
    authorization.isPending ||
    (authorization.data?.authorized && query.isPending)
  )
    return <LoadingRows />;
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
      />
    );
  if (query.error)
    return (
      <Failure
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const course = query.data?.items.find((item) => item.courseScheduleId === id);
  if (!course)
    return (
      <Message
        title="课程不存在"
        description="该课程可能已调整，请返回课表查看。"
      >
        <Button asChild>
          <Link to={`/app/schedule/${date}`}>返回课表</Link>
        </Button>
      </Message>
    );
  const signed = course.signStatus === 1;
  return (
    <article className="detail-page">
      <div className="detail-heading">
        <h1 className="min-w-0 break-words text-lg font-semibold leading-7">
          {course.courseName}
        </h1>
        <CourseStatus course={course} variant="detail" />
      </div>
      <dl className="detail-fields">
        <div>
          <dt>日期</dt>
          <dd>{date}</dd>
        </div>
        <div>
          <dt>时间</dt>
          <dd>
            {timeLabel(course.classBeginTime)}–{timeLabel(course.classEndTime)}
          </dd>
        </div>
        <div>
          <dt>任课教师</dt>
          <dd>{course.teacherName.join("、") || "未提供"}</dd>
        </div>
        <div>
          <dt>上课地点</dt>
          <dd>{course.classroomName.join("、") || "未提供"}</dd>
        </div>
        {course.courseNum && (
          <div>
            <dt>课程编号</dt>
            <dd>{course.courseNum}</dd>
          </div>
        )}
      </dl>
      {feedback && (
        <p className="mb-4 text-sm leading-6" role="status">
          {feedback}
        </p>
      )}
      <Button
        className="w-full"
        disabled={signed || mutation.isPending || query.isFetching}
        onClick={() => {
          setFeedback("");
          mutation.mutate(false);
        }}
      >
        {signed ? "已签到" : mutation.isPending ? "正在签到…" : "立即签到"}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="当前不在签到时间内"
        description={`允许签到的时间为课前 10 分钟至课程结束（北京时间）。\n本节课程：${date} ${timeLabel(course.classBeginTime)}–${timeLabel(course.classEndTime)}\n是否仍要尝试签到？`}
        action="仍要签到"
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate(true)}
      />
    </article>
  );
}
