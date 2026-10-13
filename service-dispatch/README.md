# Thành Đức – Điều phối dịch vụ: mốc đầu tiên

Ngày 13/10/2026. Mã thử nghiệm riêng theo SPEC_V1_1.md. Không triển khai hoặc ghi vào 5 app legacy.

## Đã chạy được với dữ liệu mẫu

- Đăng nhập tài khoản/mật khẩu thật ở máy chủ, PBKDF2-SHA256 600.000 vòng, salt riêng. Không có nút chọn vai trò client. Local dùng cookie HttpOnly; GAS bridge dùng token trong sessionStorage và máy chủ kiểm mọi lời gọi.
- Phiên 8 giờ, 5 lần sai khóa 15 phút là cấu hình thử nghiệm, chưa phải chính sách vận hành. Logout, hết phiên, ngừng tài khoản hoặc đổi version tài khoản làm mất quyền phiên. Token chỉ lưu hash phía máy chủ.
- Tạo khách và hồ sơ máy, nhận đơn với số TD theo ngày Việt Nam. Giữ quy tắc ERP đã chốt; DV riêng app vẫn là lựa chọn cần chốt, chưa tự đổi mã.
- Giao → thợ nhận → hẹn → bắt đầu → tải ảnh sau và biên bản → nghiệm thu. Ảnh được máy chủ lưu riêng và kiểm quyền khi tải. Chỉ dùng ảnh/dữ liệu giả trong runner.
- Thợ đề nghị chuyển; điều phối duyệt với kế hoạch bàn giao; thợ mới phải nhận/hẹn lại. Người cũ không truy vấn/sửa đơn sau chuyển. Trách nhiệm vật tư/tiền không được chuyển tự động.
- Không làm được có lý do, đề xuất/chờ linh kiện trên cùng đơn, lịch/lần đến và sự kiện được giữ. Phần xác nhận kho chưa có nên không cho tự tiếp tục giả vờ đã nhận linh kiện.
- Optimistic version, idempotency, file journal/recovery local; GAS tái sử dụng repository Sheets staging với domain riêng. App và snapshot ERP không được dùng chung một workbook staging.

## Chạy trên máy phát triển

Từ repository:

```bash
npm ci --prefix service-dispatch
node --test service-dispatch/test/*.test.cjs
node service-dispatch/server.cjs
```

Runner chỉ nghe loopback, không phải web app production. Mở trình duyệt máy phát triển ở cổng 8787. Đổi DISPATCH_PORT hoặc DISPATCH_FIXTURE_DIR nếu cần; thư mục dữ liệu phải là đường dẫn tuyệt đối ngoài checkout. Dữ liệu mặc định lưu thư mục thanhduc-dispatch-fixture trong thư mục tạm của hệ điều hành, không bảo đảm tồn tại sau khi máy bị thay.

Tài khoản MẪU local: dispatch, tech1, tech2, director. Tất cả dùng mật khẩu mẫu `DemoThanhDuc2026!`. Đây là fixture công khai để dùng thử, không tài khoản vận hành; tuyệt đối không cấp các tài khoản/mật khẩu này trên GAS thật. Mỗi tài khoản vẫn được băm với salt riêng. Nếu quên tài khoản mẫu, dừng runner và chọn thư mục fixture mới; không reset production.

## Build gói Apps Script

```bash
node service-dispatch/build-gas.cjs /tmp/thanhduc-dispatch-gas
```

Build tạo Code.gs, Index.html, appsscript.json và README ở thư mục độc lập. Không copy vào 5 app legacy, không chạy clasp push/deploy ở checkout Sale. Gói không chứa tài khoản, mật khẩu, marker hoặc spreadsheet ID thực tế. Workflow CI cung cấp ZIP SERVICE_DISPATCH_STAGING để tải.

## Khởi tạo staging riêng – chưa thực hiện trên Google

1. Tạo Apps Script, Sheets và thư mục ảnh Drive MỚI chỉ dành cho thử nghiệm; không dùng project/file legacy hoặc workbook của ERP prototype. Chỉ quản trị staging có quyền sửa file/code. Kiểm tra thư mục Drive không chia sẻ công khai.
2. Spreadsheet cần 3 tab preallocated: ERP_META A1:B2 là `environment | token` và `STAGING | marker ngẫu nhiên`; ERP_STATE, ERP_JOURNAL có header `attempt_id | kind | chunk_index | chunk_count | checksum | payload`. Chừa số hàng phù hợp; adapter không tự thêm tab, không mở rộng khi đầy.
3. Script Properties: DISPATCH_ENV=STAGING; DISPATCH_ENABLE_WRITES=true; DISPATCH_SCRIPT_ID bằng chính project mới; DISPATCH_SHEET_ID bằng file mới; DISPATCH_MARKER_TOKEN khớp marker; DISPATCH_IMAGE_FOLDER_ID bằng thư mục mới. Đây không phải hướng dẫn thay setting production.
4. Cấp tài khoản qua helper editor-only dispatchProvisionUser_: nhập DISPATCH_PROVISION_USER là JSON metadata `{ "id": "employee-id", "username": "login-name", "name": "Tên nhân viên", "roles": ["dispatcher"] }`; nhập mật khẩu thử nghiệm riêng ở DISPATCH_PROVISION_PASSWORD trong Script Properties. Không nhập mật khẩu vào code, GitHub, chat, URL hoặc logs. Helper xóa hai property tạm kể cả khi lỗi. Mật khẩu tối thiểu 12 ký tự. Không dùng mật khẩu thật của app Finance/Care. Cho phép nhiều vai trò; bản đầu hỗ trợ dispatcher/technician/director; warehouse/finance chưa có màn hình nghiệp vụ.
5. Chạy helper từ editor với quyền quản trị; không có API công khai tạo tài khoản. Tài khoản lưu theo DISPATCH_USER_<id> chứa hash/salt, không plaintext. Đổi active=false hoặc tăng version để thu hồi phiên; chưa có giao diện quản trị/đổi mật khẩu/khôi phục tài khoản. Không tự sửa hash bằng tay nếu chưa có kế hoạch đổi mật khẩu.
6. Deploy phiên thử nghiệm chỉ trong project mới, execute as owner và yêu cầu đăng nhập Google (`ANYONE`, không anonymous); sau đó vẫn đăng nhập nhân viên. Giữ quyền sửa script/file của quản trị. Link đơn là ID, không chứa token. Phải kiểm Google runtime, thời gian PBKDF2 và hành vi HtmlService trước khi mở pilot.
7. Thử auth, quyền đơn/ảnh, đồng thời, recovery/visibility/quota, upload mất sóng và backup restore bằng fixture. Chưa có kết quả Apps Script UAT hoặc triển khai thật. Node VM build test không chứng minh Google runtime.

## Giới hạn mốc này

Chưa có giá dịch vụ/phí 0–200k, dòng công/vật tư thực dùng, chữ ký vẽ trực tiếp, tiếp tục sau kho xác nhận, trả vật tư, thu/nộp tiền, hóa đơn, đóng hồ sơ tài chính, bảng giá, cấu hình SLA/nhắc việc, tìm/gộp/import khách, giao diện quản trị tài khoản, backup định kỳ và pilot. Nghiệm thu mốc này chỉ ghi kết quả công việc và ảnh, giữ hồ sơ Chờ đối soát; không kết luận đã quyết toán hoặc thu đủ.

Hồ sơ snapshot và property auth chỉ phù hợp thử nghiệm nhỏ; cần normalized tables, dung lượng phiên và benchmarks trước vận hành. Upload thất bại sau file được tạo có thể còn file mồ côi khi process hard-crash; cần reconciliation theo file metadata trước pilot. Cả local và GAS dùng cùng PBKDF2, để kiểm tính tương thích hash; hiệu năng GAS chưa đo. Chỉ chống ghi lặp khi client giữ cùng command key; không suy đoán hai key khác nhau là cùng giao dịch.

Không gọi môi trường ready hoặc app vận hành thật khi chưa có staging IDs, tài khoản thử nghiệm, quyền Google và kiểm thử thực tế. Mốc tiếp theo: chỉnh giá/phí và dòng công theo đặc tả, quản trị tài khoản, luồng vật tư, rồi đối soát tiền.

## Khởi tạo nhanh ở project mới được workflow tạo

Workflow create-service-staging dùng CLASPRC_JSON đã có để tạo một project riêng và triển khai web app. ID/link được lưu trong artifact SERVICE_DISPATCH_PROJECT_20261013_01 và SERVICE_DISPATCH_DEPLOYMENT_20261013_01; không chứa credential. Registry phải được giữ để lần chạy lại tái sử dụng project/deployment; nếu registry hết hạn cần khôi phục ID, không tự tạo trùng.

Ở project MỚI này: mở Project Settings → Script Properties, thêm DISPATCH_INITIAL_PASSWORD là mật khẩu riêng tối thiểu 12 ký tự. Chọn hàm dispatchSetupStaging_ ở editor rồi Run và cấp quyền Google theo lời nhắc. Hàm tạo Sheets staging, marker/tabs, thư mục ảnh private và tài khoản admin (director + dispatcher), tự lưu cấu hình. Mật khẩu tạm được xóa sau chạy, chỉ giữ hash/salt. Không gửi mật khẩu vào chat. Hàm chặn 5 project/file legacy và không khởi tạo lên workbook chưa được helper tạo. Chạy lại sẽ giữ tài khoản và các tài nguyên đã tạo; không xóa dữ liệu. Nếu Google tạo file thành công nhưng chưa lưu được ID do lỗi, kiểm tra tài nguyên đã tạo trước retry để tránh file mồ côi.

Mở web app bằng tài khoản Google có quyền truy cập deployment, rồi đăng nhập admin bằng mật khẩu vừa chọn. Đây vẫn là staging; chưa nghiệm thu Google runtime hoặc dùng dữ liệu thật. Cấp thợ qua dispatchProvisionUser_ theo mục trên. Không cần dán mật khẩu hoặc cấu hình app Finance/Care.
