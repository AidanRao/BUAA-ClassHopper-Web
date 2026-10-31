import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/context";
import { api, ApiError } from "@/lib/api";
import { timeLabel } from "@/lib/dates";
import type { Schedule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CourseStatus } from "@/components/course-status";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Sheet } from "@/components/ui/sheet";
import {
  AuthorizationPrompt,
  Failure,
  LoadingRows,
  Message,
} from "@/components/feedback";
import { scheduleKey, useAuthorization } from "@/lib/iclass";

export function CourseDetailSheet({ date, id, onClose, returnFocusTo }: {
  date: string;
  id: string;
  onClose: () => void;
  returnFocusTo: HTMLButtonElement;
}) {
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
  const course = query.data?.items.find((item) => item.courseScheduleId === id);
  const renderSheet = (content: ReactNode, actions?: ReactNode) => (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={course?.courseName ?? "课程详情"}
      titleAside={course && <CourseStatus course={course} variant="detail" />}
      className="course-sheet"
      closeLabel="关闭课程详情"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (returnFocusTo.isConnected) returnFocusTo.focus({ preventScroll: true });
      }}
    >
      <div className="course-sheet-body">{content}</div>
      {actions && <div className="course-sheet-actions">{actions}</div>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="当前不在签到时间内"
        description={course
          ? `允许签到的时间为课前 10 分钟至课程结束（北京时间）。\n本节课程：${date} ${timeLabel(course.classBeginTime)}–${timeLabel(course.classEndTime)}\n是否仍要尝试签到？`
          : ""}
        action="仍要签到"
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate(true)}
      />
    </Sheet>
  );
  if (
    authorization.isPending ||
    (authorization.data?.authorized && query.isPending)
  )
    return renderSheet(<LoadingRows />);
  if (authorization.error)
    return renderSheet(
      <Failure
        error={authorization.error}
        retry={() => {
          void authorization.refetch();
        }}
      />
    );
  if (!authorization.data?.authorized)
    return renderSheet(
      <AuthorizationPrompt
        refresh={() => {
          void authorization.refetch();
        }}
      />
    );
  if (query.error)
    return renderSheet(
      <Failure
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (!course)
    return renderSheet(
      <Message
        title="课程不存在"
        description="该课程可能已调整，请返回课表查看。"
      >
        <Button onClick={onClose}>返回课表</Button>
      </Message>
    );
  const signed = course.signStatus === 1;
  return renderSheet(
    <>
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
        <p className="mt-3 text-sm leading-6" role="status">
          {feedback}
        </p>
      )}
    </>,
    <Button
      className="w-full"
      data-analytics-id="sign-in"
      disabled={signed || mutation.isPending || query.isFetching}
      onClick={() => {
        setFeedback("");
        mutation.mutate(false);
      }}
    >
      {signed ? "已签到" : mutation.isPending ? "正在签到…" : "立即签到"}
    </Button>,
  );
}
