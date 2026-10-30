export interface Course {
  courseScheduleId: string;
  courseId: string;
  courseName: string;
  courseType: string;
  weekDay: string;
  courseNum: string;
  teacherName: string[];
  classroomName: string[];
  signStatus: number;
  isReserved: boolean;
  classBeginTime: string;
  classEndTime: string;
}
export interface Schedule {
  date: string;
  serverTime: string;
  items: Course[];
}
export interface Authorization {
  authorized: boolean;
  authorizedAt: string | null;
}
export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  isPinned: boolean;
  coverUrl: string | null;
  tags: string[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PublicConfig {
  ssoIssuer: string;
  clientId: string;
}
export interface Profile {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
}
