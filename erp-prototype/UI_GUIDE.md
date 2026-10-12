# Bản thử nghiệm có giao diện — cách dùng

## Mở bản demo
Bản HTML tự chứa code và dữ liệu giả, không gọi mạng. Mở THANH_DUC_ERP_DEMO.html bằng Chrome/Edge trên máy tính. Nếu xem trong preview không cho chạy JavaScript hoặc localStorage, tải file rồi mở bằng trình duyệt. Chưa phải URL ứng dụng đã deploy.

Build từ source: `python3 erp-prototype/build-preview.py /tmp/THANH_DUC_ERP_DEMO.html`.
Source UI lưu .html.txt/.js.txt để không tham gia runtime Apps Script legacy. Build nhúng đúng domain order-work.cjs hiện hành, không viết lại logic nghiệp vụ riêng trong UI.

## Một vòng thử nghiệm
1. Vai trò Kinh doanh: Nhận đơn mới, chọn khách/sản phẩm mẫu, số lượng/giá chốt, lưu và xác nhận đơn.
2. Chuyển Quản lý 1, mở cùng số đơn, Giao kỹ thuật.
3. Chuyển Kỹ thuật được giao: Bắt đầu → ghi kết quả kiểm tra/in thử → ghi bằng chứng bàn giao.
4. Kinh doanh mở lại đơn, Đề nghị ghi doanh thu.
5. Tài chính mở đơn, Duyệt doanh thu mẫu. Thanh toán vẫn là Chưa thu tiền.
6. Xem Nhật ký thao tác, Doanh thu và Tiến độ dự án.

Hủy: trước xuất có Hủy trước xuất, bắt buộc lý do. Sau khi Kho ghi nhận phiếu xuất mẫu, dùng Đề nghị hoàn/đảo. Người đề nghị không tự duyệt; đổi sang quản lý khác để thử. Duyệt chỉ là trạng thái hồ sơ, không hoàn hàng/đảo tiền thực tế.

## Lưu trữ và vai trò
- UI lưu dữ liệu fixture bằng localStorage riêng của trình duyệt/file origin; không dùng Sheets hoặc LocalRepository. Không có dữ liệu khách hàng thật.
- Có Web Locks khi trình duyệt hỗ trợ; luôn kiểm revision/version để từ chối form cũ. Tab khác cập nhật dữ liệu thì màn hình đồng bộ qua storage event.
- Nếu localStorage không hoạt động từ đầu, hiển thị chế độ bộ nhớ tạm. Lỗi lưu giữa chừng giữ nguyên state và báo thao tác chưa áp dụng. JSON corrupt bị khóa ghi, không tự ghi đè.
- Vai trò là mô phỏng, không phải authentication/RBAC server. Dữ liệu đã nằm phía client, không có bảo mật tài chính thật dù màn hình kỹ thuật ẩn tiền và thao tác Finance. Không đưa dữ liệu thật vào bản HTML này.
- Chọn Tiến độ dự án để xuất JSON mẫu hoặc khôi phục dữ liệu ban đầu, có xác nhận trước khi thay thế fixture.

## Kiểm thử
58/58 core test local và 16/16 browser scenario. UI được kiểm trên Chromium desktop 1440px và mobile 390px. Kịch bản gồm luồng đầy đủ, multi-line totals, persistent reload, cancel/reversal, self-approval, XSS escape, search, storage failure/corruption, stale command hai tab và không gọi mạng.
`npm ci --prefix erp-prototype --ignore-scripts`; `erp-prototype/node_modules/.bin/playwright install chromium`; `node erp-prototype/test/ui-browser.cjs`.

## Phạm vi còn thiếu trước pilot
Đăng nhập/session server, nguồn masters/runtime đã xác nhận, project/file staging thật, kết nối UI tới staging repository, normalized tables và benchmark, VAT/ngày, hoàn một phần và thu tiền. Chưa có endpoint production hoặc deploy. Mẫu số đơn và luồng duyệt đã áp dụng fixture, chưa cấp quyền cho nhân viên thật.

## Kho thợ và thu/nộp quỹ
Xem BUSINESS_FRAMEWORK.md, mục Dùng thử HTML. Hai mục Kho thợ và Thu tiền & nộp quỹ mở các đơn liên quan; tại chi tiết có form theo vai trò. Khi Finance xác nhận thu thì thanh toán chuyển một phần/đủ; khi quỹ xác nhận nhận tiền mới giảm tiền đang giữ. Duyệt doanh thu/hoàn không tự tạo hoặc đảo giao dịch tiền.

## Kỹ thuật lấy hàng mang theo
Sau quản lý giao việc, mở đơn ở vai trò Kho và chọn Kho chuẩn bị & cấp hàng. Đổi sang đúng kỹ thuật được giao, mở đơn và chọn Nhận hàng mang theo; chọn phiếu, nhập xác nhận kiểm đếm. Chờ nhận và đã nhận đang giữ hiển thị riêng. Đơn mới có hàng vật lý chưa nhận đủ sẽ bị chặn Bắt đầu tới khách / xử lý. Với dữ liệu demo cũ, tạo đơn mới hoặc khôi phục bộ mẫu để thử đầy đủ bước này.
