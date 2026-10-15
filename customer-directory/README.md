# Danh bạ khách Thành Đức — bước 1 và 2, chỉ bản sao

Project Apps Script và Google Sheet riêng, thư mục `customer-directory/`, nhánh `erp/sprint1-architecture-20261012`. Chưa nối ứng dụng nào. Không ghi Sales/CARE/Finance/Điều phối hoặc Kho, không điền MA_KHACH_CHUNG vào nguồn.

Đặc tả trong tin nhắn của chủ là tiêu chuẩn thực hiện. Link Claude chỉ trả khung Artifact khi kiểm tra, chưa đọc được nội dung thiết kế bên trong; không tuyên bố đã đối chiếu phần chưa truy cập được.

App COPY: [https://script.google.com/macros/s/AKfycbw8nUjBrRpt1iae-g272wA6Lg0Gd9JTvpKdcOVIr51xbMvSg8xSgoNbNtYZpspTusV2/exec](https://script.google.com/macros/s/AKfycbw8nUjBrRpt1iae-g272wA6Lg0Gd9JTvpKdcOVIr51xbMvSg8xSgoNbNtYZpspTusV2/exec). [Editor riêng](https://script.google.com/d/1L65AaP41TWcRK52PlOjHUdWj82NaEHh5CKgQ9nYyJ998CMjR-rMxkXTW/edit). Triển khai v1; setup/UAT Google chưa được Execution API xác nhận, xem [trạng thái Google](docs/GOOGLE_STATUS.json).

## Chạy app và khởi tạo

1. Mở link **project Danh bạ riêng** từ kết quả triển khai. Không chép Code.gs vào project của app hiện có.
2. Mở web app bằng tài khoản Google chủ project. Nếu chưa có dữ liệu, bấm **Khởi tạo danh bạ bản sao (chủ project)**. Cách tương đương trong editor: chọn Run **setupCustomerDirectory**, chấp thuận quyền Google cho project mới.
3. Khởi tạo tạo Sheet **THANH_DUC_CUSTOMER_DIRECTORY_COPY**, liên kết có trong đầu app. Chạy lại giữ nguyên counter, khách, lịch sử, quyết định, ánh xạ và cấu hình; không có chức năng reset. Không đổi CD_WORKBOOK_ID, CD_MARKER, CD_SCRIPT_ID hoặc bộ đếm bằng tay.
4. Trong editor chọn Run **checkCustomerDirectory** để kiểm tra cấu hình. Có thể chạy **runCustomerDirectoryCopyUat**: hàm tạo workbook UAT khác, chỉ dữ liệu giả; kiểm tra thật trên GAS/Sheets, không nhập khách mẫu vào danh bạ hoặc nguồn. Kết quả phải có pass=true, root_untouched=true. Giữ file UAT để đối chiếu.

Google Execution API có thể chưa cho chạy từ CI. Xem `setup-status.json` / `uat-status.json`: chỉ `confirmed:true` là đã chạy được, không coi việc deploy thành công là đã setup/UAT. Nếu chưa xác nhận, dùng nút khởi tạo hoặc Run trong editor; không đổi sang ANYONE_ANONYMOUS.

## Cấp quyền nhân viên

Chủ project thêm Script Property `CD_PROVISION_USER` (JSON, ví dụ):

```json
{"email":"nhanvien@example.com","name":"Tên nhân viên","roles":["finance"]}
```

Run **provisionCustomerDirectoryUser**. Property tạm được xóa, chỉ danh sách quyền được giữ. Roles: `sales` (kinh doanh), `reception` (tiếp nhận), `dispatcher`, `finance`, `director`. Mặc định chủ có finance+director. Nhóm có nợ cần hai người khác nhau: người kế toán duyệt và giám đốc xác nhận; người có cả hai vai trò vẫn không được tự xác nhận phần mình duyệt.

App dùng Google đã đăng nhập + danh sách email được cấp quyền. Không lấy email/role do trình duyệt tự gửi. Nếu Google không cung cấp ActiveUser email (có thể gặp với tài khoản ngoài Workspace), app chặn `GOOGLE_IDENTITY_REQUIRED`; cần kiểm tra định danh Google cho tài khoản đó trước khi cấp dùng thực tế, không nới quyền ẩn danh để né. Chưa khẳng định UAT đăng nhập nhiều tài khoản ngoài Workspace.

## Chủ tạo bốn bản sao

**Làm sau khi setup Danh bạ**, để kiểm tra thời điểm tạo bản sao. Mở file nguồn → Tệp → Tạo bản sao vào Drive của chủ; đặt tên bắt đầu **CD_COPY_**. Giữ nguyên tên sheet/cột. Không sửa file nguồn.

| Nguồn chỉ đọc | ID file gốc (không dùng trực tiếp trong cấu hình) | Sheet cần giữ |
| --- | --- | --- |
| Sales | `1tHd_ypY36P0cyFFcPoDjVuPobU2y4k1__nR4cLZdsYY` | KHACH_HANG |
| CARE | `1-j45sURspD4PvrymNp8P2gLwrebFRVt9Rbo3AwEiDWw` | Khách hàng |
| Finance | `1R5YaLosDq7fhUJuulfjXoJYEOA4tZief5Ge5qaL_jrs` | KHACH_HANG, CONG_NO_KH |
| Điều phối staging | Chủ lấy DISPATCH_SHEET_ID trong Project Settings của project Điều phối hiện tại, mở file rồi tạo bản sao | ERP_STATE, ERP_JOURNAL (nên copy cả file) |

Điều phối phải kết thúc ghi trước khi copy. Snapshot hỏng hoặc journal mới hơn snapshot thì dừng `DISPATCH_COPY_UNSETTLED`; tạo lại bản sao khi ứng dụng đã ghi xong. Không truy cập hoặc thay Script Properties của project Điều phối từ Danh bạ.

Trong project **Danh bạ** đặt riêng:

```json
CD_SOURCE_COPIES_JSON = {"SALE":"ID_BAN_SAO_SALES","CARE":"ID_BAN_SAO_CARE","FIN":"ID_BAN_SAO_FINANCE","DISPATCH":"ID_BAN_SAO_DIEU_PHOI"}
CD_CONFIRM_SOURCE_COPIES = true
```

Run **configureCustomerDirectorySources**. Hàm kiểm tra bốn ID khác nhau, không phải file gốc hoặc file danh bạ, chủ sở hữu hiện tại, tên CD_COPY_ và ngày tạo sau setup. Registry có chữ ký để đổi ID nhầm bằng tay bị chặn. Bộ đọc nguồn chỉ dùng openById/getRange/getValues, không có ghi nguồn. Không gửi token, HMAC hoặc dữ liệu khách vào chat/GitHub.

## Quét, duyệt và cấp mã

1. Kế toán/giám đốc vào tab **Gộp khách cũ → Quét bốn bản sao**. App chỉ ghi NGUON, DUYET_TRUNG và lịch sử trong file Danh bạ. Báo số khách mỗi nguồn, số nhóm chắc chắn, số chờ duyệt, số thiếu cả SĐT và MST.
2. Cùng MST hoặc cùng SĐT+tên không dấu là ghép chắc chắn. Không tự ghép hai MST khác nhau qua một số điện thoại trung gian. Cùng SĐT khác tên, tên giống khác SĐT/MST thành nhóm cần duyệt. Nhóm lớn được tách thành cặp nhóm chắc chắn để có thể duyệt một phần; các quyết định bắc cầu mâu thuẫn bị chặn.
3. Kế toán mở từng nhóm, đối chiếu các dòng nguồn, chọn **Cùng khách / Khác khách**, ghi lý do rồi Lưu. Nhóm có nợ xếp đầu, cần giám đốc khác người kế toán xác nhận thêm. **Nhóm ghép chắc chắn nhưng có nợ cũng bị giữ**, chưa có đủ hai xác nhận thì không cấp mã. Nếu thông tin ghép chắc chắn có nợ bị sai, sửa nguồn trên bản sao rồi quét lại, không ghi đè ghép tự động bằng quyết định mâu thuẫn.
4. Cột **DONG_NGUON** liệt kê app, mã, tên, SĐT, MST, địa chỉ từng dòng; nhóm có nợ ở đầu sheet. Có thể chọn trước trong cột **LUA_CHON_NHAP** và ghi **LY_DO_NHAP** của DUYET_TRUNG, rồi kế toán bấm **Duyệt lựa chọn trên sheet**. Không nhập nháp trên sheet trong lúc đang Quét/sắp xếp lại nhóm. Các ô nhập không phải quyết định đã có hiệu lực: app lấy người Google đang đăng nhập, kiểm quyền/version, ghi lịch sử. Không lấy tên người duyệt gõ tay. Giám đốc xác nhận ở app.
5. Kế toán bấm **Cấp mã / xuất ánh xạ**: cấp tối đa 50 nhóm mới/lượt; còn nhóm thì bấm tiếp. Đây cũng là lần kế toán duyệt ghi các nhóm tự động không có nợ. Nhóm chờ chưa được cấp, các nhóm không liên quan vẫn ghi được.
6. Xem sheet **ANH_XA** (có cả ID_KH và MA_KH Finance nếu khác nhau, ID và customer_no Điều phối; alias mơ hồ bị chặn): `APP, MA_CU, MA_KHACH`. Chưa ghi cột vào app nguồn. Tìm mã cũ như `SALE:KH0012` trả về khách KTD, sau gộp trả về đích.
7. Quét/cấp lại giữ mã và quyết định không đổi dữ liệu nguồn. Nguồn đổi thì hủy hiệu lực quyết định liên quan, tăng version để người đang xem bản cũ không duyệt nhầm. Lịch sử duyệt cũ vẫn giữ. Không tự gộp hai nhóm đã có KTD khác nhau: giám đốc dùng Gộp khách trước. Không tự ghi đè thông tin khách đã được sửa trong danh bạ; bổ sung alias, giữ nguồn mới để đối chiếu/sửa có lịch sử.

**Nên nhập dữ liệu cũ trước khi tạo khách dùng thật.** Nếu đã tạo tay một khách khớp nhóm nhập, app dừng `MASTER_CUSTOMER_CONFLICT` để kế toán/giám đốc đối chiếu trên bản sao; không tự tạo mã thứ hai hoặc tự gán theo tên. Chưa có giao diện gán tùy ý một nhóm nguồn vào một khách tạo tay.

Thông tin lần nhập đầu: tên hóa đơn/MST ưu tiên Sales; hạn mức/quyền nợ từ Finance mới nhất (không lấy mức lớn nhất), chỉ thiếu Finance mới dùng allow_credit/terms=credit Điều phối. SĐT/địa chỉ lấy dòng mới nhất có thông tin; các số cũ vẫn giữ trong NGUON/lịch sử. Khi thiếu ngày hợp lệ, báo số dòng, thứ tự chọn cố định Điều phối → CARE → Sales → Finance; không đoán ngày theo vị trí dòng. Không suy diễn tài khoản hay ID Finance theo tên.

Finance chỉ lấy LA_KHACH_HANG=true; dòng vừa khách vừa NCC vẫn là khách, NCC riêng bị bỏ. Thiếu CONG_NO_KH hoặc cột nợ thì dừng, không coi là không nợ. Điều phối đọc sổ CN và phân bổ trả nợ để đánh dấu nợ mở; trường hợp nợ cũ chỉ có snapshot đóng/outbox được giữ theo hướng thận trọng và cần người kiểm lại.

Nguồn thiếu ID/tên, SĐT/MST sai chuẩn hoặc schema không đúng sẽ chặn lần quét, không bỏ dòng âm thầm. Sửa **bản sao**, không sửa file thật; cần rà soát riêng trước pilot. Giới hạn an toàn: 30.000 quan hệ nghi trùng và 8MB một giao dịch; vượt thì báo lỗi, không cắt bớt dữ liệu để chạy cho xong.

## API và thiết kế kỹ thuật

Xem [API.md](docs/API.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [UAT.md](docs/UAT.md), [STATUS.md](STATUS.md). Chưa cấp client key cho bốn app; không gọi từ app hiện tại.

## Phát triển / kiểm thử

```bash
npm ci --prefix customer-directory --cache /tmp/customer-directory-npm --ignore-scripts
node --test customer-directory/test/*.test.cjs
npm ci --prefix erp-prototype --cache /tmp/customer-directory-npm --ignore-scripts
erp-prototype/node_modules/.bin/playwright install chromium
node customer-directory/test/browser.cjs
node customer-directory/build-gas.cjs /tmp/customer-directory-gas
node customer-directory/server.cjs
```

Máy có Chromium có thể đặt `ERP_TEST_CHROMIUM=/usr/bin/chromium`. Server nội bộ chỉ 127.0.0.1, dữ liệu giả trong RAM, không đọc Google; dừng/mở lại mất fixture, không phải môi trường dữ liệu thật. Không nhập khách thật vào fixture. Build ra ngoài checkout, dùng loader base64 tránh lỗi HtmlService document.write đã gặp ở Điều phối. Không log payload hoặc tên/SĐT/MST khách. File cấu hình riêng `.private/`, `*.local.json`, node_modules bị ignore.


## Bản sửa quét SĐT cũ (revision 2)

Quét không dừng vì số điện thoại nguồn không hợp lệ. Tách từng số, chuẩn hóa phần hợp lệ; phần lỗi không dùng để ghép và không tự đoán. Giao diện Gộp khách cũ có danh sách tổng hợp nguồn/mã cũ/SĐT gốc/phần lỗi. Giá trị gốc và phần lỗi giữ ở JSON của sheet NGUON (DIEN_THOAI_GOC, DIEN_THOAI_LOI), kể cả sau cấp mã. Chủ có thể sửa nhiều dòng trên bản sao nguồn rồi quét lại. API tạo/sửa danh bạ vẫn kiểm SĐT nghiêm ngặt. Cần rà danh sách lỗi trước khi duyệt/cấp mã; SĐT chưa xác minh không được tự bổ sung vào khách. Không sửa dữ liệu nguồn hoặc app thật.


## Quét MST cũ (revision 3)

MST không hợp lệ không dừng quét; liệt kê toàn bộ trong mục MST cần kiểm tra, đồng thời với SĐT lỗi. NGUON giữ MST_GOC và MST_LOI; MST chuẩn hóa để trống khi sai, không dùng giá trị sai để ghép, không tự đoán/thêm số 0. Có thông tin MST gốc vẫn giữ loại công ty. Cần rà lỗi trước cấp mã; sửa trên bản sao rồi quét lại. CRUD vẫn chặn MST sai. Kiểm tra: 64/64 Node, 8 nhóm trình duyệt (cả lỗi SĐT/MST cùng lượt, HTML escape), build GAS đạt; chưa xác nhận quét dữ liệu Google thực tế.


## Khôi phục số 0 nguồn (revision 6)

Chỉ áp dụng khi quét nguồn (không đổi kiểm tra MST của API tạo/sửa): SĐT dạng số/chỉ chữ số: 9 chữ số đầu 3/5/7/8/9 thêm 0; 10 chữ số đầu 2 thêm 0. MST 9/12 chữ số thêm 0 thành 10/13. Number được đổi chuỗi đầy đủ không dạng mũ; chuỗi ký pháp mũ không được đoán. NGUON JSON giữ DIEN_THOAI_GOC, MST_GOC, BU_SO_0 (trường/gốc/sau), MST_LOI_LY_DO và MST_CHUYEN_SDT. MST trùng SĐT đã chuẩn hóa của chính dòng hoặc bản thân có dạng 02 + 9 số được đánh lỗi và chuyển sang SĐT; không suy đoán mọi MST 10 chữ số bắt đầu 2 là số bàn.

Setup đặt định dạng @ cho các cột mã/SĐT/MST/mã cũ/chỉ mục/JSON liên quan ở toàn bộ bảng. Mọi lần ghi của app cũng đặt @ trước khi ghi literal text. Bản đang dùng: chỉ cần **Gộp khách cũ → Quét bốn bản sao**; lượt quét đầu sẽ nâng định dạng đích một lần sau khi kiểm tra COPY marker. Có hàm owner normalizeCustomerDirectorySourceNumbers để chạy cùng bước trên editor. Chỉ ghi Danh bạ; không sửa nguồn (kể cả bản sao nguồn), không cấp lại KTD.

Khi quét, tự sửa hồ sơ đã nhập nếu có bằng chứng số tương đương thiếu 0/giá trị nhập cũ trống vì lỗi này. Ghi lịch sử CHUAN_HOA_SO_0, tăng version hồ sơ và làm lại chỉ mục; không ghi đè các chỉnh sửa tay khác. Nếu MST phục hồi đụng một mã KTD khác thì giữ mã/giá trị hiện tại; khi hai nhóm đã có mã cần GĐ xử lý gộp, không tự gộp/cấp lại. Quyết định duyệt giữ khi chỉ khác metadata audit; thông tin đối chiếu thực sự đổi thì cần duyệt lại.

Kiểm tra: 85/85 Node, 11 nhóm browser 390px, build GAS đạt; test setup chạy lại giữ dữ liệu/bộ đếm, scan giữ mã/rerun, quyền/marker và số lượt tìm ≤6 vẫn đạt. Trên mô hình offline dựng từ 1.769 dòng của bốn Excel chủ gửi: 991 mã cũ giữ nguyên, 21 hồ sơ sửa, lần 2 sửa 0. Đây không phải số đo/lần ghi Google thực tế; xem docs/SOURCE_ZERO_VERIFICATION.json.
