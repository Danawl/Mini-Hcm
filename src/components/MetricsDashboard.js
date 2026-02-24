import React, { useState, useEffect, useCallback} from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { calculateHoursImmediately } from '../utils/calculation';

const getWeekKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((d.getDate() - d.getDay() + 6) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

function MetricsDashboard({ employees, attendanceRecords, selectedDateRange }) {
  const [metrics, setMetrics] = useState({
    overview: {},
    productivity: {},
    attendance: {},
    trends: {}
  });
  const [loading, setLoading] = useState(false);

  const calculateOverviewMetrics = useCallback((records) => {
    const completedRecords = records.filter(r => r.punchOut && r.status === 'completed');
    const activeRecords = records.filter(r => !r.punchOut || r.status === 'active');
    
    const totalEmployees = employees.length;
    const presentToday = new Set(records
      .filter(r => {
        const today = new Date().toDateString();
        const recordDate = new Date(r.punchIn).toDateString();
        return recordDate === today;
      })
      .map(r => r.userId)
    ).size;

    const absentToday = totalEmployees - presentToday;
    const attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees * 100).toFixed(1) : 0;

    return {
      totalEmployees,
      presentToday,
      absentToday,
      activeRecords: activeRecords.length,
      attendanceRate,
      completedSessions: completedRecords.length
    };
  }, [employees]);

  const calculateProductivityMetrics = useCallback((records) => {
    const completedRecords = records.filter(r => r.punchOut && r.status === 'completed');
    
    if (completedRecords.length === 0) {
      return {
        averageHoursPerDay: 0,
        totalOvertime: 0,
        totalRegularHours: 0,
        overtimePercentage: 0,
        averageBreakTime: 0
      };
    }

    const totals = completedRecords.reduce((acc, record) => {
      const calculations = calculateHoursImmediately(record) || record;
      
      acc.totalHours += calculations.totalHours || 0;
      acc.regularHours += calculations.regularHours || 0;
      acc.overtime += calculations.overtimeHours || 0;
      acc.nightDiff += calculations.nightDiffHours || 0;
      
      return acc;
    }, {
      totalHours: 0,
      regularHours: 0,
      overtime: 0,
      nightDiff: 0
    });

    const averageHoursPerDay = (totals.totalHours / completedRecords.length).toFixed(2);
    const overtimePercentage = totals.totalHours > 0 ? 
      ((totals.overtime / totals.totalHours) * 100).toFixed(1) : 0;

    return {
      averageHoursPerDay,
      totalOvertime: totals.overtime.toFixed(2),
      totalRegularHours: totals.regularHours.toFixed(2),
      totalNightDiff: totals.nightDiff.toFixed(2),
      overtimePercentage,
      totalHours: totals.totalHours.toFixed(2)
    };
  }, []);

  const calculateAttendanceMetrics = useCallback((records) => {
    const completedRecords = records.filter(r => r.punchOut && r.status === 'completed');
    
    if (completedRecords.length === 0) {
      return {
        punctualityRate: 0,
        averageLateMinutes: 0,
        earlyDepartures: 0,
        perfectAttendance: 0
      };
    }

    const lateArrivals = completedRecords.reduce((acc, record) => {
      const calculations = calculateHoursImmediately(record) || record;
      if (calculations.lateMinutes > 0) {
        acc.count++;
        acc.totalMinutes += calculations.lateMinutes;
      }
      return acc;
    }, { count: 0, totalMinutes: 0 });

    const earlyDepartures = completedRecords.reduce((acc, record) => {
      const calculations = calculateHoursImmediately(record) || record;
      if (calculations.undertimeMinutes > 0) {
        acc++;
      }
      return acc;
    }, 0);

    const punctualityRate = completedRecords.length > 0 ? 
      (((completedRecords.length - lateArrivals.count) / completedRecords.length) * 100).toFixed(1) : 0;
    
    const averageLateMinutes = lateArrivals.count > 0 ? 
      (lateArrivals.totalMinutes / lateArrivals.count).toFixed(1) : 0;

    const perfectAttendance = completedRecords.filter(record => {
      const calculations = calculateHoursImmediately(record) || record;
      return calculations.lateMinutes === 0 && calculations.undertimeMinutes === 0;
    }).length;

    return {
      punctualityRate,
      averageLateMinutes,
      earlyDepartures,
      perfectAttendance,
      lateArrivals: lateArrivals.count
    };
  }, []);

  const calculateTrendMetrics = useCallback((records) => {
    const weeklyData = records.reduce((acc, record) => {
      const date = new Date(record.punchIn);
      const week = getWeekKey(date);
      
      if (!acc[week]) {
        acc[week] = {
          totalHours: 0,
          recordCount: 0,
          lateCount: 0,
          overtimeHours: 0
        };
      }
      
      const calculations = calculateHoursImmediately(record) || record;
      acc[week].totalHours += calculations.totalHours || 0;
      acc[week].recordCount += 1;
      acc[week].overtimeHours += calculations.overtimeHours || 0;
      
      if (calculations.lateMinutes > 0) {
        acc[week].lateCount += 1;
      }
      
      return acc;
    }, {});

    const weeks = Object.keys(weeklyData).sort().slice(-4);
    
    return {
      weeklyAverageHours: weeks.map(week => ({
        week,
        average: (weeklyData[week].totalHours / weeklyData[week].recordCount).toFixed(2)
      })),
      weeklyOvertimeTrend: weeks.map(week => ({
        week,
        overtime: weeklyData[week].overtimeHours.toFixed(2)
      })),
      weeklyPunctuality: weeks.map(week => ({
        week,
        punctuality: ((weeklyData[week].recordCount - weeklyData[week].lateCount) / weeklyData[week].recordCount * 100).toFixed(1)
      }))
    };
  }, []);

  const calculateMetrics = useCallback(async () => {
    setLoading(true);
    
    try {
      let allRecords = attendanceRecords;
      
      if (selectedDateRange) {
        const attendanceRef = collection(db, 'attendance');
        const q = query(attendanceRef, orderBy('punchIn', 'desc'));
        const querySnapshot = await getDocs(q);
        
        allRecords = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          allRecords.push({
            id: doc.id,
            ...data,
            punchIn: data.punchIn?.toDate ? data.punchIn.toDate() : new Date(data.punchIn),
            punchOut: data.punchOut?.toDate ? data.punchOut.toDate() : (data.punchOut ? new Date(data.punchOut) : null)
          });
        });
      }

      const calculatedMetrics = {
        overview: calculateOverviewMetrics(allRecords),
        productivity: calculateProductivityMetrics(allRecords),
        attendance: calculateAttendanceMetrics(allRecords),
        trends: calculateTrendMetrics(allRecords)
      };

      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Error calculating metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [attendanceRecords, selectedDateRange, calculateOverviewMetrics, calculateProductivityMetrics, calculateAttendanceMetrics, calculateTrendMetrics]);

  useEffect(() => {
    if (attendanceRecords.length > 0) {
      calculateMetrics();
    }
  }, [attendanceRecords, calculateMetrics]);


  const MetricCard = ({ title, value, subtitle, icon, color = 'primary', trend = null }) => (
    <div className="col-md-3 mb-3">
      <div className={`card border-${color} h-100`}>
        <div className="card-body text-center">
          <div className={`text-${color} fs-1 mb-2`}>{icon}</div>
          <h5 className="card-title">{title}</h5>
          <h3 className={`text-${color} fw-bold`}>{value}</h3>
          {subtitle && <p className="card-text text-muted small">{subtitle}</p>}
          {trend && (
            <span className={`badge ${trend.type === 'up' ? 'bg-success' : trend.type === 'down' ? 'bg-danger' : 'bg-secondary'}`}>
              {trend.type === 'up' ? '' : trend.type === 'down' ? '' : ''} {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Calculating metrics...</span>
        </div>
        <p className="mt-2">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="metrics-dashboard">
      {/* Overview Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="mb-3">Daily Overview</h4>
        </div>
        <MetricCard 
          title="Total Employees" 
          value={metrics.overview.totalEmployees} 
          icon="👥" 
          color="primary"
        />
        <MetricCard 
          title="Present Today" 
          value={metrics.overview.presentToday} 
          subtitle={`${metrics.overview.attendanceRate}% attendance rate`}
          color="success"
        />
        <MetricCard 
          title="Absent Today" 
          value={metrics.overview.absentToday} 
          color="danger"
        />
        <MetricCard 
          title="Active Sessions" 
          value={metrics.overview.activeRecords} 
          subtitle="Currently clocked in"
          color="warning"
        />
      </div>

      {/* Productivity Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="mb-3"> Productivity Metrics</h4>
        </div>
        <MetricCard 
          title="Avg Hours/Day" 
          value={metrics.productivity.averageHoursPerDay}
          subtitle="Per completed session"
        
          color="info"
        />
        <MetricCard 
          title="Total Overtime" 
          value={`${metrics.productivity.totalOvertime}h`}
          subtitle={`${metrics.productivity.overtimePercentage}% of total hours`}
          
          color="warning"
        />
        <MetricCard 
          title="Regular Hours" 
          value={`${metrics.productivity.totalRegularHours}h`}
        
          color="success"
        />
        <MetricCard 
          title="Night Differential" 
          value={`${metrics.productivity.totalNightDiff}h`}
          subtitle="Night shift hours"
          icon="🌙" 
          color="dark"
        />
      </div>

      {/* Attendance Quality Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="mb-3"> Attendance Quality</h4>
        </div>
        <MetricCard 
          title="Punctuality Rate" 
          value={`${metrics.attendance.punctualityRate}%`}
          subtitle="On-time arrivals"
          color="success"
        />
        <MetricCard 
          title="Late Arrivals" 
          value={metrics.attendance.lateArrivals}
          subtitle={`Avg: ${metrics.attendance.averageLateMinutes} min late`}
          color="warning"
        />
        <MetricCard 
          title="Early Departures" 
          value={metrics.attendance.earlyDepartures} 
          color="danger"
        />
        <MetricCard 
          title="Perfect Attendance" 
          value={metrics.attendance.perfectAttendance}
          subtitle="No late/early records"
          color="primary"
        />
      </div>

      {/* Trend Analysis */}
      {metrics.trends.weeklyAverageHours && metrics.trends.weeklyAverageHours.length > 0 && (
        <div className="row">
          <div className="col-12">
            <h4 className="mb-3">4-Week Trends</h4>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-header">
                <h6>Weekly Average Hours</h6>
              </div>
              <div className="card-body">
                {metrics.trends.weeklyAverageHours.map((week, index) => (
                  <div key={index} className="d-flex justify-content-between mb-2">
                    <span>Week {new Date(week.week).toLocaleDateString()}</span>
                    <strong>{week.average}h</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-header">
                <h6>Weekly Overtime Trend</h6>
              </div>
              <div className="card-body">
                {metrics.trends.weeklyOvertimeTrend.map((week, index) => (
                  <div key={index} className="d-flex justify-content-between mb-2">
                    <span>Week {new Date(week.week).toLocaleDateString()}</span>
                    <strong>{week.overtime}h</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-header">
                <h6>Weekly Punctuality</h6>
              </div>
              <div className="card-body">
                {metrics.trends.weeklyPunctuality.map((week, index) => (
                  <div key={index} className="d-flex justify-content-between mb-2">
                    <span>Week {new Date(week.week).toLocaleDateString()}</span>
                    <strong>{week.punctuality}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricsDashboard;