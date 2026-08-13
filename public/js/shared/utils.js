import { TYPE_META } from './constants.js';

export function normalizePlate(value) {
    return String(value || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
}

export function normalizeSearch(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function getTypeLabel(type) {
    return TYPE_META[type]?.label || type || 'Auto';
}

export function getTypeIcon(type) {
    return TYPE_META[type]?.icon || 'car-front';
}

export function minutesBetween(start, end) {
    return Math.max(0, Math.ceil((new Date(end) - new Date(start)) / 60000));
}

export function crossesDate(start, end) {
    return toDateInputValue(start) !== toDateInputValue(end);
}

export function sameLocalDay(value, day) {
    return toDateInputValue(value) === toDateInputValue(day);
}

export function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

export function endOfDay(value) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
}

export function parseDateInput(value, end = false) {
    if (!value) return end ? endOfDay(new Date()) : startOfDay(new Date());
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return end ? endOfDay(date) : startOfDay(date);
}

export function toDateInputValue(value) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function sum(values) {
    return roundMoney(values.reduce((acc, value) => acc + (Number(value) || 0), 0));
}

export function readOptionMoney(value) {
    return Math.max(0, roundMoney(Number(value) || 0));
}

export function formatMoney(value, currency = 'S/') {
    return `${currency || 'S/'} ${roundMoney(value).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

export function formatTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(value) {
    if (!value) return '-';
    return `${formatDate(value)} ${formatTime(value)}`;
}

export function makeTicketId() {
    const now = new Date();
    const day = toDateInputValue(now).replace(/-/g, '');
    const suffix = String(now.getTime()).slice(-5);
    return `PM-${day}-${suffix}`;
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

export function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

export function toCsv(rows) {
    return rows.map(row => row.map(cell => {
        const text = String(cell ?? '');
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\n');
}

export function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

export function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
}

export function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

export function readMoneyInput(id) {
    return Math.max(0, roundMoney(Number(getValue(id)) || 0));
}

export function readPositiveIntegerInput(id, fallback) {
    const value = Number.parseInt(getValue(id), 10);
    return Number.isFinite(value) ? Math.max(fallback, value) : fallback;
}

export function refreshIcons() {
    document.querySelectorAll('i[data-lucide]').forEach(el => el.setAttribute('aria-hidden', 'true'));
    if (window.lucide) window.lucide.createIcons();
    document.querySelectorAll('svg[data-lucide]').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
}

export function getFocusable(container) {
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from((container || document).querySelectorAll(selector))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
}

export function cycleFocus(container, event) {
    const focusable = getFocusable(container);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
