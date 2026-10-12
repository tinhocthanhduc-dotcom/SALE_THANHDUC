# Thành Đức ERP — Sprint 1: Kiểm toán mã nguồn
Ngày: 12/10/2026. Trạng thái: hoàn tất kiểm toán tĩnh và thiết kế; chưa triển khai ứng dụng.

## Phạm vi và bằng chứng
Đọc toàn bộ 60 tệp JS, HTML, JSON và workflow YAML trong 5 repository ở commit cố định (snapshots.json). Cây Git không bị cắt; không có AGENTS.md trong cây đã lấy. Không tải tệp Python/PowerShell phụ trợ, không thực thi patch hay hàm Apps Script, không mở ứng dụng live, không đọc/ghi Sheets thực tế. Bằng chứng gồm evidence.json và liên kết mã theo commit. Các ID file trong code chỉ xác nhận cấu hình mặc định; không xác nhận cấu hình runtime, quyền thực tế hay dữ liệu hiện tại.

| Repository | Cấu trúc và cách truy cập Sheets | Nguồn logic |
|---|---|---|
| QL_KHO_THANH_DUC | code.js tổng hợp nhiều module; Index.html; openById, có dùng active spreadsheet nếu đúng ID cấu hình | Kho 58: TONKHO, MASTER_META, NHAT_KY_XNT, TRANSACTION_LEDGER, TRANSACTION_LINES, DOCUMENT_SEQUENCE, TRANSACTION_RECONCILIATION; đọc cả Kho 145 |
| AI_KHO_THANH_DUC | code.js, AI_AGENT_V1/V13, alias và module kiểm kho/đảo giao dịch; openById mặc định Kho 145, một số API nhận sheetId từ payload | TONKHO, CHOTHUE, CAN_BO_SUNG, NHAT_KY_XNT, PHAT_SINH_TAM và alias |
| SALE_THANHDUC | code.js + Index.html; ss_() dùng getActiveSpreadsheet; tồn kho đọc openById Kho 58 | KHACH_HANG, SAN_PHAM, BAO_GIA, CHI_TIET_BAO_GIA, HOP_DONG, NHOM_HANG, CAU_HINH |
| CARE_THANHDUC | code.js cấu hình; Database.js repository; ServiceCore, KPI, quá hạn, nhiều bản dashboard | openById với Script Property SPREADSHEET_ID ưu tiên hơn mặc định; Sửa chữa, Bảo hành, Máy đã bán, BH máy mới, Khách hàng, Nhân viên, Nhật ký |
| FINANCE_THANHDUC | code.js lớn, CustomerData.js dữ liệu nhập đóng gói, Index.html | openById DATABASE_ID; GIAO_DICH, PHAN_BO_CONG_NO, CONG_NO_KH/NCC, KHACH_HANG, NHA_CUNG_CAP, NHAN_VIEN, CHOT_SO, LICH_SU |

## Phát hiện và mức ưu tiên
1. **P0 — API đọc có tác dụng ghi.** SALE code.js:1783 gọi ensureAppReady_():1545; hàm này gọi tạo nhóm hàng, bổ sung cột giá, định dạng điện thoại và migrateQuoteTotalsToNet_. Không dùng bootstrap để kiểm toán hoặc làm adapter read-only. Đọc trực tiếp và không gọi ensure/setup/migrate.
2. **P1 — Hai namespace sản phẩm Sale/Kho.** SALE bootstrap:1804–1881 trả riêng SALE:<MaSanPham> và KHO:<code>, concat hai danh sách; chưa có product_id chung. nextProductCode_:2056 tự cấp TD-xxxx trong SAN_PHAM, nên trùng hình thức mã với Kho không chứng minh cùng sản phẩm. Hàm resolveWarehouseProduct_:1611 có EXACT_NAME/TOKEN_NAME nhưng không thấy call site trong JS/HTML đã lấy; đây là khả năng ghép mờ có sẵn, chưa kết luận đang chạy.
3. **P1 — Kho 145 khác bố cục Kho 58.** QL cấu hình:10–60, readStock_:783 và readWarehouse145Stock_:982. Kho 58 B=mã, C=tên, D=đơn vị, E=tồn; Kho 145 B=tên, C=đơn vị, F=tồn, G=mã chuẩn, H=tên chuẩn. Không dùng một adapter cột cho cả hai. AI và QL cùng chạm nguồn Kho 145, cần quy định một đầu ghi và tránh hai script sửa cùng dòng.
4. **P1 — Khách hàng và nhân viên phân tán.** Sale KHACH_HANG, Care Khách hàng/Nhân viên, Finance KHACH_HANG/NHAN_VIEN. Care ticket lưu tên/điện thoại/kỹ thuật phụ trách; Finance có ID_KH, DOI_TUONG_ID, NHAN_VIEN_ID. Chưa xác minh trùng bản ghi thực tế; đây là trùng phạm vi danh mục và thiếu khóa xuyên hệ thống. Không tự hợp nhất theo tên hay điện thoại dùng chung.
5. **P1 — Chưa có khóa nghiệp vụ xuyên suốt được chứng minh.** Care Máy đã bán có orderNo='Mã đơn hàng', invoiceNo='Số hóa đơn'; Finance dùng HOA_DON_ID. Không coi các trường text đó là foreign key tới Sale khi chưa đối chiếu mẫu. Cần order_id/order_line_id/work_order_id và bảng external_keys.
6. **P1 — Giá và số tiền khác mục đích.** Kho giá nhập tham khảo I; Sale GiaBan/GiaVon/VAT/GiaDaGomVAT; Finance công nợ và thu chi. Không lấy giá tham khảo làm giá vốn quyết toán; không coi báo giá/hợp đồng/hoàn thành kỹ thuật là tiền đã thu.
7. **P1 — Triển khai tự động cần kiểm soát.** AI push master có auto deploy; CARE push main có sync/deploy; FINANCE main có push/deploy; SALE có deploy và patch workflow. Branch Sprint không khớp các trigger đó. PR thiết kế đặt trong SALE, chỉ docs/erp-sprint1, không đổi workflow/runtime. Không merge hoặc gọi workflow_dispatch. CARE đổi tài liệu trên main vẫn có thể deploy vì không lọc paths.
8. **P2 — Dữ liệu cũ đóng gói trong Finance.** CustomerData.js:7 khai báo sourceRows=1392, companyCustomers=398 và payload gzip. Đây là số trong bộ nhập, không phải số khách live. Không sao chép payload vào ERP hoặc báo cáo công khai; dùng dữ liệu hiện tại đã được duyệt.
9. **P2 — Cấu hình webapp cho phép ANYONE_ANONYMOUS và USER_DEPLOYING trong cả 5 manifest.** Chỉ là cấu hình nguồn, không chứng minh endpoint hiện hành thiếu bảo vệ. Phải rà authorization server từng lệnh ở staging trước khi tích hợp; không sửa quyền trong Sprint này.
10. **P3 — FINANCE formatMoneyText_ khai báo hai lần (1971 và 7679), nội dung tương đương.** Không phải lỗi cú pháp; gom lại khi bảo trì có regression test, không đổi tài chính trong Sprint thiết kế.

## Đối chiếu sản phẩm
| Thuộc tính | Kho 58 | Kho 145 | Sale | Chuẩn ERP |
|---|---|---|---|---|
| Khóa | TONKHO B | TONKHO G ánh xạ chuẩn, có thể thiếu | SAN_PHAM.MaSanPham, hoặc KHO:code | product_id UUID bất biến; sku nghiệp vụ duy nhất |
| Tên | C | B/tên chuẩn H | TenSanPham | name + alias; không dùng tên làm FK |
| Đơn vị | D | C | DonViTinh | unit_id, quy đổi được duyệt |
| Tồn | E | F | đọc Kho 58, cache 120s | stock projection theo warehouse_id, as_of, source_health |
| Giá | I tham khảo | I tham khảo | GiaBan/GiaVon | price_list + cost_reference; giá chốt lưu snapshot trên dòng đơn |
| Biến thể | mã hàng độc lập theo quy tắc kho | ánh xạ về mã chuẩn | tên, DaQuaSuDung và metadata | brand/model/variant/condition/chip/color; mỗi SKU riêng |

Không gộp WB/ES/Topzon/chính hãng, có chip/không chip, mới/cũ hay màu khác nhau. Dịch vụ được tạo product.kind=service và không bắt buộc có tồn. Bảng product_external_keys ánh xạ (source_system, source_entity, source_key) → product_id; nếu thiếu mã Kho 145, lưu candidate fingerprint để duyệt, không dùng số dòng làm ID dài hạn.

## Kiểm chứng
24/24 tệp JS qua node --check. Có inventory đếm call đọc/ghi và duplicate global declarations; số đếm chỉ là tín hiệu tĩnh, không phải số thao tác đã chạy. Đã đối chiếu cột Kho 58 với parser Sale và cột Kho 145 với QL. Chưa kiểm thử UI, Apps Script runtime, dữ liệu live, tốc độ hay đồng bộ xuyên hệ thống.
