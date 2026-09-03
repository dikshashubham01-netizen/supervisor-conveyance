import * as XLSX from 'xlsx';

/**
 * Maps duty session records into the exact 13 specified columns:
 * Date | Supervisor | Employee ID | Start Time | End Time | Start KM | End KM | GPS KM | Odometer KM | Approved KM | Rate | Conveyance | Status
 */
export function formatReportRows(sessions) {
  return sessions.map((s) => {
    const startDate = s.start_time ? s.start_time.split(' ')[0] : 'N/A';
    const startTime = s.start_time ? s.start_time.split(' ')[1] || s.start_time : 'N/A';
    const endTime = s.end_time ? s.end_time.split(' ')[1] || s.end_time : 'In Progress';

    return {
      'Date': startDate,
      'Supervisor': s.supervisor_name || s.name || 'Unknown',
      'Employee ID': s.employee_id || 'N/A',
      'Start Time': startTime,
      'End Time': endTime,
      'Start KM': s.start_odometer_final != null ? s.start_odometer_final : 'N/A',
      'End KM': s.end_odometer_final != null ? s.end_odometer_final : 'N/A',
      'GPS KM': s.gps_distance_km != null ? s.gps_distance_km.toFixed(2) : '0.00',
      'Odometer KM': s.odometer_distance_km != null ? s.odometer_distance_km.toFixed(2) : '0.00',
      'Approved KM': s.approved_distance_km != null ? s.approved_distance_km.toFixed(2) : '0.00',
      'Rate': s.conveyance_rate != null ? `₹${s.conveyance_rate.toFixed(2)}` : 'N/A',
      'Conveyance': s.conveyance_amount != null ? `₹${s.conveyance_amount.toFixed(2)}` : '₹0.00',
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
