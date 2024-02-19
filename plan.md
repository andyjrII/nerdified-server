In this model, a Student has a unique email address, and can enroll in many courses through the CourseEnrollment table. A Course has a name, description, and price, and can have many CourseEnrollment records. The CourseEnrollment table contains the id of the enrollment record, the id of the student who enrolled, the id of the course they enrolled in, the date they enrolled, and the amount they paid for the course.

## Prevent a user from paying for a course 2 times
