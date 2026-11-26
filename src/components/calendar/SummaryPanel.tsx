/** สรุปสถานะงานของฉัน (ในช่วงที่แสดงในปฏิทิน) */
export function SummaryPanel({ done, cancelled, edit }: { done: number; cancelled: number; edit: number }) {
  return (
        <section className="panel side-panel bottom-panel sum-panel">
          <div className="today-head"><h2>สรุปสถานะงานของฉัน</h2><span className="muted" style={{ fontSize: 13 }}>ในช่วงที่แสดงในปฏิทิน</span></div>
          <div className="sum-grid">
            <div className="sum-box sum-done"><strong>{done}</strong><span>เสร็จสิ้น</span></div>
            <div className="sum-box sum-cancel"><strong>{cancelled}</strong><span>ยกเลิก</span></div>
            <div className="sum-box sum-edit"><strong>{edit}</strong><span>แก้ไข (ส่งกลับ)</span></div>
          </div>
        </section>
  );
}
