// API.JS
// Gọi Google Apps Script Web App bằng JSONP (thẻ <script> động) thay vì
// fetch() thông thường — vì frontend (Netlify) và backend (script.google.com)
// khác domain, và Apps Script Web App không set CORS header cho fetch().
// JSONP né được vấn đề này vì <script src="..."> không bị trình duyệt chặn CORS.
//
// Hệ quả: mọi request (kể cả tạo/sửa/xoá) đều là GET, dữ liệu ghi được gửi
// dưới dạng JSON trong query string (payload=...).

const PASSWORD_KEY = 'qd_api_password';

function getStoredPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}

function setStoredPassword(pass) {
  sessionStorage.setItem(PASSWORD_KEY, pass);
}

function clearStoredPassword() {
  sessionStorage.removeItem(PASSWORD_KEY);
}

let _callbackCounter = 0;

function callApi(action, payload) {
  return new Promise((resolve, reject) => {
    if (!API_URL || API_URL.indexOf('DAN_URL_WEB_APP') > -1) {
      reject(new Error('Chưa cấu hình API_URL trong js/config.js'));
      return;
    }

    const cbName = 'qd_cb_' + Date.now() + '_' + (_callbackCounter++);
    const params = new URLSearchParams();
    params.set('action', action);
    params.set('callback', cbName);
    params.set('password', getStoredPassword());
    if (payload !== undefined) params.set('payload', JSON.stringify(payload));

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Hết thời gian chờ phản hồi từ máy chủ.'));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (res) => {
      cleanup();
      if (!res || res.success === false) {
        reject(new Error((res && res.error) || 'Lỗi không xác định từ máy chủ.'));
      } else {
        resolve(res.data !== undefined ? res.data : res);
      }
    };

    const script = document.createElement('script');
    script.src = API_URL + '?' + params.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('Không kết nối được máy chủ Apps Script.'));
    };
    document.body.appendChild(script);
  });
}

// Gọi riêng để xác thực mật khẩu khi người dùng bấm "Vào hệ thống",
// không lẫn với các action đọc/ghi dữ liệu khác.
function verifyPassword(pass) {
  setStoredPassword(pass);
  return callApi('login').catch((err) => {
    clearStoredPassword();
    throw err;
  });
}
