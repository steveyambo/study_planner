export type Course = {
  id: string;
  code: string;
  name: string;
  color: string;
  revision_multiplier: number;
};

export type CourseSession = {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
