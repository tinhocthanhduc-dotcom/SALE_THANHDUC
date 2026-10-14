# Thành Đức – Điều phối dịch vụ: mốc đầu tiên

Ngày 13/10/2026. Mã thử nghiệm riêng theo SPEC_V1_1.md. Không triển khai hoặc ghi vào 5 app legacy.

## Đã chạy được với dữ liệu mẫu

- Đăng nhập tài khoản/mật khẩu thật ở máy chủ, PBKDF2-SHA256 600.000 vòng, salt riêng. Không có nút chọn vai trò client. Local dùng cookie HttpOnly; GAS bridge dùng token trong sessionStorage và máy chủ kiểm mọi lời gọi.
- Phiên 8 giờ, 5 lần sai khóa 15 phút là cấu hình thử nghiệm, chưa phải chính sách vận hành. Logout, hết phiên, ngừng tài khoản hoặc đổi version tài khoản làm mất quyền phiên. Token chỉ lưu hash phía máy chủ.
- Tạo khách và hồ sơ máy, nhận đơn với số TD theo ngày Việt Nam. Giữ quy tắc ERP đã chốt; DV riêng app vẫn là lựa chọn cần chốt, chưa tự đổi mã.
- Giao → thợ nhận → hẹn → bắt đầu → tải ảnh sau và biên bản → nghiệm thu. Ảnh được máy chủ lưu riêng và kiểm quyền khi tải. Chỉ dùng ảnh/dữ liệu giả trong runner.
- Thợ đề nghị chuyển; điều phối duyệt với kế hoạch bàn giao; thợ mới phải nhận/hẹn lại. Người cũ không truy vấn/sửa đơn sau chuyển. Trách nhiệm vật tư/tiền không được chuyển tự động.
- Không làm được có lý do, đề xuất/chờ linh kiện trên cùng đơn, lịch/lần đến và sự kiện được giữ. Kho/Giám đốc xác nhận xuất và thợ xác nhận nhận hàng riêng; chỉ tiếp tục khi tất cả đề xuất đã được xử lý.
- Optimistic version, idempotency, file journal/recovery local; GAS tái sử dụng repository Sheets staging với domain riêng. App và snapshot ERP không được dùng chung một workbook staging.

## Chạy trên máy phát triển

Từ repository:

```bash
npm ci --prefix service-dispatch
node --test service-dispatch/test/*.test.cjs
node service-dispatch/server.cjs
```

Runner chỉ nghe loopback, không phải web app production. Mở trình duyệt máy phát triển ở cổng 8787. Đổi DISPATCH_PORT hoặc DISPATCH_FIXTURE_DIR nếu cần; thư mục dữ liệu phải là đường dẫn tuyệt đối ngoài checkout. Dữ liệu mặc định lưu thư mục thanhduc-dispatch-fixture trong thư mục tạm của hệ điều hành, không bảo đảm tồn tại sau khi máy bị thay.

Tài khoản MẪU local: dispatch, tech1, tech2, director, warehouse. Tất cả dùng mật khẩu mẫu `DemoThanhDuc2026!`. Đây là fixture công khai để dùng thử, không tài khoản vận hành; tuyệt đối không cấp các tài khoản/mật khẩu này trên GAS thật. Mỗi tài khoản vẫn được băm với salt riêng. Nếu quên tài khoản mẫu, dừng runner và chọn thư mục fixture mới; không reset production.

## Build gói Apps Script

```bash
node service-dispatch/build-gas.cjs /tmp/thanhduc-dispatch-gas
```

Build tạo Code.gs, Index.html, appsscript.json và README ở thư mục độc lập. Không copy vào 5 app legacy, không chạy clasp push/deploy ở checkout Sale. Gói không chứa tài khoản, mật khẩu, marker hoặc spreadsheet ID thực tế. Workflow CI cung cấp ZIP SERVICE_DISPATCH_STAGING để tải.

## Khởi tạo staging riêng – chưa thực hiện trên Google

1. Tạo Apps Script, Sheets và thư mục ảnh Drive MỚI chỉ dành cho thử nghiệm; không dùng project/file legacy hoặc workbook của ERP prototype. Chỉ quản trị staging có quyền sửa file/code. Kiểm tra thư mục Drive không chia sẻ công khai.
2. Spreadsheet cần 3 tab preallocated: ERP_META A1:B2 là `environment | token` và `STAGING | marker ngẫu nhiên`; ERP_STATE, ERP_JOURNAL có header `attempt_id | kind | chunk_index | chunk_count | checksum | payload`. Chừa số hàng phù hợp; adapter không tự thêm tab, không mở rộng khi đầy.
3. Script Properties: DISPATCH_ENV=STAGING; DISPATCH_ENABLE_WRITES=true; DISPATCH_SCRIPT_ID bằng chính project mới; DISPATCH_SHEET_ID bằng file mới; DISPATCH_MARKER_TOKEN khớp marker; DISPATCH_IMAGE_FOLDER_ID bằng thư mục mới. Đây không phải hướng dẫn thay setting production.
4. Cấp tài khoản qua helper editor-only provisionDispatchUser: nhập DISPATCH_PROVISION_USER là JSON metadata `{ "id": "employee-id", "username": "login-name", "name": "Tên nhân viên", "roles": ["dispatcher"] }`; nhập mật khẩu thử nghiệm riêng ở DISPATCH_PROVISION_PASSWORD trong Script Properties. Không nhập mật khẩu vào code, GitHub, chat, URL hoặc logs. Helper xóa hai property tạm kể cả khi lỗi. Mật khẩu tối thiểu 12 ký tự. Không dùng mật khẩu thật của app Finance/Care. Cho phép nhiều vai trò; hỗ trợ dispatcher/technician/director/warehouse; finance chưa có màn hình nghiệp vụ.
5. Chạy helper từ editor với quyền quản trị; không có API công khai tạo tài khoản. Tài khoản lưu theo DISPATCH_USER_<id> chứa hash/salt, không plaintext. Đổi active=false hoặc tăng version để thu hồi phiên; chưa có giao diện quản trị/đổi mật khẩu/khôi phục tài khoản. Không tự sửa hash bằng tay nếu chưa có kế hoạch đổi mật khẩu.
6. Deploy phiên thử nghiệm chỉ trong project mới, execute as owner và cho phép mở không đăng nhập Google (`ANYONE_ANONYMOUS`); vẫn bắt buộc đăng nhập tài khoản/mật khẩu nhân viên để đọc đơn hoặc thao tác. Giữ quyền sửa script/file của quản trị. Link đơn là ID, không chứa token. Phải kiểm Google runtime, thời gian PBKDF2 và hành vi HtmlService trước khi mở pilot.
7. Thử auth, quyền đơn/ảnh, đồng thời, recovery/visibility/quota, upload mất sóng và backup restore bằng fixture. Người dùng đã UAT luồng chính; chức năng bổ sung cần UAT lại trên staging. Node VM build test không chứng minh Google runtime.

## Giới hạn mốc này

Chưa có giá dịch vụ/phí 0–200k, dòng công/giá vật tư, chữ ký vẽ trực tiếp, định mức kho thợ, vật tư hỏng và duyệt hỏng, xuất/nhận từng phần, đồng bộ tồn kho với app Kho, thu/nộp tiền, hóa đơn, đóng hồ sơ tài chính, bảng giá, cấu hình SLA/nhắc việc, tìm/gộp/import khách, giao diện quản trị tài khoản, backup định kỳ và pilot. Nghiệm thu mốc này chỉ ghi kết quả công việc và ảnh, giữ hồ sơ Chờ đối soát; không kết luận đã quyết toán hoặc thu đủ.

Hồ sơ snapshot và property auth chỉ phù hợp thử nghiệm nhỏ; cần normalized tables, dung lượng phiên và benchmarks trước vận hành. Upload thất bại sau file được tạo có thể còn file mồ côi khi process hard-crash; cần reconciliation theo file metadata trước pilot. Cả local và GAS dùng cùng PBKDF2, để kiểm tính tương thích hash; hiệu năng GAS chưa đo. Chỉ chống ghi lặp khi client giữ cùng command key; không suy đoán hai key khác nhau là cùng giao dịch.

Không gọi môi trường ready hoặc app vận hành thật khi chưa có staging IDs, tài khoản thử nghiệm, quyền Google và kiểm thử thực tế. Mốc tiếp theo: chỉnh giá/phí và dòng công theo đặc tả, quản trị tài khoản, luồng vật tư, rồi đối soát tiền.

## Khởi tạo nhanh ở project mới được workflow tạo

Workflow create-service-staging dùng CLASPRC_JSON đã có để tạo một project riêng và triển khai web app. ID/link được lưu trong artifact SERVICE_DISPATCH_PROJECT_20261013_01 và SERVICE_DISPATCH_DEPLOYMENT_20261013_01; không chứa credential. Registry phải được giữ để lần chạy lại tái sử dụng project/deployment; nếu registry hết hạn cần khôi phục ID, không tự tạo trùng.

Ở project MỚI này: mở Project Settings → Script Properties, thêm DISPATCH_INITIAL_PASSWORD là mật khẩu riêng tối thiểu 12 ký tự. Chọn hàm setupDispatchStaging ở editor rồi Run và cấp quyền Google theo lời nhắc. Hàm tạo Sheets staging, marker/tabs, thư mục ảnh private và tài khoản admin (director + dispatcher), tự lưu cấu hình. Mật khẩu tạm được xóa sau chạy, chỉ giữ hash/salt. Không gửi mật khẩu vào chat. Hàm chặn 5 project/file legacy và không khởi tạo lên workbook chưa được helper tạo. Chạy lại sẽ giữ tài khoản và các tài nguyên đã tạo; không xóa dữ liệu. Nếu Google tạo file thành công nhưng chưa lưu được ID do lỗi, kiểm tra tài nguyên đã tạo trước retry để tránh file mồ côi.

Mở web app trực tiếp (không cần đăng nhập Google), rồi đăng nhập admin bằng mật khẩu vừa chọn. Đây vẫn là staging; chưa nghiệm thu đầy đủ Google runtime để vận hành chính thức. Cấp thợ qua provisionDispatchUser theo mục trên. Không cần dán mật khẩu hoặc cấu hình app Finance/Care.

## Tiếp nhận đơn
Tìm khách theo tên/điện thoại hoặc bấm Tạo khách mới; khi lưu, app trở lại đơn đang nhập và chọn khách vừa tạo. Không cần chọn hoặc tạo hồ sơ máy: ghi model và thông tin máy trong Lỗi / yêu cầu. Hồ sơ máy cũ vẫn giữ nguyên; tab Khách hàng vẫn cho phép quản lý hồ sơ máy riêng.

Ngày đơn lấy từ thời gian máy chủ theo Việt Nam. Có thể để trống giờ, chọn Buổi sáng / Buổi chiều / Cả ngày, hoặc chọn khoảng giờ tùy chỉnh bằng hai ô giờ không có ngày. Nếu chọn giờ phải có đủ từ và đến, giờ đến sau giờ từ. Giao / giao lại thợ dùng Ghi chú tùy chọn; đề nghị chuyển thợ vẫn cần lý do.

## Cập nhật sau UAT

Tạo tài khoản thợ trong editor: Project Settings → Script Properties, thêm DISPATCH_PROVISION_USER (JSON ví dụ `{ "id": "tho-01", "username": "tho01", "name": "Thợ 01", "roles": ["technician"] }`) và DISPATCH_PROVISION_PASSWORD (mật khẩu riêng tối thiểu 12 ký tự). Chọn **provisionDispatchUser** → Run bằng tài khoản chủ project. Hai property tạm sẽ được xóa; tải lại app để thấy thợ trong danh sách giao việc. Không chạy lại setup để cập nhật mã.

Đo thời gian băm thực tế: chủ project chọn **benchmarkDispatchPassword** → Run, xem `hash_ms` trong Nhật ký thực thi. Phép đo dùng chuỗi tổng hợp, không đọc mật khẩu hoặc thay đổi tài khoản. Chưa có số đo runtime GAS trong lần sửa này; giữ PBKDF2-SHA256 600.000 vòng và định dạng hash cũ. Login băm ngoài ScriptLock, sau đó đọc lại phiên bản/hash/trạng thái khóa trước khi ghi phiên hoặc số lần thất bại. Chỉ cân nhắc đổi thuật toán/tham số khi có số đo GAS và kế hoạch tương thích tài khoản cũ.

Nhận đơn có thể bỏ trống cả hai giờ hẹn; nếu nhập phải nhập đủ khoảng hợp lệ. Thợ chọn Chốt giờ và bắt đầu, có thể dùng giờ đã có hoặc đổi khung giờ; đơn chưa hẹn chọn Chốt giờ và bắt đầu. Khu vực khách không bắt buộc. Điện thoại được kiểm tra ngay trong form; chi tiết đơn có liên kết gọi và Google Maps, lịch sử tiếng Việt và giờ không có giây. Thợ dùng tab Việc của tôi; mở đơn sẽ đưa chi tiết vào tầm nhìn.

## Hàng mang theo và máy thu về

Với đơn đang Chờ linh kiện, không tạo lại đơn. Dùng admin (vai trò director) hoặc tài khoản warehouse: mở đơn → **Kho xác nhận xuất hàng**, chọn đề xuất, ghi serial nếu có và ghi chú bàn giao thực tế. Phiếu PX được tạo tự động; bản này xuất đủ số lượng đề xuất, chưa hỗ trợ xuất từng phần. Phong KT/thợ được giao mở cùng đơn → **Xác nhận đã nhận hàng**. Sau khi mọi đề xuất đã được nhận hoặc từ chối, thợ chọn **Tiếp tục tại khách**, hoặc **Hẹn lại sau khi có linh kiện** nếu phải quay lại ngày khác.

Thợ có thể ghi số thực dùng ngay trong **Nghiệm thu công việc**, hoặc dùng form **Ghi vật tư / hàng thực dùng** riêng (đối với máy giao khách: số lượng đã giao). Phần dư được giữ ở thợ đến khi Kho/Giám đốc chọn **Kho xác nhận nhận hàng dư**, tạo phiếu PN. Số thực dùng không vượt số xuất; vật tư hỏng cần quy trình riêng chưa có trong bản này.

Nếu thu máy cũ, thợ chọn **Ghi nhận máy cũ thu về**, ghi model/serial, tình trạng/phụ kiện, mục đích đổi máy hoặc mang về sửa và xác nhận của khách. Biên nhận BN tự tạo. Kho/Giám đốc chọn **Kho nhận máy cũ**, ghi vị trí và tình trạng kiểm nhận, tạo phiếu NK. Ghi nhận này là bàn giao tài sản theo đơn, không tự kết luận quyền sở hữu, giá mua hoặc tạo đơn sửa riêng.

Chuyển thợ bị chặn khi còn hàng/máy đang giữ: ghi thực dùng, trả phần dư và bàn giao máy về kho trước khi duyệt chuyển trong bản này. Đơn từng xuất hàng phải Giám đốc duyệt hủy; hủy không tự xóa hàng hoặc xác nhận đã trả. Kho vẫn nhận lại hàng/máy của đơn hủy.

Các phiếu nằm trong Sheets staging của Điều phối; **chưa trừ/cộng tồn kho của QL_KHO_THANH_DUC**. Đơn cũ không cần migration/setup lại, đề xuất cũ status requested tiếp tục dùng được. Cấp tài khoản kho bằng provisionDispatchUser với roles `["warehouse"]`; admin hiện tại đã có quyền director để kiểm tra luồng ngay.

## Chẩn đoán màn hình trắng sau đăng nhập

Nút đăng nhập dùng type=button và form chặn điều hướng mặc định; Enter vẫn đăng nhập một lần. Nút chỉ bật sau khi gắn handler. Giao diện giữ form đến khi query và render thành công, hiển thị lỗi khi callback/query trả null hoặc dữ liệu không hợp lệ (`BAD_SERVER_RESPONSE`). Bootstrap độc lập hiển thị `UI_RUNTIME_ERROR` / `UI_ASYNC_ERROR` nếu script gặp lỗi, thay vì để form gửi mặc định và mất giao diện. Không log username/password/token.

Kiểm thử `node service-dispatch/test/gas-ui-browser.cjs` chạy gói Index.html đã build trong iframe sandbox với giao thức callback google.script.run giả lập và auth/repository thật local. Kiểm tra này bổ sung cho runner HTTP; không có phiên Google để xác định nguyên nhân lỗi trong trình duyệt người dùng. Sau cập nhật cần UAT đăng nhập trên Google, và gửi mã lỗi hiển thị nếu còn lỗi.

Gói GAS chuẩn hóa frontend bằng esbuild ES2017/ASCII, lưu nguồn thành payload base64 tĩnh và dùng loader nhỏ gắn script.text vào DOM (kế thừa nonce). Cách này tách mã ứng dụng/chuỗi HTML lồng nhau khỏi HTML được Google đưa qua document.write; không dùng eval hoặc nguồn mã từ dữ liệu người dùng. Bộ gas-ui-browser kiểm qua document.write và CSP nonce, thay vì chỉ nạp HTML trực tiếp.

## Chọn và đánh dấu thay nhập xác nhận nhiều lần

Nghiệm thu: chọn kết quả đã thực hiện, đánh dấu khách đã nghiệm thu; số thực dùng/giao khách hiện ngay từ phiếu xuất, sửa nếu còn dư và đánh dấu xác nhận lượng. Không cần nhập “1 máy” vào mô tả hoặc mở form ghi dùng riêng. Ghi chú bổ sung không bắt buộc. Lưu nghiệm thu ghi lượng và kết quả cùng một lần; nếu ảnh/kiểm tra thất bại thì không ghi lượng trước, retry cùng command không ghi trùng. Ảnh sau làm và biên bản của đúng lần thực hiện vẫn bắt buộc.

Xuất/nhận/trả hàng, chốt giờ, tiếp tục và bàn giao máy dùng checkbox xác nhận thay textarea; ghi chú dùng cho ngoại lệ. Checkbox không được tích sẵn. Form ghi dùng riêng tự điền số theo hàng đang chọn, có dropdown nội dung và chặn vượt số xuất. Với phần dư, Kho xác nhận lượng dư, không phải lượng đã xuất ban đầu.

Chọn “Chưa sử dụng – trả kho” tự đưa số dùng về 0. Đổi hàng hoặc sửa số lượng sẽ bỏ dấu xác nhận lượng cũ; cần đánh dấu lại trước khi lưu.


## Đề xuất nhiều linh kiện và ảnh tự tải

Trong Đề xuất thêm / chờ linh kiện, dùng **+ Thêm loại linh kiện** để nhập nhiều dòng tên/mã và số lượng, chọn nhu cầu chung rồi lưu một lần. Một phiếu DX tự cấp cho toàn bộ dòng; kho xuất cả phiếu bằng một mã PX và thợ xác nhận nhận cả phiếu. Vẫn hỗ trợ đề xuất một dòng và dữ liệu cũ. Chưa hỗ trợ xuất từng phần; vật tư dư được kho kiểm nhận từng dòng. Tên vật tư có gợi ý từ lịch sử đơn được cấp quyền, chưa phải danh mục tồn kho của app Kho.

Chọn loại ảnh trước rồi chọn/chụp ảnh: app tự nén và tải lên, hiển thị tiến trình và xác nhận đã lưu. Không cần bấm Tải ảnh lên. Nếu mất phản hồi mạng, dùng **Thử tải lại ảnh**; cùng mã yêu cầu tránh tạo ảnh trùng. Ảnh chờ thử lại chỉ giữ trong phiên trang hiện tại, không đóng/tải lại trang trước khi có thông báo đã lưu.


## Thao tác sau UAT ngày 14/10/2026

Thợ dùng **Chốt giờ và bắt đầu**: chọn sáng/chiều/cả ngày hoặc hai ô giờ, xác nhận đã liên hệ khách và lưu một lần để vào Đang làm. Ngày lấy theo hôm nay tại Việt Nam; giờ có sẵn được điền để chọn lại nhanh. Lý do đổi hẹn vẫn cần khi đơn đã có lịch xác nhận. Không còn hai nút chốt hẹn và bắt đầu riêng trên UI; API cũ tương thích.

**Ghi vật tư / hàng thực dùng** hiển thị nhiều món: chọn những món cần ghi, bấm Dùng hết/Trả hết cho từng món hoặc tất cả, hoặc sửa lượng thực dùng. Chỉ món đã chọn được lưu; lượng trả = đã nhận − thực dùng. Trong nghiệm thu cũng có nút dùng/trả nhanh, nhưng cần quyết toán đủ mọi món đã nhận. Kho chọn từng món dư hoặc Chọn tất cả món trả, xác nhận đã kiểm nhận và lưu một phiếu PN chung. Thợ ghi trả không tự xác nhận hàng đã về kho.

Đơn nghiệm thu chuyển sang tab **Đã kết thúc**, rời danh sách việc mở. Kho vẫn thấy đơn có hàng/máy để bàn giao. Ghi chú phân công mới nhất hiển thị trên thẻ và đầu chi tiết; giao lần 2 trở đi ghi rõ số lần giao, không phải tìm trong lịch sử.


Tab **Đã kết thúc** gom đơn Đã nghiệm thu và Đã hủy, lọc Tất cả hoặc từng trạng thái kèm số lượng. Đơn thuộc hai trạng thái này không nằm trong Bảng điều phối/Việc của tôi. Bộ lọc giữ khi tải dữ liệu lại trong phiên trang, bỏ khi đăng xuất. Kho vẫn thấy bàn giao chưa xử lý; các thao tác và quyền đọc không đổi. Đơn Không làm được vẫn cần xử lý/giao lại, không tự coi là kết thúc. Trạng thái Hoàn thành hồ sơ sau đối soát chưa có trong bản hiện tại.
