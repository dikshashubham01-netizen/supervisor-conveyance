import * as XLSX from 'xlsx';

/**
 * Maps duty session records into the exact 13 specified columns:
 * Date | Supervisor | Employee ID | Start Time | End Time | Start KM | End KM | GPS KM | Odometer KM | Approved KM | Rate | Conveyance | Status
 */
export function formatReportRows(sessions) {
  return sessions.map((s) => {
    const formatTimestamp = (ts) => {
      if (!ts) return { date: 'N/A', time: 'N/A' };
      const d = ts instanceof Date ? ts : new Date(ts);
      if (isNaN(d.getTime())) {
        const str = String(ts);
        const parts = str.split(' ');
        return { date: parts[0] || str, time: parts[1] || '' };
      }
      const dateStr = d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      return { date: dateStr, time: timeStr };
    };

    const startFormatted = formatTimestamp(s.start_time);
    const endFormatted = s.end_time ? formatTimestamp(s.end_time) : { date: '', time: 'In Progress' };

    return {
      'Date': startFormatted.date,
      'Supervisor': s.supervisor_name || s.name || 'Unknown',
      'Employee ID': s.employee_id || 'N/A',
      'Start Time': startFormatted.time,
      'End Time': endFormatted.time,
      'Start KM': s.start_odometer_final != null ? s.start_odometer_final : 'N/A',
      'End KM': s.end_odometer_final != null ? s.end_odometer_final : 'N/A',
      'GPS KM': s.gps_distance_km != null ? Number(s.gps_distance_km).toFixed(2) : '0.00',
      'Odometer KM': s.odometer_distance_km != null ? Number(s.odometer_distance_km).toFixed(2) : '0.00',
      'Approved KM': s.approved_distance_km != null ? Number(s.approved_distance_km).toFixed(2) : '0.00',
      'Rate': s.conveyance_rate != null ? `₹${Number(s.conveyance_rate).toFixed(2)}` : 'N/A',
      'Conveyance': s.conveyance_amount != null ? `₹${Number(s.conveyance_amount).toFixed(2)}` : '₹0.00',
      'Status': s.status
    };
  });
}

/**
 * Generates CSV string
 */
export function generateCsv(sessions) {
  const data = formatReportRows(sessions);
  if (data.length === 0) {
    return 'Date,Supervisor,Employee ID,Start Time,End Time,Start KM,End KM,GPS KM,Odometer KM,Approved KM,Rate,Conveyance,Status\n';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Generates Excel buffer (.xlsx) using xlsx library
 */
export function generateExcelBuffer(sessions) {
  const data = formatReportRows(sessions);
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 18 }, // Supervisor
    { wch: 14 }, // Employee ID
    { wch: 12 }, // Start Time
    { wch: 12 }, // End Time
    { wch: 10 }, // Start KM
    { wch: 10 }, // End KM
    { wch: 10 }, // GPS KM
    { wch: 14 }, // Odometer KM
    { wch: 14 }, // Approved KM
    { wch: 10 }, // Rate
    { wch: 14 }, // Conveyance
    { wch: 20 }  // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conveyance Report');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
