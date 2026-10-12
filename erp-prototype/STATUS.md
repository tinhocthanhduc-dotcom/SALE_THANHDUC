# Tiến độ 12/10/2026 — sau khi duyệt nguyên tắc

## Đã thực hiện
- Đọc metadata 5 workbook và 16 hàng tiêu đề; không đọc business rows, mật khẩu hoặc dữ liệu phiên đăng nhập, không ghi Sheets.
- Xác nhận schema Kho 58, Kho 145, Sale, Care, Finance cho adapter prototype; lưu schema-evidence.json.
- Xây read adapter 10 bảng, mapping theo khóa đã duyệt, domain đơn/công việc, build GAS riêng và CI chỉ kiểm thử.
- 30/30 kiểm thử local PASS, gồm demo GAS trong Node VM. Code.gs qua node --check sau khi đổi extension bản kiểm tra.

## Phát hiện mới
- SALE spreadsheet timezone America/Los_Angeles; APP.TZ trong code là Asia/Ho_Chi_Minh. Cần chuẩn hóa ngày; chưa sửa cài đặt workbook.
- FINANCE metadata không có NHA_CUNG_CAP. Chưa đọc code path nhà cung cấp hay dữ liệu để kết luận lỗi; để kiểm tra tiếp ở staging.
- CARE/FINANCE nhân viên có headers xác thực; adapter chỉ lấy ID, tên, role, trạng thái. Header đọc phục vụ schema, không có business cells nhạy cảm được tải.
- File Sale đọc được là THANH_DUC_SALES_APP_DATABASE; chưa chứng minh đây là workbook của webapp hiện hành. Care Script Property override cũng chưa xác minh.

## Chưa hoàn tất
Không có UI hoặc lưu trữ bền vững; chưa triển khai GAS/Sheets staging. Chưa có auth session thật, journal recovery, VAT/date normalization, fulfillment từng dòng, nhiều task/đơn, hủy/đổi trả, shadow-read và test Apps Script runtime. Test local không nghiệm thu production.

## Bước kế tiếp
Xây repository staging và auth server, chốt schema lưu trữ, kiểm thử recovery trên fixture; xác nhận workbook bound của Sale và Care runtime override trước khi nối nguồn. Tạo staging độc lập chỉ khi có cấu hình project đúng môi trường, không dùng các project legacy.

## Phê duyệt còn lại
PR code/design để review; không tự merge. Quy tắc cấp số đơn, người duyệt mapping và đổi trả chưa được chốt. Không cần yêu cầu lại ba nguyên tắc master/khách–nhân viên/doanh thu đã duyệt.

## Cập nhật sau khi duyệt mẫu số đơn và nguyên tắc hủy — 12/10/2026
- 43/43 test local PASS. Số đơn theo ngày Việt Nam, sequence giữ sau reopen/hủy. 12 process riêng cấp số không trùng; 5 process replay cùng key chỉ tạo một đơn.
- Lưu trữ fixture local với journal chuẩn bị/commit, atomic file rename + fsync, lock single writer. Inject lỗi ở 3 checkpoint phục hồi/replay không nhân đôi; lỗi hash hoặc mất committed state bị chặn.
- Hard process exit được kiểm thử: khóa giữ lại, operator xác nhận PID đã dừng trước khi giải phóng khóa ở fixture; không auto-break lock.
- Thêm marker dispatch, cancel trước xuất, request/approve reversal sau xuất. Vai trò manager/admin trong fixture là đề xuất kiểm thử; vai trò/người duyệt vận hành chưa được cấp hoặc thay đổi. Người đề nghị không tự duyệt. Trạng thái reversal_approved chỉ biểu thị duyệt hồ sơ, không xác nhận kho/Finance đã đảo.
- Lớp file local không nằm trong build GAS; chưa có Sheets staging repository. UI/session thật, nguồn runtime, phân bổ tiền/hoàn một phần và kiểm thử Apps Script vẫn còn. Không deploy hoặc ghi dữ liệu thực tế.
