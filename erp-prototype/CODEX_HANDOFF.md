# Thành Đức ERP — bàn giao tiếp tục trên Codex
Cập nhật 12/10/2026. Đây là chỉ dẫn bàn giao, không phải phê duyệt deploy hoặc chính sách tài chính mới.

## Repository và nhánh
- Repository: tinhocthanhduc-dotcom/SALE_THANHDUC
- Branch: erp/sprint1-architecture-20261012
- Draft PR: https://github.com/tinhocthanhduc-dotcom/SALE_THANHDUC/pull/1
- Không bắt đầu từ main rồi viết lại prototype; fetch và checkout nhánh trên. Đọc AGENTS.md nếu có ở checkout hiện tại.

## Đọc trước
1. erp-prototype/STATUS.md — tiến độ hiện hành.
2. erp-prototype/README.md và UI_GUIDE.md.
3. erp-prototype/SHEETS_STAGING.md — giới hạn storage.
4. docs/erp-sprint1/03_CONG_VIEC_NGHIEM_THU.md — quyết định đã duyệt.
5. Các test và domain order-work.cjs, read-adapter.cjs, sheets-repository.cjs.

## Đã có
Kiểm toán 5 repo; metadata 5 workbook và 16 headers. Prototype offline có UI, 4 đơn mẫu, nhận đơn đa dòng, giao kỹ thuật, test/bàn giao, đề nghị doanh thu/Finance duyệt, hủy/hoàn fixture, nhật ký, tiến độ, search, export/reset.
Domain dùng chung cho UI và output GAS. Cấp số ngày Việt Nam, idempotency/version/role guards. File local có journal/recovery; SheetsRepository đã test giả lập có chunks/checksum/manifest/recovery và guard staging.
Kiểm thử mới nhất: 67 core + 20 browser scenarios PASS local. Browser CI đã có; kiểm tra run của HEAD trước khi báo trạng thái. Sửa UX gần nhất: Bước tiếp theo, nút chuyển vai trò và giữ đơn đang mở, sticky toolbar.

## Chưa có
Project/file staging thực tế; Apps Script UAT; auth/session server; masters persistence; API command/query; UI–Sheets staging integration; normalized tables, benchmark/quota; full payment workflows, hoàn tiền thực tế, POS settlement, technician stock nhiều kho và contract workflows. Kho thợ theo dòng đơn và đối soát thu/nộp quỹ đã có fixture/UI; xem BUSINESS_FRAMEWORK.md.
HTML offline dùng localStorage. Chọn vai trò chỉ mô phỏng, không có bảo mật server. Không nhập dữ liệu thật. Snapshot tổng state trong Sheets chỉ cho thử nghiệm kỹ thuật nhỏ.

## Quyết định đã duyệt
- Kho 58 làm master hàng vật lý; Sale quản lý dịch vụ; mapping rõ, không ghép theo tên.
- ERP giữ danh mục khách hàng/nhân viên chung, liên kết mã nguồn; không tự gộp record mơ hồ.
- Hoàn tất tạo đề nghị doanh thu do Finance xác nhận; tiền thu tách riêng.
- Số đơn TD-YYYYMMDD-0001 tăng theo ngày Việt Nam, giữ chứng từ cũ, số đã cấp không tái sử dụng.
- Trước xuất có thể hủy; sau xuất phải qua phiếu hoàn/đảo được người có quyền duyệt và giữ lịch sử.

## Quy trình mới vừa được đọc và đánh giá — chưa chốt các đề xuất bổ sung
Người dùng gửi “Quy trình làm việc chuẩn – Thành Đức (1).docx”. Tệp chưa được đưa vào repository; yêu cầu người dùng đính kèm nếu cần nguyên văn. Không suy đoán đã có tệp trong môi trường Codex mới.
Bản mới có 8 luồng: dịch vụ tại khách, bán hàng/lắp đặt, mực định kỳ, Care/bảo hành, kho/kho thợ, thanh toán/nộp quỹ, công nợ/hóa đơn, CSKH/khiếu nại. Đây là tài liệu đang review, không phải toàn bộ chính sách đã duyệt.
Sáu điểm review còn cần thống nhất:
1. Nộp tiền cuối ngày mâu thuẫn với giữ tối đa 3 ngày/5 triệu (đều mức đề xuất). Tách đối soát hằng ngày và hạn nộp được duyệt.
2. Tiền giữ chỉ trừ khoản hoàn đã thực hiện từ đúng quỹ và được xác nhận; không trừ ngay khi mới duyệt hoàn.
3. Tách điều khoản thanh toán, mức thanh toán và trạng thái xác nhận giao dịch. Còn phải thu tính từ khoản đã xác nhận/phân bổ. POS settlement/phí tách khỏi nghĩa vụ khách.
4. Hợp đồng là hồ sơ cha; đơn/lần thực hiện liên kết hợp đồng. Ghi doanh thu một lần ở cấp giao dịch, không cộng cả hợp đồng và đơn.
5. Phiếu nhập liên kết mua hàng; tính phải trả trừ tiền đã trả/phân bổ, không mặc định mọi phiếu nhập tạo thêm nợ.
6. Giữ bước đề nghị và Finance xác nhận doanh thu; tính tình trạng hàng theo từng dòng/số lượng.
Không tự chốt 3 ngày/5 triệu, discount 5%, hạn mức mua/chi, người kiêm nhiệm hoặc vai trò giám đốc duyệt hoàn. Role manager/admin trong fixture không thay quyền nhân viên thật.

## Mốc tiếp theo
Đã có fixture/UI cho kho thợ và thu tiền–nộp quỹ; tiếp tục lịch hẹn/dịch vụ tại khách, từ chối/sửa phiếu, hoàn tiền và nhiều kho; đồng thời hoàn thiện staging server/API/auth và nối UI. Có thể viết contract/migration/fixture/tests an toàn trước khi có môi trường thật. Những thay đổi số tiền, xác nhận thu/hoàn hoặc quyền vận hành phải giữ là fixture/config đề xuất khi chưa được chốt.
Cần xác minh workbook bound của Sale và Care Script Properties override trước shadow-read. Không cho rằng kết nối Google Drive/GitHub của phiên ChatGPT tự có trong Codex mới.

## Kiểm thử/build
- node --test erp-prototype/test/*.test.cjs
- npm ci --prefix erp-prototype --ignore-scripts
- erp-prototype/node_modules/.bin/playwright install chromium
- node erp-prototype/test/ui-browser.cjs
- python3 erp-prototype/build-preview.py /tmp/THANH_DUC_ERP_DEMO.html
- python3 erp-prototype/build-staging.py /tmp/thanhduc-erp-staging
Không build GAS vào project legacy. Không copy .gs vào 5 ứng dụng hiện hành.

## Quy tắc bắt buộc
Không ghi/xóa dữ liệu Sheets thực tế, không thay quyền, dữ liệu tài chính hoặc chứng từ thực tế. Không tự merge PR/deploy production. Không gọi workflow_dispatch triển khai.
Mọi code trên branch riêng; tiếp tục PR #1 nếu môi trường hỗ trợ, hoặc branch con/PR liên kết và ghi rõ base. Không ghi đè thay đổi người khác; kiểm HEAD trước push.
Tự làm liên tục tới mốc bàn giao, không chờ người dùng nhắn “tiếp”. Chỉ hỏi khi thiếu quyền/dữ liệu thiết yếu hoặc quyết định vận hành. Cập nhật tiến độ ngắn khi đang làm; giữ STATUS.md thống nhất. Kết thúc bằng đã làm/chưa làm/test/rủi ro/cần duyệt; không gọi mock tests là nghiệm thu Google runtime.
