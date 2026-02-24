export const calculateHoursImmediately = (record) => {
  if (!record.punchIn || !record.punchOut) return null;
  
  const punchIn = record.punchIn.toDate ? record.punchIn.toDate() : new Date(record.punchIn);
  const punchOut = record.punchOut.toDate ? record.punchOut.toDate() : new Date(record.punchOut);
  
  const totalMs = punchOut - punchIn;
  const totalHours = totalMs / (1000 * 60 * 60);
  
  const scheduledStart = record.scheduledStart || '08:00';
  const scheduledEnd = record.scheduledEnd || '17:00';
  const [startHour, startMin] = scheduledStart.split(':').map(Number);
  const [endHour, endMin] = scheduledEnd.split(':').map(Number);
  const scheduledHours = (endHour + endMin/60) - (startHour + startMin/60);
  
 
  const scheduledStartTime = new Date(punchIn);
  scheduledStartTime.setHours(startHour, startMin, 0, 0);
  const lateMinutes = Math.max(0, (punchIn - scheduledStartTime) / (1000 * 60));

  const scheduledEndTime = new Date(punchOut);
  scheduledEndTime.setHours(endHour, endMin, 0, 0);
  const undertimeMinutes = Math.max(0, (scheduledEndTime - punchOut) / (1000 * 60));
  
  const regularHours = Math.min(totalHours, scheduledHours);
  const overtimeHours = Math.max(0, totalHours - scheduledHours);
  
 
  let nightHours = 0;
  const startHourOfDay = punchIn.getHours();
  const endHourOfDay = punchOut.getHours();
  
  if (startHourOfDay >= 22 || startHourOfDay < 6 || endHourOfDay >= 22 || endHourOfDay < 6) {

    nightHours = totalHours * 0.1; 
  }
  
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    nightDiffHours: Math.round(nightHours * 100) / 100,
    lateMinutes: Math.round(lateMinutes),
    undertimeMinutes: Math.round(undertimeMinutes)
  };
};

export const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};