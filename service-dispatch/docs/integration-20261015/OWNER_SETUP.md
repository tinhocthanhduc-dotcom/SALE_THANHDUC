# Hoàn tất cài consumer trên các bản sao — 15/10/2026

Hai project mới đã tạo/push mã qua GitHub Actions, chưa deploy web app, chưa đặt token/HMAC hoặc cài trigger. Kho/Finance/AI_KHO thật giữ nguyên. Metadata chỉ gồm ID; không chứa source Finance private hay secrets.

- Kho 58/145: https://script.google.com/d/1gU8n4jcCf52xqZyVzpP13Ba-M5B5Dko0c3qH12VWMOZnxz5xsIROseXn/edit
- Finance: https://script.google.com/d/1FuBiv-e2UbP-FjLaNoh56XX8BEllZWIX7lbiee_dejmqAVFgzF8uAuqf/edit
- Điều phối đang dùng: https://script.google.com/d/1k2pMSKKG1DF_r7p479O_VSZP3hOciVjCluZgoqM1pN7TOU0ArHeEgGZH/edit

## Làm cho từng project Kho và Finance

1. Mở editor → chọn hàm **setupCopyConsumer** → Run; cấp quyền Google nếu được hỏi. Hàm điền sẵn bốn ID copy vào Script Properties và giữ consumer tắt. Không sửa dữ liệu trong các sheet.
2. Ở project Điều phối → Project Settings → Script Properties: sao chép trực tiếp hai giá trị **DISPATCH_COPY_TOKEN** và **DISPATCH_BRIDGE_HMAC** sang Script Properties của project consumer đang cài. Dùng cùng tên, giữ nguyên giá trị. Không gửi giá trị qua chat, không tạo token/HMAC mới, không chép vào Code.gs hoặc GitHub. Không cần nhập lại các ID.
3. Run **setupCopyConsumer** lần nữa. Nhật ký cần `missing_properties: []`, `copy_markers_verified: true`, `consumer_enabled: false`. Nhật ký không in giá trị hai khóa.
4. Run **enableCopyConsumer**. Hàm kiểm Google principal/role native và các marker trước khi bật; cài trigger mỗi 5 phút, chạy lại không tạo trigger trùng. Nếu FORBIDDEN, giữ consumer tắt và bổ sung quyền trên **bản sao**: Kho USER_ROLES phải có EMAIL đúng tài khoản đang Run, enabled, role cho INVENTORY_OUT/IN; Finance NHAN_VIEN phải có email đang Run, hoạt động, ADMIN/KE_TOAN. Không dùng fallback OPERATOR hoặc tự đổi bảng trên file thật. Có thể cấp role khác nhau; mỗi chứng từ Kho vẫn kiểm quyền riêng IN/OUT.
5. Run **receiveFromDispatch** để kiểm thủ công. Khi chưa có chứng từ thử nghiệm, `processed: 0` là bình thường, không phải bằng chứng ghi sổ đã đạt. Không cần deploy web app để dùng Run và trigger.

## Điều phối và UAT

- Giữ Đồng bộ tắt đến khi cả hai consumer kiểm xong marker/quyền. Giám đốc chọn các ID Finance hiện hữu; không tạo tài khoản mới. Trong **Thanh toán / cấu hình**, sửa từng hình thức ACB/TCB: chọn tài khoản Finance, điền số và chủ tài khoản để khách nhìn thấy, Lưu một lần cho cả tài khoản nhận và gán Finance. Không gán chuyển khoản ở màn thứ hai. Trong **Gán Finance** chọn cash → Tiền nhân viên đang giữ, quỹ → Quỹ tiền mặt, hàng → Thu bán hàng, công → Thu dịch vụ, thợ thử → mã NV Finance; khách công nợ gán một lần khi cần. Cấu hình cũ chỉ có mapping chưa đủ: phải bổ sung thông tin ngân hàng tại màn chung.
- Trong Điều phối Script Properties, đặt **DISPATCH_BRIDGE_ACTOR_ID = admin** nếu tài khoản admin hiện có vẫn hoạt động và có director. `installDispatchOutboxPump` kiểm lại directory; không tạo tài khoản hoặc vai trò giả. Run hàm này để gửi/nhận kết quả mỗi 5 phút. Nếu admin đã thay/ngừng dùng, chọn ID director đang hoạt động đúng directory, không đoán tên.
- Bật Đồng bộ chỉ cho các bản sao; tạo đơn thử mới để kiểm actual pickup → OUT, trả kho → IN, PT cash/ACB/TCB, NQ thực nhận/thiếu, công nợ và replay. Không backfill đơn cũ hoặc dùng tiền khách thật.
- Bấm Nhận từ Điều phối ở từng consumer (Run receiveFromDispatch), rồi Điều phối → Đồng bộ → Nhận kết quả. Đối chiếu sổ native/số phiếu/số dư trong các bản sao; kiểm lỗi thiếu mapping/tồn âm/ngày chốt/quyền và đóng hồ sơ. Không coi việc tạo project/push code hay kết quả 0 jobs là UAT thành công.
- Trước bất kỳ cutover/deploy app thật hoặc thay AI_KHO phải có anh Tuấn duyệt riêng. Source Finance private chỉ được xử lý trong runner và project Google private, không đăng lên SALE public/artifact public.

## Bằng chứng cài project

Run đầu thành công: https://github.com/tinhocthanhduc-dotcom/SALE_THANHDUC/actions/runs/38615310093

Mã Native Kho/Finance được đọc qua Apps Script API và kiểm bằng workbook giả lập trước khi tạo project; không đọc/ghi các sheet thật trong workflow. Các gói pin đúng 4 ID; bootstrap thiếu khóa/marker/sai role bị chặn, không log secrets, trigger idempotent. Registry lưu ngay sau tạo từng project và trước push để tiếp tục khi lỗi không tạo project trùng. Rerun chỉ push lại đúng hai ID đã tạo.

**Chưa xác minh:** Google marker/quyền runtime sau khi chuyển khóa; ghi sổ trên copy Sheets; trigger thực chạy, thời gian/quota và toàn bộ UAT. Các bước này cần owner Run trong editor vì Execution API chưa khả dụng.
