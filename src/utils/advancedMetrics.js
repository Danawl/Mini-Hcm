
import { calculateHoursImmediately } from './calculation';

export const calculateDepartmentMetrics = (attendanceRecords, employees) => {
  const departmentData = {};
  
  employees.forEach(employee => {
    const dept = employee.department || 'Unassigned';
    if (!departmentData[dept]) {
      departmentData[dept] = {
        employees: [],
        totalHours: 0,
        overtime: 0,
        productivity: 0,
        attendanceRate: 0
      };
    }
    departmentData[dept].employees.push(employee);
  });

  attendanceRecords.forEach(record => {
    const employee = employees.find(emp => emp.id === record.userId);
    const dept = employee?.department || 'Unassigned';
    
    if (departmentData[dept] && record.status === 'completed') {
      const calculations = calculateHoursImmediately(record) || record;
      departmentData[dept].totalHours += calculations.totalHours || 0;
      departmentData[dept].overtime += calculations.overtimeHours || 0;
    }
  });

  return Object.keys(departmentData).map(dept => ({
    department: dept,
    employeeCount: departmentData[dept].employees.length,
    totalHours: departmentData[dept].totalHours.toFixed(2),
    avgHoursPerEmployee: (departmentData[dept].totalHours / departmentData[dept].employees.length).toFixed(2),
    overtimeHours: departmentData[dept].overtime.toFixed(2),
    overtimePercentage: departmentData[dept].totalHours > 0 ? 
      ((departmentData[dept].overtime / departmentData[dept].totalHours) * 100).toFixed(1) : 0
  }));
};

export const calculateEmployeeRankings = (attendanceRecords, employees) => {
  const employeeMetrics = {};

  employees.forEach(employee => {
    employeeMetrics[employee.id] = {
      name: `${employee.fname} ${employee.lname}`,
      totalHours: 0,
      punctualityScore: 0,
      productivityScore: 0,
      records: 0,
      lateCount: 0,
      overtimeHours: 0
    };
  });


  attendanceRecords.forEach(record => {
    if (record.status === 'completed' && employeeMetrics[record.userId]) {
      const calculations = calculateHoursImmediately(record) || record;
      const metrics = employeeMetrics[record.userId];
      
      metrics.totalHours += calculations.totalHours || 0;
      metrics.overtimeHours += calculations.overtimeHours || 0;
      metrics.records += 1;
      
      if (calculations.lateMinutes > 0) {
        metrics.lateCount += 1;
      }
    }
  });

  return Object.keys(employeeMetrics)
    .map(employeeId => {
      const metrics = employeeMetrics[employeeId];
      
      const punctualityScore = metrics.records > 0 ? 
        Math.max(0, 100 - (metrics.lateCount / metrics.records * 100)) : 0;
      
      const avgHoursPerDay = metrics.records > 0 ? metrics.totalHours / metrics.records : 0;
      const productivityScore = Math.min(100, (avgHoursPerDay / 8) * 100);
      
      return {
        employeeId,
        name: metrics.name,
        totalHours: metrics.totalHours.toFixed(2),
        avgHoursPerDay: avgHoursPerDay.toFixed(2),
        punctualityScore: punctualityScore.toFixed(1),
        productivityScore: productivityScore.toFixed(1),
        overallScore: ((punctualityScore + productivityScore) / 2).toFixed(1),
        records: metrics.records,
        lateCount: metrics.lateCount,
        overtimeHours: metrics.overtimeHours.toFixed(2)
      };
    })
    .sort((a, b) => parseFloat(b.overallScore) - parseFloat(a.overallScore));
};


export const calculateCostMetrics = (attendanceRecords, employees, payrollRates = {}) => {
  let totalRegularCost = 0;
  let totalOvertimeCost = 0;
  let totalNightDiffCost = 0;
  
  const employeeCosts = {};

  attendanceRecords.forEach(record => {
    if (record.status === 'completed') {
      const employee = employees.find(emp => emp.id === record.userId);
      const hourlyRate = payrollRates[record.userId] || employee?.hourlyRate || 15; 
      const calculations = calculateHoursImmediately(record) || record;
      
      const regularCost = (calculations.regularHours || 0) * hourlyRate;
      const overtimeCost = (calculations.overtimeHours || 0) * hourlyRate * 1.5; 
      const nightDiffCost = (calculations.nightDiffHours || 0) * hourlyRate * 0.1; 
      
      totalRegularCost += regularCost;
      totalOvertimeCost += overtimeCost;
      totalNightDiffCost += nightDiffCost;
      
      if (!employeeCosts[record.userId]) {
        employeeCosts[record.userId] = {
          employeeName: record.employeeName || employee?.name,
          regularCost: 0,
          overtimeCost: 0,
          nightDiffCost: 0,
          totalCost: 0
        };
      }
      
      employeeCosts[record.userId].regularCost += regularCost;
      employeeCosts[record.userId].overtimeCost += overtimeCost;
      employeeCosts[record.userId].nightDiffCost += nightDiffCost;
      employeeCosts[record.userId].totalCost = 
        employeeCosts[record.userId].regularCost + 
        employeeCosts[record.userId].overtimeCost + 
        employeeCosts[record.userId].nightDiffCost;
    }
  });

  return {
    totals: {
      regularCost: totalRegularCost.toFixed(2),
      overtimeCost: totalOvertimeCost.toFixed(2),
      nightDiffCost: totalNightDiffCost.toFixed(2),
      totalCost: (totalRegularCost + totalOvertimeCost + totalNightDiffCost).toFixed(2)
    },
    employeeBreakdown: Object.keys(employeeCosts).map(employeeId => ({
      employeeId,
      ...employeeCosts[employeeId],
      regularCost: employeeCosts[employeeId].regularCost.toFixed(2),
      overtimeCost: employeeCosts[employeeId].overtimeCost.toFixed(2),
      nightDiffCost: employeeCosts[employeeId].nightDiffCost.toFixed(2),
      totalCost: employeeCosts[employeeId].totalCost.toFixed(2)
    }))
  };
};

export const generatePredictiveAnalytics = (attendanceRecords) => {
  const dailyPatterns = {};
  const weeklyTrends = {};
  
  attendanceRecords.forEach(record => {
    if (record.status === 'completed') {
      const date = new Date(record.punchIn);
      const dayOfWeek = date.getDay(); 
      const weekKey = getWeekKey(date);
      
      const calculations = calculateHoursImmediately(record) || record;
      
      if (!dailyPatterns[dayOfWeek]) {
        dailyPatterns[dayOfWeek] = {
          totalHours: 0,
          records: 0,
          lateCount: 0
        };
      }
      
      dailyPatterns[dayOfWeek].totalHours += calculations.totalHours || 0;
      dailyPatterns[dayOfWeek].records += 1;
      if (calculations.lateMinutes > 0) {
        dailyPatterns[dayOfWeek].lateCount += 1;
      }
      
      if (!weeklyTrends[weekKey]) {
        weeklyTrends[weekKey] = {
          totalHours: 0,
          records: 0,
          overtime: 0
        };
      }
      
      weeklyTrends[weekKey].totalHours += calculations.totalHours || 0;
      weeklyTrends[weekKey].records += 1;
      weeklyTrends[weekKey].overtime += calculations.overtimeHours || 0;
    }
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const dailyAnalysis = Object.keys(dailyPatterns).map(day => ({
    dayOfWeek: dayNames[parseInt(day)],
    avgHours: dailyPatterns[day].records > 0 ? 
      (dailyPatterns[day].totalHours / dailyPatterns[day].records).toFixed(2) : 0,
    latenessRate: dailyPatterns[day].records > 0 ? 
      ((dailyPatterns[day].lateCount / dailyPatterns[day].records) * 100).toFixed(1) : 0,
    totalRecords: dailyPatterns[day].records
  }));

  const recentWeeks = Object.keys(weeklyTrends).sort().slice(-4);
  const trendAnalysis = {
    hoursPerWeek: recentWeeks.map(week => ({
      week,
      hours: weeklyTrends[week].totalHours.toFixed(2),
      records: weeklyTrends[week].records
    })),
    predictedNextWeek: recentWeeks.length >= 2 ? 
      calculateTrend(recentWeeks.map(week => weeklyTrends[week].totalHours)) : null
  };

  return {
    dailyAnalysis,
    trendAnalysis,
    insights: generateInsights(dailyAnalysis, trendAnalysis)
  };
};

const generateInsights = (dailyAnalysis, trendAnalysis) => {
  const insights = [];
  

  const highestLatenessDay = dailyAnalysis.reduce((prev, current) => 
    parseFloat(prev.latenessRate) > parseFloat(current.latenessRate) ? prev : current
  );
  
  if (parseFloat(highestLatenessDay.latenessRate) > 20) {
    insights.push({
      type: 'warning',
      title: 'High Lateness Alert',
      message: `${highestLatenessDay.dayOfWeek}s have the highest lateness rate at ${highestLatenessDay.latenessRate}%. Consider flexible scheduling.`
    });
  }

  const avgDailyHours = dailyAnalysis.reduce((sum, day) => sum + parseFloat(day.avgHours), 0) / dailyAnalysis.length;
  if (avgDailyHours < 7.5) {
    insights.push({
      type: 'info',
      title: 'Productivity Opportunity',
      message: `Average daily hours (${avgDailyHours.toFixed(2)}h) are below standard. Review workload distribution.`
    });
  }

  return insights;
};

/**
 * Helper function to get week key for grouping
 */
const getWeekKey = (date) => {
  const week = new Date(date);
  week.setDate(date.getDate() - date.getDay());
  return week.toISOString().split('T')[0];
};

/**
 * Simple linear trend calculation
 */
const calculateTrend = (values) => {
  if (values.length < 2) return null;
  
  const n = values.length;
  const sumX = n * (n - 1) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return {
    prediction: (slope * n + intercept).toFixed(2),
    trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
    confidence: Math.min(Math.abs(slope) * 100, 100).toFixed(1)
  };
};