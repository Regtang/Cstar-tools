// 喜事达 Cstar 装箱软件 —— 多语言支持（中/英/韩/泰/马来/越南）
// 词典以中文原文为键。zh 直接返回原文；其他语言查表，缺失则回退中文。
// 引擎：t() 用于 app.js 中带数字拼接的动态文案；
//       applyStatic()+MutationObserver 自动翻译静态 HTML 与动态整句文案。
(function () {
  const LANGS = [
    ["zh", "中文"],
    ["en", "English"],
    ["ko", "한국어"],
    ["th", "ไทย"],
    ["ms", "Bahasa Melayu"],
    ["vi", "Tiếng Việt"],
  ];

  // 词典：键 = 中文，值 = { en, ko, th, ms, vi }
  const DICT = {
    // —— 品牌 / 导航 / 顶栏 / 状态 ——
    "喜事达 Cstar": { en: "Cstar", ko: "Cstar", th: "Cstar", ms: "Cstar", vi: "Cstar" },
    "装箱软件": { en: "Container Packer", ko: "컨테이너 적재", th: "ซอฟต์แวร์จัดตู้", ms: "Pemuat Kontena", vi: "Phần mềm xếp container" },
    "版本 1.4.0": { en: "Version 1.4.0", ko: "버전 1.4.0", th: "เวอร์ชัน 1.4.0", ms: "Versi 1.4.0", vi: "Phiên bản 1.4.0" },
    "主导航": { en: "Main navigation", ko: "주 메뉴", th: "เมนูหลัก", ms: "Navigasi utama", vi: "Điều hướng chính" },
    "工作台": { en: "Workspace", ko: "작업대", th: "พื้นที่ทำงาน", ms: "Ruang kerja", vi: "Bàn làm việc" },
    "货物清单": { en: "Cargo list", ko: "화물 목록", th: "รายการสินค้า", ms: "Senarai kargo", vi: "Danh sách hàng" },
    "装箱报告": { en: "Packing report", ko: "적재 보고서", th: "รายงานการจัดตู้", ms: "Laporan pemuatan", vi: "Báo cáo xếp hàng" },
    "帮助": { en: "Help", ko: "도움말", th: "ช่วยเหลือ", ms: "Bantuan", vi: "Trợ giúp" },
    "待计算": { en: "Awaiting calculation", ko: "계산 대기", th: "รอการคำนวณ", ms: "Menunggu pengiraan", vi: "Chờ tính toán" },
    "录入货物后生成方案": { en: "Add cargo to generate a plan", ko: "화물 입력 후 계획 생성", th: "เพิ่มสินค้าเพื่อสร้างแผน", ms: "Masukkan kargo untuk jana pelan", vi: "Nhập hàng để tạo phương án" },
    "Cstar 装箱软件": { en: "Cstar Container Packer", ko: "Cstar 컨테이너 적재", th: "Cstar ซอฟต์แวร์จัดตู้", ms: "Cstar Pemuat Kontena", vi: "Cstar Phần mềm xếp container" },
    "喜事达（Cstar）装箱软件": { en: "Cstar Container Packing Software", ko: "Cstar 컨테이너 적재 소프트웨어", th: "Cstar ซอฟต์แวร์จัดตู้คอนเทนเนอร์", ms: "Perisian Pemuatan Kontena Cstar", vi: "Phần mềm xếp container Cstar" },
    "保存项目": { en: "Save project", ko: "프로젝트 저장", th: "บันทึกโปรเจกต์", ms: "Simpan projek", vi: "Lưu dự án" },
    "打开项目": { en: "Open project", ko: "프로젝트 열기", th: "เปิดโปรเจกต์", ms: "Buka projek", vi: "Mở dự án" },
    "导出项目": { en: "Export project", ko: "프로젝트 내보내기", th: "ส่งออกโปรเจกต์", ms: "Eksport projek", vi: "Xuất dự án" },
    "导入货物": { en: "Import cargo", ko: "화물 가져오기", th: "นำเข้าสินค้า", ms: "Import kargo", vi: "Nhập hàng" },
    "恢复样例": { en: "Restore sample", ko: "샘플 복원", th: "คืนค่าตัวอย่าง", ms: "Pulih sampel", vi: "Khôi phục mẫu" },
    "自动装箱": { en: "Auto pack", ko: "자동 적재", th: "จัดตู้อัตโนมัติ", ms: "Muat automatik", vi: "Xếp tự động" },

    // —— 任务信息 / 表单 ——
    "任务名称": { en: "Task name", ko: "작업 이름", th: "ชื่องาน", ms: "Nama tugas", vi: "Tên nhiệm vụ" },
    "例如：上海仓 5 月出口装柜": { en: "e.g. Shanghai WH May export loading", ko: "예: 상하이 창고 5월 수출 적재", th: "เช่น คลังเซี่ยงไฮ้ ส่งออกเดือน 5", ms: "cth: Gudang Shanghai eksport Mei", vi: "VD: Kho Thượng Hải xuất khẩu tháng 5" },
    "客户 / 订单": { en: "Customer / Order", ko: "고객 / 주문", th: "ลูกค้า / คำสั่งซื้อ", ms: "Pelanggan / Pesanan", vi: "Khách hàng / Đơn hàng" },
    "客户名称或订单号": { en: "Customer name or order no.", ko: "고객명 또는 주문번호", th: "ชื่อลูกค้าหรือเลขที่สั่งซื้อ", ms: "Nama pelanggan atau no. pesanan", vi: "Tên khách hoặc số đơn" },
    "操作员": { en: "Operator", ko: "작업자", th: "ผู้ปฏิบัติงาน", ms: "Operator", vi: "Người thực hiện" },
    "制单人": { en: "Prepared by", ko: "작성자", th: "ผู้จัดทำ", ms: "Disediakan oleh", vi: "Người lập" },
    "装箱日期": { en: "Packing date", ko: "적재 날짜", th: "วันที่จัดตู้", ms: "Tarikh pemuatan", vi: "Ngày xếp hàng" },
    "集装箱类型": { en: "Container type", ko: "컨테이너 종류", th: "ประเภทตู้", ms: "Jenis kontena", vi: "Loại container" },
    "最大箱数": { en: "Max containers", ko: "최대 컨테이너 수", th: "จำนวนตู้สูงสุด", ms: "Kontena maksimum", vi: "Số container tối đa" },
    "下载用户手册": { en: "Download manual", ko: "사용 설명서 다운로드", th: "ดาวน์โหลดคู่มือ", ms: "Muat turun manual", vi: "Tải sổ tay" },
    "约束规则": { en: "Constraints", ko: "제약 규칙", th: "กฎข้อจำกัด", ms: "Peraturan kekangan", vi: "Quy tắc ràng buộc" },
    "重货优先放置": { en: "Heavy items first", ko: "중량물 우선 배치", th: "วางของหนักก่อน", ms: "Barang berat dahulu", vi: "Ưu tiên hàng nặng" },
    "遵守不可堆叠": { en: "Respect no-stacking", ko: "적재 불가 준수", th: "ปฏิบัติตามห้ามวางซ้อน", ms: "Patuh larangan susun", vi: "Tuân thủ không xếp chồng" },
    "估算左右重量均衡": { en: "Estimate left/right balance", ko: "좌우 무게 균형 추정", th: "ประเมินสมดุลซ้าย/ขวา", ms: "Anggar imbangan kiri/kanan", vi: "Ước tính cân bằng trái/phải" },
    "内长": { en: "Inner length", ko: "내부 길이", th: "ความยาวภายใน", ms: "Panjang dalam", vi: "Dài trong" },
    "内宽": { en: "Inner width", ko: "내부 너비", th: "ความกว้างภายใน", ms: "Lebar dalam", vi: "Rộng trong" },
    "内高": { en: "Inner height", ko: "내부 높이", th: "ความสูงภายใน", ms: "Tinggi dalam", vi: "Cao trong" },
    "箱门宽": { en: "Door width", ko: "도어 너비", th: "ความกว้างประตู", ms: "Lebar pintu", vi: "Rộng cửa" },
    "箱门高": { en: "Door height", ko: "도어 높이", th: "ความสูงประตู", ms: "Tinggi pintu", vi: "Cao cửa" },
    "箱体自重": { en: "Tare weight", ko: "공차 중량", th: "น้ำหนักตู้เปล่า", ms: "Berat tara", vi: "Tự trọng" },
    "最大总重": { en: "Max gross weight", ko: "최대 총중량", th: "น้ำหนักรวมสูงสุด", ms: "Berat kasar maks", vi: "Tổng trọng tối đa" },
    "最大载重": { en: "Max payload", ko: "최대 적재량", th: "น้ำหนักบรรทุกสูงสุด", ms: "Muatan maksimum", vi: "Tải trọng tối đa" },

    // —— 货物表头 ——
    "名称": { en: "Name", ko: "이름", th: "ชื่อ", ms: "Nama", vi: "Tên" },
    "长 毫米": { en: "Length (mm)", ko: "길이 (mm)", th: "ยาว (มม.)", ms: "Panjang (mm)", vi: "Dài (mm)" },
    "宽 毫米": { en: "Width (mm)", ko: "너비 (mm)", th: "กว้าง (มม.)", ms: "Lebar (mm)", vi: "Rộng (mm)" },
    "高 毫米": { en: "Height (mm)", ko: "높이 (mm)", th: "สูง (มม.)", ms: "Tinggi (mm)", vi: "Cao (mm)" },
    "重量 千克": { en: "Weight (kg)", ko: "무게 (kg)", th: "น้ำหนัก (กก.)", ms: "Berat (kg)", vi: "Khối lượng (kg)" },
    "数量": { en: "Quantity", ko: "수량", th: "จำนวน", ms: "Kuantiti", vi: "Số lượng" },
    "分组/目的地": { en: "Group / Destination", ko: "그룹/목적지", th: "กลุ่ม/ปลายทาง", ms: "Kumpulan/Destinasi", vi: "Nhóm/Điểm đến" },
    "可旋转": { en: "Rotatable", ko: "회전 가능", th: "หมุนได้", ms: "Boleh putar", vi: "Xoay được" },
    "可倾斜": { en: "Tiltable", ko: "기울임 가능", th: "เอียงได้", ms: "Boleh condong", vi: "Nghiêng được" },
    "可堆叠": { en: "Stackable", ko: "적재 가능", th: "วางซ้อนได้", ms: "Boleh susun", vi: "Xếp chồng được" },
    "最大层数": { en: "Max layers", ko: "최대 단수", th: "จำนวนชั้นสูงสุด", ms: "Lapisan maks", vi: "Số lớp tối đa" },
    "优先级": { en: "Priority", ko: "우선순위", th: "ลำดับความสำคัญ", ms: "Keutamaan", vi: "Ưu tiên" },
    "删除": { en: "Delete", ko: "삭제", th: "ลบ", ms: "Padam", vi: "Xóa" },
    "新增货物": { en: "Add cargo", ko: "화물 추가", th: "เพิ่มสินค้า", ms: "Tambah kargo", vi: "Thêm hàng" },
    "下载模板": { en: "Download template", ko: "템플릿 다운로드", th: "ดาวน์โหลดเทมเพลต", ms: "Muat turun templat", vi: "Tải mẫu" },
    "下载专业模板": { en: "Download pro template", ko: "전문 템플릿 다운로드", th: "ดาวน์โหลดเทมเพลตมืออาชีพ", ms: "Muat turun templat pro", vi: "Tải mẫu chuyên nghiệp" },
    "优先使用专业模板录入货物，避免字段名和单位填错。": { en: "Prefer the pro template to avoid wrong field names and units.", ko: "필드명·단위 오류를 피하려면 전문 템플릿을 사용하세요.", th: "แนะนำใช้เทมเพลตมืออาชีพเพื่อกันชื่อฟิลด์และหน่วยผิด", ms: "Gunakan templat pro untuk elak nama medan dan unit salah.", vi: "Nên dùng mẫu chuyên nghiệp để tránh sai tên trường và đơn vị." },

    // —— 视图 / 可视化 ——
    "装载视图": { en: "Loading view", ko: "적재 뷰", th: "มุมมองการจัด", ms: "Paparan muatan", vi: "Khung nhìn xếp hàng" },
    "查看箱号": { en: "View container no.", ko: "컨테이너 번호 보기", th: "ดูเลขตู้", ms: "Lihat no. kontena", vi: "Xem số container" },
    "视图切换": { en: "Switch view", ko: "뷰 전환", th: "สลับมุมมอง", ms: "Tukar paparan", vi: "Chuyển khung nhìn" },
    "等距": { en: "Iso", ko: "등각", th: "ไอโซ", ms: "Iso", vi: "Đẳng cự" },
    "俯视": { en: "Top", ko: "위", th: "ด้านบน", ms: "Atas", vi: "Trên" },
    "热力": { en: "Heatmap", ko: "히트맵", th: "ฮีตแมป", ms: "Peta haba", vi: "Nhiệt" },
    "侧视": { en: "Side", ko: "측면", th: "ด้านข้าง", ms: "Sisi", vi: "Cạnh" },
    "拖动旋转 · 滚轮缩放 · 右键/双指平移 · 双击复位": { en: "Drag to rotate · Scroll to zoom · Right-drag/two-finger to pan · Double-click to reset", ko: "드래그 회전 · 휠 확대/축소 · 우클릭/두 손가락 이동 · 더블클릭 초기화", th: "ลากเพื่อหมุน · ล้อเลื่อนซูม · คลิกขวา/สองนิ้วเลื่อน · ดับเบิลคลิกรีเซ็ต", ms: "Seret untuk putar · Tatal untuk zum · Klik kanan/dua jari untuk alih · Klik dua kali untuk set semula", vi: "Kéo để xoay · Cuộn để thu phóng · Chuột phải/hai ngón để di chuyển · Nhấp đúp để đặt lại" },
    "分层显示高度": { en: "Layer display height", ko: "층 표시 높이", th: "ความสูงที่แสดงเป็นชั้น", ms: "Tinggi paparan lapisan", vi: "Chiều cao hiển thị theo lớp" },
    "显示全部": { en: "Show all", ko: "전체 표시", th: "แสดงทั้งหมด", ms: "Papar semua", vi: "Hiện tất cả" },
    "装载步骤回放": { en: "Loading step playback", ko: "적재 단계 재생", th: "เล่นซ้ำขั้นตอนการจัด", ms: "Main semula langkah muatan", vi: "Phát lại bước xếp" },
    "显示全部步骤": { en: "Show all steps", ko: "전체 단계 표시", th: "แสดงทุกขั้นตอน", ms: "Papar semua langkah", vi: "Hiện tất cả các bước" },
    "显示承重热区": { en: "Show load heat zones", ko: "하중 핫존 표시", th: "แสดงโซนน้ำหนัก", ms: "Papar zon haba beban", vi: "Hiện vùng nhiệt tải" },
    "承重上限 千克/平方米": { en: "Floor load limit (kg/m²)", ko: "바닥 하중 한계 (kg/m²)", th: "ขีดจำกัดน้ำหนักพื้น (กก./ตร.ม.)", ms: "Had beban lantai (kg/m²)", vi: "Giới hạn tải sàn (kg/m²)" },
    "选择货物": { en: "Select cargo", ko: "화물 선택", th: "เลือกสินค้า", ms: "Pilih kargo", vi: "Chọn hàng" },
    "移动货物": { en: "Move cargo", ko: "화물 이동", th: "ย้ายสินค้า", ms: "Alih kargo", vi: "Di chuyển hàng" },
    "上": { en: "Up", ko: "위", th: "ขึ้น", ms: "Atas", vi: "Lên" },
    "下": { en: "Down", ko: "아래", th: "ลง", ms: "Bawah", vi: "Xuống" },
    "前": { en: "Front", ko: "앞", th: "หน้า", ms: "Depan", vi: "Trước" },
    "后": { en: "Back", ko: "뒤", th: "หลัง", ms: "Belakang", vi: "Sau" },
    "重置移动": { en: "Reset moves", ko: "이동 초기화", th: "รีเซ็ตการย้าย", ms: "Set semula gerakan", vi: "Đặt lại di chuyển" },
    "结果队列": { en: "Result queue", ko: "결과 대기열", th: "คิวผลลัพธ์", ms: "Baris gilir hasil", vi: "Hàng đợi kết quả" },
    "未装 0": { en: "Unloaded 0", ko: "미적재 0", th: "ยังไม่จัด 0", ms: "Belum muat 0", vi: "Chưa xếp 0" },

    // —— 指标 / 状态 ——
    "空间利用": { en: "Space usage", ko: "공간 활용", th: "การใช้พื้นที่", ms: "Penggunaan ruang", vi: "Sử dụng không gian" },
    "重量利用": { en: "Weight usage", ko: "무게 활용", th: "การใช้น้ำหนัก", ms: "Penggunaan berat", vi: "Sử dụng tải trọng" },
    "重心纵向": { en: "CoG longitudinal", ko: "무게중심 종방향", th: "จุดศูนย์ถ่วงตามยาว", ms: "Pusat graviti membujur", vi: "Trọng tâm dọc" },
    "重心横向": { en: "CoG lateral", ko: "무게중심 횡방향", th: "จุดศูนย์ถ่วงตามขวาง", ms: "Pusat graviti melintang", vi: "Trọng tâm ngang" },
    "重心高度": { en: "CoG height", ko: "무게중심 높이", th: "ความสูงจุดศูนย์ถ่วง", ms: "Tinggi pusat graviti", vi: "Trọng tâm cao" },
    "计划箱数": { en: "Planned containers", ko: "계획 컨테이너 수", th: "จำนวนตู้ที่วางแผน", ms: "Kontena dirancang", vi: "Số container kế hoạch" },
    "使用箱数": { en: "Containers used", ko: "사용 컨테이너 수", th: "จำนวนตู้ที่ใช้", ms: "Kontena digunakan", vi: "Số container đã dùng" },
    "总体积": { en: "Total volume", ko: "총 부피", th: "ปริมาตรรวม", ms: "Jumlah isipadu", vi: "Tổng thể tích" },
    "总重量": { en: "Total weight", ko: "총 무게", th: "น้ำหนักรวม", ms: "Jumlah berat", vi: "Tổng khối lượng" },
    "已装件数": { en: "Items loaded", ko: "적재 건수", th: "จำนวนที่จัดแล้ว", ms: "Item dimuatkan", vi: "Số kiện đã xếp" },
    "已装 / 未装": { en: "Loaded / Unloaded", ko: "적재 / 미적재", th: "จัดแล้ว / ยังไม่จัด", ms: "Dimuat / Belum", vi: "Đã xếp / Chưa xếp" },
    "已保存": { en: "Saved", ko: "저장됨", th: "บันทึกแล้ว", ms: "Disimpan", vi: "Đã lưu" },
    "已复制": { en: "Copied", ko: "복사됨", th: "คัดลอกแล้ว", ms: "Disalin", vi: "Đã sao chép" },
    "方案已生成": { en: "Plan generated", ko: "계획 생성됨", th: "สร้างแผนแล้ว", ms: "Pelan dijana", vi: "Đã tạo phương án" },
    "需要复核": { en: "Needs review", ko: "검토 필요", th: "ต้องตรวจสอบ", ms: "Perlu semakan", vi: "Cần rà soát" },
    "通过": { en: "Passed", ko: "통과", th: "ผ่าน", ms: "Lulus", vi: "Đạt" },
    "位置不可用": { en: "Position unavailable", ko: "위치 사용 불가", th: "ตำแหน่งใช้ไม่ได้", ms: "Kedudukan tidak tersedia", vi: "Vị trí không khả dụng" },

    // —— 视图标题 / 热力 ——
    "俯视图": { en: "Top view", ko: "평면도", th: "มุมมองด้านบน", ms: "Pandangan atas", vi: "Nhìn từ trên" },
    "侧视图": { en: "Side view", ko: "측면도", th: "มุมมองด้านข้าง", ms: "Pandangan sisi", vi: "Nhìn từ cạnh" },
    "承重热力图": { en: "Load heatmap", ko: "하중 히트맵", th: "ฮีตแมปน้ำหนัก", ms: "Peta haba beban", vi: "Bản đồ nhiệt tải" },
    "承重复核": { en: "Load review", ko: "하중 검토", th: "ตรวจสอบน้ำหนัก", ms: "Semakan beban", vi: "Rà soát tải" },
    "最高热点": { en: "Hottest spot", ko: "최고 핫스팟", th: "จุดร้อนสุด", ms: "Titik terpanas", vi: "Điểm nóng nhất" },
    "相对较高": { en: "Relatively high", ko: "상대적으로 높음", th: "ค่อนข้างสูง", ms: "Agak tinggi", vi: "Tương đối cao" },
    "最低载荷点": { en: "Lowest load point", ko: "최저 하중 지점", th: "จุดน้ำหนักต่ำสุด", ms: "Titik beban terendah", vi: "Điểm tải thấp nhất" },
    "承重调整建议": { en: "Load adjustment advice", ko: "하중 조정 권고", th: "คำแนะนำปรับน้ำหนัก", ms: "Nasihat pelarasan beban", vi: "Gợi ý điều chỉnh tải" },
    "当前没有明显需要调整的承重区域。": { en: "No load zone clearly needs adjustment.", ko: "조정이 필요한 하중 구역이 뚜렷이 없습니다.", th: "ยังไม่มีโซนน้ำหนักที่ต้องปรับชัดเจน", ms: "Tiada zon beban yang jelas perlu dilaras.", vi: "Hiện chưa có vùng tải nào cần điều chỉnh rõ rệt." },
    "箱底承重分布平稳": { en: "Floor load distribution is stable", ko: "바닥 하중 분포가 안정적임", th: "การกระจายน้ำหนักพื้นสม่ำเสมอ", ms: "Taburan beban lantai stabil", vi: "Phân bố tải sàn ổn định" },
    "装载顺序": { en: "Loading sequence", ko: "적재 순서", th: "ลำดับการจัด", ms: "Urutan muatan", vi: "Thứ tự xếp" },

    // —— 校验 / 错误 / 原因 ——
    "名称不能为空": { en: "Name cannot be empty", ko: "이름은 비울 수 없습니다", th: "ชื่อต้องไม่ว่าง", ms: "Nama tidak boleh kosong", vi: "Tên không được để trống" },
    "长度必须大于 0": { en: "Length must be greater than 0", ko: "길이는 0보다 커야 합니다", th: "ความยาวต้องมากกว่า 0", ms: "Panjang mesti lebih daripada 0", vi: "Chiều dài phải lớn hơn 0" },
    "宽度必须大于 0": { en: "Width must be greater than 0", ko: "너비는 0보다 커야 합니다", th: "ความกว้างต้องมากกว่า 0", ms: "Lebar mesti lebih daripada 0", vi: "Chiều rộng phải lớn hơn 0" },
    "高度必须大于 0": { en: "Height must be greater than 0", ko: "높이는 0보다 커야 합니다", th: "ความสูงต้องมากกว่า 0", ms: "Tinggi mesti lebih daripada 0", vi: "Chiều cao phải lớn hơn 0" },
    "重量不能为负数": { en: "Weight cannot be negative", ko: "무게는 음수일 수 없습니다", th: "น้ำหนักต้องไม่ติดลบ", ms: "Berat tidak boleh negatif", vi: "Khối lượng không được âm" },
    "数量必须为正整数": { en: "Quantity must be a positive integer", ko: "수량은 양의 정수여야 합니다", th: "จำนวนต้องเป็นจำนวนเต็มบวก", ms: "Kuantiti mesti integer positif", vi: "Số lượng phải là số nguyên dương" },
    "分组/目的地不能为空": { en: "Group/Destination cannot be empty", ko: "그룹/목적지는 비울 수 없습니다", th: "กลุ่ม/ปลายทางต้องไม่ว่าง", ms: "Kumpulan/Destinasi tidak boleh kosong", vi: "Nhóm/Điểm đến không được trống" },
    "最大层数必须为正整数": { en: "Max layers must be a positive integer", ko: "최대 단수는 양의 정수여야 합니다", th: "จำนวนชั้นสูงสุดต้องเป็นจำนวนเต็มบวก", ms: "Lapisan maks mesti integer positif", vi: "Số lớp tối đa phải là số nguyên dương" },
    "当前箱剩余空间不足或规则限制": { en: "Not enough space in current container or blocked by rules", ko: "현재 컨테이너 공간 부족 또는 규칙 제한", th: "พื้นที่ตู้ปัจจุบันไม่พอหรือถูกจำกัดด้วยกฎ", ms: "Ruang kontena semasa tidak cukup atau disekat peraturan", vi: "Container hiện không đủ chỗ hoặc bị quy tắc chặn" },
    "当前箱载重不足": { en: "Current container is overweight", ko: "현재 컨테이너 적재 한도 초과", th: "ตู้ปัจจุบันเกินน้ำหนักบรรทุก", ms: "Kontena semasa melebihi muatan", vi: "Container hiện vượt tải" },
    "数据校验通过，当前清单可用于装箱计算。": { en: "Validation passed; the list is ready for packing.", ko: "검증 통과, 목록을 적재 계산에 사용할 수 있습니다.", th: "ตรวจสอบผ่าน รายการพร้อมใช้คำนวณการจัดตู้", ms: "Pengesahan lulus; senarai sedia untuk pengiraan.", vi: "Kiểm tra đạt; danh sách sẵn sàng để tính xếp." },
    "全部货物已装入当前箱型": { en: "All cargo loaded into current container type", ko: "모든 화물이 현재 컨테이너에 적재됨", th: "จัดสินค้าทั้งหมดลงตู้ปัจจุบันแล้ว", ms: "Semua kargo dimuat ke jenis kontena semasa", vi: "Đã xếp toàn bộ hàng vào loại container hiện tại" },
    "货物文件为空。": { en: "The cargo file is empty.", ko: "화물 파일이 비어 있습니다.", th: "ไฟล์สินค้าว่างเปล่า", ms: "Fail kargo kosong.", vi: "Tệp hàng hóa trống." },
    "货物文件导入失败。": { en: "Failed to import the cargo file.", ko: "화물 파일 가져오기 실패.", th: "นำเข้าไฟล์สินค้าไม่สำเร็จ", ms: "Gagal import fail kargo.", vi: "Nhập tệp hàng hóa thất bại." },
    "工作簿没有工作表。": { en: "The workbook has no sheets.", ko: "워크북에 시트가 없습니다.", th: "เวิร์กบุ๊กไม่มีชีต", ms: "Buku kerja tiada helaian.", vi: "Workbook không có trang tính." },
    "没有读取到工作簿第一个工作表。": { en: "Could not read the first sheet of the workbook.", ko: "워크북의 첫 시트를 읽지 못했습니다.", th: "อ่านชีตแรกของเวิร์กบุ๊กไม่ได้", ms: "Tidak dapat baca helaian pertama buku kerja.", vi: "Không đọc được trang tính đầu tiên." },
    "没有读取到文字文档内容。": { en: "Could not read the document content.", ko: "문서 내용을 읽지 못했습니다.", th: "อ่านเนื้อหาเอกสารไม่ได้", ms: "Tidak dapat baca kandungan dokumen.", vi: "Không đọc được nội dung tài liệu." },
    "文字文档中没有找到货物表格。请把货物清单放在表格中，第一行为字段名。": { en: "No cargo table found in the document. Put the list in a table with field names in the first row.", ko: "문서에서 화물 표를 찾지 못했습니다. 첫 행에 필드명을 둔 표로 목록을 작성하세요.", th: "ไม่พบตารางสินค้าในเอกสาร ใส่รายการในตารางโดยให้แถวแรกเป็นชื่อฟิลด์", ms: "Tiada jadual kargo dalam dokumen. Letak senarai dalam jadual dengan nama medan di baris pertama.", vi: "Không tìm thấy bảng hàng trong tài liệu. Đặt danh sách trong bảng với tên trường ở hàng đầu." },
    "没有读取到货物行。请确认第一行是字段名，后续行是货物数据。": { en: "No cargo rows read. Ensure the first row is field names and the rest are data.", ko: "화물 행을 읽지 못했습니다. 첫 행은 필드명, 이후는 데이터인지 확인하세요.", th: "อ่านแถวสินค้าไม่ได้ ตรวจให้แถวแรกเป็นชื่อฟิลด์ แถวถัดไปเป็นข้อมูล", ms: "Tiada baris kargo dibaca. Pastikan baris pertama nama medan, selebihnya data.", vi: "Không đọc được dòng hàng. Đảm bảo dòng đầu là tên trường, các dòng sau là dữ liệu." },
    "暂不支持该文件格式。请导入逗号表、工作簿或文字文档。": { en: "This file format is not supported. Import a CSV, workbook, or document.", ko: "지원하지 않는 형식입니다. CSV, 워크북 또는 문서를 가져오세요.", th: "ยังไม่รองรับไฟล์นี้ กรุณานำเข้า CSV เวิร์กบุ๊ก หรือเอกสาร", ms: "Format fail ini tidak disokong. Import CSV, buku kerja, atau dokumen.", vi: "Định dạng tệp chưa hỗ trợ. Hãy nhập CSV, workbook hoặc tài liệu." },
    "文件不是有效的 XLSX/DOCX 格式。": { en: "The file is not a valid XLSX/DOCX.", ko: "유효한 XLSX/DOCX 파일이 아닙니다.", th: "ไฟล์ไม่ใช่รูปแบบ XLSX/DOCX ที่ถูกต้อง", ms: "Fail bukan XLSX/DOCX yang sah.", vi: "Tệp không phải XLSX/DOCX hợp lệ." },
    "文件使用了暂不支持的压缩方式。": { en: "The file uses an unsupported compression method.", ko: "지원하지 않는 압축 방식을 사용했습니다.", th: "ไฟล์ใช้วิธีบีบอัดที่ยังไม่รองรับ", ms: "Fail guna kaedah mampatan tidak disokong.", vi: "Tệp dùng phương thức nén chưa hỗ trợ." },
    "压缩包结构异常。": { en: "The archive structure is invalid.", ko: "압축 파일 구조가 비정상입니다.", th: "โครงสร้างไฟล์บีบอัดผิดปกติ", ms: "Struktur arkib tidak normal.", vi: "Cấu trúc tệp nén bất thường." },
    "当前浏览器不支持离线解压 XLSX/DOCX，请使用最新版 Chrome、Edge 或 Safari。": { en: "This browser cannot unzip XLSX/DOCX offline. Use the latest Chrome, Edge, or Safari.", ko: "이 브라우저는 오프라인 XLSX/DOCX 압축 해제를 지원하지 않습니다. 최신 Chrome, Edge, Safari를 사용하세요.", th: "เบราว์เซอร์นี้แตกไฟล์ XLSX/DOCX ออฟไลน์ไม่ได้ โปรดใช้ Chrome, Edge หรือ Safari รุ่นล่าสุด", ms: "Pelayar ini tidak boleh nyahzip XLSX/DOCX luar talian. Guna Chrome, Edge atau Safari terkini.", vi: "Trình duyệt này không giải nén XLSX/DOCX ngoại tuyến được. Hãy dùng Chrome, Edge hoặc Safari mới nhất." },
    "无法读取本地保存的项目": { en: "Could not read the locally saved project", ko: "로컬에 저장된 프로젝트를 읽지 못했습니다", th: "อ่านโปรเจกต์ที่บันทึกในเครื่องไม่ได้", ms: "Tidak dapat baca projek yang disimpan setempat", vi: "Không đọc được dự án đã lưu cục bộ" },
    "恢复样例会覆盖当前货物清单，确定继续吗？": { en: "Restoring the sample will overwrite the current cargo list. Continue?", ko: "샘플 복원은 현재 화물 목록을 덮어씁니다. 계속할까요?", th: "การคืนค่าตัวอย่างจะเขียนทับรายการสินค้าปัจจุบัน ดำเนินการต่อหรือไม่?", ms: "Memulihkan sampel akan menulis ganti senarai kargo semasa. Teruskan?", vi: "Khôi phục mẫu sẽ ghi đè danh sách hàng hiện tại. Tiếp tục?" },

    // —— 默认值 / 词汇 ——
    "默认": { en: "Default", ko: "기본", th: "ค่าเริ่มต้น", ms: "Lalai", vi: "Mặc định" },
    "未命名": { en: "Unnamed", ko: "이름 없음", th: "ไม่มีชื่อ", ms: "Tanpa nama", vi: "Chưa đặt tên" },
    "未命名货物": { en: "Unnamed cargo", ko: "이름 없는 화물", th: "สินค้าไม่มีชื่อ", ms: "Kargo tanpa nama", vi: "Hàng chưa đặt tên" },
    "未填写": { en: "Not filled", ko: "미입력", th: "ยังไม่กรอก", ms: "Belum diisi", vi: "Chưa điền" },
    "固定": { en: "Fixed", ko: "고정", th: "คงที่", ms: "Tetap", vi: "Cố định" },
    "是": { en: "Yes", ko: "예", th: "ใช่", ms: "Ya", vi: "Có" },
    "可": { en: "Yes", ko: "가능", th: "ได้", ms: "Boleh", vi: "Được" },
    "无": { en: "None", ko: "없음", th: "ไม่มี", ms: "Tiada", vi: "Không" },
    "暂无数据。": { en: "No data yet.", ko: "데이터 없음.", th: "ยังไม่มีข้อมูล", ms: "Tiada data lagi.", vi: "Chưa có dữ liệu." },
    "上海": { en: "Shanghai", ko: "상하이", th: "เซี่ยงไฮ้", ms: "Shanghai", vi: "Thượng Hải" },
    "宁波": { en: "Ningbo", ko: "닝보", th: "หนิงปัว", ms: "Ningbo", vi: "Ninh Ba" },
    "出口装箱任务": { en: "Export packing task", ko: "수출 적재 작업", th: "งานจัดตู้ส่งออก", ms: "Tugas pemuatan eksport", vi: "Nhiệm vụ xếp hàng xuất khẩu" },
    "任务": { en: "Task", ko: "작업", th: "งาน", ms: "Tugas", vi: "Nhiệm vụ" },
    "家电纸箱 A": { en: "Appliance carton A", ko: "가전 박스 A", th: "กล่องเครื่องใช้ไฟฟ้า A", ms: "Kotak perkakas A", vi: "Thùng điện máy A" },
    "托盘货 B": { en: "Palletized goods B", ko: "팔레트 화물 B", th: "สินค้าพาเลท B", ms: "Barang palet B", vi: "Hàng pallet B" },
    "长条设备 C": { en: "Long equipment C", ko: "장척 장비 C", th: "อุปกรณ์ยาว C", ms: "Peralatan panjang C", vi: "Thiết bị dài C" },
    "配件箱 D": { en: "Parts box D", ko: "부품 상자 D", th: "กล่องอะไหล่ D", ms: "Kotak alat ganti D", vi: "Hộp phụ kiện D" },
    "新货物": { en: "New cargo", ko: "새 화물", th: "สินค้าใหม่", ms: "Kargo baharu", vi: "Hàng mới" },
    "旋转方向": { en: "Rotation", ko: "회전 방향", th: "ทิศหมุน", ms: "Putaran", vi: "Hướng xoay" },
    "坐标X": { en: "X coord", ko: "X 좌표", th: "พิกัด X", ms: "Koordinat X", vi: "Tọa độ X" },
    "坐标Y": { en: "Y coord", ko: "Y 좌표", th: "พิกัด Y", ms: "Koordinat Y", vi: "Tọa độ Y" },
    "坐标Z": { en: "Z coord", ko: "Z 좌표", th: "พิกัด Z", ms: "Koordinat Z", vi: "Tọa độ Z" },
    "堆叠层": { en: "Stack layer", ko: "적재 단", th: "ชั้นวางซ้อน", ms: "Lapisan susun", vi: "Lớp xếp chồng" },
    "货物编号": { en: "Cargo ID", ko: "화물 번호", th: "รหัสสินค้า", ms: "ID kargo", vi: "Mã hàng" },
    "箱号": { en: "Container no.", ko: "컨테이너 번호", th: "เลขตู้", ms: "No. kontena", vi: "Số container" },
    "箱型": { en: "Container type", ko: "컨테이너 종류", th: "ประเภทตู้", ms: "Jenis kontena", vi: "Loại container" },
    "分组": { en: "Group", ko: "그룹", th: "กลุ่ม", ms: "Kumpulan", vi: "Nhóm" },
    "重量": { en: "Weight", ko: "무게", th: "น้ำหนัก", ms: "Berat", vi: "Khối lượng" },
    "长": { en: "Length", ko: "길이", th: "ยาว", ms: "Panjang", vi: "Dài" },
    "宽": { en: "Width", ko: "너비", th: "กว้าง", ms: "Lebar", vi: "Rộng" },
    "高": { en: "Height", ko: "높이", th: "สูง", ms: "Tinggi", vi: "Cao" },
    "低": { en: "Low", ko: "낮음", th: "ต่ำ", ms: "Rendah", vi: "Thấp" },
    "前段": { en: "Front section", ko: "앞쪽", th: "ส่วนหน้า", ms: "Bahagian depan", vi: "Phần trước" },
    "中段": { en: "Middle section", ko: "중간", th: "ส่วนกลาง", ms: "Bahagian tengah", vi: "Phần giữa" },
    "后段": { en: "Rear section", ko: "뒤쪽", th: "ส่วนหลัง", ms: "Bahagian belakang", vi: "Phần sau" },
    "左侧": { en: "Left", ko: "왼쪽", th: "ซ้าย", ms: "Kiri", vi: "Trái" },
    "右侧": { en: "Right", ko: "오른쪽", th: "ขวา", ms: "Kanan", vi: "Phải" },

    // —— 箱型名称 ——
    "20GP 标准箱": { en: "20GP Standard", ko: "20GP 표준", th: "20GP มาตรฐาน", ms: "20GP Standard", vi: "20GP tiêu chuẩn" },
    "40GP 标准箱": { en: "40GP Standard", ko: "40GP 표준", th: "40GP มาตรฐาน", ms: "40GP Standard", vi: "40GP tiêu chuẩn" },
    "40HQ 高柜": { en: "40HQ High Cube", ko: "40HQ 하이큐브", th: "40HQ ไฮคิวบ์", ms: "40HQ High Cube", vi: "40HQ cao" },
    "45HQ 高柜": { en: "45HQ High Cube", ko: "45HQ 하이큐브", th: "45HQ ไฮคิวบ์", ms: "45HQ High Cube", vi: "45HQ cao" },

    // —— 报告页按钮 ——
    "复制报告": { en: "Copy report", ko: "보고서 복사", th: "คัดลอกรายงาน", ms: "Salin laporan", vi: "Sao chép báo cáo" },
    "下载表格": { en: "Download table", ko: "표 다운로드", th: "ดาวน์โหลดตาราง", ms: "Muat turun jadual", vi: "Tải bảng" },
    "打印存档": { en: "Print / archive", ko: "인쇄 / 보관", th: "พิมพ์ / จัดเก็บ", ms: "Cetak / arkib", vi: "In / lưu trữ" },

    // —— 帮助页 ——
    "使用说明": { en: "User guide", ko: "사용 안내", th: "คู่มือการใช้งาน", ms: "Panduan pengguna", vi: "Hướng dẫn sử dụng" },
    "产品定位": { en: "Product positioning", ko: "제품 포지셔닝", th: "จุดยืนผลิตภัณฑ์", ms: "Kedudukan produk", vi: "Định vị sản phẩm" },
    "喜事达（Cstar）装箱软件面向业务、仓库和管理复核人员，提供离线装箱计划、数据导入、多箱分装、箱门校验、分层查看、装载顺序和报告导出。": { en: "Cstar Container Packing Software serves sales, warehouse and management reviewers, offering offline packing plans, data import, multi-container splitting, door checks, layer view, loading sequence and report export.", ko: "Cstar 컨테이너 적재 소프트웨어는 영업·창고·관리 검토자를 위해 오프라인 적재 계획, 데이터 가져오기, 다중 컨테이너 분할, 도어 검증, 층별 보기, 적재 순서, 보고서 내보내기를 제공합니다.", th: "ซอฟต์แวร์จัดตู้ Cstar สำหรับฝ่ายขาย คลังสินค้า และผู้ตรวจสอบ ให้แผนจัดตู้ออฟไลน์ นำเข้าข้อมูล แบ่งหลายตู้ ตรวจประตูตู้ ดูเป็นชั้น ลำดับการจัด และส่งออกรายงาน", ms: "Perisian Pemuatan Kontena Cstar untuk jualan, gudang dan penyemak pengurusan: pelan luar talian, import data, pembahagian pelbagai kontena, semakan pintu, paparan lapisan, urutan muatan dan eksport laporan.", vi: "Phần mềm xếp container Cstar phục vụ bộ phận kinh doanh, kho và người rà soát: lập kế hoạch ngoại tuyến, nhập dữ liệu, chia nhiều container, kiểm tra cửa, xem theo lớp, thứ tự xếp và xuất báo cáo." },
    "标准作业流程": { en: "Standard workflow", ko: "표준 작업 절차", th: "ขั้นตอนการทำงานมาตรฐาน", ms: "Aliran kerja standard", vi: "Quy trình chuẩn" },
    "填写任务名称、客户、操作员和装箱日期。": { en: "Fill in task name, customer, operator and packing date.", ko: "작업 이름, 고객, 작업자, 적재 날짜를 입력합니다.", th: "กรอกชื่องาน ลูกค้า ผู้ปฏิบัติงาน และวันที่จัดตู้", ms: "Isi nama tugas, pelanggan, operator dan tarikh pemuatan.", vi: "Điền tên nhiệm vụ, khách hàng, người thực hiện và ngày xếp." },
    "选择箱型、最大箱数和约束规则，点击自动装箱。": { en: "Choose container type, max containers and constraints, then click Auto pack.", ko: "컨테이너 종류, 최대 수, 제약을 선택한 뒤 자동 적재를 클릭합니다.", th: "เลือกประเภทตู้ จำนวนตู้สูงสุด และกฎข้อจำกัด แล้วคลิกจัดตู้อัตโนมัติ", ms: "Pilih jenis kontena, kontena maksimum dan kekangan, kemudian klik Muat automatik.", vi: "Chọn loại container, số tối đa và ràng buộc, rồi nhấn Xếp tự động." },
    "按箱号和分层高度检查视图、未装货物、重心、利用率和智能建议。": { en: "Review views, unloaded items, CoG, usage and smart tips by container and layer height.", ko: "컨테이너·층 높이별로 뷰, 미적재 화물, 무게중심, 활용률, 스마트 팁을 검토합니다.", th: "ตรวจมุมมอง สินค้าที่ยังไม่จัด จุดศูนย์ถ่วง การใช้งาน และคำแนะนำ ตามตู้และความสูงชั้น", ms: "Semak paparan, item belum muat, pusat graviti, penggunaan dan petua pintar mengikut kontena dan lapisan.", vi: "Rà soát khung nhìn, hàng chưa xếp, trọng tâm, mức sử dụng và gợi ý theo container và độ cao lớp." },
    "在装载视图下选择具体货物，用方向按钮进行 100 毫米微调。": { en: "Select a specific item in the loading view and fine-tune by 100 mm with the arrow buttons.", ko: "적재 뷰에서 특정 화물을 선택해 방향 버튼으로 100mm씩 미세 조정합니다.", th: "เลือกสินค้าในมุมมองการจัด แล้วปรับละเอียดทีละ 100 มม. ด้วยปุ่มทิศทาง", ms: "Pilih item tertentu dalam paparan muatan dan halus suai 100 mm dengan butang arah.", vi: "Chọn một kiện trong khung nhìn xếp và tinh chỉnh 100 mm bằng các nút mũi tên." },
    "导出装箱表格、复制报告，或打印存档。": { en: "Export the packing table, copy the report, or print to archive.", ko: "적재 표를 내보내거나 보고서를 복사하거나 인쇄하여 보관합니다.", th: "ส่งออกตารางการจัด คัดลอกรายงาน หรือพิมพ์เก็บ", ms: "Eksport jadual, salin laporan, atau cetak untuk arkib.", vi: "Xuất bảng xếp, sao chép báo cáo, hoặc in để lưu trữ." },
    "导入文件规范": { en: "Import file rules", ko: "가져오기 파일 규칙", th: "ข้อกำหนดไฟล์นำเข้า", ms: "Peraturan fail import", vi: "Quy cách tệp nhập" },
    "逗号表：第一行字段名，后续行是货物数据。": { en: "CSV: first row field names, following rows cargo data.", ko: "CSV: 첫 행 필드명, 이후 행 화물 데이터.", th: "CSV: แถวแรกชื่อฟิลด์ แถวถัดไปข้อมูลสินค้า", ms: "CSV: baris pertama nama medan, baris seterusnya data kargo.", vi: "CSV: dòng đầu tên trường, các dòng sau là dữ liệu hàng." },
    "工作簿：读取第一个工作表，第一行必须是字段名。": { en: "Workbook: reads the first sheet; the first row must be field names.", ko: "워크북: 첫 시트를 읽으며 첫 행은 필드명이어야 합니다.", th: "เวิร์กบุ๊ก: อ่านชีตแรก แถวแรกต้องเป็นชื่อฟิลด์", ms: "Buku kerja: baca helaian pertama; baris pertama mesti nama medan.", vi: "Workbook: đọc trang đầu; dòng đầu phải là tên trường." },
    "文字文档：读取文档中的货物表格，第一行必须是字段名。": { en: "Document: reads the cargo table; the first row must be field names.", ko: "문서: 화물 표를 읽으며 첫 행은 필드명이어야 합니다.", th: "เอกสาร: อ่านตารางสินค้า แถวแรกต้องเป็นชื่อฟิลด์", ms: "Dokumen: baca jadual kargo; baris pertama mesti nama medan.", vi: "Tài liệu: đọc bảng hàng; dòng đầu phải là tên trường." },
    "推荐使用专业模板中的中文字段：名称、长、宽、高、重量、数量、分组、可旋转、可倾斜、可堆叠、优先级。": { en: "Recommended fields (from the pro template): Name, Length, Width, Height, Weight, Quantity, Group, Rotatable, Tiltable, Stackable, Priority.", ko: "권장 필드(전문 템플릿): 이름, 길이, 너비, 높이, 무게, 수량, 그룹, 회전 가능, 기울임 가능, 적재 가능, 우선순위.", th: "ฟิลด์ที่แนะนำ (จากเทมเพลตมืออาชีพ): ชื่อ, ยาว, กว้าง, สูง, น้ำหนัก, จำนวน, กลุ่ม, หมุนได้, เอียงได้, วางซ้อนได้, ลำดับความสำคัญ", ms: "Medan disyorkan (templat pro): Nama, Panjang, Lebar, Tinggi, Berat, Kuantiti, Kumpulan, Boleh putar, Boleh condong, Boleh susun, Keutamaan.", vi: "Trường đề xuất (mẫu chuyên nghiệp): Tên, Dài, Rộng, Cao, Khối lượng, Số lượng, Nhóm, Xoay được, Nghiêng được, Xếp chồng được, Ưu tiên." },
    "模板填写要求": { en: "Template requirements", ko: "템플릿 작성 요건", th: "ข้อกำหนดการกรอกเทมเพลต", ms: "Keperluan templat", vi: "Yêu cầu điền mẫu" },
    "尺寸单位为毫米，重量单位为千克。数量必须为正整数。可旋转、可倾斜、可堆叠使用下拉选择。优先级使用高、中、低。专业模板内置下拉、数据校验、字段字典、箱型参考和示例数据。": { en: "Sizes in mm, weight in kg. Quantity must be a positive integer. Use dropdowns for Rotatable/Tiltable/Stackable. Priority is High/Medium/Low. The pro template includes dropdowns, validation, a field dictionary, container references and sample data.", ko: "치수는 mm, 무게는 kg. 수량은 양의 정수. 회전/기울임/적재 가능은 드롭다운 사용. 우선순위는 상/중/하. 전문 템플릿에는 드롭다운, 검증, 필드 사전, 컨테이너 참고, 샘플 데이터가 포함됩니다.", th: "ขนาดเป็น มม. น้ำหนักเป็น กก. จำนวนต้องเป็นจำนวนเต็มบวก ใช้ดรอปดาวน์สำหรับหมุน/เอียง/วางซ้อน ลำดับความสำคัญใช้ สูง/กลาง/ต่ำ เทมเพลตมืออาชีพมีดรอปดาวน์ การตรวจสอบ พจนานุกรมฟิลด์ ข้อมูลตู้อ้างอิง และตัวอย่างข้อมูล", ms: "Saiz dalam mm, berat dalam kg. Kuantiti mesti integer positif. Guna dropdown untuk Boleh putar/condong/susun. Keutamaan Tinggi/Sederhana/Rendah. Templat pro termasuk dropdown, pengesahan, kamus medan, rujukan kontena dan data sampel.", vi: "Kích thước theo mm, khối lượng theo kg. Số lượng phải là số nguyên dương. Dùng danh sách thả xuống cho Xoay/Nghiêng/Xếp chồng. Ưu tiên Cao/Trung/Thấp. Mẫu chuyên nghiệp có sẵn danh sách, kiểm tra, từ điển trường, tham chiếu container và dữ liệu mẫu." },
    "多箱与箱门校验": { en: "Multi-container & door checks", ko: "다중 컨테이너 및 도어 검증", th: "หลายตู้และการตรวจประตูตู้", ms: "Pelbagai kontena & semakan pintu", vi: "Nhiều container & kiểm tra cửa" },
    "最大箱数控制可使用的集装箱数量。软件会按箱号生成分装方案，并校验货物是否能通过箱门。若提示无法通过箱门，需要调整包装方向、拆分货物或更换运输方案。": { en: "Max containers limits how many can be used. The software splits the plan by container and checks whether items pass the door. If an item cannot pass, adjust packing orientation, split it, or change the shipping plan.", ko: "최대 컨테이너 수는 사용 가능한 수를 제한합니다. 컨테이너별로 분할 계획을 만들고 도어 통과 여부를 검증합니다. 통과 불가 시 포장 방향 조정, 분할 또는 운송 방안 변경이 필요합니다.", th: "จำนวนตู้สูงสุดจำกัดจำนวนที่ใช้ ซอฟต์แวร์จะแบ่งแผนตามตู้และตรวจว่าสินค้าผ่านประตูได้หรือไม่ หากผ่านไม่ได้ ต้องปรับทิศทางบรรจุ แยกสินค้า หรือเปลี่ยนแผนขนส่ง", ms: "Kontena maksimum mengehadkan bilangan yang boleh digunakan. Perisian membahagi pelan mengikut kontena dan menyemak sama ada item melepasi pintu. Jika tidak boleh, laras orientasi, pecahkan, atau tukar pelan penghantaran.", vi: "Số container tối đa giới hạn số lượng dùng được. Phần mềm chia kế hoạch theo container và kiểm tra hàng có qua cửa không. Nếu không qua được, hãy chỉnh hướng đóng, tách hàng hoặc đổi phương án vận chuyển." },
    "分层与移动": { en: "Layers & moving", ko: "층 및 이동", th: "ชั้นและการย้าย", ms: "Lapisan & gerakan", vi: "Lớp & di chuyển" },
    "小包装较多时，拖动分层显示高度，只查看指定高度以下的货物。选择具体货物后，可使用方向按钮按 100 毫米微调。系统会阻止越界和碰撞。": { en: "With many small packages, drag the layer height to view only items below a set height. After selecting an item, fine-tune by 100 mm with the arrow buttons; the system prevents out-of-bounds and collisions.", ko: "소형 포장이 많을 때 층 높이를 드래그해 지정 높이 이하 화물만 봅니다. 화물 선택 후 방향 버튼으로 100mm씩 조정하며, 경계 초과와 충돌은 차단됩니다.", th: "เมื่อมีหีบห่อเล็กจำนวนมาก ลากความสูงชั้นเพื่อดูเฉพาะสินค้าที่ต่ำกว่าระดับที่กำหนด เมื่อเลือกสินค้าแล้วปรับทีละ 100 มม. ด้วยปุ่มทิศทาง ระบบจะกันการล้นและการชน", ms: "Apabila banyak bungkusan kecil, seret tinggi lapisan untuk lihat item di bawah tinggi tertentu sahaja. Selepas pilih item, halus suai 100 mm dengan butang arah; sistem menghalang luar sempadan dan pelanggaran.", vi: "Khi có nhiều kiện nhỏ, kéo chiều cao lớp để chỉ xem hàng dưới độ cao đã đặt. Sau khi chọn kiện, tinh chỉnh 100 mm bằng nút mũi tên; hệ thống ngăn vượt biên và va chạm." },
    "分享与交接": { en: "Sharing & handover", ko: "공유 및 인계", th: "การแบ่งปันและส่งมอบ", ms: "Perkongsian & serahan", vi: "Chia sẻ & bàn giao" },
    "点击导出项目得到项目文件，适合同事继续编辑同一个任务。发给同事时建议同时发送软件文件夹、项目文件、专业模板和用户手册。": { en: "Click Export project to get a project file so colleagues can keep editing the same task. When sharing, send the software folder, project file, pro template and manual together.", ko: "프로젝트 내보내기를 클릭하면 동료가 같은 작업을 계속 편집할 수 있는 프로젝트 파일이 생성됩니다. 공유 시 소프트웨어 폴더, 프로젝트 파일, 전문 템플릿, 설명서를 함께 보내세요.", th: "คลิกส่งออกโปรเจกต์เพื่อได้ไฟล์โปรเจกต์ ให้เพื่อนร่วมงานแก้ไขงานเดิมต่อได้ เมื่อส่งให้ผู้อื่น แนะนำส่งโฟลเดอร์ซอฟต์แวร์ ไฟล์โปรเจกต์ เทมเพลตมืออาชีพ และคู่มือไปด้วย", ms: "Klik Eksport projek untuk dapat fail projek supaya rakan boleh terus menyunting tugas sama. Semasa berkongsi, hantar folder perisian, fail projek, templat pro dan manual bersama.", vi: "Nhấn Xuất dự án để có tệp dự án giúp đồng nghiệp tiếp tục sửa cùng nhiệm vụ. Khi chia sẻ, hãy gửi kèm thư mục phần mềm, tệp dự án, mẫu chuyên nghiệp và sổ tay." },
    "现场复核": { en: "On-site review", ko: "현장 검토", th: "การตรวจสอบหน้างาน", ms: "Semakan di tapak", vi: "Rà soát tại hiện trường" },
    "当前算法适合快速生成仓库作业参考方案。正式发运前仍需由现场人员复核承重、绑扎、禁配、法规和箱况。": { en: "The algorithm is for quickly generating reference plans. Before shipping, on-site staff must still verify load-bearing, lashing, incompatibilities, regulations and container condition.", ko: "이 알고리즘은 참고 계획을 빠르게 생성하기 위한 것입니다. 정식 출하 전 현장 인원이 하중, 결박, 혼적 금지, 규정, 컨테이너 상태를 검토해야 합니다.", th: "อัลกอริทึมนี้ใช้สร้างแผนอ้างอิงอย่างรวดเร็ว ก่อนส่งจริงต้องให้เจ้าหน้าที่หน้างานตรวจการรับน้ำหนัก การรัด ของต้องห้ามรวม กฎระเบียบ และสภาพตู้", ms: "Algoritma ini untuk menjana pelan rujukan dengan cepat. Sebelum penghantaran, kakitangan di tapak masih perlu sahkan beban, ikatan, larangan campuran, peraturan dan keadaan kontena.", vi: "Thuật toán dùng để tạo nhanh phương án tham khảo. Trước khi xuất hàng, nhân viên hiện trường vẫn phải kiểm tra khả năng chịu tải, chằng buộc, hàng cấm xếp chung, quy định và tình trạng container." },
    "常见问题": { en: "FAQ", ko: "자주 묻는 질문", th: "คำถามที่พบบ่อย", ms: "Soalan lazim", vi: "Câu hỏi thường gặp" },
    "导入后没有货物时，先检查第一行字段名。货物无法装入时，检查尺寸、重量、箱门、不可堆叠和最大箱数。同事看到旧版时，重新解压最新版或刷新浏览器缓存。": { en: "If no cargo appears after import, check the first-row field names. If items won't load, check size, weight, door, no-stacking and max containers. If a colleague sees an old version, re-extract the latest or refresh the browser cache.", ko: "가져오기 후 화물이 없으면 첫 행 필드명을 확인하세요. 적재가 안 되면 치수, 무게, 도어, 적재 불가, 최대 컨테이너 수를 확인하세요. 동료가 구버전을 보면 최신본을 다시 압축 해제하거나 캐시를 새로고침하세요.", th: "หากนำเข้าแล้วไม่มีสินค้า ให้ตรวจชื่อฟิลด์แถวแรก หากจัดไม่ได้ ให้ตรวจขนาด น้ำหนัก ประตูตู้ ห้ามวางซ้อน และจำนวนตู้สูงสุด หากเพื่อนเห็นรุ่นเก่า ให้แตกไฟล์รุ่นล่าสุดใหม่หรือรีเฟรชแคช", ms: "Jika tiada kargo selepas import, semak nama medan baris pertama. Jika item tak boleh dimuat, semak saiz, berat, pintu, larangan susun dan kontena maksimum. Jika rakan lihat versi lama, nyahzip semula versi terkini atau segar semula cache.", vi: "Nếu sau khi nhập không có hàng, hãy kiểm tra tên trường dòng đầu. Nếu hàng không xếp được, kiểm tra kích thước, khối lượng, cửa, không xếp chồng và số container tối đa. Nếu đồng nghiệp thấy bản cũ, hãy giải nén lại bản mới nhất hoặc làm mới bộ nhớ đệm." },
    "对标成熟软件新增能力": { en: "Added capabilities vs mature software", ko: "성숙 소프트웨어 대비 추가 기능", th: "ความสามารถที่เพิ่มเทียบซอฟต์แวร์ชั้นนำ", ms: "Keupayaan tambahan berbanding perisian matang", vi: "Năng lực bổ sung so với phần mềm trưởng thành" },
    "参考成熟装箱软件常见能力，当前版本增加分组/目的地、可倾斜限制、最大堆叠层数、装载步骤回放、箱底承重热区、重量分布风险提示、专业模板和正式用户手册。": { en: "Referencing common features of mature packing software, this version adds group/destination, tilt limits, max stacking layers, loading-step playback, floor-load heat zones, weight-distribution risk alerts, a pro template and a formal manual.", ko: "성숙한 적재 소프트웨어의 일반 기능을 참고해 이 버전은 그룹/목적지, 기울임 제한, 최대 적재 단수, 적재 단계 재생, 바닥 하중 핫존, 무게 분포 위험 경고, 전문 템플릿, 정식 설명서를 추가했습니다.", th: "อ้างอิงฟีเจอร์ทั่วไปของซอฟต์แวร์จัดตู้ชั้นนำ เวอร์ชันนี้เพิ่มกลุ่ม/ปลายทาง ข้อจำกัดการเอียง จำนวนชั้นซ้อนสูงสุด การเล่นซ้ำขั้นตอน โซนน้ำหนักพื้น การแจ้งเตือนการกระจายน้ำหนัก เทมเพลตมืออาชีพ และคู่มือทางการ", ms: "Merujuk ciri biasa perisian matang, versi ini menambah kumpulan/destinasi, had condong, lapisan susun maksimum, main semula langkah, zon haba lantai, amaran risiko taburan berat, templat pro dan manual rasmi.", vi: "Tham chiếu các tính năng phổ biến của phần mềm trưởng thành, phiên bản này bổ sung nhóm/điểm đến, giới hạn nghiêng, số lớp xếp tối đa, phát lại bước xếp, vùng nhiệt tải sàn, cảnh báo rủi ro phân bố tải, mẫu chuyên nghiệp và sổ tay chính thức." },

    // —— app.js 动态片段（带数字拼接，用 t() 包裹）——
    "号箱": { en: "Container", ko: "번 컨테이너", th: "ตู้", ms: "Kontena", vi: "Container" },
    "件已装，": { en: " loaded, ", ko: "건 적재, ", th: " จัดแล้ว, ", ms: " dimuat, ", vi: " đã xếp, " },
    "件未装": { en: " unloaded", ko: "건 미적재", th: " ยังไม่จัด", ms: " belum muat", vi: " chưa xếp" },
    "未装": { en: "Unloaded", ko: "미적재", th: "ยังไม่จัด", ms: "Belum muat", vi: "Chưa xếp" },
    "件": { en: " pcs", ko: "개", th: " ชิ้น", ms: " unit", vi: " kiện" },
    "千克": { en: " kg", ko: " kg", th: " กก.", ms: " kg", vi: " kg" },
    "毫米": { en: " mm", ko: " mm", th: " มม.", ms: " mm", vi: " mm" },
    "纵向=": { en: "Long=", ko: "종=", th: "ยาว=", ms: "Membujur=", vi: "Dọc=" },
    "横向=": { en: "Lat=", ko: "횡=", th: "ขวาง=", ms: "Melintang=", vi: "Ngang=" },
    "高度=": { en: "Height=", ko: "높이=", th: "สูง=", ms: "Tinggi=", vi: "Cao=" },
    "显示全部步骤（": { en: "Show all steps (", ko: "전체 단계 (", th: "แสดงทุกขั้นตอน (", ms: "Papar semua langkah (", vi: "Hiện tất cả bước (" },
    "件）": { en: " pcs)", ko: "개)", th: " ชิ้น)", ms: " unit)", vi: " kiện)" },
    "显示前 ": { en: "Showing first ", ko: "처음 ", th: "แสดง ", ms: "Memaparkan ", vi: "Hiện " },
    " 件 / 共 ": { en: " of ", ko: "건 / 총 ", th: " จาก ", ms: " drpd ", vi: " trên " },
    " 件": { en: " pcs", ko: "건", th: " ชิ้น", ms: " unit", vi: " kiện" },
    "仍有 ": { en: "There are still ", ko: "아직 ", th: "ยังเหลือ ", ms: "Masih ada ", vi: "Vẫn còn " },
    " 件未装。可增加最大箱数、换更大箱型，或检查不可堆叠/不可旋转限制。": { en: " items unloaded. Increase max containers, use a larger container, or check no-stacking/no-rotation limits.", ko: "건 미적재. 최대 컨테이너 수를 늘리거나 더 큰 컨테이너를 쓰거나 적재 불가/회전 불가 제한을 확인하세요.", th: " ชิ้นยังไม่จัด เพิ่มจำนวนตู้สูงสุด ใช้ตู้ใหญ่ขึ้น หรือตรวจข้อจำกัดห้ามวางซ้อน/ห้ามหมุน", ms: " item belum muat. Tambah kontena maksimum, guna kontena lebih besar, atau semak had larangan susun/putar.", vi: " kiện chưa xếp. Hãy tăng số container, dùng container lớn hơn, hoặc kiểm tra giới hạn không xếp chồng/không xoay." },
    "当前方案空间利用较高，适合进入仓库复核和装柜作业排程。": { en: "This plan has high space usage and is ready for warehouse review and loading scheduling.", ko: "이 계획은 공간 활용이 높아 창고 검토와 적재 일정에 적합합니다.", th: "แผนนี้ใช้พื้นที่ได้สูง เหมาะเข้าสู่การตรวจคลังและจัดตารางการบรรจุ", ms: "Pelan ini tinggi penggunaan ruang dan sedia untuk semakan gudang dan penjadualan muatan.", vi: "Phương án này tận dụng không gian cao, sẵn sàng để rà soát kho và lên lịch xếp." },
    "方案平稳，没有明显装载风险。建议现场复核包装强度和绑扎要求。": { en: "The plan is stable with no obvious loading risk. Verify packaging strength and lashing on site.", ko: "계획이 안정적이며 뚜렷한 적재 위험이 없습니다. 현장에서 포장 강도와 결박 요건을 확인하세요.", th: "แผนสม่ำเสมอ ไม่มีความเสี่ยงชัดเจน ควรตรวจความแข็งแรงบรรจุภัณฑ์และการรัดหน้างาน", ms: "Pelan stabil tanpa risiko ketara. Sahkan kekuatan pembungkusan dan ikatan di tapak.", vi: "Phương án ổn định, không có rủi ro xếp rõ rệt. Hãy kiểm tra độ bền đóng gói và chằng buộc tại hiện trường." },
    "建议从箱内最深处向箱门方向装载，重货和高优先级货物优先复核。": { en: "Load from the deepest part toward the door; review heavy and high-priority items first.", ko: "컨테이너 안쪽 끝에서 도어 방향으로 적재하고, 중량물과 높은 우선순위 화물을 먼저 검토하세요.", th: "จัดจากส่วนลึกสุดของตู้ไปทางประตู ตรวจของหนักและสำคัญสูงก่อน", ms: "Muat dari bahagian paling dalam ke arah pintu; semak barang berat dan keutamaan tinggi dahulu.", vi: "Xếp từ phần sâu nhất hướng ra cửa; ưu tiên rà soát hàng nặng và ưu tiên cao." },
    "件未装": { en: " unloaded", ko: "건 미적재", th: " ยังไม่จัด", ms: " belum muat", vi: " chưa xếp" },
    "未装 ": { en: "Unloaded ", ko: "미적재 ", th: "ยังไม่จัด ", ms: "Belum muat ", vi: "Chưa xếp " },
    "超过 ": { en: "Exceeds ", ko: "초과 ", th: "เกิน ", ms: "Melebihi ", vi: "Vượt " },
    " 个箱子的可用容量或规则限制": { en: " containers' available capacity or rule limits", ko: "개 컨테이너의 가용 용량 또는 규칙 제한", th: " ตู้ของความจุหรือข้อจำกัดกฎ", ms: " kapasiti kontena atau had peraturan", vi: " container về sức chứa hoặc giới hạn quy tắc" },
    "第 ": { en: "Row ", ko: "행 ", th: "แถว ", ms: "Baris ", vi: "Dòng " },
    " 行 ": { en: " ", ko: " ", th: " ", ms: " ", vi: " " },
    "未命名货物": { en: "Unnamed item", ko: "이름 없는 화물", th: "สินค้าไม่มีชื่อ", ms: "Barang tanpa nama", vi: "Hàng chưa đặt tên" },
    "任意旋转后都无法通过箱门 ": { en: "Cannot pass the door even after any rotation ", ko: "어떤 회전으로도 도어를 통과할 수 없음 ", th: "หมุนอย่างไรก็ผ่านประตูไม่ได้ ", ms: "Tidak boleh melalui pintu walaupun diputar ", vi: "Không thể qua cửa dù xoay thế nào " },
    " 个热点超过上限": { en: " hotspots exceed the limit", ko: "개 핫스팟이 한계 초과", th: " จุดร้อนเกินขีดจำกัด", ms: " titik panas melebihi had", vi: " điểm nóng vượt giới hạn" },
    " 个热点接近上限": { en: " hotspots near the limit", ko: "개 핫스팟이 한계 근접", th: " จุดร้อนใกล้ขีดจำกัด", ms: " titik panas hampir had", vi: " điểm nóng gần giới hạn" },
    "箱底承重分布平稳": { en: "Floor load distribution is stable", ko: "바닥 하중 분포가 안정적", th: "การกระจายน้ำหนักพื้นตู้สม่ำเสมอ", ms: "Taburan beban lantai stabil", vi: "Phân bố tải sàn ổn định" },
    "连续承重热力图": { en: "Continuous load heatmap", ko: "연속 하중 히트맵", th: "ฮีตแมพน้ำหนักต่อเนื่อง", ms: "Peta haba beban berterusan", vi: "Bản đồ nhiệt tải liên tục" },
    "箱底按 ": { en: "Floor uses ", ko: "바닥은 ", th: "พื้นตู้ใช้ ", ms: "Lantai guna ", vi: "Sàn dùng " },
    " 个承重点计算面积载荷。画布用连续色带显示当前箱内相对热度，风险判断按上限 ": { en: " load points to compute area load. The canvas shows relative heat with a continuous gradient; risk is judged against the limit ", ko: "개 하중점으로 면적 하중을 계산합니다. 캔버스는 연속 그라데이션으로 상대 열을 표시하며, 위험은 한계 기준으로 판단합니다 ", th: " จุดรับน้ำหนักคำนวณภาระต่อพื้นที่ ผ้าใบแสดงความร้อนสัมพัทธ์ด้วยแถบสีต่อเนื่อง ตัดสินความเสี่ยงตามขีดจำกัด ", ms: " titik beban untuk mengira beban kawasan. Kanvas menunjukkan haba relatif dengan kecerunan berterusan; risiko dinilai pada had ", vi: " điểm tải để tính tải theo diện tích. Khung hiển thị nhiệt tương đối bằng dải màu liên tục; rủi ro đánh giá theo giới hạn " },
    " 千克/平方米。": { en: " kg/m². ", ko: " kg/m². ", th: " กก./ตร.ม. ", ms: " kg/m². ", vi: " kg/m². " },
    " 千克/平方米": { en: " kg/m²", ko: " kg/m²", th: " กก./ตร.ม.", ms: " kg/m²", vi: " kg/m²" },
    "千克/平方米": { en: "kg/m²", ko: "kg/m²", th: "กก./ตร.ม.", ms: "kg/m²", vi: "kg/m²" },
    "最高热点": { en: "Hottest point", ko: "최고 핫스팟", th: "จุดร้อนสูงสุด", ms: "Titik terpanas", vi: "Điểm nóng nhất" },
    "最低载荷点": { en: "Lowest load point", ko: "최저 하중점", th: "จุดภาระต่ำสุด", ms: "Titik beban terendah", vi: "Điểm tải thấp nhất" },
    "暂无数据。": { en: "No data.", ko: "데이터 없음.", th: "ไม่มีข้อมูล", ms: "Tiada data.", vi: "Chưa có dữ liệu." },
    "该热点暂无货物压载": { en: "No cargo on this hotspot", ko: "이 핫스팟에 화물 없음", th: "จุดร้อนนี้ไม่มีสินค้ากด", ms: "Tiada kargo di titik panas ini", vi: "Điểm nóng này chưa có hàng đè" },
    "承重调整建议": { en: "Load adjustment advice", ko: "하중 조정 제안", th: "คำแนะนำปรับภาระ", ms: "Nasihat pelarasan beban", vi: "Gợi ý điều chỉnh tải" },
    "优先处理：": { en: "Priority: ", ko: "우선 처리: ", th: "จัดการก่อน: ", ms: "Keutamaan: ", vi: "Ưu tiên: " },
    "，贡献 ": { en: ", contributing ", ko: ", 기여 ", th: ", มีส่วน ", ms: ", menyumbang ", vi: ", đóng góp " },
    "当前没有明显需要调整的承重区域。": { en: "No load areas clearly need adjustment.", ko: "조정이 필요한 하중 구역이 뚜렷하지 않습니다.", th: "ไม่มีพื้นที่ภาระที่ต้องปรับชัดเจน", ms: "Tiada kawasan beban yang jelas perlu dilaras.", vi: "Hiện không có vùng tải cần điều chỉnh rõ rệt." },
    "装载顺序": { en: "Loading sequence", ko: "적재 순서", th: "ลำดับการบรรจุ", ms: "Urutan muatan", vi: "Trình tự xếp" },
    "默认": { en: "Default", ko: "기본", th: "ค่าเริ่มต้น", ms: "Lalai", vi: "Mặc định" },
    "号箱左右重量差约 ": { en: " left-right weight diff ≈ ", ko: "번 컨테이너 좌우 중량차 약 ", th: "ตู้ ผลต่างน้ำหนักซ้ายขวาราว ", ms: "Kontena beza berat kiri-kanan ≈ ", vi: "Container chênh lệch trọng lượng trái-phải ≈ " },
    "，建议复核配载或手动微调。": { en: ", review load plan or fine-tune manually.", ko: ", 적재 계획 검토 또는 수동 미세조정 권장.", th: ", ควรตรวจการจัดวางหรือปรับด้วยมือ", ms: ", semak pelan muatan atau halusi secara manual.", vi: ", nên rà soát phương án xếp hoặc tinh chỉnh thủ công." },
    "号箱重量利用超过 90%，发运前建议复核限重和地磅数据。": { en: " container weight usage over 90%; verify weight limits and weighbridge data before shipping.", ko: "번 컨테이너 중량 사용률 90% 초과; 출하 전 중량 제한과 계량 데이터 확인 권장.", th: "ตู้ ใช้น้ำหนักเกิน 90% ควรตรวจขีดจำกัดและข้อมูลตาชั่งก่อนส่ง", ms: "Kontena penggunaan berat melebihi 90%; sahkan had berat dan data jambatan timbang sebelum hantar.", vi: "Container dùng trọng lượng trên 90%; kiểm tra giới hạn và dữ liệu cân trước khi gửi." },
    "面积载荷 ": { en: "area load ", ko: "면적 하중 ", th: "ภาระต่อพื้นที่ ", ms: "beban kawasan ", vi: "tải diện tích " },
    "，占上限 ": { en: ", of limit ", ko: ", 한계의 ", th: ", ของขีดจำกัด ", ms: ", daripada had ", vi: ", trên giới hạn " },
    "，建议分散重货。": { en: "; spread heavy cargo.", ko: "; 중량물 분산 권장.", th: "; ควรกระจายของหนัก", ms: "; sebarkan kargo berat.", vi: "; nên phân tán hàng nặng." },
    "号箱空间利用偏低，可尝试降低箱数或合并低优先级货物。": { en: " container space usage is low; try fewer containers or merge low-priority cargo.", ko: "번 컨테이너 공간 사용률이 낮음; 컨테이너 수를 줄이거나 낮은 우선순위 화물을 합치세요.", th: "ตู้ ใช้พื้นที่ต่ำ ลองลดจำนวนตู้หรือรวมสินค้าสำคัญต่ำ", ms: "Kontena penggunaan ruang rendah; cuba kurangkan kontena atau gabungkan kargo keutamaan rendah.", vi: "Container dùng không gian thấp; thử giảm số container hoặc gộp hàng ưu tiên thấp." },
    "号箱": { en: "Container ", ko: "번 컨테이너", th: "ตู้ ", ms: "Kontena ", vi: "Container " },
    "面积 ": { en: "Area ", ko: "면적 ", th: "พื้นที่ ", ms: "Kawasan ", vi: "Diện tích " },
    " 平方米，面积载荷 ": { en: " m², area load ", ko: " m², 면적 하중 ", th: " ตร.ม. ภาระต่อพื้นที่ ", ms: " m², beban kawasan ", vi: " m², tải diện tích " },
    " 已超过上限，建议把该区重货向低载荷区域分散，或降低上层堆叠。": { en: " exceeds the limit; spread heavy cargo here to lower-load areas or reduce upper stacking.", ko: " 한계 초과; 이 구역 중량물을 낮은 하중 구역으로 분산하거나 상단 적재를 줄이세요.", th: " เกินขีดจำกัด ควรกระจายของหนักไปยังพื้นที่ภาระต่ำหรือลดการวางซ้อนชั้นบน", ms: " melebihi had; sebarkan kargo berat ke kawasan beban rendah atau kurangkan susunan atas.", vi: " vượt giới hạn; phân tán hàng nặng sang vùng tải thấp hoặc giảm xếp chồng tầng trên." },
    " 接近上限，建议现场重点复核箱底承重和垫板。": { en: " is near the limit; review floor load and dunnage on site.", ko: " 한계 근접; 현장에서 바닥 하중과 받침판을 중점 검토하세요.", th: " ใกล้ขีดจำกัด ควรตรวจน้ำหนักพื้นตู้และไม้รองหน้างาน", ms: " hampir had; semak beban lantai dan papan alas di tapak.", vi: " gần giới hạn; rà soát tải sàn và ván lót tại hiện trường." },
    " 当前风险较低。": { en: " currently low risk.", ko: " 현재 위험 낮음.", th: " ขณะนี้ความเสี่ยงต่ำ", ms: " kini risiko rendah.", vi: " hiện rủi ro thấp." },
    "将 ": { en: "Move ", ko: "", th: "ย้าย ", ms: "Alihkan ", vi: "Chuyển " },
    " 从": { en: " from ", ko: "을(를) ", th: " จาก", ms: " dari ", vi: " từ " },
    "附近移向": { en: " toward ", ko: " 부근에서 ", th: " ไปยัง", ms: " ke arah ", vi: " về phía " },
    "，可优先降低最高承重区。": { en: " to lower the heaviest load area first.", ko: "(으)로 옮기면 최고 하중 구역을 우선 낮출 수 있습니다.", th: " เพื่อลดพื้นที่รับน้ำหนักสูงสุดก่อน", ms: " untuk merendahkan kawasan beban tertinggi dahulu.", vi: " để giảm vùng tải nặng nhất trước." },
    "上限 ": { en: "Limit ", ko: "한계 ", th: "ขีดจำกัด ", ms: "Had ", vi: "Giới hạn " },
    "最高 ": { en: "Max ", ko: "최고 ", th: "สูงสุด ", ms: "Maks ", vi: "Cao nhất " },
    "最低 ": { en: "Min ", ko: "최저 ", th: "ต่ำสุด ", ms: "Min ", vi: "Thấp nhất " },
    "建议 ": { en: "Advice ", ko: "제안 ", th: "คำแนะนำ ", ms: "Nasihat ", vi: "Gợi ý " },
    " 立方米": { en: " m³", ko: " m³", th: " ลบ.ม.", ms: " m³", vi: " m³" },
    "号箱左右重量差": { en: " container left-right weight diff", ko: "번 컨테이너 좌우 중량차", th: "ตู้ ผลต่างน้ำหนักซ้ายขวา", ms: "Kontena beza berat kiri-kanan", vi: "Container chênh lệch trọng lượng trái-phải" },
    "立方米": { en: "m³", ko: "m³", th: "ลบ.ม.", ms: "m³", vi: "m³" },
    "装箱报告": { en: "Loading Report", ko: "적재 보고서", th: "รายงานการบรรจุ", ms: "Laporan Muatan", vi: "Báo cáo xếp hàng" },
    "任务名称: ": { en: "Task: ", ko: "작업명: ", th: "ชื่องาน: ", ms: "Tugas: ", vi: "Tên tác vụ: " },
    "客户/订单: ": { en: "Customer/Order: ", ko: "고객/주문: ", th: "ลูกค้า/คำสั่งซื้อ: ", ms: "Pelanggan/Pesanan: ", vi: "Khách hàng/Đơn: " },
    "操作员: ": { en: "Operator: ", ko: "작업자: ", th: "ผู้ปฏิบัติงาน: ", ms: "Operator: ", vi: "Người thao tác: " },
    "装箱日期: ": { en: "Date: ", ko: "적재 날짜: ", th: "วันที่บรรจุ: ", ms: "Tarikh: ", vi: "Ngày xếp: " },
    "箱型: ": { en: "Container type: ", ko: "컨테이너 종류: ", th: "ชนิดตู้: ", ms: "Jenis kontena: ", vi: "Loại container: " },
    "使用箱数: ": { en: "Containers used: ", ko: "사용 컨테이너 수: ", th: "จำนวนตู้ที่ใช้: ", ms: "Kontena digunakan: ", vi: "Số container dùng: " },
    "空间利用率: ": { en: "Space usage: ", ko: "공간 활용률: ", th: "อัตราใช้พื้นที่: ", ms: "Kadar guna ruang: ", vi: "Tỷ lệ dùng không gian: " },
    "重量利用率: ": { en: "Weight usage: ", ko: "중량 활용률: ", th: "อัตราใช้น้ำหนัก: ", ms: "Kadar guna berat: ", vi: "Tỷ lệ dùng trọng lượng: " },
    "装载重量: ": { en: "Loaded weight: ", ko: "적재 중량: ", th: "น้ำหนักบรรจุ: ", ms: "Berat dimuat: ", vi: "Trọng lượng xếp: " },
    "重心: 纵向=": { en: "Center: Long=", ko: "무게중심: 종=", th: "ศูนย์ถ่วง: ยาว=", ms: "Pusat: Membujur=", vi: "Trọng tâm: Dọc=" },
    "数据校验: ": { en: "Validation: ", ko: "데이터 검증: ", th: "ตรวจสอบข้อมูล: ", ms: "Pengesahan: ", vi: "Kiểm tra dữ liệu: " },
    "通过": { en: "Pass", ko: "통과", th: "ผ่าน", ms: "Lulus", vi: "Đạt" },
    " 项需修正": { en: " items to fix", ko: "건 수정 필요", th: " รายการต้องแก้", ms: " perkara perlu dibetulkan", vi: " mục cần sửa" },
    "货物汇总": { en: "Cargo summary", ko: "화물 요약", th: "สรุปสินค้า", ms: "Ringkasan kargo", vi: "Tổng hợp hàng" },
    "建议装载顺序": { en: "Suggested loading sequence", ko: "권장 적재 순서", th: "ลำดับการบรรจุที่แนะนำ", ms: "Urutan muatan dicadangkan", vi: "Trình tự xếp đề xuất" },
    "箱底承重复核（当前查看箱，上限 ": { en: "Floor load review (current container, limit ", ko: "바닥 하중 검토 (현재 컨테이너, 한계 ", th: "ตรวจน้ำหนักพื้นตู้ (ตู้ที่ดูอยู่, ขีดจำกัด ", ms: "Semakan beban lantai (kontena semasa, had ", vi: "Rà soát tải sàn (container hiện tại, giới hạn " },
    "千克/平方米）": { en: " kg/m²)", ko: " kg/m²)", th: " กก./ตร.ม.)", ms: " kg/m²)", vi: " kg/m²)" },
    "调整建议": { en: "Adjustment advice", ko: "조정 제안", th: "คำแนะนำการปรับ", ms: "Nasihat pelarasan", vi: "Gợi ý điều chỉnh" },
    "摆放坐标": { en: "Placement coordinates", ko: "배치 좌표", th: "พิกัดการวาง", ms: "Koordinat susunan", vi: "Tọa độ đặt" },
    "未装货物": { en: "Unloaded cargo", ko: "미적재 화물", th: "สินค้าที่ยังไม่บรรจุ", ms: "Kargo belum dimuat", vi: "Hàng chưa xếp" },
    "占上限 ": { en: "of limit ", ko: "한계의 ", th: "ของขีดจำกัด ", ms: "daripada had ", vi: "trên giới hạn " },
    "占上限": { en: "of limit", ko: "한계의", th: "ของขีดจำกัด", ms: "daripada had", vi: "trên giới hạn" },
    "主要货物 ": { en: "main cargo ", ko: "주요 화물 ", th: "สินค้าหลัก ", ms: "kargo utama ", vi: "hàng chính " },
    "当前无需调整": { en: "no adjustment needed", ko: "조정 불필요", th: "ไม่ต้องปรับ", ms: "tiada pelarasan diperlukan", vi: "không cần điều chỉnh" },
    "层=": { en: "Layer=", ko: "층=", th: "ชั้น=", ms: "Lapisan=", vi: "Tầng=" },
    ". 箱": { en: ". Box ", ko: ". 컨테이너 ", th: ". ตู้ ", ms: ". Kotak ", vi: ". Thùng " },
    "、": { en: ", ", ko: ", ", th: ", ", ms: ", ", vi: ", " },
    "无": { en: "None", ko: "없음", th: "ไม่มี", ms: "Tiada", vi: "Không" },
    "箱": { en: "Box ", ko: "컨테이너 ", th: "ตู้ ", ms: "Kotak ", vi: "Thùng " },
    "项需修正": { en: " items to fix", ko: "건 수정 필요", th: " รายการต้องแก้", ms: " perkara perlu dibetulkan", vi: " mục cần sửa" },
    "前段左侧": { en: "Front-left", ko: "앞쪽 좌측", th: "ส่วนหน้าซ้าย", ms: "Depan-kiri", vi: "Trước-trái" },
    "前段右侧": { en: "Front-right", ko: "앞쪽 우측", th: "ส่วนหน้าขวา", ms: "Depan-kanan", vi: "Trước-phải" },
    "中段左侧": { en: "Mid-left", ko: "중간 좌측", th: "ส่วนกลางซ้าย", ms: "Tengah-kiri", vi: "Giữa-trái" },
    "中段右侧": { en: "Mid-right", ko: "중간 우측", th: "ส่วนกลางขวา", ms: "Tengah-kanan", vi: "Giữa-phải" },
    "后段左侧": { en: "Rear-left", ko: "뒤쪽 좌측", th: "ส่วนท้ายซ้าย", ms: "Belakang-kiri", vi: "Sau-trái" },
    "后段右侧": { en: "Rear-right", ko: "뒤쪽 우측", th: "ส่วนท้ายขวา", ms: "Belakang-kanan", vi: "Sau-phải" },
    "前段": { en: "Front", ko: "앞쪽", th: "ส่วนหน้า", ms: "Depan", vi: "Trước" },
    "中段": { en: "Mid", ko: "중간", th: "ส่วนกลาง", ms: "Tengah", vi: "Giữa" },
    "后段": { en: "Rear", ko: "뒤쪽", th: "ส่วนท้าย", ms: "Belakang", vi: "Sau" },
    "左侧": { en: "left", ko: "좌측", th: "ซ้าย", ms: "kiri", vi: "trái" },
    "右侧": { en: "right", ko: "우측", th: "ขวา", ms: "kanan", vi: "phải" },
    "固定": { en: "Fixed", ko: "고정", th: "คงที่", ms: "Tetap", vi: "Cố định" },
    "箱型与策略": { en: "Container type & strategy", ko: "컨테이너 종류 및 전략", th: "ชนิดตู้และกลยุทธ์", ms: "Jenis kontena & strategi", vi: "Loại container & chiến lược" },
    "中": { en: "Medium", ko: "중", th: "กลาง", ms: "Sederhana", vi: "Trung bình" },
    "。": { en: ". ", ko: ". ", th: ". ", ms: ". ", vi: ". " },
    "，": { en: ", ", ko: ", ", th: ", ", ms: ", ", vi: ", " },
    "（": { en: " (", ko: " (", th: " (", ms: " (", vi: " (" },
    "）": { en: ")", ko: ")", th: ")", ms: ")", vi: ")" },
    "：": { en: ": ", ko: ": ", th: ": ", ms: ": ", vi: ": " },
  };

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  const CJK = /[一-鿿]/;
  // 用于插值字符串（含数字）的子串回退：按长度降序替换已知中文片段。
  const FRAG_KEYS = Object.keys(DICT).filter((k) => CJK.test(k)).sort((a, b) => b.length - a.length);
  function translateFragments(text, lang) {
    let out = text;
    for (let i = 0; i < FRAG_KEYS.length; i++) {
      const k = FRAG_KEYS[i];
      if (out.indexOf(k) === -1) continue;
      const e = DICT[k];
      if (e && e[lang]) out = out.split(k).join(e[lang]);
    }
    return out;
  }

  const I18N = {
    LANGS,
    lang: "zh",
    init() {
      try {
        this.lang = localStorage.getItem("cstar-lang") || "zh";
      } catch (e) {
        this.lang = "zh";
      }
    },
    t(zh) {
      if (zh == null) return zh;
      if (this.lang === "zh") return zh;
      const e = DICT[zh];
      return e && e[this.lang] ? e[this.lang] : zh;
    },
    setLang(l) {
      this.lang = l;
      try {
        localStorage.setItem("cstar-lang", l);
      } catch (e) {}
      document.documentElement.lang = l === "zh" ? "zh-CN" : l;
    },
  };

  // 静态/动态 DOM 自动翻译：记录原始中文，按当前语言替换。
  const ORIG = new WeakMap();
  let observer = null;

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let orig = ORIG.get(node);
      if (orig === undefined) {
        if (!CJK.test(node.nodeValue)) return;
        orig = node.nodeValue;
        ORIG.set(node, orig);
      }
      const lead = orig.match(/^\s*/)[0];
      const trail = orig.match(/\s*$/)[0];
      const core = orig.trim();
      if (I18N.lang === "zh") {
        node.nodeValue = orig;
        return;
      }
      let translated = I18N.t(core);
      if (translated === core && CJK.test(core)) translated = translateFragments(core, I18N.lang);
      node.nodeValue = lead + translated + trail;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    ["placeholder", "aria-label", "title", "alt"].forEach((attr) => {
      if (!node.hasAttribute || !node.hasAttribute(attr)) return;
      const key = attr + "::orig";
      let orig = node.getAttribute("data-i18n-" + attr);
      if (orig == null) {
        const v = node.getAttribute(attr);
        if (!CJK.test(v)) return;
        orig = v;
        node.setAttribute("data-i18n-" + attr, orig);
      }
      node.setAttribute(attr, I18N.t(orig));
    });
    for (let i = 0; i < node.childNodes.length; i++) translateNode(node.childNodes[i]);
  }

  function applyAll() {
    if (observer) observer.disconnect();
    translateNode(document.body);
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function buildSelector() {
    const sel = document.querySelector("#langSelect");
    if (!sel) return;
    sel.innerHTML = LANGS.map(([code, label]) => `<option value="${code}">${label}</option>`).join("");
    sel.value = I18N.lang;
    sel.addEventListener("change", () => {
      I18N.setLang(sel.value);
      applyAll();
      // 通知 app.js 重渲染动态内容（指标、报告、视图等）
      if (typeof window.onLanguageChanged === "function") window.onLanguageChanged();
    });
  }

  function start() {
    I18N.init();
    I18N.setLang(I18N.lang);
    buildSelector();
    observer = new MutationObserver((mutations) => {
      observer.disconnect();
      mutations.forEach((m) => {
        if (m.type === "characterData") translateNode(m.target);
        else m.addedNodes.forEach((n) => translateNode(n));
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    applyAll();
  }

  window.I18N = I18N;
  window.t = (zh) => I18N.t(zh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
