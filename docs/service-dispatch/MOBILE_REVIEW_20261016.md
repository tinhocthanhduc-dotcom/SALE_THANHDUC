# Kiểm tra giao diện thợ — 16/10/2026

Phạm vi: service-dispatch, nhánh `erp/sprint1-architecture-20261012`. Chỉ sửa màn thợ và guard nghiệm thu/ảnh liên quan. Chưa deploy; tên thư mục `mobile-v65` là bộ ảnh của bản sửa dự kiến tiếp sau staging v64.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| Node Điều phối + Danh bạ + ERP | 331/331 |
| Bộ trình duyệt Điều phối, gồm UAT | 25/25 |
| Trình duyệt Danh bạ | 11/11 kịch bản |
| ERP UI | 21/21 |
| GAS build, JavaScript syntax, git diff --check | Đạt |
| Chrome Android / Safari iPhone thật / camera thật | Chưa thử |
| Giao dịch trên Apps Script / Kho / Finance thật | Không chạy |

Bài kiểm tra mới `mobile-revision-browser.cjs` chạy viewport 390×844, kiểm tra ba thẻ nằm trọn phía trên nút đáy; chọn nhiều ảnh qua input camera ẩn tự tải và hiện ảnh nhỏ; ảnh máy nhận về và biên lai dùng cùng hàng đợi; không query toàn bộ sau upload; xóa ảnh có audit và giữ form; chọn Có thu tiền / Miễn phí, lý do Khác bắt buộc ghi chú; giữ giá khi chuyển qua lại; nghiệm thu có tiền mở form chọn thanh toán, không tự thu.

Bộ `technician-complete-browser.cjs` còn kiểm tra lỗi mạng sau khi server đã lưu: retry dùng lại khóa, chỉ lưu một lần, không mất ghi chú, không bỏ qua duyệt giá và xác nhận khách. Bộ `photo-browser.cjs` kiểm tra 3 ảnh 4000×3000 nén dưới 200KB, thumbnail riêng tư, retry và không refresh toàn bộ. Bài `live-browser.cjs` chạy hai trình duyệt với chu kỳ 20 giây thật, kiểm tra cập nhật hai chiều và bảo toàn form.

Lệnh chạy Node: `node --test service-dispatch/test/*.test.cjs erp-prototype/test/*.test.cjs customer-directory/test/*.test.cjs`.

Browser dùng `ERP_TEST_CHROMIUM=/usr/bin/chromium node service-dispatch/test/<tên-bộ>-browser.cjs`; CI liệt kê từng bộ trong `.github/workflows/erp-prototype-tests.yml`.

## Ảnh chụp 390×844

Toàn bộ là dữ liệu giả, không có danh sách khách thật.

- [Việc của tôi](screenshots/mobile-v65/work-list-390.png)
- [Chi tiết đơn](screenshots/mobile-v65/order-detail-390.png)
- [Nghiệm thu: chọn cách tính tiền và nhập dòng công](screenshots/mobile-v65/acceptance-390.png)

## Lưu ý khi review

- Thanh tiến độ là tiến độ không xác định trong lúc nén/gửi qua `google.script.run`, không dựng phần trăm giả.
- Nút Xóa là xóa khỏi bằng chứng đang sử dụng, giữ metadata audit và file riêng tư. Ảnh nghiệm thu đã chốt không được xóa.
- Miễn phí toàn đơn không tự xóa tiền hàng đã giao có giá; cần chọn Có thu tiền nếu còn hàng giao phải tính tiền. Không sửa giá hàng báo khách bằng thao tác nghiệm thu.
- Các ô nhập giữ 16px, nút từ 44px; CTA chính vẫn 62px. Cỡ chữ phụ 13px được áp dụng riêng màn thợ ≤480px theo yêu cầu mới.
