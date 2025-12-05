/**
 * Visualization Utilities
 * Helper functions for data aggregation and chart preparation
 */

const db = require('../config/database');

/**
 * Get violations sorted by student (most to least)
 */
const getViolationsByStudent = async () => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        s.id,
        s.student_id,
        s.full_name,
        s.year,
        s.section,
        COUNT(asl.id) as violation_count,
        MIN(asl.created_at) as first_violation,
        MAX(asl.created_at) as last_violation,
        ARRAY_AGG(DISTINCT vt.code) FILTER (WHERE vt.code IS NOT NULL) as violation_codes
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      GROUP BY s.id, s.student_id, s.full_name, s.year, s.section
      HAVING COUNT(asl.id) > 0
      ORDER BY violation_count DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('getViolationsByStudent error:', error);
    throw error;
  }
};

/**
 * Get violations sorted by course
 */
const getViolationsByCourse = async () => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        asl.course,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count,
        ARRAY_AGG(DISTINCT vt.code) FILTER (WHERE vt.code IS NOT NULL) as violation_codes,
        MIN(asl.created_at) as first_violation,
        MAX(asl.created_at) as last_violation
      FROM admission_slips asl
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE asl.course IS NOT NULL AND asl.course != '' AND asl.status = 'approved'
      GROUP BY asl.course
      ORDER BY violation_count DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('getViolationsByCourse error:', error);
    throw error;
  }
};

/**
 * Get violations sorted by type
 */
const getViolationsByType = async () => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        vt.id,
        vt.code,
        vt.description,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count,
        COUNT(DISTINCT asl.course) as course_count
      FROM violation_types vt
      LEFT JOIN admission_slips asl ON vt.id = asl.violation_type_id AND asl.status = 'approved'
      GROUP BY vt.id, vt.code, vt.description
      ORDER BY violation_count DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('getViolationsByType error:', error);
    throw error;
  }
};

/**
 * Get violations by year and section
 */
const getViolationsByYearSection = async () => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        s.year,
        s.section,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count,
        ARRAY_AGG(DISTINCT s.full_name) as students,
        ARRAY_AGG(DISTINCT vt.description) FILTER (WHERE vt.description IS NOT NULL) as violation_types
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE s.year IS NOT NULL AND s.section IS NOT NULL
      GROUP BY s.year, s.section
      ORDER BY s.year ASC, s.section ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('getViolationsByYearSection error:', error);
    throw error;
  }
};

/**
 * Get summary statistics
 */
const getSummaryStats = async () => {
  try {
    // Summary metrics should reflect only approved slips
    const totalViolations = await db.query(`SELECT COUNT(*) as total FROM admission_slips WHERE status = 'approved'`);
    const studentsWithViolations = await db.query(`SELECT COUNT(DISTINCT student_id) as total FROM admission_slips WHERE status = 'approved'`);
    
    const topViolator = await db.query(`
      SELECT 
        s.id,
        s.full_name,
        s.year,
        s.section,
        COUNT(asl.id) as violation_count
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      GROUP BY s.id, s.full_name, s.year, s.section
      ORDER BY violation_count DESC
      LIMIT 1
    `);
    
    const leastViolator = await db.query(`
      SELECT 
        s.id,
        s.full_name,
        s.year,
        s.section,
        COUNT(asl.id) as violation_count
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      HAVING COUNT(asl.id) > 0
      GROUP BY s.id, s.full_name, s.year, s.section
      ORDER BY violation_count ASC
      LIMIT 1
    `);
    
    const mostCommonViolation = await db.query(`
      SELECT 
        vt.code,
        vt.description,
        COUNT(asl.id) as violation_count
      FROM violation_types vt
      LEFT JOIN admission_slips asl ON vt.id = asl.violation_type_id AND asl.status = 'approved'
      GROUP BY vt.id, vt.code, vt.description
      ORDER BY violation_count DESC
      LIMIT 1
    `);
    
    const mostViolatedCourse = await db.query(`
      SELECT 
        course,
        COUNT(asl.id) as violation_count
      FROM admission_slips asl
      WHERE course IS NOT NULL AND course != '' AND asl.status = 'approved'
      GROUP BY course
      ORDER BY violation_count DESC
      LIMIT 1
    `);

    const classWithMostViolations = await db.query(`
      SELECT 
        CONCAT(s.year, '-', s.section) as class,
        s.year,
        s.section,
        COUNT(asl.id) as violation_count
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      WHERE s.year IS NOT NULL AND s.section IS NOT NULL
      GROUP BY s.year, s.section
      ORDER BY violation_count DESC
      LIMIT 1
    `);

    return {
      total_violations: parseInt(totalViolations.rows[0].total),
      students_with_violations: parseInt(studentsWithViolations.rows[0].total),
      top_violator: topViolator.rows.length > 0 ? topViolator.rows[0] : null,
      least_violator: leastViolator.rows.length > 0 ? leastViolator.rows[0] : null,
      most_common_violation: mostCommonViolation.rows.length > 0 ? mostCommonViolation.rows[0] : null,
      most_violated_course: mostViolatedCourse.rows.length > 0 ? mostViolatedCourse.rows[0] : null,
      class_with_most_violations: classWithMostViolations.rows.length > 0 ? classWithMostViolations.rows[0] : null
    };
  } catch (error) {
    console.error('getSummaryStats error:', error);
    throw error;
  }
};

/**
 * Get violations by date range (for trend analysis)
 */
const getViolationsTrend = async (startDate, endDate) => {
  try {
    const result = await db.query(`
      SELECT 
        DATE(asl.created_at) as date,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count
      FROM admission_slips asl
      WHERE asl.created_at >= $1 AND asl.created_at <= $2 AND asl.status = 'approved'
      GROUP BY DATE(asl.created_at)
      ORDER BY date ASC
    `, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('getViolationsTrend error:', error);
    throw error;
  }
};

/**
 * Get student profile with all violations
 */
const getStudentViolationProfile = async (studentId) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.student_id,
        s.full_name,
        s.year,
        s.section,
        COUNT(asl.id) as total_violations,
        STRING_AGG(DISTINCT vt.description, ', ') as violation_types,
        STRING_AGG(DISTINCT asl.course, ', ') as courses,
        MIN(asl.created_at) as first_violation_date,
        MAX(asl.created_at) as last_violation_date
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE s.id = $1
      GROUP BY s.id, s.student_id, s.full_name, s.year, s.section
    `, [studentId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('getStudentViolationProfile error:', error);
    throw error;
  }
};

/**
 * Get percentile ranking for a student among all students
 */
const getStudentViolationPercentile = async (studentId) => {
  try {
    const result = await db.query(`
      WITH student_violations AS (
        SELECT 
          s.id,
          COUNT(asl.id) as violation_count
        FROM students s
        LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
        GROUP BY s.id
      ),
      ranked_students AS (
        SELECT 
          id,
          violation_count,
          PERCENT_RANK() OVER (ORDER BY violation_count) as percentile
        FROM student_violations
      )
      SELECT 
        id,
        violation_count,
        ROUND(percentile * 100, 2) as percentile_rank
      FROM ranked_students
      WHERE id = $1
    `, [studentId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('getStudentViolationPercentile error:', error);
    throw error;
  }
};

module.exports = {
  getViolationsByStudent,
  getViolationsByCourse,
  getViolationsByType,
  getViolationsByYearSection,
  getSummaryStats,
  getViolationsTrend,
  getStudentViolationProfile,
  getStudentViolationPercentile
};
