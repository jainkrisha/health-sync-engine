import { describe, expect, it } from 'vitest';
import type { Patient } from '@shared/types';
import { buildExport, patientRows } from './exportPatients';
import { crc32, toCsv } from './spreadsheet';

const patient: Patient = {
  id: 'p1',
  name: 'Asha "Tai" Patil',
  dateOfBirth: '1984-03-12',
  gender: 'female',
  bloodType: 'B+',
  contactNumber: '+91 98200 12345',
  allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Hives, swelling' }],
  medications: [{ name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', startDate: '2026-06-01', endDate: '', openConflictIds: ['c1'] }],
  vitals: [{ id: 'v1', recordedAt: '2026-10-01T04:30:00.000Z', recordedBy: 'Dr. Priya', heartRate: 78, bloodPressure: '128/84' }],
  deleted: false,
  hasOpenConflicts: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-01T04:30:00.000Z',
  createdBy: 'u1',
};
const today = new Date(2026, 9, 24);

/** Reads the stored (uncompressed) zip that toXlsx writes. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen));
    const data = bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, new TextDecoder().decode(data));
    at += 30 + nameLen + size;
  }
  return files;
}

describe('patient export', () => {
  it('writes one row per patient with readable columns', () => {
    const [head, row] = patientRows([patient], today);
    expect(head[0]).toBe('Name');
    expect(row).toContain(42); // age on 24 Oct 2026
    expect(row).toContain('Penicillin (severe, Hives, swelling)');
    expect(row).toContain('Metformin 500 mg Twice daily');
    expect(row).toContain('128/84');
    expect(row).toContain('Yes');
  });

  it('quotes CSV cells and keeps formulas from running', () => {
    expect(toCsv([['a,b', 'say "hi"', '=SUM(A1)', '+91 98200', 3]])).toBe('"a,b","say ""hi""",\'=SUM(A1),\'+91 98200,3\r\n');
    const { data, filename, type } = buildExport([patient], 'csv', today);
    expect([...data.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte-order mark for Excel
    const text = new TextDecoder().decode(data);
    expect(text).toContain('"Asha ""Tai"" Patil"');
    expect(filename).toBe('patient-asha-tai-patil-2026-10-24.csv');
    expect(type).toContain('text/csv');
  });

  it('builds a valid xlsx workbook with four sheets', () => {
    const { data, filename } = buildExport([patient, { ...patient, id: 'p2', name: 'Ramesh <Jadhav>' }], 'xlsx', today);
    expect(filename).toBe('patients-2026-10-24.xlsx');
    const files = unzip(data);
    expect([...files.keys()]).toEqual(
      expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet4.xml']),
    );
    expect(files.get('xl/workbook.xml')).toContain('name="Medicines"');
    const sheet1 = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet1).toContain('Ramesh &lt;Jadhav&gt;');
    expect(sheet1).toContain('<c r="C2"><v>42</v></c>');
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('Metformin');
  });
});
