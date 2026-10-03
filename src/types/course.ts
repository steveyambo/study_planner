export type Course = {
  id: string;
  code: string;
  name: string;
  color: string;
  revision_multiplier: number;
  archived_at?: string | null;
};

export type CourseSession = {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from?: string | null;
};
