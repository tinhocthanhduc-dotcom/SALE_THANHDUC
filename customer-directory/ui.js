"use strict";
(() => {
  const $ = (s) => document.querySelector(s), e = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), key = () => crypto.randomUUID(), can = (role) => actor?.roles.includes(role), manager = () => can("finance") || can("director");
  let actor = null, selected = null, overview = null, picker, importEpoch = 0;
  const roleLabel = (r) => ({ sales: "Kinh doanh", reception: "Tiếp nhận", dispatcher: "Điều phối", finance: "Kế toán", director: "Giám đốc" })[r] || r, statusLabel = (s) => ({ DANG_DUNG: "Đang dùng", NGUNG: "Ngừng sử dụng", DA_GOP: "Đã gộp" })[s] || s, actionLabel = (s) => ({ TAO: "Tạo khách", SUA: "Sửa khách", THEM_LIEN_HE: "Thêm người liên hệ", GOP_NGUON: "Gộp khách nguồn", GOP_DICH: "Nhận gộp vào khách đích", QUET_BAN_SAO: "Quét bản sao", KT_DUYET_TRUNG: "Kế toán duyệt trùng", GD_XAC_NHAN: "Giám đốc xác nhận", NHAP_KHACH: "Nhập khách", THEM_MA_CU: "Bổ sung mã cũ", CHUAN_HOA_SO_0: "Khôi phục số 0 đầu SĐT / MST" })[s] || s;
  const errors = { PHONE_OF_PERSON: "Số điện thoại thuộc khách cá nhân. Chọn cách xử lý để giữ đúng lịch sử khách.", AUTO_MATCH_SOURCE_REVIEW_REQUIRED: "Nhóm ghép chắc chắn có thông tin sai: sửa trên bản sao rồi Quét lại trước khi duyệt.", MASTER_CUSTOMER_CONFLICT: "Danh bạ đã có khách khớp với nhóm nhập. Kế toán và giám đốc cần đối chiếu, không tự cấp mã trùng.", GOOGLE_IDENTITY_REQUIRED: "Không xác định được tài khoản Google. Dùng tài khoản đã được cấp quyền; không mở quyền ẩn danh.", FORBIDDEN: "Tài khoản chưa được cấp quyền cho thao tác này.", DIRECTORY_NOT_CONFIGURED: "Chủ project mở Apps Script, chọn Run setupCustomerDirectory để tạo file danh bạ riêng.", SERVER_ERROR: "Máy chủ chưa xử lý được. Giữ nội dung và thử lại.", VERSION_CONFLICT: "Dữ liệu vừa được người khác sửa. Đóng form, tìm lại khách rồi mở để sửa.", FIELD_FORBIDDEN: "Chỉ kế toán hoặc giám đốc được sửa tên, MST, loại khách và quyền ghi nợ.", INVALID_PHONE: "Số điện thoại không hợp lệ. Dùng số Việt Nam, có thể nhập +84 hoặc nhiều số ngăn bằng dấu ;.", INVALID_TAX: "MST phải có 10 hoặc 13 chữ số.", REASON_REQUIRED: "Hãy ghi lý do.", SECOND_APPROVER_REQUIRED: "Giám đốc xác nhận phải khác người kế toán đã duyệt.", COPY_SOURCES_REQUIRED: "Chủ project cần cấu hình đủ bốn bản sao trước.", USE_VERIFIED_COPY_SCAN: "Chỉ nhập từ các bản sao đã xác minh.", CONTRADICTORY_DECISIONS: "Các quyết định Cùng khách / Khác khách đang mâu thuẫn; cần duyệt lại nhóm liên quan.", OWNER_CREATED_COPY_REQUIRED: "Nguồn phải là bản sao mới do chủ tạo, đặt tên CD_COPY_…", EXISTING_GROUPS_NEED_DIRECTOR_MERGE: "Các nhóm đã có mã KTD khác nhau. Giám đốc gộp các mã đó trước; không cấp mã thay thế." };
  function notify(text, bad = false) {
    $("#notice").textContent = text;
    $("#notice").className = bad ? "error" : "success";
  }
  const searchCache = new Map();
  let searchGeneration = 0;
  async function api(request) {
    const started = Date.now();
    request = JSON.parse(JSON.stringify(request));
    let response;
    if (window.google?.script?.run) response = await new Promise((resolve, reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(() => reject(Error("NETWORK_ERROR"))).directoryUi(request));
    else {
      const r = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      response = await r.json();
    }
    if (!response.ok) {
      const err = Error(response.error);
      err.details = response.details;
      throw err;
    }
    if (["command", "create", "update", "merge", "add_contact", "scan_copies", "finalize_import"].includes(request.action)) { searchCache.clear(); searchGeneration++; }
    if (request.action === "search") console.info("directory.search", { elapsed_ms: Date.now() - started, results: response.data.customers.length });
    return response.data;
  }
  function message(err) {
    const source = err.details?.app ? " Nguồn " + err.details.app + " · " + (err.details.ma_cu || "") + "." : "";
    return source + (errors[err.message] || { DUPLICATE_TAX: "MST đã thuộc một khách có sẵn.", DUPLICATE_PHONE: "Số điện thoại đã thuộc khách cá nhân có sẵn.", COMPANY_PHONE_WARNING: "SĐT đang thuộc một công ty. Có thể thêm người liên hệ hoặc tạo riêng với lý do." }[err.message] || "Không hoàn tất thao tác (" + err.message + ").");
  }
  class CustomerPicker {
    constructor(root, { label, onChoose, onCreate }) {
      this.root = root;
      this.onChoose = onChoose;
      this.onCreate = onCreate;
      this.seq = 0;
      this.choice = null;
      this.rows = [];
      this.index = 0;
      const id = key();
      root.className = "picker";
      root.innerHTML = '<input role="combobox" aria-label="' + e(label) + '" aria-autocomplete="list" aria-expanded="false" aria-controls="' + id + '-list" autocomplete="off" placeholder="Gõ để tìm khách…"><button type="button" class="picker-clear" aria-label="Bỏ chọn" hidden>×</button><div class="picker-popup" hidden><div role="listbox" aria-label="' + e(label) + '" id="' + id + '-list"></div><p class="empty" hidden>Không tìm thấy</p><button type="button" data-picker-create hidden>+ Tạo khách mới</button></div><span class="picker-status" role="status" aria-live="polite"></span>';
      this.input = root.querySelector("input");
      this.popup = root.querySelector(".picker-popup");
      this.list = root.querySelector("[role=listbox]");
      this.clear = root.querySelector(".picker-clear");
      this.input.addEventListener("input", () => {
        this.seq++;
        this.rows = [];
        this.list.replaceChildren();
        this.close();
        this.choice = null;
        onChoose?.(null);
        this.clear.hidden = !this.input.value;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.load(), 300);
      });
      this.input.addEventListener("focus", () => {
        this.load();
        if (this.choice) this.input.select();
      });
      this.input.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          this.close();
        }
        if (["ArrowDown", "ArrowUp"].includes(ev.key)) {
          ev.preventDefault();
          if (this.popup.hidden) this.load(true);
          else {
            this.index = (this.index + (ev.key === "ArrowDown" ? 1 : -1) + this.rows.length) % Math.max(1, this.rows.length);
            this.draw();
            this.list.children[this.index]?.scrollIntoView({ block: "nearest" });
          }
        }
        if (ev.key === "Enter" && !this.popup.hidden) {
          ev.preventDefault();
          if (this.rows[this.index]) this.choose(this.rows[this.index]);
        }
      });
      root.addEventListener("pointerdown", (ev) => {
        if (ev.target.closest("[role=option],[data-picker-create]")) ev.preventDefault();
      });
      root.addEventListener("click", (ev) => {
        const option = ev.target.closest("[data-result]");
        if (option) this.choose(this.rows[Number(option.dataset.result)]);
        if (ev.target.closest(".picker-clear")) {
          this.seq++;
          this.choice = null;
          this.input.value = "";
          this.clear.hidden = true;
          onChoose?.(null);
          this.input.focus();
          this.load();
        }
        if (ev.target.closest("[data-picker-create]")) {
          const q = this.input.value;
          this.close();
          onCreate?.(q);
        }
      });
      root.addEventListener("focusout", (ev) => {
        if (!root.contains(ev.relatedTarget)) this.close();
      });
    }
    async load(allowEmpty = false) {
      const seq = ++this.seq;
      const q = this.choice ? "" : this.input.value.trim();
      const status = this.root.querySelector("[role=status]");
      if (!q && !allowEmpty) { this.close(); this.input.removeAttribute("aria-busy"); status.textContent = ""; return; }
      status.textContent = "Đang tìm…";
      this.input.setAttribute("aria-busy", "true");
      try {
        const cacheKey = q.toLowerCase(), cached = searchCache.get(cacheKey), generation = searchGeneration;
        const result = cached && Date.now() - cached.at < 30000 ? cached.result : await api({ action: "search", payload: { q } });
        if (generation === searchGeneration && (!cached || cached.result !== result)) {
          if (searchCache.size >= 50) searchCache.delete(searchCache.keys().next().value);
          searchCache.set(cacheKey, { at: Date.now(), result });
        }
        if (seq !== this.seq || !this.root.isConnected || !this.root.contains(document.activeElement)) return;
        this.rows = result.customers;
        this.index = 0;
        this.draw();
        this.popup.hidden = false;
        this.input.setAttribute("aria-expanded", "true");
      } catch (err) {
        if (seq === this.seq) {
          this.close();
          status.textContent = "Không tìm được. Hãy thử lại.";
          notify(message(err), true);
        }
      } finally { if (seq === this.seq) this.input.removeAttribute("aria-busy"); }
    }
    draw() {
      this.list.innerHTML = this.rows.map((c, i) => '<div role="option" id="' + this.list.id + "-" + i + '" aria-selected="' + (i === this.index) + '" data-result="' + i + '"><strong>' + e(c.MA_KHACH) + " · " + e(c.TEN) + "</strong><small>" + e(c.DIEN_THOAI.join(" · ")) + (c.MST ? " · MST " + e(c.MST) : "") + "</small></div>").join("");
      this.root.querySelector(".empty").hidden = !!this.rows.length;
      this.root.querySelector("[data-picker-create]").hidden = !!this.rows.length || !this.onCreate;
      this.root.querySelector("[role=status]").textContent = this.rows.length + " kết quả, tối đa 20.";
      if (this.rows.length) this.input.setAttribute("aria-activedescendant", this.list.id + "-" + this.index);
      else this.input.removeAttribute("aria-activedescendant");
    }
    choose(c) {
      this.seq++;
      this.choice = c;
      this.input.value = c.MA_KHACH + " · " + c.TEN + (c.DIEN_THOAI.length ? " · " + c.DIEN_THOAI.join(", ") : "");
      this.clear.hidden = false;
      this.close();
      this.onChoose?.(c);
    }
    close() {
      this.popup.hidden = true;
      this.input.setAttribute("aria-expanded", "false");
      this.input.removeAttribute("aria-activedescendant");
    }
  }
  function close() {
    const d = $("#dialog");
    d.close();
    d.replaceChildren();
  }
  async function showCustomer(c) {
    selected = c;
    if (!c) {
      $("#detail").innerHTML = '<p class="muted">Chọn khách trong kết quả tìm kiếm.</p>';
      return;
    }
    $("#detail").innerHTML = '<article class="panel"><span class="badge">' + e(c.MA_KHACH) + " · " + e(statusLabel(c.TRANG_THAI)) + "</span><h2>" + e(c.TEN) + "</h2><p>" + e(c.LOAI === "CONG_TY" ? "Công ty" : "Cá nhân") + (c.MST ? " · MST " + e(c.MST) : "") + "</p><p>" + c.DIEN_THOAI.map((p) => '<a href="tel:' + e(p) + '">' + e(p) + "</a>").join(" · ") + "</p><p>" + e(c.DIA_CHI) + "</p><p>" + e(c.EMAIL) + "</p><p>Cho phép ghi nợ: " + (c.CHO_PHEP_NO ? "Có" : "Không") + "</p><p>Mã cũ: " + e(c.MA_CU.join("; ") || "Chưa có") + '</p><div class="actions"><button data-edit>Sửa thông tin</button>' + (c.LOAI === "CONG_TY" ? "<button data-contact>+ Người liên hệ</button>" : "") + (can("director") ? "<button data-merge>Gộp vào khách khác</button>" : "") + "<button data-history>Lịch sử</button></div><h3>Người liên hệ</h3>" + c.NGUOI_LIEN_HE.map((x) => "<p>" + e(x.ten) + " · " + e(x.dien_thoai.join(", ")) + " · " + e(x.ghi_chu) + "</p>").join("") + '<div id="history"></div></article>';
  }
  function form(title, html, onSubmit) {
    const d = $("#dialog");
    d.innerHTML = "<form><h2>" + e(title) + "</h2>" + html + '<div id="form-error" role="alert"></div><div class="actions"><button class="primary" type="submit">Lưu</button><button type="button" data-close>Đóng</button></div></form>';
    d.querySelector("[data-close]").onclick = close;
    d.querySelector("form").onsubmit = async (ev) => {
      ev.preventDefault();
      const b = d.querySelector("[type=submit]");
      b.disabled = true;
      try {
        await onSubmit(ev.target);
      } catch (err) {
        if (d.open) {
          d.querySelector("#form-error").className = "error";
          d.querySelector("#form-error").textContent = message(err);
          if (err.details?.existing) {
            const c = err.details.existing, wrap = d.querySelector("#form-error"), open = document.createElement("button");
            open.type = "button";
            open.textContent = "Mở " + c.MA_KHACH + " · " + c.TEN;
            open.onclick = () => {
              close();
              picker.choose(c);
            };
            wrap.append(document.createElement("br"), open);
            if (err.message === "PHONE_OF_PERSON") {
              const f = ev.target;
              if (manager()) {
                const convert = document.createElement("button"); convert.type = "button";
                convert.textContent = "Chuyển cá nhân thành công ty (giữ mã)";
                convert.onclick = () => { f.personToConvert = c; f.requestSubmit(); };
                wrap.append(convert);
              }
              const linked = document.createElement("button"); linked.type = "button";
              linked.textContent = "Tạo công ty và thêm cá nhân làm liên hệ";
              linked.onclick = () => { f.personContact = c; f.requestSubmit(); };
              wrap.append(linked);
            }
            if (["COMPANY_PHONE_WARNING", "PHONE_OF_PERSON"].includes(err.message)) {
              const contact = document.createElement("button");
              contact.type = "button";
              contact.textContent = "Thêm người liên hệ";
              const f = ev.target, prefill = { ten: f.elements.TEN.value, dien_thoai: f.elements.DIEN_THOAI.value };
              contact.onclick = () => contactForm(c, prefill);
              if (err.message === "COMPANY_PHONE_WARNING") wrap.append(contact);
              let reason = f.querySelector("[name=separate_reason]");
              if (!reason) {
                reason = document.createElement("textarea");
                reason.name = "separate_reason";
                reason.placeholder = "Lý do tạo khách riêng (bắt buộc)";
                f.querySelector(".actions").before(reason);
                const separate = document.createElement("button");
                separate.type = "button";
                separate.textContent = "Tạo riêng với lý do";
                separate.onclick = () => {
                  if (!reason.value.trim()) {
                    reason.setCustomValidity("Hãy ghi lý do.");
                    reason.reportValidity();
                    return;
                  }
                  reason.setCustomValidity("");
                  f.personContact = null; f.personToConvert = null;
                  f.dataset.separate = "true";
                  f.requestSubmit();
                };
                reason.after(separate);
              }
            }
          }
        } else notify(message(err), true);
      } finally {
        if (b.isConnected) b.disabled = false;
      }
    };
    if (!d.open) d.showModal();
    return d.querySelector("form");
  }
  const choices = (name, label, options, disabled = false) => "<fieldset><legend>" + e(label) + '</legend><div class="actions">' + options.map(([value, text]) => '<label class="check choice"><input type="radio" name="' + name + '" value="' + value + '" ' + (disabled ? "disabled " : "") + ">" + e(text) + "</label>").join("") + "</div></fieldset>";
  const field = (name, label, value = "", type = "text", required = false, disabled = false) => "<label>" + e(label) + '<input name="' + name + '" type="' + (name === "DIEN_THOAI" || name === "dien_thoai" ? "tel" : type) + '" ' + (name === "MST" ? 'inputmode="numeric" ' : "") + 'value="' + e(value) + '" ' + (required ? "required " : "") + (disabled ? "disabled" : "") + "></label>";
  function editor(c = null, seed = "") {
    const idem = key(), locked = !!c && !manager(), html = choices("LOAI", "Loại khách", [["CA_NHAN", "Cá nhân"], ["CONG_TY", "Công ty"]], locked) + field("TEN", "Tên khách / tên hóa đơn", c?.TEN || (!/^[+\d ()-]+$/.test(seed) ? seed : ""), "text", true, locked) + field("MST", "Mã số thuế", c?.MST || "", "text", false, locked) + field("DIEN_THOAI", "Điện thoại (nhiều số cách nhau bằng ;)", c?.DIEN_THOAI.join("; ") || (/^[+\d ()-]+$/.test(seed) ? seed : ""), "text") + field("EMAIL", "Email", c?.EMAIL || "", "email") + field("DIA_CHI", "Địa chỉ", c?.DIA_CHI || "") + '<label class="check"><input type="checkbox" name="CHO_PHEP_NO" ' + (c?.CHO_PHEP_NO ? "checked " : "") + (!manager() ? "disabled" : "") + "> Cho phép ghi công nợ</label>" + field("HAN_MUC_NO", "Hạn mức nợ (đồng)", c?.HAN_MUC_NO || 0, "number", false, !manager()) + '<label>Ghi chú<textarea name="GHI_CHU">' + e(c?.GHI_CHU || "") + "</textarea></label>" + (c && manager() ? choices("TRANG_THAI", "Trạng thái", [["DANG_DUNG", "Đang dùng"], ["NGUNG", "Ngừng sử dụng"]]) : "");
    const f = form(c ? "Sửa khách" : "Tạo khách", html, async (f2) => {
      const customer = Object.fromEntries(["LOAI", "TEN", "MST", "DIEN_THOAI", "EMAIL", "DIA_CHI", "GHI_CHU"].map((k) => [k, f2.elements[k].value]));
      customer.CHO_PHEP_NO = f2.elements.CHO_PHEP_NO.checked;
      customer.HAN_MUC_NO = Number(f2.elements.HAN_MUC_NO.value || 0);
      if (c && manager()) customer.TRANG_THAI = f2.elements.TRANG_THAI.value;
      const target = f2.personToConvert || c;
      if (f2.personToConvert) {
        customer.CHO_PHEP_NO = target.CHO_PHEP_NO;
        customer.HAN_MUC_NO = target.HAN_MUC_NO;
        for (const field of ["EMAIL", "DIA_CHI", "GHI_CHU"]) if (!customer[field]) customer[field] = target[field];
      }
      const confirmation = f2.personContact ? { mode: "CREATE_COMPANY_WITH_CONTACT", person_id: f2.personContact.MA_KHACH, person_version: f2.personContact.VERSION } : f2.dataset.separate ? { mode: "CREATE_SEPARATE", reason: f2.elements.separate_reason.value } : void 0;
      const r = await api({ action: target ? "update" : "create", idempotency_key: idem, expected_version: target?.VERSION, payload: { ma: target?.MA_KHACH, customer, confirmation, reason: f2.personToConvert ? "Chuyển cá nhân thành công ty theo thông tin hóa đơn" : undefined } });
      close();
      picker.choose(r.customer);
      notify("Đã lưu " + r.customer.MA_KHACH + (r.warnings?.length ? " · Đã ghi nhận cảnh báo / liên hệ liên quan." : ""));
    });
    f.elements.LOAI.value = c?.LOAI || "CA_NHAN";
    if (f.elements.TRANG_THAI) f.elements.TRANG_THAI.value = c.TRANG_THAI;
  }
  function contactForm(c, prefill = {}) {
    const idem = key();
    form("Thêm người liên hệ · " + c.MA_KHACH, field("ten", "Tên người liên hệ", prefill.ten || "", "text", true) + field("phone", "Điện thoại", Array.isArray(prefill.dien_thoai) ? prefill.dien_thoai.join("; ") : prefill.dien_thoai || "") + field("note", "Ghi chú"), async (f) => {
      const r = await api({ action: "add_contact", idempotency_key: idem, expected_version: c.VERSION, payload: { ma: c.MA_KHACH, contact: { ten: f.elements.ten.value, dien_thoai: f.elements.phone.value, ghi_chu: f.elements.note.value } } });
      close();
      picker.choose(r.customer);
      notify("Đã thêm người liên hệ.");
    });
  }
  function mergeForm(c) {
    const idem = key();
    let target = null;
    form("Gộp " + c.MA_KHACH + " vào khách đích", '<p>Mã nguồn và lịch sử được giữ. Chỉ giám đốc thực hiện.</p><label>Khách đích</label><div id="merge-picker"></div><label>Lý do<textarea name="reason" required></textarea></label>', async (f) => {
      if (!target || target.MA_KHACH === c.MA_KHACH) throw Error("TARGET_SELECTION_REQUIRED");
      const r = await api({ action: "merge", idempotency_key: idem, expected_version: c.VERSION, payload: { source: c.MA_KHACH, target: target.MA_KHACH, target_version: target.VERSION, reason: f.elements.reason.value } });
      close();
      picker.choose(r.customer);
      notify("Đã gộp, mã nguồn vẫn tra được khách đích.");
    });
    new CustomerPicker($("#merge-picker"), { label: "Khách đích", onChoose: (c2) => target = c2 });
  }
  function phoneIssues(rows) {
    if (!rows.length) return "";
    return '<details><summary>' + rows.length + ' dòng có SĐT cần kiểm tra · quét vẫn tiếp tục</summary><p>Chỉ dùng số hợp lệ để ghép khách. Giá trị gốc giữ trong sheet NGUON; sửa trên bản sao nguồn rồi quét lại.</p><div class="table-scroll"><table><thead><tr><th>Nguồn</th><th>Mã cũ</th><th>SĐT gốc</th><th>Phần không hợp lệ</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + e(r.app) + '</td><td>' + e(r.ma_cu) + '</td><td>' + e(r.raw) + '</td><td>' + e(r.invalid.join('; ')) + '</td></tr>').join('') + '</tbody></table></div></details>';
  }
  function taxIssues(rows) {
    if (!rows.length) return "";
    return '<details><summary>' + rows.length + ' dòng có MST cần kiểm tra · quét vẫn tiếp tục</summary><p>MST lỗi không dùng để ghép khách. Giữ nguyên giá trị gốc trong sheet NGUON; sửa trên bản sao nguồn rồi quét lại. Chỉ bù số 0 cho chuỗi số đủ điều kiện; MST giống SĐT được chuyển sang SĐT và vẫn ghi lỗi MST.</p><div class="table-scroll"><table><thead><tr><th>Nguồn</th><th>Mã cũ</th><th>MST gốc</th><th>Lỗi / SĐT đã chuyển</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + e(r.app) + '</td><td>' + e(r.ma_cu) + '</td><td>' + e(r.raw) + '</td><td>' + (r.reason === "MST_IS_PHONE" ? "MST đang chứa SĐT: " + e((r.moved_to_phone || []).join("; ")) : "MST không hợp lệ") + '</td></tr>').join('') + '</tbody></table></div></details>';
  }
  function zeroIssues(rows) {
    return rows.length ? '<details><summary>' + rows.length + ' dòng đã bù số 0 đầu</summary><div class="table-scroll"><table><thead><tr><th>Nguồn</th><th>Mã cũ</th><th>Trường</th><th>Giá trị gốc</th><th>Sau chuẩn hóa</th></tr></thead><tbody>' + rows.flatMap(r => r.changes.map(c => '<tr><td>' + e(r.app) + '</td><td>' + e(r.ma_cu) + '</td><td>' + e(c.truong) + '</td><td>' + e(c.goc) + '</td><td>' + e(c.sau) + '</td></tr>')).join('') + '</tbody></table></div></details>' : '';
  }
  async function importView() {
    const epoch = ++importEpoch;
    $("#import").innerHTML = '<p role="status">Đang tải danh sách duyệt…</p>';
    const loaded = await api({ action: "import_view" }), report = await api({ action: "report" });
    if (epoch !== importEpoch) return;
    overview = loaded;
    $("#import").innerHTML = '<section class="panel"><h2>Gộp khách cũ · chỉ bản sao</h2><p>Nguồn chỉ đọc. Kế toán duyệt nhóm nghi ngờ; nhóm có nợ cần giám đốc khác người duyệt xác nhận thêm.</p><div class="actions"><button class="primary" data-scan>Quét bốn bản sao</button><button data-finalize ' + (can("finance") ? "" : "disabled") + ">Cấp mã / xuất ánh xạ</button><button data-sheet-choices " + (can("finance") ? "" : "disabled") + ">Duyệt lựa chọn trên sheet</button><button data-mappings>Xem ánh xạ</button></div><p>" + report.source_rows + " dòng nguồn · " + report.automatic_groups + " nhóm ghép chắc chắn · " + report.pending_review + " nhóm chờ duyệt · " + report.missing_phone_and_tax + " dòng thiếu cả SĐT và MST.</p><p>Nguồn: " + e(Object.entries(report.sources).map(([a, n]) => a + " " + n).join(" · ")) + "</p>" + (report.unknown_updated_at ? '<p class="muted">' + report.unknown_updated_at + " dòng chưa xác định được thời điểm cập nhật; giữ dấu nguồn, không đoán ngày.</p>" : "") + phoneIssues(report.invalid_phone_rows || []) + taxIssues(report.invalid_tax_rows || []) + zeroIssues(report.leading_zero_rows || []) + '<div class="table-scroll"><table><thead><tr><th>Nhóm</th><th>Số dòng</th><th>Công nợ</th><th>Duyệt</th><th></th></tr></thead><tbody>' + overview.reviews.map((r) => "<tr><td>" + e(r.id) + (r.changed_since_approval ? "<br>Nguồn đổi, cần duyệt lại" : "") + "</td><td>" + r.count + '</td><td class="' + (r.open_debt ? "debt" : "") + '">' + (r.open_debt ? "Có nợ mở" : "Không") + "</td><td>" + e(r.decision === "CUNG_KHACH" ? "Cùng khách" : r.decision === "KHAC_KHACH" ? "Khác khách" : "Chờ kế toán") + (r.open_debt ? r.director_by ? " · GD đã xác nhận" : " · Chờ GD" : "") + '</td><td><button data-review="' + e(r.id) + '">Xem / duyệt</button></td></tr>').join("") + '</tbody></table></div><div id="mapping-view"></div></section>';
  }
  async function reviewForm(id) {
    const { review: r, rows } = await api({ action: "review_detail", payload: { id } }), idem = key();
    form("Duyệt nhóm trùng", '<p class="' + (r.open_debt ? "debt" : "") + '">' + (r.open_debt ? "Có công nợ mở: cần thêm giám đốc xác nhận." : "Không có công nợ mở được báo từ nguồn.") + "</p>" + rows.map((x) => '<article class="card"><strong>' + e(x.app + " · " + x.ma_cu + " · " + x.TEN) + "</strong><p>" + e(x.DIEN_THOAI.join(", ")) + " · MST " + e(x.MST || "Chưa có") + "</p><p>" + e(x.DIA_CHI) + "</p></article>").join("") + '<div class="actions"><label class="check"><input type="radio" name="decision" value="CUNG_KHACH" ' + (r.decision === "CUNG_KHACH" ? "checked" : "") + '>Cùng khách</label><label class="check"><input type="radio" name="decision" value="KHAC_KHACH" ' + (r.kind === "AUTO_DEBT" ? "disabled " : "") + (r.decision === "KHAC_KHACH" ? "checked" : "") + '>Khác khách</label></div><label>Lý do<textarea name="reason" required>' + e(r.reason || "") + "</textarea></label>" + (can("director") && r.open_debt && r.decision ? '<label class="check"><input type="checkbox" name="director">Giám đốc xác nhận quyết định kế toán</label>' : ""), async (f) => {
      const director = !!f.elements.director?.checked;
      if (!director && !can("finance")) throw Error("FORBIDDEN");
      await api({ action: "review_import", idempotency_key: idem, expected_version: r.VERSION, payload: { id, decision: f.elements.decision.value, director, reason: f.elements.reason.value } });
      close();
      await importView();
      notify("Đã lưu quyết định có người duyệt và thời điểm.");
    });
  }
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    try {
      if (b.dataset.tab) {
        document.querySelectorAll("[data-tab]").forEach((n) => n.setAttribute("aria-current", n === b ? "page" : "false"));
        $("#directory").hidden = b.dataset.tab !== "directory";
        $("#import").hidden = b.dataset.tab !== "import";
        if (b.dataset.tab === "import") await importView();
      } else if (b.hasAttribute("data-edit")) editor(selected);
      else if (b.hasAttribute("data-contact")) contactForm(selected);
      else if (b.hasAttribute("data-merge")) mergeForm(selected);
      else if (b.hasAttribute("data-history")) {
        const code = selected.MA_KHACH, r = await api({ action: "history", payload: { ma: code } });
        if (selected?.MA_KHACH !== code) return;
        $("#history").innerHTML = "<h3>Lịch sử</h3>" + r.events.map((x) => "<details><summary>" + e(actionLabel(x.LOAI) + " · " + x.AI + " · " + new Date(x.LUC).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })) + "</summary><p>" + e(x.LY_DO) + "</p><h4>Trước</h4><pre>" + e(JSON.stringify(x.TRUOC, null, 2)) + "</pre><h4>Sau</h4><pre>" + e(JSON.stringify(x.SAU, null, 2)) + "</pre></details>").join("");
      } else if (b.hasAttribute("data-scan") || b.hasAttribute("data-finalize")) {
        b.disabled = true;
        const scan = b.hasAttribute("data-scan"), r = await api({ action: scan ? "scan_copies" : "finalize_import", idempotency_key: key(), expected_version: overview.revision, payload: { limit: 50 } });
        await importView();
        notify(scan ? "Đã quét bản sao; khôi phục SĐT/MST cho " + (r.repaired_customers || 0) + " khách, giữ nguyên mã KTD. Chưa ghi vào app nguồn." : "Đã cấp " + r.allocated + " mã; giữ " + r.unchanged + " nhóm cũ; " + r.pending + " nhóm chờ duyệt; " + r.remaining + " nhóm sẽ cấp ở lượt tiếp.");
      } else if (b.hasAttribute("data-sheet-choices")) {
        const r = await api({ action: "apply_review_choices" });
        await importView();
        notify("Đã duyệt " + r.approved + " lựa chọn từ sheet bằng tài khoản hiện tại.");
      } else if (b.dataset.review) await reviewForm(b.dataset.review);
      else if (b.hasAttribute("data-mappings")) {
        const r = await api({ action: "mappings" });
        $("#mapping-view").innerHTML = '<h3>Ánh xạ (cũng có trong sheet ANH_XA)</h3><div class="table-scroll"><table><thead><tr><th>App</th><th>Mã cũ</th><th>MA_KHACH</th></tr></thead><tbody>' + r.rows.map((x) => "<tr><td>" + e(x.app) + "</td><td>" + e(x.ma_cu) + "</td><td>" + e(x.MA_KHACH) + "</td></tr>").join("") + "</tbody></table></div>";
      }
    } catch (err) {
      notify(message(err), true);
    } finally {
      if (b.isConnected) b.disabled = false;
    }
  });
  $("#create").onclick = () => editor();
  api({ action: "bootstrap" }).then((r) => {
    actor = r.actor;
    $("#identity").textContent = (actor.name || actor.id) + " · " + actor.roles.map(roleLabel).join(", ");
    if (r.spreadsheet_url) {
      const link = document.createElement("a");
      link.href = r.spreadsheet_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.color = "white";
      link.textContent = " · Mở file Danh bạ";
      $("#identity").append(link);
    }
    $("#nav").hidden = false;
    $("#directory").hidden = false;
    $("[data-tab=import]").hidden = !manager();
    picker = new CustomerPicker($("#search"), { label: "Tìm và chọn khách", onChoose: showCustomer, onCreate: (q) => editor(null, q) });
  }).catch((err) => {
    $("#identity").textContent = "Chưa vào danh bạ";
    notify(message(err), true);
    if (err.message === "DIRECTORY_NOT_CONFIGURED") {
      const b = document.createElement("button");
      b.textContent = "Khởi tạo danh bạ bản sao (chủ project)";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await api({ action: "setup" });
          location.reload();
        } catch (e2) {
          notify(message(e2), true);
        } finally {
          b.disabled = false;
        }
      };
      $("#notice").append(document.createElement("br"), b);
    }
  });
})();
