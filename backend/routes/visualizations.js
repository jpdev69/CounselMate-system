const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/visualizations/health
 * Test endpoint to verify the route is working
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Visualizations API is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/visualizations/violations/by-student
 * Returns violation count aggregated by student (most to least violations)
 */
router.get('/violations/by-student', async (req, res) => {
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
        ARRAY_AGG(DISTINCT vt.description) FILTER (WHERE vt.description IS NOT NULL) as violation_types,
        ARRAY_AGG(DISTINCT asl.course) FILTER (WHERE asl.course IS NOT NULL) as courses
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      GROUP BY s.id, s.student_id, s.full_name, s.year, s.section
      ORDER BY violation_count DESC, s.full_name ASC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Violations by student error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualizations/violations/by-course
 * Returns violation count aggregated by course
 */
router.get('/violations/by-course', async (req, res) => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        asl.course,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count,
        ARRAY_AGG(DISTINCT vt.description) FILTER (WHERE vt.description IS NOT NULL) as violation_types
      FROM admission_slips asl
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE asl.course IS NOT NULL AND asl.course != '' AND asl.status = 'approved'
      GROUP BY asl.course
      ORDER BY violation_count DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Violations by course error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualizations/violations/by-type
 * Returns violation count aggregated by violation type
 */
router.get('/violations/by-type', async (req, res) => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        vt.id,
        vt.code,
        vt.description,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count
      FROM violation_types vt
      LEFT JOIN admission_slips asl ON vt.id = asl.violation_type_id AND asl.status = 'approved'
      GROUP BY vt.id, vt.code, vt.description
      ORDER BY violation_count DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Violations by type error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualizations/violations/by-year-section
 * Returns violation count aggregated by year and section
 */
router.get('/violations/by-year-section', async (req, res) => {
  try {
    // Only count approved admission slips for analytics
    const result = await db.query(`
      SELECT 
        s.year,
        s.section,
        COUNT(asl.id) as violation_count,
        COUNT(DISTINCT asl.student_id) as student_count,
        ARRAY_AGG(DISTINCT s.full_name) as students
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      WHERE s.year IS NOT NULL AND s.section IS NOT NULL
      GROUP BY s.year, s.section
      ORDER BY s.year ASC, s.section ASC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Violations by year/section error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualizations/violations/summary
 * Returns comprehensive summary statistics
 */
router.get('/violations/summary', async (req, res) => {
  try {
    // Summary metrics should reflect only approved slips
    // Total violations
    const totalViolations = await db.query(`
      SELECT COUNT(*) as total FROM admission_slips WHERE status = 'approved'
    `);
    
    // Total students with violations
    const studentsWithViolations = await db.query(`
      SELECT COUNT(DISTINCT student_id) as total FROM admission_slips WHERE status = 'approved'
    `);
    
    // Top violator
    const topViolator = await db.query(`
      SELECT 
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
    
    // Most common violation type
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
    
    // Most violated course
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
    
    res.json({
      success: true,
      summary: {
        total_violations: parseInt(totalViolations.rows[0].total),
        students_with_violations: parseInt(studentsWithViolations.rows[0].total),
        top_violator: topViolator.rows.length > 0 ? topViolator.rows[0] : null,
        most_common_violation: mostCommonViolation.rows.length > 0 ? mostCommonViolation.rows[0] : null,
        most_violated_course: mostViolatedCourse.rows.length > 0 ? mostViolatedCourse.rows[0] : null
      }
    });
  } catch (error) {
    console.error('Violations summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualizations/dashboard
 * Returns HTML dashboard with interactive visualizations
 */
router.get('/dashboard', async (req, res) => {
  try {
    const violationsByStudent = await db.query(`
      SELECT 
        s.full_name,
        COUNT(asl.id) as violation_count
      FROM students s
      LEFT JOIN admission_slips asl ON s.id = asl.student_id AND asl.status = 'approved'
      GROUP BY s.id, s.full_name
      ORDER BY violation_count DESC
      LIMIT 10
    `);
    
    const violationsByCourse = await db.query(`
      SELECT 
        course,
        COUNT(asl.id) as violation_count
      FROM admission_slips asl
      WHERE course IS NOT NULL AND course != '' AND asl.status = 'approved'
      GROUP BY course
      ORDER BY violation_count DESC
      LIMIT 10
    `);
    
    const violationsByType = await db.query(`
      SELECT 
        vt.description,
        COUNT(asl.id) as violation_count
      FROM violation_types vt
      LEFT JOIN admission_slips asl ON vt.id = asl.violation_type_id AND asl.status = 'approved'
      GROUP BY vt.id, vt.description
      ORDER BY violation_count DESC
      LIMIT 10
    `);

    const summary = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM admission_slips WHERE status = 'approved') as total_violations,
        (SELECT COUNT(DISTINCT student_id) FROM admission_slips WHERE status = 'approved') as students_with_violations,
        (SELECT COUNT(DISTINCT course) FROM admission_slips WHERE course IS NOT NULL AND status = 'approved') as courses_involved
    `);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Violation Analytics Dashboard - CounselMate</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .container {
            max-width: 1400px;
            margin: 0 auto;
          }

          .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            animation: slideDown 0.6s ease-out;
          }

          .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }

          .header p {
            font-size: 1.1em;
            opacity: 0.9;
          }

          .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            animation: slideUp 0.6s ease-out;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }

          .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
          }

          .card-title {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 600;
          }

          .card-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
          }

          .card-subtitle {
            font-size: 0.85em;
            color: #999;
          }

          .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .chart-container {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            animation: slideUp 0.6s ease-out 0.1s both;
          }

          .chart-title {
            font-size: 1.3em;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
          }

          .chart-wrapper {
            position: relative;
            height: 350px;
          }

          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .footer {
            text-align: center;
            color: white;
            padding: 20px;
            opacity: 0.8;
            font-size: 0.9em;
          }

          @media (max-width: 768px) {
            .charts-grid {
              grid-template-columns: 1fr;
            }

            .header h1 {
              font-size: 1.8em;
            }

            .card-value {
              font-size: 2em;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Violation Analytics Dashboard</h1>
            <p>Real-time insights into student violations and patterns</p>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-title">Total Violations</div>
              <div class="card-value">${summary.rows[0].total_violations}</div>
              <div class="card-subtitle">Across all students</div>
            </div>
            <div class="card">
              <div class="card-title">Students with Violations</div>
              <div class="card-value">${summary.rows[0].students_with_violations}</div>
              <div class="card-subtitle">Involved students</div>
            </div>
            <div class="card">
              <div class="card-title">Courses Involved</div>
              <div class="card-value">${summary.rows[0].courses_involved}</div>
              <div class="card-subtitle">With violations reported</div>
            </div>
          </div>

          <div class="charts-grid">
            <div class="chart-container">
              <div class="chart-title">📈 Top 10 Violators</div>
              <div class="chart-wrapper">
                <canvas id="violationsByStudentChart"></canvas>
              </div>
            </div>

            <div class="chart-container">
              <div class="chart-title">📚 Violations by Course</div>
              <div class="chart-wrapper">
                <canvas id="violationsByCourseChart"></canvas>
              </div>
            </div>

            <div class="chart-container">
              <div class="chart-title">⚠️ Violation Types</div>
              <div class="chart-wrapper">
                <canvas id="violationsByTypeChart"></canvas>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>CounselMate System © 2024 | Last updated: ${new Date().toLocaleString()}</p>
          </div>
        </div>

        <script>
          const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  padding: 20,
                  font: {
                    size: 12,
                    weight: 600
                  }
                }
              }
            }
          };

          // Top Violators Chart
          const violatorCtx = document.getElementById('violationsByStudentChart').getContext('2d');
          new Chart(violatorCtx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(violationsByStudent.rows.map(r => r.full_name))},
              datasets: [{
                label: 'Number of Violations',
                data: ${JSON.stringify(violationsByStudent.rows.map(r => r.violation_count))},
                backgroundColor: [
                  'rgba(255, 99, 132, 0.7)',
                  'rgba(255, 159, 64, 0.7)',
                  'rgba(255, 206, 86, 0.7)',
                  'rgba(75, 192, 192, 0.7)',
                  'rgba(54, 162, 235, 0.7)',
                  'rgba(153, 102, 255, 0.7)',
                  'rgba(255, 99, 132, 0.7)',
                  'rgba(255, 159, 64, 0.7)',
                  'rgba(75, 192, 192, 0.7)',
                  'rgba(54, 162, 235, 0.7)'
                ],
                borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
              }]
            },
            options: {
              ...chartOptions,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1
                  }
                }
              }
            }
          });

          // Violations by Course Chart
          const courseCtx = document.getElementById('violationsByCourseChart').getContext('2d');
          new Chart(courseCtx, {
            type: 'doughnut',
            data: {
              labels: ${JSON.stringify(violationsByCourse.rows.map(r => r.course))},
              datasets: [{
                label: 'Violations',
                data: ${JSON.stringify(violationsByCourse.rows.map(r => r.violation_count))},
                backgroundColor: [
                  'rgba(102, 126, 234, 0.7)',
                  'rgba(118, 75, 162, 0.7)',
                  'rgba(237, 100, 166, 0.7)',
                  'rgba(255, 154, 158, 0.7)',
                  'rgba(250, 208, 196, 0.7)',
                  'rgba(255, 242, 204, 0.7)',
                  'rgba(102, 126, 234, 0.7)',
                  'rgba(118, 75, 162, 0.7)',
                  'rgba(237, 100, 166, 0.7)',
                  'rgba(255, 154, 158, 0.7)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
              }]
            },
            options: chartOptions
          });

          // Violation Types Chart
          const typeCtx = document.getElementById('violationsByTypeChart').getContext('2d');
          new Chart(typeCtx, {
            type: 'polarArea',
            data: {
              labels: ${JSON.stringify(violationsByType.rows.map(r => r.description || 'N/A'))},
              datasets: [{
                label: 'Number of Occurrences',
                data: ${JSON.stringify(violationsByType.rows.map(r => r.violation_count))},
                backgroundColor: [
                  'rgba(255, 99, 132, 0.7)',
                  'rgba(54, 162, 235, 0.7)',
                  'rgba(255, 206, 86, 0.7)',
                  'rgba(75, 192, 192, 0.7)',
                  'rgba(153, 102, 255, 0.7)',
                  'rgba(255, 159, 64, 0.7)',
                  'rgba(199, 199, 199, 0.7)',
                  'rgba(83, 102, 255, 0.7)',
                  'rgba(102, 194, 255, 0.7)',
                  'rgba(255, 153, 102, 0.7)'
                ],
                borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(199, 199, 199, 1)',
                  'rgba(83, 102, 255, 1)',
                  'rgba(102, 194, 255, 1)',
                  'rgba(255, 153, 102, 1)'
                ],
                borderWidth: 2
              }]
            },
            options: chartOptions
          });
        </script>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Dashboard error:', error);
    // Return JSON error for consistency
    res.status(500).json({ 
      error: 'Failed to generate dashboard',
      details: error.message 
    });
  }
});

module.exports = router;
