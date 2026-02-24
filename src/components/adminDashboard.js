import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  limit,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';
import { db } from './firebase';

function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportWeek, setReportWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [viewMode, setViewMode] = useState('employee');
  
  const [selectedEmployeeForMetrics, setSelectedEmployeeForMetrics] = useState('');
  

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage] = useState(10);
  const [lastVisible, setLastVisible] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
    setWeekDefault();
  }, []);

  const setWeekDefault = () => {
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    setReportWeek(monday.toISOString().split('T')[0]);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'employee'));
      const querySnapshot = await getDocs(q);
      
      const employeesList = [];
      querySnapshot.forEach((doc) => {
        employeesList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setEmployees(employeesList);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async (page = 1) => {
    if (!selectedEmployee) return;
    
    setLoading(true);
    try {
      const attendanceRef = collection(db, 'attendance');
      
      const countQuery = query(attendanceRef, where('userId', '==', selectedEmployee));
      const countSnapshot = await getCountFromServer(countQuery);
      setTotalRecords(countSnapshot.data().count);

      let q = query(
        attendanceRef, 
        where('userId', '==', selectedEmployee),
        orderBy('punchIn', 'desc'),
        limit(recordsPerPage)
      );

      if (page > 1 && lastVisible) {
        const offset = (page - 1) * recordsPerPage;
        
        const offsetQuery = query(
          attendanceRef, 
          where('userId', '==', selectedEmployee),
          orderBy('punchIn', 'desc'),
          limit(offset)
        );
        const offsetSnapshot = await getDocs(offsetQuery);
        const offsetDocs = offsetSnapshot.docs;
        
        if (offsetDocs.length > 0) {
          q = query(
            attendanceRef, 
            where('userId', '==', selectedEmployee),
            orderBy('punchIn', 'desc'),
            startAfter(offsetDocs[offsetDocs.length - 1]),
            limit(recordsPerPage)
          );
        }
      }

      const querySnapshot = await getDocs(q);
      const records = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        records.push({
          id: doc.id,
          ...data,
          punchIn: data.punchIn?.toDate ? data.punchIn.toDate() : new Date(data.punchIn),
          punchOut: data.punchOut?.toDate ? data.punchOut.toDate() : (data.punchOut ? new Date(data.punchOut) : null)
        });
      });
      
      setAttendanceRecords(records);
      setCurrentPage(page);
      
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setMessage('Error fetching attendance records');
    }
    setLoading(false);
  };

  const generateReport = async (page = 1) => {
    
    if (!selectedEmployeeForMetrics) {
      setMessage('Please select an employee for the metrics report');
      return;
    }

    setLoading(true);
    try {
      const attendanceRef = collection(db, 'attendance');
      let startDate, endDate;

      if (reportType === 'daily') {
        startDate = new Date(reportDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(reportDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(reportWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }

      const countQuery = query(
        attendanceRef,
        where('userId', '==', selectedEmployeeForMetrics),
        where('punchIn', '>=', Timestamp.fromDate(startDate)),
        where('punchIn', '<=', Timestamp.fromDate(endDate))
      );
      const countSnapshot = await getCountFromServer(countQuery);
      setTotalRecords(countSnapshot.data().count);

      let q = query(
        attendanceRef,
        where('userId', '==', selectedEmployeeForMetrics),
        where('punchIn', '>=', Timestamp.fromDate(startDate)),
        where('punchIn', '<=', Timestamp.fromDate(endDate)),
        orderBy('punchIn', 'desc'),
        limit(recordsPerPage)
      );

      if (page > 1 && lastVisible) {
        const offset = (page - 1) * recordsPerPage;
        const offsetQuery = query(
          attendanceRef,
          where('userId', '==', selectedEmployeeForMetrics),
          where('punchIn', '>=', Timestamp.fromDate(startDate)),
          where('punchIn', '<=', Timestamp.fromDate(endDate)),
          orderBy('punchIn', 'desc'),
          limit(offset)
        );
        const offsetSnapshot = await getDocs(offsetQuery);
        const offsetDocs = offsetSnapshot.docs;
        
        if (offsetDocs.length > 0) {
          q = query(
            attendanceRef,
            where('userId', '==', selectedEmployeeForMetrics),
            where('punchIn', '>=', Timestamp.fromDate(startDate)),
            where('punchIn', '<=', Timestamp.fromDate(endDate)),
            orderBy('punchIn', 'desc'),
            startAfter(offsetDocs[offsetDocs.length - 1]),
            limit(recordsPerPage)
          );
        }
      }

      const querySnapshot = await getDocs(q);
      const records = [];
      
      const selectedEmp = employees.find(emp => emp.id === selectedEmployeeForMetrics);
      
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        
        records.push({
          id: docSnap.id,
          ...data,
          employeeName: selectedEmp ? `${selectedEmp.fname} ${selectedEmp.lname}` : 'Unknown Employee',
          fname: selectedEmp?.fname || 'Unknown',
          lname: selectedEmp?.lname || 'Employee',
          punchIn: data.punchIn?.toDate ? data.punchIn.toDate() : new Date(data.punchIn),
          punchOut: data.punchOut?.toDate ? data.punchOut.toDate() : (data.punchOut ? new Date(data.punchOut) : null)
        });
      }
      
      setAttendanceRecords(records);
      setCurrentPage(page);
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      setMessage('Error generating report');
    }
    setLoading(false);
  };

  const handlePageChange = (newPage) => {
    if (viewMode === 'employee' && selectedEmployee) {
      fetchAttendanceRecords(newPage);
    } else if (viewMode === 'daily' || viewMode === 'weekly') {
      generateReport(newPage);
    }
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    pages.push(
      <li key="prev" className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
        >
          &laquo; Previous
        </button>
      </li>
    );

    if (startPage > 1) {
      pages.push(
        <li key={1} className="page-item">
          <button 
            className="page-link" 
            onClick={() => handlePageChange(1)}
            disabled={loading}
          >
            1
          </button>
        </li>
      );
      if (startPage > 2) {
        pages.push(
          <li key="ellipsis1" className="page-item disabled">
            <span className="page-link">...</span>
          </li>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => handlePageChange(i)}
            disabled={loading}
          >
            {i}
          </button>
        </li>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <li key="ellipsis2" className="page-item disabled">
            <span className="page-link">...</span>
          </li>
        );
      }
      pages.push(
        <li key={totalPages} className="page-item">
          <button 
            className="page-link" 
            onClick={() => handlePageChange(totalPages)}
            disabled={loading}
          >
            {totalPages}
          </button>
        </li>
      );
    }


    pages.push(
      <li key="next" className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
        >
          Next &raquo;
        </button>
      </li>
    );

    return (
      <nav aria-label="Page navigation">
        <ul className="pagination justify-content-center">
          {pages}
        </ul>
      </nav>
    );
  };

  const handleEditPunch = (record) => {
    setEditingRecord({
      ...record,
      punchIn: formatDateTimeForInput(record.punchIn),
      punchOut: record.punchOut ? formatDateTimeForInput(record.punchOut) : ''
    });
  };

  const formatDateTimeForInput = (dateTime) => {
    const date = new Date(dateTime);
    return date.toISOString().slice(0, 16);
  };

  const savePunchEdit = async () => {
    try {
      setLoading(true);
      const attendanceDoc = doc(db, 'attendance', editingRecord.id);
      
      const updateData = {
        punchIn: Timestamp.fromDate(new Date(editingRecord.punchIn))
      };

      if (editingRecord.punchOut) {
        updateData.punchOut = Timestamp.fromDate(new Date(editingRecord.punchOut));
      }

      await updateDoc(attendanceDoc, updateData);
      
      setMessage('Punch record updated successfully');
      setEditingRecord(null);
      
      if (viewMode === 'employee' && selectedEmployee) {
        fetchAttendanceRecords(currentPage);
      } else if (viewMode === 'daily' || viewMode === 'weekly') {
        generateReport(currentPage);
      }
    } catch (error) {
      console.error('Error updating punch:', error);
      setMessage('Error updating punch record');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (record) => {
    if (!record.punchIn || !record.punchOut) return null;

    const punchIn = new Date(record.punchIn);
    const punchOut = new Date(record.punchOut);
    const totalMinutes = (punchOut - punchIn) / (1000 * 60);
    const totalHours = totalMinutes / 60;

    const scheduledStart = 8 * 60;
    const scheduledEnd = 17 * 60;
    const punchInMinutes = punchIn.getHours() * 60 + punchIn.getMinutes();
    const punchOutMinutes = punchOut.getHours() * 60 + punchOut.getMinutes();

    const lateMinutes = Math.max(0, punchInMinutes - scheduledStart);
    const undertimeMinutes = Math.max(0, scheduledEnd - punchOutMinutes);
    
    const regularHours = Math.min(8, Math.max(0, totalHours));
    const overtimeHours = Math.max(0, totalHours - 8);
    
    let nightDiffHours = 0;
    const nightStart = 22 * 60;
    const nightEnd = 6 * 60;
    
    if (punchOutMinutes >= nightStart || punchInMinutes <= nightEnd) {
      if (punchInMinutes <= nightEnd && punchOutMinutes >= nightStart) {
        nightDiffHours = (nightEnd - punchInMinutes + punchOutMinutes - nightStart) / 60;
      } else if (punchInMinutes <= nightEnd) {
        nightDiffHours = (nightEnd - punchInMinutes) / 60;
      } else if (punchOutMinutes >= nightStart) {
        nightDiffHours = (punchOutMinutes - nightStart) / 60;
      }
      nightDiffHours = Math.max(0, Math.min(nightDiffHours, totalHours));
    }

    return {
      regularHours: regularHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      nightDiffHours: nightDiffHours.toFixed(2),
      lateMinutes: Math.round(lateMinutes),
      undertimeMinutes: Math.round(undertimeMinutes),
      totalHours: totalHours.toFixed(2)
    };
  };

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    navigate('/');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const resetPagination = () => {
    setCurrentPage(1);
    setTotalRecords(0);
    setLastVisible(null);
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    setAttendanceRecords([]);
    setSelectedEmployee('');
    setSelectedEmployeeForMetrics('');
    resetPagination();
  };

  const getSelectedEmployeeName = () => {
    if (viewMode === 'employee' && selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      return emp ? `${emp.fname} ${emp.lname}` : 'Unknown Employee';
    }
    if ((viewMode === 'daily' || viewMode === 'weekly') && selectedEmployeeForMetrics) {
      const emp = employees.find(e => e.id === selectedEmployeeForMetrics);
      return emp ? `${emp.fname} ${emp.lname}` : 'Unknown Employee';
    }
    return '';
  };

  const renderMetricsSummary = () => {
    if (attendanceRecords.length === 0) return null;

    const completedRecords = attendanceRecords.filter(r => r.punchOut);
    const totals = completedRecords.reduce((acc, record) => {
      const metrics = calculateMetrics(record);
      if (metrics) {
        acc.totalHours += parseFloat(metrics.totalHours);
        acc.regularHours += parseFloat(metrics.regularHours);
        acc.overtimeHours += parseFloat(metrics.overtimeHours);
        acc.nightDiffHours += parseFloat(metrics.nightDiffHours);
        acc.lateMinutes += metrics.lateMinutes;
        acc.undertimeMinutes += metrics.undertimeMinutes;
        acc.lateCount += metrics.lateMinutes > 0 ? 1 : 0;
      }
      return acc;
    }, {
      totalHours: 0, regularHours: 0, overtimeHours: 0, 
      nightDiffHours: 0, lateMinutes: 0, undertimeMinutes: 0, lateCount: 0
    });

    const employeeName = getSelectedEmployeeName();

    return (
      <div className="mt-4">
        <div className="row">
          <div className="col-md-12">
            <h6 className={`text-${viewMode === 'daily' ? 'primary' : viewMode === 'weekly' ? 'success' : 'info'}`}>
              {viewMode === 'daily' ? 'Daily' : viewMode === 'weekly' ? 'Weekly' : 'Employee'} Summary
              {employeeName && ` - ${employeeName}`}
            </h6>
          </div>
        </div>
        <div className="row">
          <div className="col-md-2">
            <div className="card border-primary">
              <div className="card-body text-center p-2">
                <h6 className="text-primary">Records</h6>
                <h4 className="text-primary">{totalRecords}</h4>
                <small>{attendanceRecords.filter(r => !r.punchOut).length} active</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card border-success">
              <div className="card-body text-center p-2">
                <h6 className="text-success">Total Hours</h6>
                <h4 className="text-success">{totals.totalHours.toFixed(1)}</h4>
                <small>{viewMode === 'weekly' ? 'This week' : 'Total'}</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card border-info">
              <div className="card-body text-center p-2">
                <h6 className="text-info">Regular Hours</h6>
                <h4 className="text-info">{totals.regularHours.toFixed(1)}h</h4>
                <small>Standard time</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card border-warning">
              <div className="card-body text-center p-2">
                <h6 className="text-warning">Overtime</h6>
                <h4 className="text-warning">{totals.overtimeHours.toFixed(1)}h</h4>
                <small>{totals.totalHours > 0 ? ((totals.overtimeHours/totals.totalHours)*100).toFixed(0) : 0}% of total</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card border-danger">
              <div className="card-body text-center p-2">
                <h6 className="text-danger">Late Rate</h6>
                <h4 className="text-danger">{completedRecords.length > 0 ? ((totals.lateCount/completedRecords.length)*100).toFixed(0) : 0}%</h4>
                <small>{totals.lateCount} instances</small>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card border-dark">
              <div className="card-body text-center p-2">
                <h6 className="text-dark">Night Hours</h6>
                <h4 className="text-dark">{totals.nightDiffHours.toFixed(1)}h</h4>
                <small>Night shift</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="text-primary">Admin Dashboard</h2>
            <button className="btn btn-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <div className="btn-group w-100" role="group">
                <button 
                  type="button" 
                  className={`btn ${viewMode === 'employee' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => changeViewMode('employee')}
                >
                  Employee Records & Edit
                </button>
                <button 
                  type="button" 
                  className={`btn ${viewMode === 'daily' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => changeViewMode('daily')}
                >
                  Daily Employee Metrics
                </button>
                <button 
                  type="button" 
                  className={`btn ${viewMode === 'weekly' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => changeViewMode('weekly')}
                >
                  Weekly Employee Metrics
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'employee' && (
         <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-primary">
              <div className="card-body">
                <h5 className="card-title"> Select Employee for Records</h5>
                <div className="row ">
                  <div className="col-md-6 offset-md-3">
                    <select 
                      className="form-select"
                      value={selectedEmployee}
                      onChange={(e) => {
                        setSelectedEmployee(e.target.value);
                        resetPagination();
                      }}
                      disabled={loading}
                    >
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fname} {emp.lname} - {emp.email}
                        </option>
                      ))}
                    </select>
                  </div>
                 <div className="row mt-3">
                  <div className="col-md-12 text-center">
                    <button 
                      className="btn btn-primary w-10"
                      onClick={() => fetchAttendanceRecords(1)}
                      disabled={!selectedEmployee || loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Loading...
                        </>
                      ) : (
                        'Load Records'
                      )}
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'daily' && (
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-primary">
              <div className="card-body">
                <h5 className="card-title"> Daily Employee Metrics</h5>
                <div className="row  ">
                  <div className="col-md-4 offset-md-2">
                    <label className="form-label">👤 Select Employee</label>
                    <select 
                      className="form-select"
                      value={selectedEmployeeForMetrics}
                      onChange={(e) => {
                        setSelectedEmployeeForMetrics(e.target.value);
                        resetPagination();
                      }}
                      disabled={loading}
                    >
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fname} {emp.lname} - {emp.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label"> Select Date</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={reportDate}
                      onChange={(e) => {
                        setReportDate(e.target.value);
                        setReportType('daily');
                        resetPagination();
                      }}
                    />
                  </div>
                    <div className="row mt-3">
                  <div className="col-md-12 text-center">
                    <button 
                      className="btn btn-primary w-30"
                      onClick={() => {setReportType('daily'); generateReport(1);}}
                      disabled={!selectedEmployeeForMetrics || loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Loading...
                        </>
                      ) : (
                        ' Load Daily Metrics'
                      )}
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'weekly' && (
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-primary">
              <div className="card-body">
                <h5 className="card-title">Weekly Employee Metrics</h5>
                <div className="row justify-content-center">
                  <div className="col-md-3">
                    <label className="form-label"> Select Employee</label>
                    <select 
                      className="form-select"
                      value={selectedEmployeeForMetrics}
                      onChange={(e) => {
                        setSelectedEmployeeForMetrics(e.target.value);
                        resetPagination();
                      }}
                      disabled={loading}
                    >
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fname} {emp.lname} - {emp.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label"> Week Start Date</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={reportWeek}
                      onChange={(e) => {
                        setReportWeek(e.target.value);
                        setReportType('weekly');
                        resetPagination();
                      }}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label"> Week End Date</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={reportWeek ? (() => {
                        const startDate = new Date(reportWeek);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 6);
                        return endDate.toISOString().split('T')[0];
                      })() : ''}
                      readOnly
                      style={{backgroundColor: '#f8f9fa'}}
                    />
                
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-12 text-center">
                    <button 
                      className="btn btn-primary btn-lg"
                      onClick={() => {setReportType('weekly'); generateReport(1);}}
                      disabled={!selectedEmployeeForMetrics || loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Loading...
                        </>
                      ) : (
                        ' Load Weekly Metrics'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {attendanceRecords.length > 0 && (
        <div className="row">
          <div className="col">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    {viewMode === 'employee' && selectedEmployee 
                      ? ` ${getSelectedEmployeeName()} - Attendance Records & Edit`
                      : viewMode === 'daily'
                      ? ` ${getSelectedEmployeeName()} - Daily Metrics (${reportDate})`
                      : ` ${getSelectedEmployeeName()} - Weekly Metrics (Week of ${reportWeek})`
                    }
                  </h5>
                  <span className="badge bg-light text-dark">
                    Showing {((currentPage - 1) * recordsPerPage) + 1}-{Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords}
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-hover table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Date</th>
                        <th> Punch In</th>
                        <th>Punch Out</th>
                        <th> Regular</th>
                        <th> Overtime</th>
                        <th> Night</th>
                        <th> Late</th>
                        <th> Under</th>
                        <th> Total</th>
                        <th> Status</th>
                        {viewMode === 'employee' && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRecords.map((record, index) => {
                        const metrics = calculateMetrics(record);
                        return (
                          <tr key={record.id || index} className={!record.punchOut ? 'table-warning' : ''}>
                            <td>
                              <small>{formatDate(record.punchIn)}</small>
                            </td>
                            <td>
                              <span className="badge bg-info">
                                {formatTime(record.punchIn)}
                              </span>
                            </td>
                            <td>
                              {record.punchOut 
                                ? <span className="badge bg-success">{formatTime(record.punchOut)}</span>
                                : <span className="badge bg-warning"> Active</span>
                              }
                            </td>
                            <td>
                              <span className={`badge ${metrics ? 'bg-success' : 'bg-secondary'}`}>
                                {metrics ? `${metrics.regularHours}h` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${metrics && parseFloat(metrics.overtimeHours) > 0 ? 'bg-warning' : 'bg-light text-dark'}`}>
                                {metrics ? `${metrics.overtimeHours}h` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${metrics && parseFloat(metrics.nightDiffHours) > 0 ? 'bg-info' : 'bg-light text-dark'}`}>
                                {metrics ? `${metrics.nightDiffHours}h` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${metrics && metrics.lateMinutes > 0 ? 'bg-danger' : 'bg-light text-dark'}`}>
                                {metrics ? `${metrics.lateMinutes}m` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${metrics && metrics.undertimeMinutes > 0 ? 'bg-secondary' : 'bg-light text-dark'}`}>
                                {metrics ? `${metrics.undertimeMinutes}m` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {metrics ? `${metrics.totalHours}h` : '--'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${record.punchOut ? 'bg-success' : 'bg-warning'}`}>
                                {record.punchOut ? ' Complete' : ' Active'}
                              </span>
                            </td>
                            {viewMode === 'employee' && (
                              <td>
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleEditPunch(record)}
                                  disabled={loading}
                                >
                                   Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {renderPagination()}
                
                {renderMetricsSummary()}
              </div>
            </div>
          </div>
        </div>
      )}

      {attendanceRecords.length === 0 && !loading && (
        <div className="row">
          <div className="col">
            <div className="alert alert-info">
              <h5>📭 No Records Found</h5>
              <p>
                {viewMode === 'employee' && !selectedEmployee && 'Please select an employee to view their records.'}
                {viewMode === 'employee' && selectedEmployee && 'No attendance records found for the selected employee.'}
                {viewMode === 'daily' && !selectedEmployeeForMetrics && 'Please select an employee to view daily metrics.'}
                {viewMode === 'daily' && selectedEmployeeForMetrics && `No attendance records found for ${getSelectedEmployeeName()} on ${reportDate}.`}
                {viewMode === 'weekly' && !selectedEmployeeForMetrics && 'Please select an employee to view weekly metrics.'}
                {viewMode === 'weekly' && selectedEmployeeForMetrics && `No attendance records found for ${getSelectedEmployeeName()} for the week starting ${reportWeek}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Punch Modal */}
      {editingRecord && (
        <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title"> Edit Punch Record</h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setEditingRecord(null)}
                  disabled={loading}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label">Punch In</label>
                    <input 
                      type="datetime-local"
                      className="form-control"
                      value={editingRecord.punchIn}
                      onChange={(e) => setEditingRecord({...editingRecord, punchIn: e.target.value})}
                      disabled={loading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Punch Out</label>
                    <input 
                      type="datetime-local"
                      className="form-control"
                      value={editingRecord.punchOut}
                      onChange={(e) => setEditingRecord({...editingRecord, punchOut: e.target.value})}
                      disabled={loading}
                    />
                    <small className="form-text text-muted">Leave empty if still active</small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setEditingRecord(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={savePunchEdit}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    ' Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className="position-fixed bottom-0 end-0 p-3" style={{zIndex: 1100}}>
          <div className={`toast show ${message.includes('Error') ? 'text-bg-danger' : 'text-bg-success'}`}>
            <div className="toast-header">
              <strong className="me-auto">
                {message.includes('Error') ? ' Error' : ' Success'}
              </strong>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setMessage('')}
              ></button>
            </div>
            <div className="toast-body">
              {message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;