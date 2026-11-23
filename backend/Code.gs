// 花花餵食記錄 - Apps Script 後端
// 欄位：寫入時間 | 貓咪 | 餵食者 | 餵食時間 | 份量(匙) | 狀態 | 備註 | 食物種類
// 「食物種類」是新加在最後面的欄位，原有的七欄與舊資料都不用動；舊資料沒填的一律當作貓糧。
// 修改後要到「部署 → 管理部署作業 → 編輯 → 新版本」重新部署，網址才會跑新的程式。

const SHEET_NAME = '餵食記錄';
const HEADERS = ['寫入時間', '貓咪', '餵食者', '餵食時間', '份量(匙)', '狀態', '備註', '食物種類'];
const FEEDERS = ['爸爸', '媽媽', '睿睿', '葳葳'];
const AMOUNTS = [1, 2, 3];
const FOODS = ['貓糧', '罐罐', '貓糧+罐罐'];
const DEFAULT_FOOD = '貓糧';
const STATUSES = ['食慾良好', '正常吃完', '挑食/剩食', '食慾不佳'];
const RECENT_COUNT = 5;
const SCAN_ROWS = 300;

function doGet(e) {
  try { return json(Object.assign({ ok: true }, summary_(getSheet_()))); }
  catch (err) { return json({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(10000); locked = true;
    const d = JSON.parse(e.postData.contents);
    if (FEEDERS.indexOf(d.feeder) === -1) throw new Error('餵食者不在名單內');
    const food = d.food || DEFAULT_FOOD;
    if (FOODS.indexOf(food) === -1) throw new Error('食物種類不在選項內');
    const amount = food === '罐罐' ? 0 : Number(d.amount);
    if (food !== '罐罐' && AMOUNTS.indexOf(amount) === -1) throw new Error('貓糧份量不在選項內');
    if (STATUSES.indexOf(d.catStatus) === -1) throw new Error('狀態不在選項內');
    const t = new Date(Number(d.feedTime));
    if (isNaN(t.getTime())) throw new Error('餵食時間格式錯誤');
    if (t.getTime() > Date.now() + 5 * 60000) throw new Error('餵食時間不能晚於現在');
    const catName = String(d.catName || '花花').trim().slice(0, 10) || '花花';
    const note = String(d.note || '').trim().slice(0, 30);
    const sheet = getSheet_();
    const last = getRecords_(sheet)[0];
    const isDup = !!last && last.feeder === d.feeder && last.food === food && last.amount === amount && Math.abs(last.time - t.getTime()) < 60000;
    if (!isDup) {
      sheet.appendRow([new Date(), catName, d.feeder, t, food === '罐罐' ? '' : amount, d.catStatus, note, food]);
      SpreadsheetApp.flush();
    }
    return json(Object.assign({ ok: true, duplicate: isDup }, summary_(sheet)));
  } catch (err) { return json({ ok: false, error: String(err.message || err) }); }
  finally { if (locked) lock.releaseLock(); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getLastRow() > 0 && String(sheets[i].getRange(1, 1).getValue()).trim() === HEADERS[0]) { sheet = sheets[i]; break; }
    }
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) { sheet.appendRow(HEADERS); sheet.setFrozenRows(1); }
  if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  const lastHeader = sheet.getRange(1, HEADERS.length);
  if (!String(lastHeader.getValue()).trim()) lastHeader.setValue(HEADERS[HEADERS.length - 1]);
  return sheet;
}

function summary_(sheet) {
  const records = getRecords_(sheet);
  return { last: records[0] || null, recent: records.slice(0, RECENT_COUNT), today: getToday_(records), sheetUrl: sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId() };
}

function getRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const take = Math.min(lastRow - 1, SCAN_ROWS);
  const rows = sheet.getRange(lastRow - take + 1, 1, take, HEADERS.length).getValues();
  const limit = Date.now() + 5 * 60000;
  const list = [];
  rows.forEach(function (r) {
    const t = toTime_(r[3]) || toTime_(r[0]);
    const amount = Number(r[4]);
    if (t && t <= limit && String(r[2]).trim() && !isNaN(amount)) {
      list.push({ time: t, feeder: String(r[2]).trim(), amount: amount, food: FOODS.indexOf(String(r[7]).trim()) !== -1 ? String(r[7]).trim() : DEFAULT_FOOD, status: String(r[5] || '').trim(), note: String(r[6] || '').trim() });
    }
  });
  list.sort(function (a, b) { return b.time - a.time; });
  return list;
}

function getToday_(records) {
  const tz = Session.getScriptTimeZone();
  const dayKey = function (ms) { return Utilities.formatDate(new Date(ms), tz, 'yyyy-MM-dd'); };
  const today = dayKey(Date.now());
  let total = 0, count = 0, can = 0;
  records.forEach(function (r) { if (dayKey(r.time) === today) { total += r.amount; count++; if (r.food !== DEFAULT_FOOD) can++; } });
  return { date: Utilities.formatDate(new Date(), tz, 'M/d'), total: Math.round(total * 10) / 10, count: count, can: can };
}

function toTime_(v) {
  if (v && typeof v.getTime === 'function') { const t = v.getTime(); return isNaN(t) ? 0 : t; }
  if (typeof v === 'number') return v > 1e12 ? v : 0;
  if (typeof v !== 'string') return 0;
  const s = v.trim(); if (!s) return 0;
  const upper = s.toUpperCase();
  const isPM = s.indexOf('下午') !== -1 || upper.indexOf('PM') !== -1;
  const isAM = s.indexOf('上午') !== -1 || upper.indexOf('AM') !== -1;
  const nums = []; let cur = '';
  for (let i = 0; i < s.length; i++) { const ch = s.charAt(i); if (ch >= '0' && ch <= '9') cur += ch; else if (cur) { nums.push(Number(cur)); cur = ''; } }
  if (cur) nums.push(Number(cur));
  if (nums.length < 3 || nums[0] < 2000) return 0;
  let hour = nums.length > 3 ? nums[3] : 0;
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  const d = new Date(nums[0], nums[1] - 1, nums[2], hour, nums[4] || 0, nums[5] || 0);
  const t = d.getTime(); return isNaN(t) ? 0 : t;
}
