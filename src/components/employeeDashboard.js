import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "./firebase";
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  Timestamp 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { formatTime, calculateHoursImmediately, formatDate } from "../utils/calculation";


function EmployeeDashboard() {
  const [userDetails, setUserDetails] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalPages = Math.ceil(attendanceRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = attendanceRecords.slice(startIndex, endIndex);

  const handlePageChange = (pageNumber, e) => {
    if (e) e.preventDefault();
    if (pageNumber >= 1 && pageNumber <= totalPages && pageNumber !== currentPage && !loading) {
      setCurrentPage(pageNumber);
      document.getElementById('attendance-table')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [attendanceRecords.length, currentPage, totalPages]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    pages.push(
      <li key="prev" className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={(e) => handlePageChange(currentPage - 1, e)}
          disabled={currentPage === 1 || loading}
        >
          &laquo; Previous
        </button>
      </li>
    );

    // First page
    if (startPage > 1) {
      pages.push(
        <li key={1} className="page-item">
          <button 
            className="page-link" 
            onClick={(e) => handlePageChange(1, e)}
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

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={(e) => handlePageChange(i, e)}
            disabled={loading}
          >
            {i}
          </button>
        </li>
      );
    }

    // Last page
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
            onClick={(e) => handlePageChange(totalPages, e)}
            disabled={loading}
          >
            {totalPages}
          </button>
        </li>
      );
    }

    // Next button
    pages.push(
      <li key="next" className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
        <button 
          className="page-link" 
          onClick={(e) => handlePageChange(currentPage + 1, e)}
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

  const fetchAttendanceRecords = useCallback(async (userId) => {
    try {
      const q = query(collection(db, 'attendance'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = a.punchIn?.toDate ? a.punchIn.toDate() : new Date(a.punchIn || 0);
        const dateB = b.punchIn?.toDate ? b.punchIn.toDate() : new Date(b.punchIn || 0);
        return dateB - dateA;
      });
      
      setAttendanceRecords(records);
      
      // Check if user is currently punched in
      const today = new Date().toDateString();
      const todayRecord = records.find(record => record.date === today && !record.punchOut);
      setIsPunchedIn(!!todayRecord);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserDetails(userDoc.data());
          await fetchAttendanceRecords(user.uid);
        } else {
          setError('User data not found');
        }
      } else {
        navigate('/');
      }
    } catch (error) {
      setError(`Error loading user data: ${error.message}`);
    }
    setLoading(false);
  }, [navigate, fetchAttendanceRecords]);

  const handlePunchIn = useCallback(async () => {
    setPunchLoading(true);
    setMessage("");
    
    try {
      const user = auth.currentUser;
      const now = new Date();
      const today = now.toDateString();
      
      // Check if already punched in today
      const todayRecord = attendanceRecords.find(record => 
        record.date === today && !record.punchOut
      );
      
      if (todayRecord) {
        setMessage("You are already punched in for today!");
        setPunchLoading(false);
        return;
      }

      const userTimezone = userDetails.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      await addDoc(collection(db, 'attendance'), {
        userId: user.uid,
        employeeName: `${userDetails.fname} ${userDetails.lname}`,
        punchIn: Timestamp.fromDate(now),
        punchInLocal: now.toLocaleString('en-US', { timeZone: userTimezone }),
        date: today,
        dateString: now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        status: 'active',
        scheduledStart: userDetails?.schedule?.start || '08:00',
        scheduledEnd: userDetails?.schedule?.end || '17:00',
        createdAt: Timestamp.fromDate(now)
      });
      
      setMessage("Successfully punched in!");
      setIsPunchedIn(true);
      await fetchAttendanceRecords(user.uid);
      
    } catch (error) {
      console.error('Error punching in:', error);
      setMessage("Error punching in. Please try again.");
    }
    
    setPunchLoading(false);
    setTimeout(() => setMessage(""), 5000);
  }, [attendanceRecords, userDetails, fetchAttendanceRecords]);

  const handlePunchOut = useCallback(async () => {
    setPunchLoading(true);
    setMessage("");
    
    try {
      const user = auth.currentUser;
      const now = new Date();
      const today = now.toDateString();
      
      const todayRecord = attendanceRecords.find(record => 
        record.date === today && !record.punchOut
      );
      
      if (!todayRecord) {
        setMessage("You need to punch in first!");
        setPunchLoading(false);
        return;
      }

      const userTimezone = userDetails.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Create record for calculation
      const recordForCalc = {
        ...todayRecord,
        punchOut: { toDate: () => now },
        scheduledStart: userDetails?.schedule?.start || '08:00',
        scheduledEnd: userDetails?.schedule?.end || '17:00'
      };

      // Calculate hours immediately
      const calculations = calculateHoursImmediately(recordForCalc);

      // Update with punch out and calculations
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        punchOut: Timestamp.fromDate(now),
        punchOutLocal: now.toLocaleString('en-US', { timeZone: userTimezone }),
        status: 'completed',
        updatedAt: Timestamp.fromDate(now),
        
        // Store calculated values
        ...(calculations && {
          regularHours: calculations.regularHours,
          overtimeHours: calculations.overtimeHours,
          nightDiffHours: calculations.nightDiffHours,
          lateMinutes: calculations.lateMinutes,
          undertimeMinutes: calculations.undertimeMinutes,
          totalHours: calculations.totalHours
        })
      });
      
      setMessage("Successfully punched out! Hours calculated automatically.");
      setIsPunchedIn(false);
      await fetchAttendanceRecords(user.uid);
      
    } catch (error) {
      console.error('Error punching out:', error);
      setMessage("Error punching out. Please try again.");
    }
    
    setPunchLoading(false);
    setTimeout(() => setMessage(""), 5000);
  }, [attendanceRecords, fetchAttendanceRecords, userDetails]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      navigate('/');
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  }, [navigate]);

  const getTodaysWorkTime = useCallback(() => {
    const today = new Date().toDateString();
    const todayRecord = attendanceRecords.find(record => record.date === today);
    
    if (!todayRecord || !todayRecord.punchIn) {
      return "Not started";
    }
    
    const punchIn = todayRecord.punchIn.toDate();
    const punchOut = todayRecord.punchOut ? todayRecord.punchOut.toDate() : new Date();
    const hours = (punchOut - punchIn) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hours`;
  }, [attendanceRecords]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await fetchUserData();
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [fetchUserData, navigate]);

  // Loading and error states
  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="text-primary mt-4"> Employee Dashboard</h2>
            <button className="btn btn-danger d-block me-4 " onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Welcome & Status Row */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-body">
              <h4 className="card-title">
                Welcome, {userDetails?.fname} {userDetails?.lname}!
              </h4>
              <div className="row">
                <div className="col-md-6">
                  <p className="mb-2"><strong>Email:</strong> {userDetails?.email}</p>
                  <p className="mb-2"><strong>Role:</strong> {userDetails?.role}</p>
                  <p className="mb-2"><strong>Schedule:</strong> {userDetails?.schedule?.start || '08:00'} - {userDetails?.schedule?.end || '17:00'}</p>
                </div>
                <div className="col-md-6">
                  <p className="mb-2"><strong>Timezone:</strong> {userDetails?.timezone || 'Auto'}</p>
                  <p className="mb-2"><strong>Current Time:</strong> {currentTime.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body text-center">
              <h5 className="card-title">Status</h5>
              <div className="mb-3">
                <span className={`badge fs-6 ${isPunchedIn ? 'bg-success' : 'bg-secondary'}`}>
                  {isPunchedIn ? 'Punched In' : 'Punched Out'}
                </span>
              </div>
              <p className="mb-0"><strong>Today's Work:</strong></p>
              <p className="h6 text-primary">{getTodaysWorkTime()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Punch In/Out Section */}
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title text-center mb-4">Time Tracking</h5>
              
              <div className="text-center">
                <div className="d-flex justify-content-center gap-4 mb-4">
                  <button 
                    className="btn btn-success btn-lg px-5 py-3"
                    onClick={handlePunchIn}
                    disabled={punchLoading || isPunchedIn}
                    style={{ minWidth: '180px' }}
                  >
                    {punchLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Processing...
                      </>
                    ) : (
                      'Punch In'
                    )}
                  </button>
                  
                  <button 
                    className="btn btn-danger btn-lg px-5 py-3"
                    onClick={handlePunchOut}
                    disabled={punchLoading || !isPunchedIn}
                    style={{ minWidth: '180px' }}
                  >
                    {punchLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Processing...
                      </>
                    ) : (
                      'Punch Out'
                    )}
                  </button>
                </div>

                {message && (
                  <div className={`alert ${message.includes('Error') || message.includes('already') ? 'alert-warning' : 'alert-success'}`} role="alert">
                    {message.includes('Error') ? '' : ''} {message}
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <div className="card" id="attendance-table">
            <div className="card-header bg-light">
              <div className="d-flex justify-content-between align-items-center flex-wrap">
                <h5 className="mb-0"> Attendance History</h5>
                <small className="text-muted">
                  Showing {attendanceRecords.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, attendanceRecords.length)} of {attendanceRecords.length}
                </small>
              </div>
            </div>
            <div className="card-body">
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: '3rem' }}></div>
                  <p className="text-muted mt-3">No attendance records found.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Date</th>
                        <th>In</th>
                        <th>Out</th>
                        <th className="d-none d-md-table-cell">Regular</th>
                        <th className="d-none d-lg-table-cell">OT</th>
                        <th className="d-none d-lg-table-cell">Night</th>
                        <th className="d-none d-md-table-cell">Late</th>
                        <th className="d-none d-lg-table-cell">Under</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRecords.map((record, index) => {
                        const calculations = record.regularHours !== undefined ? record : 
                          calculateHoursImmediately(record);
                
                        return (
                          <tr key={record.id || index}>
                            <td>{record.dateString || formatDate(record.punchIn)}</td>
                            <td className="small text-success">{formatTime(record.punchIn)}</td>
                            <td>
                              {record.punchOut ? 
                                <span className="text-danger">{formatTime(record.punchOut)}</span> : 
                                <span className="badge bg-primary">Active</span>
                              }
                            </td>
                            <td className="d-none d-md-table-cell">
                              {calculations?.regularHours !== undefined ? 
                                `${calculations.regularHours}h` : 
                                <span className="text-muted">--</span>
                              }
                            </td>
                            <td className="d-none d-lg-table-cell">
                              {calculations?.overtimeHours ? 
                                `${calculations.overtimeHours}h` : '--'
                              }
                            </td>
                            <td className="d-none d-lg-table-cell">
                              {calculations?.nightDiffHours ? 
                                `${calculations.nightDiffHours}h` : '--'
                              }
                            </td>
                            <td className="d-none d-md-table-cell">
                              {calculations?.lateMinutes ? 
                                `${calculations.lateMinutes}m` : '--'
                              }
                            </td>
                            <td className="d-none d-lg-table-cell">
                              {calculations?.undertimeMinutes ? 
                                `${calculations.undertimeMinutes}m` : '--'
                              }
                            </td>
                            <td>
                              <span className={`badge ${record.punchOut ? 'bg-success' : 'bg-primary'}`}>
                                {record.punchOut ? 'Completed' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-center mt-3">
                      {renderPagination()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboard;